/**
 * V1 extraction honest mode — weak OCR must not fabricate clean sections.
 */
import { OCR_CONFIDENCE_WARN_THRESHOLD } from '../extraction/ocr-quality-score.js';
import { isOcrNoiseLine } from '../parsing/ocr-cleanup.js';
import { isCorruptEducationLine } from '../parsing/education-confidence.js';
import {
  dedupeEducationEntries,
  isEducationGarbageLine,
} from './ocr-cleanup-pipeline.js';

export const EXTRACTION_HONEST_MODE_VERSION = 'EXTRACTION_HONEST_MODE_V1';
export const EXTRACTED_VERIFY_LABEL = 'Contenu extrait à vérifier';
export const PARTIAL_READ_WARNING = 'Lecture partielle — vérifiez les lignes extraites.';

function cloneResume(rd) {
  try {
    return structuredClone(rd);
  } catch {
    return JSON.parse(JSON.stringify(rd || {}));
  }
}

function normKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * @param {number} score
 */
export function isWeakOcrQuality(score) {
  const n = Number(score);
  return Number.isFinite(n) && n < OCR_CONFIDENCE_WARN_THRESHOLD;
}

/**
 * @param {object} [opts]
 */
export function shouldUseExtractionHonestMode(opts = {}) {
  if (opts.honestMode === true) return true;
  if (opts.lowOcr === true) return true;
  return isWeakOcrQuality(opts.ocrConfidence);
}

/**
 * @param {string} line
 */
export function isConfidentExtractedLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 3) return false;
  if (isEducationGarbageLine(l) || isOcrNoiseLine(l) || isCorruptEducationLine(l)) return false;
  if (/^[\W|•*#@]{1,6}$/.test(l)) return false;
  if (l.length < 14 && !/\b(19|20)\d{2}\b/.test(l) && !/@/.test(l) && !/\b(illustrator|designer|freelance|manager|director|bachelor|master|licence|diploma)\b/i.test(l)) {
    const words = l.match(/[A-Za-zÀ-ÿ]{2,}/g) || [];
    if (words.length <= 1) return false;
  }
  return true;
}

/**
 * @param {string[]} lines
 */
export function partitionLinesByConfidence(lines) {
  const confident = [];
  const uncertain = [];
  const seen = new Set();
  for (const line of lines || []) {
    const t = String(line || '').trim();
    const key = normKey(t);
    if (!t || seen.has(key)) continue;
    seen.add(key);
    if (isConfidentExtractedLine(t)) confident.push(t);
    else uncertain.push(t);
  }
  return { confident, uncertain };
}

function lineTextFromEducationEntry(entry) {
  if (typeof entry === 'string') return String(entry).trim();
  const parts = [entry?.degree, entry?.school, entry?.dates, ...(entry?.bullets || [])].filter(Boolean);
  return parts.join(' — ').trim();
}

function harvestUncertainFromSections(rd) {
  const uncertain = [];
  const keep = {
    experiences: [],
    education: [],
    skills: [],
    tools: [],
    clients: [],
    languages: [],
    summary: '',
  };

  for (const exp of rd.experiences || []) {
    if (typeof exp === 'string') {
      if (isConfidentExtractedLine(exp)) keep.experiences.push(exp);
      else uncertain.push(String(exp).trim());
      continue;
    }
    const bullets = [];
    for (const b of exp.bullets || []) {
      const t = String(b || '').trim();
      if (isConfidentExtractedLine(t)) bullets.push(b);
      else if (t) uncertain.push(t);
    }
    const role = String(exp.role || '').trim();
    const company = String(exp.company || '').trim();
    const cleanRole = isConfidentExtractedLine(role) ? role : role ? (uncertain.push(role), '') : '';
    const cleanCompany = isConfidentExtractedLine(company) ? company : company ? (uncertain.push(company), '') : '';
    if (cleanRole || cleanCompany || bullets.length || exp.dates) {
      keep.experiences.push({ ...exp, role: cleanRole, company: cleanCompany, bullets });
    }
  }

  for (const entry of rd.education || []) {
    const line = lineTextFromEducationEntry(entry);
    if (isConfidentExtractedLine(line)) keep.education.push(entry);
    else if (line) uncertain.push(line);
  }

  for (const key of ['skills', 'tools', 'clients', 'languages']) {
    const part = partitionLinesByConfidence(rd[key] || []);
    keep[key] = part.confident;
    uncertain.push(...part.uncertain);
  }

  const summaryPart = partitionLinesByConfidence(String(rd.summary || '').split('\n').filter(Boolean));
  keep.summary = summaryPart.confident.join('\n').trim();
  uncertain.push(...summaryPart.uncertain);

  return { keep, uncertain: [...new Set(uncertain.map((x) => String(x).trim()).filter(Boolean))] };
}

/**
 * Strip aggressive fills; route uncertain content to verify bucket.
 * @param {object} resumeData
 * @param {{ ocrConfidence?: number }} [opts]
 */
export function applyExtractionHonestMode(resumeData, opts = {}) {
  if (!shouldUseExtractionHonestMode(opts)) return resumeData;

  const rd = cloneResume(resumeData);
  const pipelineUncertain = [...(rd.meta?.verifyContent || [])];
  const harvested = harvestUncertainFromSections(rd);

  rd.experiences = harvested.keep.experiences;
  rd.education = dedupeEducationEntries(harvested.keep.education);
  rd.skills = harvested.keep.skills;
  rd.tools = harvested.keep.tools;
  rd.clients = harvested.keep.clients;
  rd.languages = harvested.keep.languages;
  rd.summary = harvested.keep.summary;

  const verifySet = new Set();
  const verifyLines = [];
  const addVerify = (text) => {
    const t = String(text || '').trim();
    const key = normKey(t);
    if (!t || verifySet.has(key)) return;
    verifySet.add(key);
    verifyLines.push(t);
  };

  for (const t of pipelineUncertain) addVerify(t);
  for (const t of harvested.uncertain) addVerify(t);
  for (const t of rd.unsorted || []) {
    if (!isConfidentExtractedLine(t)) addVerify(t);
  }

  rd.unsorted = verifyLines;
  rd.meta = {
    ...(rd.meta || {}),
    extractionHonestMode: true,
    extractionHonestVersion: EXTRACTION_HONEST_MODE_VERSION,
    partialReadWarning: PARTIAL_READ_WARNING,
    verifyContent: verifyLines.length ? verifyLines : undefined,
    verifyContentLabel: EXTRACTED_VERIFY_LABEL,
    ocrConfidence: Number.isFinite(Number(opts.ocrConfidence)) ? Number(opts.ocrConfidence) : rd.meta?.ocrConfidence,
    warnings: [
      ...new Set([...(rd.meta?.warnings || []), 'EXTRACTION_HONEST_MODE', ...(verifyLines.length ? ['OCR_PARTIAL_READ'] : [])]),
    ],
  };

  if (!String(rd.identity?.title || '').trim()) {
    rd.identity = { ...(rd.identity || {}), title: '' };
  }

  return rd;
}

/**
 * Honest text-first build — only confident lines enter structured sections.
 * @param {object} parts
 */
export function buildHonestResumeFromTextParts(parts) {
  const {
    clean = '',
    lines = [],
    name = 'Nom à vérifier',
    title = '',
    contact = {},
    buckets = {},
    pipelineUncertain = [],
    ocrConfidence = null,
  } = parts;

  const verifySet = new Set();
  const verifyLines = [];
  const addVerify = (text) => {
    const t = String(text || '').trim();
    const key = normKey(t);
    if (!t || verifySet.has(key)) return;
    verifySet.add(key);
    verifyLines.push(t);
  };

  for (const t of pipelineUncertain) addVerify(t);

  const summaryPart = partitionLinesByConfidence(buckets.summary || []);
  const expPart = partitionLinesByConfidence(buckets.experiences || []);
  const eduPart = partitionLinesByConfidence(buckets.education || []);
  const skillsPart = partitionLinesByConfidence(buckets.skills || []);
  const toolsPart = partitionLinesByConfidence(buckets.tools || []);
  const clientsPart = partitionLinesByConfidence(buckets.clients || []);
  const bodyPart = partitionLinesByConfidence(
    (buckets.body || []).length
      ? buckets.body
      : lines.filter((l) => l !== name && l !== title)
  );

  [summaryPart, expPart, eduPart, skillsPart, toolsPart, clientsPart, bodyPart].forEach((p) => {
    p.uncertain.forEach(addVerify);
  });

  const parseExperiences = (confidentLines) => {
    const bullets = confidentLines
      .map((l) => String(l).replace(/^[-•*▪◦]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 48);
    if (!bullets.length) return [];
    return [{ role: '', company: '', dates: '', bullets }];
  };

  const parseSkills = (confidentLines) => {
    const joined = confidentLines.join(' ');
    const comma = joined
      .split(/[,;|•]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 64 && isConfidentExtractedLine(s));
    if (comma.length >= 2) return comma.slice(0, 48);
    return confidentLines.filter(isConfidentExtractedLine).slice(0, 48);
  };

  const parseEducation = (confidentLines) => {
    const bullets = confidentLines
      .map((l) => String(l).replace(/^[-•*▪◦]\s*/, '').trim())
      .filter((l) => l && !isEducationGarbageLine(l) && isConfidentExtractedLine(l));
    if (!bullets.length) return [];
    return dedupeEducationEntries(
      bullets.slice(0, 24).map((line) => {
        const parts = line.split(/\s*[–—-]\s*|\s*,\s*/);
        return {
          degree: parts[0] || line,
          school: parts[1] || '',
          dates: parts[2] || '',
          bullets: parts.length > 3 ? parts.slice(3) : [],
        };
      })
    );
  };

  const summary = summaryPart.confident.join('\n').slice(0, 1200);

  return {
    identity: {
      name: isConfidentExtractedLine(name) ? name : name && name !== 'Nom à vérifier' ? name : 'Nom à vérifier',
      title: isConfidentExtractedLine(title) ? title : String(title || '').trim(),
      email: contact.email || '',
      phone: contact.phone || '',
      location: '',
      website: contact.website || '',
      linkedin: contact.linkedin || '',
    },
    summary,
    experiences: parseExperiences(expPart.confident),
    education: parseEducation(eduPart.confident),
    clients: parseSkills(clientsPart.confident),
    projects: [],
    exhibitions: [],
    awards: [],
    publications: [],
    press: [],
    portfolioLinks: [],
    skills: parseSkills(skillsPart.confident),
    tools: parseSkills(toolsPart.confident),
    languages: [],
    unsorted: verifyLines,
    meta: {
      textFirstEngine: true,
      ocrCleanupPipeline: true,
      extractionHonestMode: true,
      extractionHonestVersion: EXTRACTION_HONEST_MODE_VERSION,
      engineVersion: parts.engineVersion,
      source: 'createResumeFromText',
      charCount: String(clean).length,
      verifyContent: verifyLines.length ? verifyLines : undefined,
      verifyContentLabel: EXTRACTED_VERIFY_LABEL,
      partialReadWarning: PARTIAL_READ_WARNING,
      ocrConfidence: Number.isFinite(Number(ocrConfidence)) ? Number(ocrConfidence) : undefined,
      ocrCleanup: parts.pipelineMeta,
      warnings: ['EXTRACTION_HONEST_MODE', 'OCR_PARTIAL_READ'],
      errors: [],
    },
  };
}
