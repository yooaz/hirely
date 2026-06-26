/**
 * Raw text review mode — low OCR confidence: suspicious lines quarantined;
 * CV preview stays clean until the user keeps, deletes, or moves lines.
 */
import { isOcrNoiseLine } from '../parsing/ocr-cleanup.js';
import { isCorruptEducationLine } from '../parsing/education-confidence.js';
import { moveUnsortedToSection } from '../resume-data.js';
import {
  isEducationGarbageLine,
} from './ocr-cleanup-pipeline.js';
import { EXTRACTED_VERIFY_LABEL } from './extraction-honest-mode.js';

export const RAW_TEXT_REVIEW_VERSION = 'RAW_TEXT_REVIEW_V1';
export const LOW_OCR_CONFIDENCE_THRESHOLD = 60;
export const RAW_TEXT_VERIFY_LABEL = 'Texte à vérifier';

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

function lineTextFromEducationEntry(entry) {
  if (typeof entry === 'string') return String(entry).trim();
  const parts = [entry?.degree, entry?.school, entry?.dates, ...(entry?.bullets || [])].filter(Boolean);
  return parts.join(' — ').trim();
}

/**
 * @param {string} line
 * @param {{ lowOcr?: boolean }} [opts]
 */
export function isSuspiciousExtractedLine(line, opts = {}) {
  const l = String(line || '').trim();
  if (!l || l.length < 2) return true;
  if (isEducationGarbageLine(l) || isOcrNoiseLine(l) || isCorruptEducationLine(l)) return true;
  if (/^[\W|•*#@]{1,6}$/.test(l)) return true;
  if (opts.lowOcr && l.length < 12 && !/\b(19|20)\d{2}\b/.test(l) && !/@/.test(l)) {
    const words = l.match(/[A-Za-zÀ-ÿ]{2,}/g) || [];
    if (words.length <= 1) return true;
  }
  return false;
}

function collectFromUnsorted(rd, lowOcr) {
  const out = [];
  for (const line of rd.unsorted || []) {
    const t = String(line || '').trim();
    if (t && isSuspiciousExtractedLine(t, { lowOcr })) out.push(t);
  }
  return out;
}

function harvestFromEducation(rd) {
  const quarantine = [];
  const education = [];
  for (const entry of rd.education || []) {
    const line = lineTextFromEducationEntry(entry);
    const degree = String(entry?.degree || '').trim();
    const school = String(entry?.school || '').trim();
    if (
      isSuspiciousExtractedLine(line) ||
      isEducationGarbageLine(degree) ||
      isEducationGarbageLine(school) ||
      isCorruptEducationLine(line)
    ) {
      if (line) quarantine.push(line);
      continue;
    }
    education.push(entry);
  }
  return { quarantine, education };
}

function harvestFromExperiences(rd) {
  const quarantine = [];
  const experiences = [];
  for (const exp of rd.experiences || []) {
    if (typeof exp === 'string') {
      const t = String(exp).trim();
      if (isSuspiciousExtractedLine(t)) quarantine.push(t);
      else experiences.push(exp);
      continue;
    }
    const bullets = [];
    for (const b of exp.bullets || []) {
      const t = String(b || '').trim();
      if (isSuspiciousExtractedLine(t)) quarantine.push(t);
      else bullets.push(b);
    }
    const role = String(exp.role || '').trim();
    const company = String(exp.company || '').trim();
    if (isSuspiciousExtractedLine(role)) quarantine.push(role);
    if (isSuspiciousExtractedLine(company)) quarantine.push(company);
    const cleanRole = isSuspiciousExtractedLine(role) ? '' : role;
    const cleanCompany = isSuspiciousExtractedLine(company) ? '' : company;
    if (cleanRole || cleanCompany || bullets.length || exp.dates) {
      experiences.push({ ...exp, role: cleanRole, company: cleanCompany, bullets });
    }
  }
  return { quarantine, experiences };
}

function harvestFromStringList(list, lowOcr) {
  const quarantine = [];
  const keep = [];
  for (const item of list || []) {
    const t = String(item || '').trim();
    if (!t) continue;
    if (isSuspiciousExtractedLine(t, { lowOcr })) quarantine.push(t);
    else keep.push(item);
  }
  return { quarantine, keep };
}

/**
 * @param {object} resumeData
 * @param {{ lowOcr?: boolean }} [opts]
 */
export function buildVerifyQueueLines(resumeData, opts = {}) {
  const rd = resumeData || {};
  const lowOcr = !!opts.lowOcr;
  const seen = new Set();
  const lines = [];

  const add = (text, reason = 'suspicious') => {
    const t = String(text || '').trim();
    const key = normKey(t);
    if (!t || seen.has(key)) return;
    seen.add(key);
    lines.push({
      id: `rv-${lines.length}-${key.slice(0, 20).replace(/\W/g, '') || 'line'}`,
      text: t,
      reason,
      confidence: reason === 'ocr_uncertain' ? 35 : 45,
    });
  };

  for (const t of rd.meta?.verifyContent || []) add(t, 'ocr_uncertain');
  for (const t of collectFromUnsorted(rd, lowOcr)) add(t, 'unsorted');
  const edu = harvestFromEducation(rd);
  edu.quarantine.forEach((t) => add(t, 'education_garbage'));
  const exp = harvestFromExperiences(rd);
  exp.quarantine.forEach((t) => add(t, 'experience_garbage'));
  for (const key of ['skills', 'tools']) {
    const h = harvestFromStringList(rd[key], lowOcr);
    h.quarantine.forEach((t) => add(t, key === 'skills' ? 'skills_garbage' : 'tools_garbage'));
  }

  return {
    lines,
    harvested: {
      education: edu.education,
      experiences: exp.experiences,
      skills: harvestFromStringList(rd.skills, lowOcr).keep,
      tools: harvestFromStringList(rd.tools, lowOcr).keep,
    },
  };
}

/**
 * @param {{ ocrConfidence?: number, resumeData?: object }} [ctx]
 */
export function shouldActivateRawTextReviewMode({ ocrConfidence, resumeData } = {}) {
  const conf = Number(ocrConfidence);
  const lowOcr = Number.isFinite(conf) && conf < LOW_OCR_CONFIDENCE_THRESHOLD;
  if (!lowOcr && !(resumeData?.meta?.verifyContent || []).length) return false;
  const { lines } = buildVerifyQueueLines(resumeData, { lowOcr });
  return lines.length > 0;
}

/**
 * Strip suspicious lines from structured sections; build verify queue.
 * @param {object} resumeData
 * @param {{ ocrConfidence?: number }} [opts]
 */
export function bootstrapRawTextReview(resumeData, opts = {}) {
  const rd = cloneResume(resumeData);
  const conf = Number(opts.ocrConfidence);
  const lowOcr = Number.isFinite(conf) && conf < LOW_OCR_CONFIDENCE_THRESHOLD;

  if (!shouldActivateRawTextReviewMode({ ocrConfidence: conf, resumeData: rd })) {
    return { resumeData: rd, active: false, queueLength: 0 };
  }

  const built = buildVerifyQueueLines(rd, { lowOcr });
  rd.education = built.harvested.education;
  rd.experiences = built.harvested.experiences;
  rd.skills = built.harvested.skills;
  rd.tools = built.harvested.tools;

  const queueTexts = new Set(built.lines.map((l) => normKey(l.text)));
  rd.unsorted = (rd.unsorted || []).filter((l) => {
    const t = String(l || '').trim();
    return t && !queueTexts.has(normKey(t)) && !isSuspiciousExtractedLine(t, { lowOcr });
  });

  const verifyLabel = rd.meta?.extractionHonestMode
    ? EXTRACTED_VERIFY_LABEL
    : RAW_TEXT_VERIFY_LABEL;

  rd.meta = {
    ...(rd.meta || {}),
    rawTextReview: {
      version: RAW_TEXT_REVIEW_VERSION,
      active: true,
      label: verifyLabel,
      ocrConfidence: Number.isFinite(conf) ? conf : null,
      lowOcr,
      queue: built.lines,
    },
    verifyContentLabel: rd.meta?.verifyContentLabel || verifyLabel,
  };

  return { resumeData: rd, active: built.lines.length > 0, queueLength: built.lines.length };
}

/**
 * @param {object} resumeData
 */
export function getRawTextVerifyItems(resumeData) {
  const queue = resumeData?.meta?.rawTextReview?.queue || [];
  return queue
    .filter((it) => it && it.status !== 'deleted' && it.status !== 'kept')
    .map((it) => ({
      id: it.id,
      text: it.text,
      confidence: it.confidence ?? 40,
      reason: it.reason,
    }))
    .filter((x) => x.text);
}

function removeFromUnsorted(rd, text) {
  const key = normKey(text);
  rd.unsorted = (rd.unsorted || []).filter((l) => normKey(l) !== key);
}

/**
 * @param {object} resumeData
 * @param {string} itemId
 * @param {'keep'|'delete'|'ignore'|'move'} action
 * @param {string} [targetSection]
 */
export function applyRawTextVerifyAction(resumeData, itemId, action, targetSection) {
  const rd = cloneResume(resumeData);
  const queue = [...(rd.meta?.rawTextReview?.queue || [])];
  const idx = queue.findIndex((it) => it.id === itemId);
  if (idx < 0) return rd;

  const item = queue[idx];
  const text = String(item.text || '').trim();
  if (!text) return rd;

  if (action === 'delete' || action === 'ignore') {
    queue.splice(idx, 1);
    removeFromUnsorted(rd, text);
  } else if (action === 'keep') {
    queue.splice(idx, 1);
    removeFromUnsorted(rd, text);
    const key = normKey(text);
    if (!(rd.unsorted || []).some((l) => normKey(l) === key)) {
      rd.unsorted = [...(rd.unsorted || []), text];
    }
  } else if (action === 'move' && targetSection && targetSection !== 'ignore') {
    queue.splice(idx, 1);
    removeFromUnsorted(rd, text);
    const withLine = {
      ...rd,
      unsorted: [...(rd.unsorted || []), text],
    };
    const moved = moveUnsortedToSection(withLine, [text], targetSection);
    Object.assign(rd, moved);
  }

  const activeQueue = queue.filter((it) => it.status !== 'deleted');
  rd.meta = {
    ...(rd.meta || {}),
    rawTextReview: {
      ...(rd.meta?.rawTextReview || {}),
      queue: activeQueue,
      active: activeQueue.length > 0,
    },
  };

  return rd;
}

/**
 * Preview-safe resume — verify queue lines never appear in Formation / Experience.
 * @param {object} resumeData
 */
export function resumeDataForCleanPreview(resumeData) {
  const rd = cloneResume(resumeData);
  const queueTexts = new Set(
    (rd.meta?.rawTextReview?.queue || []).map((it) => normKey(it.text))
  );
  if (!queueTexts.size) return rd;

  const strip = (line) => !queueTexts.has(normKey(line));

  rd.education = (rd.education || []).filter((entry) => {
    const line = lineTextFromEducationEntry(entry);
    return line && strip(line) && !isSuspiciousExtractedLine(line);
  });
  rd.experiences = (rd.experiences || [])
    .map((exp) => {
      if (typeof exp === 'string') return strip(exp) ? exp : null;
      const bullets = (exp.bullets || []).filter((b) => strip(String(b || '')));
      const role = strip(String(exp.role || '')) ? exp.role : '';
      const company = strip(String(exp.company || '')) ? exp.company : '';
      if (!role && !company && !bullets.length && !exp.dates) return null;
      return { ...exp, role, company, bullets };
    })
    .filter(Boolean);
  rd.skills = (rd.skills || []).filter((s) => strip(String(s || '')));
  rd.tools = (rd.tools || []).filter((s) => strip(String(s || '')));

  return rd;
}
