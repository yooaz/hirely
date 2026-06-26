/**
 * FINAL_RESUME_DATA_CLEANUP — strip duplicates and parser garbage from finalResumeData.
 * No OCR. No PDF. No templates.
 */

import { normalizeEducationEntry } from '../parsing/education-normalization-layer.js';
import {
  dedupeEducationStrings,
  dedupeExperienceEntries,
  dedupeStringList,
  normalizeCompareString,
  normalizeDateCompareKey,
} from '../parsing/dedupe-engine.js';
import { applyFinalCvReadabilityPass } from './final-cv-readability.js';
import { stripSectionLabelLeakage } from './section-label-leakage-guard.js';
import { sanitizeLanguageLine } from './ocr-micro-garbage-cleanup.js';

export const FINAL_RESUME_DATA_CLEANUP = 'FINAL_RESUME_DATA_CLEANUP_V1';

const PARSER_GARBAGE_RE =
  /\b(id=|href=|src=|class=|data-[a-z]+=|instagram\.com|instagr\.am|linkedin\.com\/in\/|gclid=|fbclid=|mcid=|ref=|tracking)\b|utm_[a-z0-9_]+=/i;

const URL_RE = /https?:\/\/|www\.\w[\w.-]+\.\w{2,}/i;

const HASH_BLOB_RE = /\b[a-f0-9]{16,}\b/i;

const OCR_METADATA_RE =
  /\b(ocr_|page_\d|bbox_|confidence_|source_line_id|extraction_|parser_|_enterprise|_parserreview|_extractionreview)\b/i;

const OCR_FRAGMENT_RE =
  /\b(incision|wustrator|snoutors|illusthatch|gradric|mustrator|m[eE]\]|v3\s*2|20[MN]|@\s*man\b|ign\s+fin)\b/i;

const EDUCATION_URL_RE = /\binstagram\b|linkedin|https?:\/\/|www\.|@\w|\.com\/|\.be\/|href=/i;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} text
 */
export function isParserGarbage(text) {
  const s = normSpace(text);
  if (!s || s.length < 2) return true;
  if (PARSER_GARBAGE_RE.test(s)) return true;
  if (URL_RE.test(s)) return true;
  if (OCR_METADATA_RE.test(s)) return true;
  if (OCR_FRAGMENT_RE.test(s)) return true;
  if (/^id\s*=\s*["']?/i.test(s) || /^href\s*=\s*["']?/i.test(s)) return true;
  if (HASH_BLOB_RE.test(s) && !/\b(19|20)\d{2}\b/.test(s)) return true;
  return false;
}

/**
 * @param {string} text
 * @param {{ allowUrls?: boolean }} [opts]
 */
export function sanitizeFinalResumeText(text, opts = {}) {
  let s = normSpace(text);
  if (!s) return '';
  s = s
    .replace(/\bhref\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\bid\s*=\s*["'][^"']*["']/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/\s*[-–—]\s*[-–—]\s*/g, ' — ');
  s = normSpace(s);
  if (!opts.allowUrls && URL_RE.test(s)) return '';
  if (isParserGarbage(s)) return '';
  return s;
}

function educationSemanticKey(line, identity = {}) {
  const norm = normalizeEducationEntry(line, { identity });
  const school = normalizeCompareString(norm?.school || String(line).split(/\s*[—–-]\s*/)[0] || '');
  const program = normalizeCompareString(norm?.program || '');
  const years = normalizeDateCompareKey(
    norm?.years || (String(line).match(/\b(?:19|20)\d{2}\s*[-–—/]\s*(?:\d{4}|present|présent|current)\b/i) || [''])[0]
  );
  return `${school}|${program}|${years}`;
}

function dedupeEducationBySchoolTitleYears(education = [], identity = {}) {
  const byKey = new Map();
  for (const raw of education || []) {
    const cleaned = sanitizeFinalResumeText(raw);
    if (!cleaned || EDUCATION_URL_RE.test(cleaned) || isParserGarbage(cleaned)) continue;
    const key = educationSemanticKey(cleaned, identity);
    if (!key.replace(/\|/g, '').length) continue;
    const prev = byKey.get(key);
    if (!prev || cleaned.length > prev.length) byKey.set(key, cleaned);
  }
  return dedupeEducationStrings([...byKey.values()], { identity });
}

function sanitizeExperience(exp) {
  if (!exp || typeof exp !== 'object') return null;
  const out = { ...exp };
  out.role = sanitizeFinalResumeText(out.role);
  out.company = sanitizeFinalResumeText(out.company);
  out.dates = sanitizeFinalResumeText(out.dates);
  out.location = sanitizeFinalResumeText(out.location);
  out.description = sanitizeFinalResumeText(out.description);
  out.rewrittenDescription = sanitizeFinalResumeText(out.rewrittenDescription);
  out.bullets = (out.bullets || [])
    .map((b) => sanitizeFinalResumeText(b))
    .filter(Boolean)
    .slice(0, 6);
  if (!out.role && !out.company && !out.bullets.length) return null;
  return out;
}

function sanitizeStringList(list = [], opts = {}) {
  return dedupeStringList(
    (list || []).map((item) => sanitizeFinalResumeText(item, opts)).filter(Boolean)
  );
}

function sanitizeIdentity(identity = {}) {
  const out = { ...(identity || {}) };
  for (const field of ['name', 'title', 'email', 'phone', 'location', 'website', 'linkedin']) {
    if (!(field in out)) continue;
    const cleaned = sanitizeFinalResumeText(out[field], { allowUrls: field === 'website' || field === 'linkedin' });
    if (cleaned) out[field] = cleaned;
    else delete out[field];
  }
  return out;
}

/**
 * @param {object|null} finalResumeData
 * @returns {object|null}
 */
export function applyFinalResumeDataCleanup(finalResumeData) {
  if (!finalResumeData || typeof finalResumeData !== 'object') return finalResumeData;

  let out = applyFinalCvReadabilityPass({ ...finalResumeData });
  out.identity = sanitizeIdentity(out.identity);
  out.summary = sanitizeFinalResumeText(out.summary);

  out.experiences = dedupeExperienceEntries(
    (out.experiences || []).map(sanitizeExperience).filter(Boolean)
  );

  out.education = dedupeEducationBySchoolTitleYears(out.education, { identity: out.identity });
  out.skills = sanitizeStringList(out.skills);
  out.tools = sanitizeStringList(out.tools);
  out.languages = dedupeStringList(
    (out.languages || [])
      .map((line) => {
        const result = sanitizeLanguageLine(line);
        return result.ok ? result.display : '';
      })
      .filter(Boolean)
  );
  out.clients = sanitizeStringList(out.clients);
  out.projects = sanitizeStringList(out.projects);
  out.suggestions = sanitizeStringList(out.suggestions).slice(0, 12);

  for (const key of [
    'unknownExperience',
    'toClassify',
    'unsorted',
    '_enterprise',
    '_parserReview',
    '_extractionReview',
    'rejectedLines',
    'structuredResume',
    'audit',
    'debugReport',
  ]) {
    if (key in out) delete out[key];
  }

  out = stripSectionLabelLeakage(out);

  out.metaSafe = {
    ...(out.metaSafe || {}),
    finalResumeDataCleanup: FINAL_RESUME_DATA_CLEANUP,
    finalResumeDataCleanupAt: new Date().toISOString(),
  };

  return out;
}
