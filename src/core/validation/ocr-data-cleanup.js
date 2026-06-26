/**
 * P0 — OCR data cleanup before final CV render.
 * Strips fragments, parser labels, page numbers, i18n keys, polluted languages;
 * routes skills/tools without duplication.
 */

import { isPageNumberLine } from '../parsing/cv-normalizer.js';
import { isStrictSoftwareLine } from '../parsing/classification-fixes.js';
import { findLongestDictionaryTerm, TOOL_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { dedupeStringList } from '../parsing/dedupe-engine.js';
import { mergeReviewQueues, normalizeReviewItem } from '../parsing/review-queue-merge.js';
import {
  applyOcrMicroGarbageCleanup,
  isMicroGarbageOnlyLine,
  sanitizeLanguageLine,
  stripMicroGarbageFromText,
  buildMicroGarbageReviewItem,
} from './ocr-micro-garbage-cleanup.js';
import {
  isSectionLabelLeakage,
  stripSectionLabelFromText,
  sanitizeExperience,
} from './section-label-leakage-guard.js';

export const OCR_DATA_CLEANUP_V1 = 'OCR_DATA_CLEANUP_V1';

/** Leaked UI / product i18n keys (never CV content). */
const CAMELCASE_I18N_KEY_RE = /^[a-z][a-zA-Z0-9]*(?:_[a-z][a-zA-Z0-9]*)+$/;

const KNOWN_I18N_PREFIX_RE =
  /^(extractionquality|importstatus|reviewqueue|flowcta|progress|hero|studio|export|download|template|cvblock|undetected)/i;

/**
 * @param {string} text
 */
export function isCamelCaseI18nKey(text) {
  const s = String(text || '').trim();
  if (!s || s.includes(' ') || s.length > 72) return false;
  if (s.includes('@') || s.includes('.') && /\.(com|fr|org|net)\b/i.test(s)) return false;
  if (!CAMELCASE_I18N_KEY_RE.test(s)) return false;
  if (!/_/.test(s)) return false;
  if (KNOWN_I18N_PREFIX_RE.test(s)) return true;
  return /^[a-z]+[A-Z]/.test(s) === false && s.includes('_');
}

/**
 * @param {string} line
 */
export function isOcrDataCleanupJunkLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return true;
  if (isMicroGarbageOnlyLine(raw)) return true;
  if (isPageNumberLine(raw)) return true;
  if (isSectionLabelLeakage(raw)) return true;
  if (isCamelCaseI18nKey(raw)) return true;
  return false;
}

/**
 * @param {string} item
 */
export function isSoftwareToken(item) {
  const t = String(item || '').trim();
  if (!t || t.length < 2 || t.length > 56) return false;
  if (isStrictSoftwareLine(t)) return true;
  if (findLongestDictionaryTerm(t, TOOL_TERMS)) return true;
  return /^(photoshop|illustrator|indesign|figma|after effects|premiere pro|blender|sketch|xd|lightroom)$/i.test(t);
}

/**
 * Route software to tools; dedupe across skills and tools.
 * @param {string[]} skills
 * @param {string[]} tools
 */
export function partitionSkillsAndTools(skills = [], tools = []) {
  const toolKeys = new Set();
  const toolsOut = [];
  const skillsOut = [];

  const pushTool = (item) => {
    const t = String(item || '').trim();
    const k = t.toLowerCase();
    if (!t || toolKeys.has(k)) return;
    toolKeys.add(k);
    toolsOut.push(t);
  };

  for (const item of tools || []) pushTool(item);

  for (const item of skills || []) {
    const t = String(item || '').trim();
    if (!t) continue;
    if (isSoftwareToken(t)) {
      pushTool(t);
      continue;
    }
    const k = t.toLowerCase();
    if (toolKeys.has(k)) continue;
    skillsOut.push(t);
  }

  return {
    skills: dedupeStringList(skillsOut),
    tools: dedupeStringList(toolsOut),
  };
}

/**
 * @param {string} source
 * @param {string} field
 * @param {string} [reason]
 */
export function buildOcrDataCleanupReviewItem(source, field, reason = '') {
  const src = String(source || '').trim();
  if (!src || src.length < 2) return null;
  return normalizeReviewItem({
    field,
    detectedType: field,
    detected: src,
    sourceText: src,
    sourceLines: [src],
    confidence: 42,
    reason: reason || 'OCR data cleanup — confirm before adding to CV',
    status: 'pending',
    category: 'ocr_cleanup',
    ocrDataCleanup: true,
  });
}

function cleanDisplayLine(raw, field, reviewItems, stripped, violations) {
  const line = String(raw || '').trim();
  if (!line) return '';

  if (isOcrDataCleanupJunkLine(line)) {
    stripped.push(line);
    const reason = isCamelCaseI18nKey(line)
      ? 'i18n_key_leak'
      : isPageNumberLine(line)
        ? 'page_number'
        : isSectionLabelLeakage(line)
          ? 'section_label'
          : 'ocr_fragment';
    violations.push({ rule: reason, field, detail: line });
    const review =
      buildMicroGarbageReviewItem(line, field, field, reason) ||
      buildOcrDataCleanupReviewItem(line, field, reason);
    if (review) reviewItems.push(review);
    return '';
  }

  const cleaned = stripMicroGarbageFromText(stripSectionLabelFromText(line));
  if (!cleaned) {
    if (line.length >= 2) stripped.push(line);
    const review = buildOcrDataCleanupReviewItem(line, field, 'ocr_fragment');
    if (review) reviewItems.push(review);
    violations.push({ rule: 'ocr_fragment', field, detail: line });
    return '';
  }
  if (cleaned !== line) stripped.push(line);
  return cleaned;
}

function sanitizeStringListField(lines = [], field, reviewItems, stripped, violations) {
  const kept = [];
  const seen = new Set();
  for (const item of lines || []) {
    const cleaned = cleanDisplayLine(item, field, reviewItems, stripped, violations);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      violations.push({ rule: 'duplicated_label', field, detail: cleaned });
      continue;
    }
    seen.add(key);
    kept.push(cleaned);
  }
  return kept;
}

function sanitizeLanguagesField(languages = [], reviewItems, stripped, violations) {
  const kept = [];
  const seen = new Set();
  for (const item of languages || []) {
    const result = sanitizeLanguageLine(item);
    if (!result.ok) {
      if (result.source) {
        stripped.push(result.source);
        violations.push({ rule: 'partial_language', field: 'languages', detail: result.source });
        const review =
          buildMicroGarbageReviewItem(result.source, 'languages', 'languages', result.reason) ||
          buildOcrDataCleanupReviewItem(result.source, 'languages', result.reason);
        if (review) reviewItems.push(review);
      }
      continue;
    }
    const key = result.display.toLowerCase();
    if (seen.has(key)) {
      violations.push({ rule: 'duplicated_label', field: 'languages', detail: result.display });
      continue;
    }
    seen.add(key);
    kept.push(result.display);
  }
  return kept;
}

function sanitizeExperiencesField(experiences = [], reviewItems, stripped, violations) {
  const out = [];
  const seen = new Set();
  for (const exp of experiences || []) {
    if (typeof exp === 'string') {
      const cleaned = cleanDisplayLine(exp, 'experiences', reviewItems, stripped, violations);
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(cleaned);
      continue;
    }
    const { exp: cleanedExp, rejected = [] } = sanitizeExperience(exp);
    for (const rejectedLine of rejected) {
      stripped.push(rejectedLine);
      violations.push({ rule: 'section_label', field: 'experiences', detail: rejectedLine });
      const review = buildOcrDataCleanupReviewItem(rejectedLine, 'experiences', 'section_label');
      if (review) reviewItems.push(review);
    }
    if (!cleanedExp) continue;
    const key = [cleanedExp.role, cleanedExp.company, cleanedExp.dates].filter(Boolean).join('|').toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(cleanedExp);
  }
  return out;
}

/**
 * @param {object} [data]
 * @param {{ existingReviewItems?: object[] }} [opts]
 */
export function applyOcrDataCleanup(data = {}, opts = {}) {
  const micro = applyOcrMicroGarbageCleanup(data, { existingReviewItems: [] });
  const reviewItems = [...(opts.existingReviewItems || []), ...(micro.reviewItems || [])];
  const stripped = [...(micro.stripped || [])];
  const violations = [];

  const rd = {
    ...micro.resumeData,
    identity: { ...(micro.resumeData.identity || {}) },
  };

  for (const field of ['name', 'title', 'email', 'phone', 'location']) {
    const raw = String(rd.identity[field] || '').trim();
    if (!raw) continue;
    const cleaned = cleanDisplayLine(raw, `identity.${field}`, reviewItems, stripped, violations);
    if (cleaned) rd.identity[field] = cleaned;
    else delete rd.identity[field];
  }

  rd.summary = cleanDisplayLine(rd.summary, 'summary', reviewItems, stripped, violations);
  rd.languages = sanitizeLanguagesField(rd.languages, reviewItems, stripped, violations);

  for (const field of ['education', 'skills', 'tools', 'clients', 'projects', 'suggestions', 'unsorted']) {
    rd[field] = sanitizeStringListField(rd[field], field, reviewItems, stripped, violations);
  }

  const partitioned = partitionSkillsAndTools(rd.skills, rd.tools);
  rd.skills = partitioned.skills;
  rd.tools = partitioned.tools;

  rd.experiences = sanitizeExperiencesField(rd.experiences, reviewItems, stripped, violations);

  rd.meta = {
    ...(rd.meta || {}),
    ocrDataCleanup: OCR_DATA_CLEANUP_V1,
    ocrDataCleanupStripped: stripped.length,
  };
  rd.metaSafe = {
    ...(rd.metaSafe || {}),
    ocrDataCleanup: OCR_DATA_CLEANUP_V1,
    ocrDataCleanupAt: new Date().toISOString(),
    ocrDataCleanupStripped: stripped.length,
  };

  return {
    resumeData: rd,
    reviewItems: mergeReviewQueues(opts.existingReviewItems || [], reviewItems),
    stripped,
    violations,
  };
}

/**
 * @param {object} [finalResumeData]
 */
export function auditOcrDataCleanup(finalResumeData = {}) {
  const fr = finalResumeData || {};
  const issues = [];

  const scan = (section, text) => {
    const s = String(text || '').trim();
    if (!s) return;
    if (/\bnative am\b/i.test(s)) issues.push({ section, text: s, rule: 'partial_language' });
    if (isCamelCaseI18nKey(s)) issues.push({ section, text: s, rule: 'i18n_key' });
    if (isMicroGarbageOnlyLine(s)) issues.push({ section, text: s, rule: 'ocr_fragment' });
    if (isPageNumberLine(s)) issues.push({ section, text: s, rule: 'page_number' });
    if (isSectionLabelLeakage(s)) issues.push({ section, text: s, rule: 'section_label' });
  };

  scan('summary', fr.summary);
  for (const field of ['education', 'skills', 'tools', 'languages', 'clients', 'projects', 'suggestions']) {
    for (const item of fr[field] || []) scan(field, item);
  }
  for (const exp of fr.experiences || []) {
    if (typeof exp === 'string') scan('experiences', exp);
    else {
      scan('experiences', exp?.role);
      scan('experiences', exp?.company);
      scan('experiences', exp?.dates);
      for (const b of exp?.bullets || []) scan('experiences', b);
    }
  }

  const toolKeys = new Set((fr.tools || []).map((t) => String(t).toLowerCase()));
  for (const skill of fr.skills || []) {
    if (isSoftwareToken(skill)) issues.push({ section: 'skills', text: skill, rule: 'software_in_skills' });
    if (toolKeys.has(String(skill).toLowerCase())) {
      issues.push({ section: 'skills', text: skill, rule: 'skills_tools_duplicate' });
    }
  }

  return { pass: issues.length === 0, policy: OCR_DATA_CLEANUP_V1, issues };
}
