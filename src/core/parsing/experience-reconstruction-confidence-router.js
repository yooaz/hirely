/**
 * P4 — EXPERIENCE_RECONSTRUCTION_ENGINE confidence routing.
 *
 * Scans entire document → candidate experiences (company, role, date).
 * Routes by confidence — never discard:
 *   > 80  → auto-add experiences
 *   40–80 → review queue
 *   < 40  → unsorted
 */

import { isSectionHeaderLine } from './rich-parser.js';
import { mergeUnsortedLines } from './no-data-loss.js';
import { normalizeReviewItem, mergeReviewQueues } from './review-queue-merge.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import {
  reconstructExperienceEntries,
  scoreExperienceConfidence,
  formatExperienceForCvData,
  EXPERIENCE_RECONSTRUCTION_ENGINE,
} from './experience-reconstruction-engine.js';
import { reconstructExperiencesFromRawText } from './experience-reconstruction-engine-v2.js';
import { DATE_RANGE_RE, lineLooksLikeCareerHistory } from './generic-career-signals.js';

export const EXPERIENCE_RECONSTRUCTION_CONFIDENCE_ROUTER = 'EXPERIENCE_RECONSTRUCTION_CONFIDENCE_ROUTER';
export const EXPERIENCE_CONFIDENCE_AUTO_MIN = 80;
export const EXPERIENCE_CONFIDENCE_REVIEW_MIN = 40;

/**
 * @param {number} confidence 0–99
 * @returns {'auto'|'review'|'unsorted'}
 */
export function classifyExperienceConfidenceTier(confidence) {
  const c = Number(confidence) || 0;
  if (c > EXPERIENCE_CONFIDENCE_AUTO_MIN) return 'auto';
  if (c >= EXPERIENCE_CONFIDENCE_REVIEW_MIN) return 'review';
  return 'unsorted';
}

function normKey(entry) {
  return [
    String(entry?.role || '').toLowerCase(),
    String(entry?.company || '').toLowerCase(),
    String(entry?.startDate || entry?.dates || '').replace(/\D/g, '').slice(0, 8),
  ].join('|');
}

function yearAnchor(entry) {
  const d = String(entry?.startDate || entry?.dates || '').match(/\b((?:19|20)\d{2})\b/);
  return d ? d[1] : '';
}

function companyStem(company) {
  const c = String(company || '').toLowerCase();
  const tokens = c.match(/\b[a-zà-ÿ]{4,}\b/gi) || [];
  const stop = new Set([
    'internship',
    'summer',
    'present',
    'designer',
    'illustrator',
    'director',
    'freelance',
    'independent',
  ]);
  const hit = tokens.find((t) => !stop.has(t.toLowerCase()));
  return (hit || tokens[0] || c).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18);
}

/**
 * Collapse duplicate candidates from multi-pass scan (same employer + year).
 * @param {object[]} candidates
 */
export function dedupeExperienceCandidates(candidates = []) {
  const out = [];
  for (const c of candidates) {
    const stem = companyStem(c.company);
    const year = yearAnchor(c);
    let replaced = false;

    for (let i = 0; i < out.length; i++) {
      const o = out[i];
      const sameKey = normKey(o) === normKey(c);
      const sameEmployer =
        stem.length >= 4 &&
        year &&
        companyStem(o.company) === stem &&
        yearAnchor(o) === year;

      if (sameKey || sameEmployer) {
        if ((c.confidence || 0) > (o.confidence || 0)) out[i] = c;
        replaced = true;
        break;
      }
    }
    if (!replaced) out.push(c);
  }
  return out;
}

function isValidExperienceCandidate(entry) {
  const role = String(entry?.role || '').trim();
  const company = String(entry?.company || '').trim();
  if (!role && !company) return false;
  if (/^(19|20)\d{2}$/.test(role) || /^(19|20)\d{2}$/.test(company)) return false;
  if (/^(present|présent|current|now)$/i.test(role) || /^(present|présent|current|now)$/i.test(company)) {
    return false;
  }
  const hasDate =
    Boolean(entry?.startDate || entry?.dates) ||
    DATE_RANGE_RE.test(String(entry?.sourceLine || ''));
  if (!hasDate) return false;
  if (role.length < 2 && company.length < 3) return false;
  if (company.length > 52) return false;
  if ((company.match(/internship/gi) || []).length > 1) return false;
  return true;
}

function candidateFromEntry(entry, sourceLine = '') {
  const line = String(sourceLine || formatExperienceForCvData(entry) || '').trim();
  const confidence = scoreExperienceConfidence(entry, line);
  return {
    ...entry,
    confidence,
    sourceLine: line || formatExperienceForCvData(entry),
  };
}

function buildReviewItemForCandidate(candidate) {
  const line = String(candidate.sourceLine || formatExperienceForCvData(candidate) || '').trim();
  if (!line) return null;
  return normalizeReviewItem({
    field: 'experiences',
    detectedType: 'experience',
    detected: line,
    sourceText: line,
    sourceLines: [line],
    confidence: candidate.confidence,
    reason: 'Experience candidate needs confirmation (confidence 40–80%)',
    suggestion: 'Accept as experience, edit fields, or reclassify',
    status: 'pending',
    possibleCategories: ['experiences', 'clients', 'projects', 'unsorted'],
    requiresUserChoice: true,
    experienceReconstructionP4: true,
    role: candidate.role,
    company: candidate.company,
    dates: candidate.dates || candidate.startDate,
  });
}

/**
 * Heuristic count of experience anchors in raw document (for acceptance).
 * @param {string} rawText
 */
export function countExpectedExperiencesInDocument(rawText) {
  const raw = String(rawText || '').trim();
  if (!raw) return 0;

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 8 && !isSectionHeaderLine(l));

  let anchorLines = 0;
  for (const line of lines) {
    const hasDate = DATE_RANGE_RE.test(line) || /\b(19|20)\d{2}\b/.test(line);
    if (!hasDate) continue;
    if (lineLooksLikeCareerHistory(line) || /\s+[-–—]\s+/.test(line)) anchorLines++;
  }

  const reconstructed = reconstructExperienceEntries(lines.filter((l) => DATE_RANGE_RE.test(l) || /\b(19|20)\d{2}\b/.test(l)));
  const v2 = reconstructExperiencesFromRawText(raw);

  return Math.max(anchorLines, reconstructed.count, v2.experiences.length);
}

/**
 * Full-document scan → scored experience candidates.
 * @param {string} rawText
 * @param {object} [opts]
 */
export function scanDocumentExperienceCandidates(rawText, opts = {}) {
  const raw = String(rawText || '').trim();
  const candidates = [];
  const seen = new Set();

  const push = (entry, sourceLine) => {
    if (!entry) return;
    const c = candidateFromEntry(entry, sourceLine);
    if (!isValidExperienceCandidate(c)) return;
    const key = normKey(c);
    if (!key.replace(/\|/g, '').length || seen.has(key)) return;
    seen.add(key);
    candidates.push(c);
  };

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 8 && !isSectionHeaderLine(l));

  const inline = reconstructExperienceEntries(lines);
  for (const e of inline.entries || []) push(e, formatExperienceForCvData(e));

  const v2 = reconstructExperiencesFromRawText(raw, opts);
  for (const e of v2.experiences || []) push(e, formatExperienceForCvData(e));

  for (const item of opts.existingExperiences || []) {
    if (typeof item === 'string') {
      const rebuilt = reconstructExperienceEntries([item]);
      for (const e of rebuilt.entries || []) push(e, item);
    } else {
      push(item, formatExperienceForCvData(item));
    }
  }

  const deduped = dedupeExperienceCandidates(candidates);

  return {
    candidates: deduped,
    stats: {
      scannedLines: lines.length,
      v2Recovered: v2.experiences?.length || 0,
      inlineRecovered: inline.count || 0,
      rawCandidates: candidates.length,
      totalCandidates: deduped.length,
    },
  };
}

/**
 * Route candidates by confidence tier.
 * @param {object[]} candidates
 */
export function routeExperienceCandidatesByConfidence(candidates = []) {
  const experiences = [];
  const reviewQueue = [];
  const unsorted = [];
  const tiers = { auto: 0, review: 0, unsorted: 0 };

  for (const candidate of candidates) {
    const tier = classifyExperienceConfidenceTier(candidate.confidence);
    tiers[tier] += 1;

    if (tier === 'auto') {
      const { sourceLine, ...entry } = candidate;
      experiences.push({
        ...entry,
        reconstructionSource: EXPERIENCE_RECONSTRUCTION_ENGINE,
        confidenceTier: 'auto',
      });
      continue;
    }

    if (tier === 'review') {
      const item = buildReviewItemForCandidate(candidate);
      if (item) reviewQueue.push(item);
      continue;
    }

    const line = String(candidate.sourceLine || formatExperienceForCvData(candidate) || '').trim();
    if (line) unsorted.push(line);
  }

  return { experiences, reviewQueue, unsorted, tiers };
}

/**
 * P4 orchestrator — search document, score, route; never discard.
 * @param {object} structured
 * @param {string} rawText
 * @param {object} [opts]
 */
export function runExperienceReconstructionEngine(structured, rawText, opts = {}) {
  if (!structured || typeof structured !== 'object') {
    return {
      structured,
      experiences: [],
      reviewQueue: [],
      unsorted: [],
      expectedCount: 0,
      accountedCount: 0,
      stats: {},
    };
  }

  const raw = String(rawText || structured?.metadata?.rawText || '').trim();
  const existing = structured.experiences || [];

  const scan = scanDocumentExperienceCandidates(raw, {
    ...opts,
    existingExperiences: existing,
  });

  const routed = routeExperienceCandidatesByConfidence(scan.candidates);
  const mergedExperiences = mergeExperienceLists([], routed.experiences);
  const mergedReview = mergeReviewQueues(structured.reviewQueue || [], routed.reviewQueue);
  const mergedUnsorted = mergeUnsortedLines(structured.unsorted || [], routed.unsorted);

  const expectedCount = countExpectedExperiencesInDocument(raw);
  const accountedCount =
    mergedExperiences.length +
    mergedReview.filter((r) => r?.field === 'experiences' || r?.detectedType === 'experience').length +
    mergedUnsorted.length;

  structured.experiences = mergedExperiences;
  structured.reviewQueue = mergedReview;
  structured.unsorted = mergedUnsorted;
  structured.metadata = {
    ...(structured.metadata || {}),
    experienceReconstructionP4: {
      engine: EXPERIENCE_RECONSTRUCTION_CONFIDENCE_ROUTER,
      baseEngine: EXPERIENCE_RECONSTRUCTION_ENGINE,
      expectedCount,
      accountedCount,
      autoCount: routed.tiers.auto,
      reviewCount: routed.tiers.review,
      unsortedCount: routed.tiers.unsorted,
      neverDiscard: true,
      confidenceTiers: {
        autoMin: EXPERIENCE_CONFIDENCE_AUTO_MIN,
        reviewMin: EXPERIENCE_CONFIDENCE_REVIEW_MIN,
      },
      stats: scan.stats,
    },
  };

  hirelyDebugLog('EXPERIENCE_RECONSTRUCTION_ENGINE_P4', {
    expectedCount,
    accountedCount,
    auto: routed.tiers.auto,
    review: routed.tiers.review,
    unsorted: routed.tiers.unsorted,
  });

  return {
    structured,
    experiences: mergedExperiences,
    reviewQueue: mergedReview,
    unsorted: mergedUnsorted,
    expectedCount,
    accountedCount,
    tiers: routed.tiers,
    stats: scan.stats,
  };
}

function mergeExperienceLists(existing, incoming) {
  const out = [...(existing || [])];
  const seen = new Set(out.map(normKey));

  for (const candidate of incoming || []) {
    if (!candidate?.role && !candidate?.company && !candidate?.startDate) continue;
    const key = normKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }

  return out.slice(0, 32);
}
