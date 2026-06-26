/**
 * P0 — Real CV import root policy.
 * Reliable extraction routing + no fake CV on thin text + content accounting.
 */

import { IMPORT_STATE } from './import-state.js';
import { mapImportStateToLegacy } from './import-status.js';
import { buildImportFallbackMeta } from './import-fallback-ux.js';
export {
  REAL_CV_IMPORT_ROOT_V1,
  REAL_CV_IMPORT_MIN_CHARS,
  REAL_CV_IMPORT_RENDER_MIN_CHARS,
  REAL_CV_IMPORT_THIN_TEXT_MSG,
  REAL_CV_IMPORT_FAILURE_REASONS,
} from './real-cv-import-constants.js';
import {
  REAL_CV_IMPORT_MIN_CHARS,
  REAL_CV_IMPORT_RENDER_MIN_CHARS,
  REAL_CV_IMPORT_THIN_TEXT_MSG,
  REAL_CV_IMPORT_FAILURE_REASONS,
} from './real-cv-import-constants.js';
import { guardPasteImportResult } from './ocr-import-usability.js';

/**
 * @param {string} [rawText]
 * @param {string} [cleanedText]
 */
export function selectedImportTextLength(rawText, cleanedText = '') {
  const raw = String(rawText || '').trim();
  const clean = String(cleanedText || '').trim();
  return Math.max(raw.length, clean.length);
}

/**
 * @param {string} [rawText]
 * @param {string} [cleanedText]
 */
export function hasRenderableImportText(rawText, cleanedText = '') {
  return selectedImportTextLength(rawText, cleanedText) >= REAL_CV_IMPORT_RENDER_MIN_CHARS;
}

/**
 * @param {string} [rawText]
 * @param {string} [cleanedText]
 */
export function hasMeaningfulImportText(rawText, cleanedText = '') {
  return selectedImportTextLength(rawText, cleanedText) >= REAL_CV_IMPORT_MIN_CHARS;
}

/**
 * @param {string} text
 */
export function linesToRejectedGarbage(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);
}

/**
 * Thin extract (20–299 chars) — paste fallback, no fake CV; preserve text for paste panel.
 * @param {object} extracted
 * @param {string} [fileType]
 */
export function buildThinTextPasteResult(extracted, fileType = '') {
  const raw = String(extracted.rawText || extracted.cleanedText || '').trim();
  const cleaned = String(extracted.cleanedText || raw).trim();
  const fallback = buildImportFallbackMeta({
    status: IMPORT_STATE.IMPORT_NEEDS_PASTE,
    result: extracted,
    reason: REAL_CV_IMPORT_FAILURE_REASONS.thin_text,
  });
  return {
    fileType: fileType || extracted.fileType || '',
    rawText: raw,
    cleanedText: cleaned,
    extractionMethod: extracted.extractionMethod || fileType,
    importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
    importStatus: mapImportStateToLegacy(IMPORT_STATE.IMPORT_NEEDS_PASTE),
    structuredResume: null,
    templateData: null,
    resumeData: null,
    rejectedGarbage: linesToRejectedGarbage(raw),
    importFailureReason: REAL_CV_IMPORT_FAILURE_REASONS.thin_text,
    importFallback: fallback,
    warnings: [...(extracted.warnings || []), 'THIN_TEXT_NO_FAKE_CV'],
    errors: [...(extracted.errors || []), REAL_CV_IMPORT_THIN_TEXT_MSG],
    blocks: [],
    extractionMeta: {
      selectedTextLength: selectedImportTextLength(raw, cleaned),
      minRequired: REAL_CV_IMPORT_MIN_CHARS,
      failureReason: REAL_CV_IMPORT_FAILURE_REASONS.thin_text,
    },
  };
}

/**
 * Empty / blocked extract — paste fallback with preserved garbage lines when any text exists.
 * @param {object} extracted
 * @param {string} [fileType]
 * @param {string} [failureReason]
 */
export function buildEmptyExtractPasteResult(extracted, fileType = '', failureReason = 'empty_extract') {
  const raw = String(extracted.rawText || extracted.cleanedText || '').trim();
  const fallback = buildImportFallbackMeta({
    status: IMPORT_STATE.IMPORT_NEEDS_PASTE,
    file: extracted.file,
    result: extracted,
    pdfTimeout: failureReason === REAL_CV_IMPORT_FAILURE_REASONS.ocr_timeout,
    ocrFailure: failureReason === REAL_CV_IMPORT_FAILURE_REASONS.ocr_quality,
    reason: failureReason,
  });
  return guardPasteImportResult(
    {
      fileType: fileType || extracted.fileType || '',
      rawText: raw,
      cleanedText: String(extracted.cleanedText || raw).trim(),
      extractionMethod: extracted.extractionMethod || fileType,
      importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
      importStatus: extracted.importStatus || mapImportStateToLegacy(IMPORT_STATE.IMPORT_NEEDS_PASTE),
      structuredResume: null,
      templateData: null,
      resumeData: null,
      rejectedGarbage: raw ? linesToRejectedGarbage(raw) : [],
      importFailureReason: failureReason,
      importFallback: fallback,
      warnings: [...(extracted.warnings || []), 'EMPTY_EXTRACT_PASTE_FALLBACK'],
      errors: [...(extracted.errors || []), 'TEXT_EMPTY'],
      blocks: [],
      extractionMeta: {
        selectedTextLength: selectedImportTextLength(raw, String(extracted.cleanedText || raw).trim()),
        minRequired: REAL_CV_IMPORT_MIN_CHARS,
        failureReason,
      },
    },
    { ...extracted, fileType, rawText: raw }
  );
}

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function collectAccountedKeys(resumeData = {}, reviewQueue = []) {
  const keys = new Set();
  const add = (v) => {
    const k = normKey(v);
    if (k.length > 2) keys.add(k);
  };
  const id = resumeData.identity || {};
  add(id.name);
  add(id.title);
  add(id.email);
  add(id.phone);
  add(resumeData.summary);
  for (const exp of resumeData.experiences || []) {
    add(exp.role);
    add(exp.company);
    add(exp.dates);
    for (const b of exp.bullets || []) add(b);
  }
  for (const field of ['education', 'skills', 'tools', 'languages', 'clients', 'projects', 'unsorted']) {
    for (const item of resumeData[field] || []) add(item);
  }
  for (const item of reviewQueue || []) {
    add(item.sourceText);
    add(item.detected);
    add(item.line);
    if (typeof item === 'string') add(item);
  }
  return keys;
}

function lineIsAccounted(line, keys) {
  const k = normKey(line);
  if (!k || k.length < 3) return true;
  if (keys.has(k)) return true;
  for (const key of keys) {
    if (key.length >= 8 && (k.includes(key) || key.includes(k))) return true;
  }
  return false;
}

/**
 * Ensure extracted lines land in resumeData, reviewQueue, or rejectedGarbage — never vanish.
 * @param {object} opts
 * @param {string} [opts.rawText]
 * @param {object} [opts.resumeData]
 * @param {object[]} [opts.reviewQueue]
 * @param {string[]} [opts.rejectedLines]
 * @param {string[]} [opts.rejectedGarbage]
 */
export function ensureImportContentAccounting(opts = {}) {
  const rawText = String(opts.rawText || '').trim();
  const resumeData = { ...(opts.resumeData || {}) };
  let reviewQueue = [...(opts.reviewQueue || [])];
  let rejectedGarbage = [...(opts.rejectedGarbage || []), ...(opts.rejectedLines || [])];

  if (!rawText || rawText.length < REAL_CV_IMPORT_RENDER_MIN_CHARS) {
    return { resumeData, reviewQueue, rejectedGarbage, audit: { accountedPct: 100, unaccounted: 0 } };
  }

  const keys = collectAccountedKeys(resumeData, reviewQueue);
  const rawLines = linesToRejectedGarbage(rawText);
  const unaccounted = [];

  for (const line of rawLines) {
    if (lineIsAccounted(line, keys)) continue;
    unaccounted.push(line);
  }

  if (unaccounted.length) {
    const existingGarbage = new Set(rejectedGarbage.map(normKey));
    for (const line of unaccounted) {
      const k = normKey(line);
      if (existingGarbage.has(k)) continue;
      rejectedGarbage.push(line);
      existingGarbage.add(k);
    }

    const hasStructure =
      (resumeData.experiences || []).length > 0 ||
      (resumeData.education || []).length > 0 ||
      (resumeData.skills || []).length > 0 ||
      (resumeData.tools || []).length > 0;

    if (!hasStructure && unaccounted.length <= 48) {
      const reviewKeys = new Set(
        reviewQueue.map((r) => normKey(r.sourceText || r.detected || r.line || ''))
      );
      for (const line of unaccounted.slice(0, 32)) {
        const k = normKey(line);
        if (reviewKeys.has(k)) continue;
        reviewQueue.push({
          field: 'unsorted',
          sourceText: line,
          detected: line,
          confidence: 62,
          reason: 'import_content_accounting',
          status: 'pending',
        });
        reviewKeys.add(k);
      }
    }
  }

  resumeData.meta = {
    ...(resumeData.meta || {}),
    rejectedGarbage: [...new Set(rejectedGarbage.map((l) => String(l).trim()).filter(Boolean))],
    contentAccounting: {
      rawLines: rawLines.length,
      unaccounted: unaccounted.length,
      accountedPct:
        rawLines.length > 0
          ? Math.round(((rawLines.length - unaccounted.length) / rawLines.length) * 1000) / 10
          : 100,
    },
  };

  return {
    resumeData,
    reviewQueue,
    rejectedGarbage: resumeData.meta.rejectedGarbage,
    audit: resumeData.meta.contentAccounting,
  };
}
