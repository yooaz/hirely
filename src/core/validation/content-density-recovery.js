/**
 * P0 — CV content density recovery: rawText vs finalResumeData.
 * Detected section lines must land in finalResumeData or reviewQueue — never vanish.
 */

import { flattenFinalResumePreviewText } from './cv-completeness-audit.js';
import { mergeUnsortedLines } from '../parsing/no-data-loss.js';
import { mergeReviewQueues } from '../parsing/review-queue-merge.js';
import { parseExperienceString } from '../parsing/structured-resume.js';
import {
  parseUrlMergedExperienceLine,
  parseFreelanceCareerLine,
} from '../parsing/classification-fixes.js';
import { extractCleanClientBrands } from '../parsing/resume-output-quality.js';
import { isValidListItem, isValidEducationItem } from '../parsing/field-sanitize.js';
import { isSectionHeaderLine } from '../parsing/rich-parser.js';
import { dedupeExperienceEntries, experienceDedupeKey } from '../parsing/dedupe-engine.js';
import {
  buildMicroGarbageReviewItem,
  sanitizeLanguageLine,
} from './ocr-micro-garbage-cleanup.js';

export const CONTENT_DENSITY_RECOVERY_V1 = 'CONTENT_DENSITY_RECOVERY_V1';
export const CONTENT_DENSITY_MIN_PCT = 55;

const SECTION_HEADER_RES = Object.freeze({
  experience: /^(experience|expériences?|work experience|professional experience|emploi|parcours)\b/i,
  education: /^(education|formation|formations?|studies|academic)\b/i,
  skills: /^(skills?|compétences?|expertise|software)\b/i,
  tools: /^(tools?|outils|logiciels)\b/i,
  clients: /^(clients?|customers?|brands?|marques)\b/i,
  projects: /^(projects?|projets)\b/i,
  portfolio: /^(portfolio|site web|website|liens|links)\b/i,
  languages: /^(languages?|langues)\b/i,
});

const DATE_IN_LINE_RE =
  /\b(19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|now|aujourd'?hui|\d{4})\b/i;

function normLine(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normKey(s) {
  return normLine(s).replace(/[^\p{L}\p{N}\s]/gu, '');
}

/**
 * @param {string} rawText
 */
export function parseRawSectionLines(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  /** @type {Record<string, string[]>} */
  const sections = {
    experience: [],
    education: [],
    skills: [],
    tools: [],
    clients: [],
    projects: [],
    portfolio: [],
    languages: [],
    other: [],
  };
  let current = 'other';

  for (const line of lines) {
    let matchedHeader = false;
    for (const [key, re] of Object.entries(SECTION_HEADER_RES)) {
      if (re.test(line) && line.length < 48) {
        current = key;
        matchedHeader = true;
        break;
      }
    }
    if (matchedHeader) continue;
    if (isSectionHeaderLine(line)) continue;
    (sections[current] || sections.other).push(line);
  }

  return sections;
}

/**
 * @param {string} line
 * @param {string} blob
 */
export function lineAccountedInOutput(line, blob) {
  const k = normLine(line);
  if (!k || k.length < 3) return true;
  if (blob.includes(k)) return true;
  if (k.length >= 10) {
    const words = k.split(/\s+/).filter((w) => w.length > 2);
    if (words.length >= 2) {
      const hits = words.filter((w) => blob.includes(w)).length;
      if (hits / words.length >= 0.55) return true;
    }
  }
  return false;
}

/**
 * @param {object|null} finalResumeData
 * @param {object[]} [reviewQueue]
 */
export function buildAccountedBlob(finalResumeData, reviewQueue = []) {
  const preview = normLine(flattenFinalResumePreviewText(finalResumeData));
  const reviewBits = (reviewQueue || [])
    .flatMap((item) => [item?.sourceText, item?.detected, ...(item?.sourceLines || [])])
    .map((x) => normLine(x))
    .filter(Boolean)
    .join(' ');
  return `${preview} ${reviewBits}`.trim();
}

/**
 * @param {string} rawText
 * @param {object|null} finalResumeData
 * @param {object[]} [reviewQueue]
 */
export function auditContentDensity(rawText, finalResumeData, reviewQueue = []) {
  const raw = String(rawText || '').trim();
  const blob = buildAccountedBlob(finalResumeData, reviewQueue);
  const rawChars = Math.max(1, raw.length);
  const previewChars = flattenFinalResumePreviewText(finalResumeData).length;
  const previewDensityPct = Math.min(100, Math.round((previewChars / rawChars) * 1000) / 10);

  const sections = parseRawSectionLines(raw);
  const missingBySection = {};
  let missingTotal = 0;

  for (const [section, lines] of Object.entries(sections)) {
    if (section === 'other') continue;
    const missing = [];
    for (const line of lines) {
      if (line.length < 3) continue;
      if (lineAccountedInOutput(line, blob)) continue;
      missing.push(line);
    }
    if (missing.length) {
      missingBySection[section] = missing;
      missingTotal += missing.length;
    }
  }

  return {
    version: CONTENT_DENSITY_RECOVERY_V1,
    rawChars,
    previewChars,
    previewDensityPct,
    meetsDensityTarget: previewDensityPct >= CONTENT_DENSITY_MIN_PCT,
    missingBySection,
    missingTotal,
    sectionLineCounts: Object.fromEntries(
      Object.entries(sections).map(([k, v]) => [k, v.length])
    ),
  };
}

function splitListLine(line) {
  return String(line || '')
    .split(/\s*[,;·|]\s*|\s+-\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2 && x.length <= 56);
}

function buildDensityReviewItem(line, section, reason) {
  const text = String(line || '').trim();
  if (!text) return null;
  const fieldMap = {
    experience: 'experiences',
    education: 'education',
    clients: 'clients',
    tools: 'tools',
    projects: 'projects',
    portfolio: 'projects',
    skills: 'skills',
    languages: 'languages',
  };
  const field = fieldMap[section] || 'unknown';
  return {
    id: `density-${section}-${text.slice(0, 16).replace(/\W/g, '') || 'line'}`,
    field: field === 'experiences' ? 'experience' : field,
    section: field,
    sourceText: text,
    detected: text,
    status: 'pending',
    confidence: 62,
    category: 'density_recovery',
    reason: reason || 'Content detected in source — confirm placement',
    completenessAudit: true,
    densityRecovery: true,
  };
}

function mergeUniqueStrings(existing = [], incoming = [], max = 24) {
  const seen = new Set((existing || []).map((x) => normKey(x)));
  const out = [...(existing || [])];
  for (const raw of incoming) {
    const t = String(raw || '').trim();
    if (!t) continue;
    const k = normKey(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.slice(0, max);
}

function recoverExperienceLine(line, experiences) {
  const raw = String(line || '').trim();
  if (!raw || raw.length < 8) return null;

  const merged = parseUrlMergedExperienceLine(raw) || parseFreelanceCareerLine(raw);
  if (merged) {
    const key = experienceDedupeKey(merged);
    if ((experiences || []).some((e) => experienceDedupeKey(e) === key)) return null;
    return {
      ...merged,
      clients: [],
      location: '',
      bullets: merged.bullets || [],
    };
  }

  const parsed = parseExperienceString(raw);
  if (!parsed || (!parsed.role && !parsed.company)) return null;
  if (!DATE_IN_LINE_RE.test(raw) && !parsed.dates && !parsed.startDate) return null;
  const key = experienceDedupeKey(parsed);
  if ((experiences || []).some((e) => experienceDedupeKey(e) === key)) return null;
  return {
    role: parsed.role || '',
    company: parsed.company || '',
    location: parsed.location || '',
    startDate: parsed.startDate || '',
    endDate: parsed.endDate || '',
    dates: parsed.dates || '',
    bullets: parsed.bullets || [],
    clients: [],
  };
}

/**
 * Recover missing raw section content into finalResumeData or reviewQueue.
 * @param {string} rawText
 * @param {object|null} finalResumeData
 * @param {object[]} [reviewQueue]
 * @param {{ cleanedText?: string }} [opts]
 */
export function applyContentDensityRecovery(rawText, finalResumeData, reviewQueue = [], opts = {}) {
  if (!finalResumeData || typeof finalResumeData !== 'object') {
    return {
      finalResumeData,
      reviewItems: [],
      audit: auditContentDensity(rawText, finalResumeData, reviewQueue),
      stats: { recovered: 0, queued: 0 },
    };
  }

  const source = String(opts.cleanedText || rawText || '').trim();
  let frd = { ...finalResumeData };
  frd.identity = { ...(frd.identity || {}) };
  frd.experiences = [...(frd.experiences || [])];
  frd.education = [...(frd.education || [])];
  frd.skills = [...(frd.skills || [])];
  frd.tools = [...(frd.tools || [])];
  frd.languages = [...(frd.languages || [])];
  frd.clients = [...(frd.clients || [])];
  frd.projects = [...(frd.projects || [])];
  frd.suggestions = [...(frd.suggestions || [])];

  const auditBefore = auditContentDensity(source, frd, reviewQueue);
  const reviewItems = [];
  let recovered = 0;
  let queued = 0;

  const tryRecover = (section, lines) => {
    let blob = buildAccountedBlob(frd, mergeReviewQueues(reviewQueue, reviewItems));
    for (const line of lines) {
      if (lineAccountedInOutput(line, blob)) continue;

      if (section === 'experience') {
        const exp = recoverExperienceLine(line, frd.experiences);
        if (exp) {
          frd.experiences.push(exp);
          recovered += 1;
          blob = buildAccountedBlob(frd, mergeReviewQueues(reviewQueue, reviewItems));
          continue;
        }
      }

      if (section === 'education' && isValidEducationItem(line)) {
        frd.education = mergeUniqueStrings(frd.education, [line], 12);
        recovered += 1;
        blob = buildAccountedBlob(frd, mergeReviewQueues(reviewQueue, reviewItems));
        continue;
      }

      if (section === 'clients') {
        const brands = extractCleanClientBrands(splitListLine(line), [line]);
        const merged = mergeUniqueStrings(frd.clients, brands.length ? brands : splitListLine(line), 20);
        if (merged.length > frd.clients.length) {
          frd.clients = merged;
          recovered += 1;
          blob = buildAccountedBlob(frd, mergeReviewQueues(reviewQueue, reviewItems));
          continue;
        }
      }

      if (section === 'tools' || section === 'skills') {
        const items = splitListLine(line).filter((x) => isValidListItem(x));
        if (items.length) {
          if (section === 'tools') frd.tools = mergeUniqueStrings(frd.tools, items, 16);
          else frd.skills = mergeUniqueStrings(frd.skills, items, 20);
          recovered += 1;
          blob = buildAccountedBlob(frd, mergeReviewQueues(reviewQueue, reviewItems));
          continue;
        }
      }

      if (section === 'languages') {
        const accepted = [];
        for (const candidate of splitListLine(line)) {
          if (candidate.length > 48) continue;
          const result = sanitizeLanguageLine(candidate);
          if (result.ok && result.display) {
            accepted.push(result.display);
            continue;
          }
          const review = buildMicroGarbageReviewItem(
            result.source || candidate,
            'languages',
            'languages',
            result.reason === 'polluted_language'
              ? 'Polluted language line (OCR fragment) — confirm language'
              : 'Language line below confidence — confirm language'
          );
          if (review) {
            reviewItems.push(review);
            queued += 1;
          }
        }
        if (accepted.length) {
          frd.languages = mergeUniqueStrings(frd.languages, accepted, 8);
          recovered += 1;
          blob = buildAccountedBlob(frd, mergeReviewQueues(reviewQueue, reviewItems));
          continue;
        }
      }

      if (section === 'projects' || section === 'portfolio') {
        const items = splitListLine(line).filter((x) => x.length >= 3 && x.length <= 80);
        if (items.length) {
          frd.projects = mergeUniqueStrings(frd.projects, items, 16);
          recovered += 1;
          blob = buildAccountedBlob(frd, mergeReviewQueues(reviewQueue, reviewItems));
          continue;
        }
      }

      const item = buildDensityReviewItem(line, section);
      if (item) {
        reviewItems.push(item);
        queued += 1;
        blob = buildAccountedBlob(frd, mergeReviewQueues(reviewQueue, reviewItems));
      }
    }
  };

  for (const [section, lines] of Object.entries(auditBefore.missingBySection)) {
    tryRecover(section, lines);
  }

  frd.experiences = dedupeExperienceEntries(frd.experiences);

  let auditAfter = auditContentDensity(source, frd, mergeReviewQueues(reviewQueue, reviewItems));
  if (!auditAfter.meetsDensityTarget) {
    const blob = buildAccountedBlob(frd, mergeReviewQueues(reviewQueue, reviewItems));
    const orphanLines = source
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 4 && !isSectionHeaderLine(l) && !lineAccountedInOutput(l, blob));
    if (orphanLines.length) {
      frd.suggestions = mergeUnsortedLines(frd.suggestions || [], orphanLines);
      for (const line of orphanLines.slice(0, 12)) {
        if (lineAccountedInOutput(line, buildAccountedBlob(frd, mergeReviewQueues(reviewQueue, reviewItems)))) {
          continue;
        }
        const item = buildDensityReviewItem(line, 'unknown', 'Unclassified source line — confirm section');
        if (item) {
          reviewItems.push(item);
          queued += 1;
        }
      }
      auditAfter = auditContentDensity(source, frd, mergeReviewQueues(reviewQueue, reviewItems));
    }
  }

  frd.quality = {
    ...(frd.quality || {}),
    contentDensity: {
      version: CONTENT_DENSITY_RECOVERY_V1,
      previewDensityPct: auditAfter.previewDensityPct,
      meetsTarget: auditAfter.meetsDensityTarget,
      targetPct: CONTENT_DENSITY_MIN_PCT,
      recovered,
      queued,
      missingTotal: auditAfter.missingTotal,
    },
  };

  return {
    finalResumeData: frd,
    reviewItems: mergeReviewQueues(reviewQueue, reviewItems),
    audit: auditAfter,
    stats: { recovered, queued },
  };
}
