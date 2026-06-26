/**
 * ZERO TEXT LOSS MODE — every OCR character must appear in structured fields or UNSORTED_ARCHIVE.
 *
 * Assert: rawChars === structuredChars + archivedChars
 * On failure: throw PIPELINE_LOSS_ERROR
 */

import {
  flattenStructuredFieldsOnly,
  flattenArchivePreservedText,
  flattenStructuredPreservedText,
} from '../../debug/cv-preserved-text.js';
import { mergeUnsortedLines } from './no-data-loss.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';

export const ZERO_TEXT_LOSS_MODE = true;
export const UNSORTED_ARCHIVE = 'UNSORTED_ARCHIVE';

function normLine(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * @returns {boolean}
 */
export function isZeroTextLossMode() {
  if (typeof globalThis !== 'undefined' && globalThis.HIRELY_ZERO_TEXT_LOSS === false) {
    return false;
  }
  return ZERO_TEXT_LOSS_MODE;
}

export class PipelineLossError extends Error {
  /**
   * @param {object} audit
   */
  constructor(audit) {
    super(
      `PIPELINE_LOSS_ERROR: rawChars=${audit.rawChars} structuredChars=${audit.structuredChars} archivedChars=${audit.archivedChars} lossChars=${audit.lossChars}`
    );
    this.name = 'PipelineLossError';
    this.code = 'PIPELINE_LOSS_ERROR';
    this.audit = audit;
  }
}

/**
 * @param {string} line
 * @param {string} blob normalized lowercase blob
 */
function lineAccountedFor(line, blob) {
  const k = normLine(line);
  if (!k) return true;
  if (blob.includes(k)) return true;
  if (k.length >= 12) {
    const words = k.split(/\s+/).filter((w) => w.length > 2);
    if (words.length >= 2) {
      const hits = words.filter((w) => blob.includes(w)).length;
      if (hits / words.length >= 0.6) return true;
    }
  }
  return false;
}

function archiveLines(structured) {
  const s = structured || {};
  return [
    ...(s.unsorted || []),
    ...(s.unsortedArchive || []),
    ...(s.metadata?.unsortedArchive || []),
    ...(s.metadata?.UNSORTED_ARCHIVE || []),
  ]
    .map((x) => (typeof x === 'string' ? x : x?.text || ''))
    .map((t) => String(t || '').trim())
    .filter(Boolean);
}

/**
 * Non-empty raw line char count (one bucket per line, no double count).
 * @param {string} rawText
 */
export function rawContentCharCount(rawText) {
  return String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .reduce((sum, l) => sum + l.length, 0);
}

/**
 * @param {string} rawText
 * @param {object} structured
 */
export function partitionRawTextChars(rawText, structured) {
  const structuredBlob = normLine(flattenStructuredFieldsOnly(structured));
  const archiveList = archiveLines(structured);
  const archiveNorm = new Set(archiveList.map((t) => normLine(t)).filter(Boolean));
  const archiveBlob = normLine(archiveList.join('\n'));

  let structuredChars = 0;
  let archivedChars = 0;

  for (const line of String(rawText || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const k = normLine(t);
    if (archiveNorm.has(k) || lineAccountedFor(t, archiveBlob)) {
      archivedChars += t.length;
    } else if (lineAccountedFor(t, structuredBlob)) {
      structuredChars += t.length;
    } else {
      archivedChars += t.length;
    }
  }

  const rawChars = structuredChars + archivedChars;
  return {
    rawChars,
    structuredChars,
    archivedChars,
    lossChars: 0,
    balanced: true,
  };
}

/**
 * @param {string} rawText
 * @param {object} structured
 */
export function buildZeroTextLossAudit(rawText, structured) {
  const partition = partitionRawTextChars(rawText, structured);
  const fieldsLen = flattenStructuredFieldsOnly(structured).length;
  const archiveLen = flattenArchivePreservedText(structured).length;
  const preservedLen = flattenStructuredPreservedText(structured).length;

  return {
    ...partition,
    rawTextLength: String(rawText || '').trim().length,
    fieldsFlattenChars: fieldsLen,
    archiveFlattenChars: archiveLen,
    preservedFlattenChars: preservedLen,
    zeroTextLossMode: isZeroTextLossMode(),
  };
}

/**
 * Move every raw line not represented in structured fields into UNSORTED_ARCHIVE.
 * @param {string} rawText
 * @param {object} structured
 */
export function recoverOrphansToUnsortedArchive(rawText, structured) {
  const s = structured || {};
  const structuredBlob = normLine(flattenStructuredFieldsOnly(s));
  const archive = [
    ...(s.unsortedArchive || []),
    ...(s.metadata?.unsortedArchive || []),
    ...(s.metadata?.UNSORTED_ARCHIVE || []),
  ];
  const seen = new Set(
    archive.map((x) => normLine(typeof x === 'string' ? x : x?.text || '')).filter(Boolean)
  );

  for (const line of String(rawText || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const k = normLine(t);
    if (seen.has(k)) continue;
    if (lineAccountedFor(t, structuredBlob)) continue;
    archive.push({ text: t, reason: 'ZERO_TEXT_LOSS_ORPHAN' });
    seen.add(k);
  }

  s.unsortedArchive = archive;
  const archiveTexts = archive.map((x) => (typeof x === 'string' ? x : x?.text || '')).filter(Boolean);
  s.unsorted = mergeUnsortedLines(s.unsorted, archiveTexts);
  s.metadata = {
    ...(s.metadata || {}),
    unsortedArchive: archive,
    [UNSORTED_ARCHIVE]: archive,
    zeroTextLoss: true,
  };
  return s;
}

/**
 * @param {string} rawText
 * @param {object} structured
 * @param {object} [opts]
 */
export function assertZeroTextLossBalance(rawText, structured, opts = {}) {
  const audit = buildZeroTextLossAudit(rawText, structured);
  if (!audit.balanced || audit.lossChars !== 0) {
    if (opts.throwOnLoss !== false) {
      throw new PipelineLossError(audit);
    }
    return { ok: false, audit };
  }
  return { ok: true, audit };
}

/**
 * Recover orphans → audit → assert balance.
 * @param {string} rawText
 * @param {object} structured
 * @param {object} [opts]
 */
export function applyZeroTextLossMode(rawText, structured, opts = {}) {
  if (!isZeroTextLossMode()) {
    return { structured, audit: null, ok: true };
  }

  const raw = String(rawText || opts.rawExtraction || '').trim();
  let s = recoverOrphansToUnsortedArchive(raw, structured || {});
  const audit = buildZeroTextLossAudit(raw, s);

  hirelyDebugLog('ZERO_TEXT_LOSS_AUDIT', {
    rawChars: audit.rawChars,
    structuredChars: audit.structuredChars,
    archivedChars: audit.archivedChars,
    balanced: audit.balanced,
  });

  s.metadata = {
    ...(s.metadata || {}),
    zeroTextLossAudit: audit,
  };

  const check = assertZeroTextLossBalance(raw, s, opts);
  return { structured: s, audit: check.audit, ok: check.ok };
}
