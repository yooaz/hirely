/**
 * IMPORT_FALLBACK_UX_LOCK — canonical copy + metadata for incomplete imports.
 * Product-facing only; never surface technical error strings.
 */

import { IMPORT_STATE } from './import-state.js';
import {
  REAL_CV_IMPORT_FAILURE_REASONS,
  REAL_CV_IMPORT_THIN_TEXT_MSG,
} from './real-cv-import-constants.js';
import {
  PDF_IMAGE_PASTE_MSG,
  OCR_FAILURE_PASTE_TITLE,
  OCR_FAILURE_PASTE_LEAD,
  OCR_FAILURE_PASTE_CTA,
  V1_UNSUPPORTED_IMAGE_MSG,
  PASTE_FIRST_TITLE,
  PASTE_FIRST_LEAD,
  PASTE_FIRST_CTA,
  isV1ImportMode,
} from './v1-import-constants.js';

export const IMPORT_FALLBACK_UX_VERSION = 'IMPORT_FALLBACK_UX_LOCK_V1';

export const IMPORT_FALLBACK_UX_LEAD = PASTE_FIRST_LEAD;

export const IMPORT_FALLBACK_UX_TITLE = PASTE_FIRST_TITLE;

const TECHNICAL_ERROR_RE =
  /PDF_EXTRACTION_TIMEOUT|OCR_TIMEOUT|OCR_ABSOLUTE|OCR_UNAVAILABLE|OCR_ASSETS_MISSING|OCR_SCRIPT_LOAD_FAILED|IMPORT_STUCK|CORE_BOOT|RangeError|Maximum call stack|PARSER_EMPTY|OCR_QUALITY|PDF_TEXT_EMPTY|stack overflow|ECONNREFUSED|fetch failed|jsdelivr/i;

/** @type {Record<string, string>} */
export const IMPORT_FILE_TYPE_LABELS = {
  pdf: 'PDF',
  docx: 'Word (DOCX)',
  doc: 'Word (DOC)',
  txt: 'Texte (TXT)',
  rtf: 'RTF',
  image: 'Image',
  png: 'Image (PNG)',
  jpg: 'Image (JPEG)',
  jpeg: 'Image (JPEG)',
  webp: 'Image (WebP)',
  gif: 'Image (GIF)',
  bmp: 'Image (BMP)',
  file: 'Fichier',
};

/**
 * @param {string} msg
 */
export function sanitizeImportErrorForUser(msg) {
  const m = String(msg || '').trim();
  if (!m || TECHNICAL_ERROR_RE.test(m)) return IMPORT_FALLBACK_UX_LEAD;
  if (/^error:|exception|undefined|null|failed to/i.test(m)) return IMPORT_FALLBACK_UX_LEAD;
  return m.length > 120 ? IMPORT_FALLBACK_UX_LEAD : m;
}

/**
 * @param {File|{ name?: string, type?: string }|null|undefined} file
 * @param {{ fileType?: string, metadata?: { fileType?: string } }|null} [result]
 */
export function resolveImportFileTypeLabel(file, result) {
  const fromResult =
    result?.metadata?.fileType || result?.fileType || '';
  if (fromResult && IMPORT_FILE_TYPE_LABELS[fromResult]) {
    return IMPORT_FILE_TYPE_LABELS[fromResult];
  }
  const name = String(file?.name || '').toLowerCase();
  const mime = String(file?.type || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';
  if (ext === 'pdf' || mime.includes('pdf')) return IMPORT_FILE_TYPE_LABELS.pdf;
  if (ext === 'docx' || mime.includes('wordprocessingml')) return IMPORT_FILE_TYPE_LABELS.docx;
  if (ext === 'doc' || mime.includes('msword')) return IMPORT_FILE_TYPE_LABELS.doc;
  if (ext === 'txt' || mime.includes('text/plain')) return IMPORT_FILE_TYPE_LABELS.txt;
  if (ext === 'rtf') return IMPORT_FILE_TYPE_LABELS.rtf;
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext) || mime.startsWith('image/')) {
    return IMPORT_FILE_TYPE_LABELS[ext] || IMPORT_FILE_TYPE_LABELS.image;
  }
  return IMPORT_FILE_TYPE_LABELS[ext] || IMPORT_FILE_TYPE_LABELS.file;
}

/**
 * @param {string} status — IMPORT_STATE or legacy status
 * @param {{ pdfTimeout?: boolean, ocrFailure?: boolean, reason?: string, result?: object }} [opts]
 */
export function resolveImportFallbackReason(status, opts = {}) {
  const reason = String(opts.reason || '').trim();
  const errBlob = [
    ...(opts.result?.errors || []),
    ...(opts.result?.warnings || []),
    reason,
  ].join(' ');

  if (reason === 'no_file') return 'Aucun fichier sélectionné.';
  if (reason === 'core_boot_failed') return 'Impossible de démarrer la lecture du fichier.';
  if (reason === 'unsupported_format') return 'Format de fichier non pris en charge.';
  if (reason === REAL_CV_IMPORT_FAILURE_REASONS.thin_text) {
    return REAL_CV_IMPORT_THIN_TEXT_MSG;
  }
  if (reason === REAL_CV_IMPORT_FAILURE_REASONS.weak_native) {
    return 'La couche texte du PDF est trop courte — OCR local tenté sans succès suffisant.';
  }
  if (
    opts.extractionDebug?.pasteReason === 'PDF_IMAGE_OCR_DISABLED' ||
    opts.extractionDebug?.pasteReason === 'PDF_IMAGE_OCR_NOT_ATTEMPTED' ||
    reason === 'PDF_IMAGE_OCR_DISABLED'
  ) {
    return PDF_IMAGE_PASTE_MSG;
  }
  if (
    opts.extractionDebug?.pasteReason === 'V1_IMAGE_UNSUPPORTED' ||
    opts.extractionDebug?.pasteReason === 'V1_UNSUPPORTED_FORMAT' ||
    reason === 'V1_IMAGE_UNSUPPORTED'
  ) {
    return V1_UNSUPPORTED_IMAGE_MSG;
  }
  if (opts.extractionDebug?.userMessage) {
    return opts.extractionDebug.userMessage;
  }
  if (opts.pdfTimeout || /PDF_EXTRACTION_TIMEOUT|OCR_TIMEOUT|OCR_ABSOLUTE/i.test(errBlob)) {
    return 'La lecture automatique a pris trop de temps — collez le texte du CV pour continuer.';
  }
  if (/OCR_ASSETS_MISSING|OCR_SCRIPT_LOAD_FAILED/i.test(errBlob)) {
    return 'La lecture OCR locale est indisponible (fichiers manquants) — exécutez npm run setup:ocr puis réessayez.';
  }
  if (
    opts.ocrFailure ||
    status === 'PDF_TEXT_EMPTY' ||
    /OCR_QUALITY|OCR_UNAVAILABLE|OCR_INSUFFICIENT|scann|illisible|mal orient/i.test(errBlob)
  ) {
    return OCR_FAILURE_PASTE_LEAD;
  }
  if (status === IMPORT_STATE.IMPORT_NEEDS_PASTE || status === 'PASTE_FALLBACK_REQUIRED') {
    return 'Le contenu extrait est insuffisant pour continuer.';
  }
  if (status === IMPORT_STATE.IMPORT_FAILED) {
    return 'La lecture automatique du fichier a échoué.';
  }
  return PDF_IMAGE_PASTE_MSG;
}

/**
 * @param {object} opts
 * @param {string} [opts.status]
 * @param {File|{ name?: string }|null} [opts.file]
 * @param {object} [opts.result]
 * @param {boolean} [opts.pdfTimeout]
 * @param {boolean} [opts.ocrFailure]
 * @param {string} [opts.reason]
 */
export function buildImportFallbackMeta(opts = {}) {
  const file = opts.file || opts.result?.file || null;
  const fileName = String(file?.name || '—').trim() || '—';
  const reason = resolveImportFallbackReason(opts.status, opts);
  const lead =
    opts.extractionDebug?.userMessage ||
    (opts.extractionDebug?.pasteReason === 'PDF_IMAGE_OCR_DISABLED'
      ? PDF_IMAGE_PASTE_MSG
      : null) ||
    IMPORT_FALLBACK_UX_LEAD;
  return {
    fileName,
    fileTypeLabel: resolveImportFileTypeLabel(file, opts.result),
    reason,
    lead,
    title: opts.ocrFailure ? OCR_FAILURE_PASTE_TITLE : IMPORT_FALLBACK_UX_TITLE,
    pasteButtonLabel: opts.ocrFailure ? OCR_FAILURE_PASTE_CTA : PASTE_FIRST_CTA,
    retryOcrButtonLabel: 'Réessayer OCR',
    replaceFileButtonLabel: 'Remplacer le fichier',
  };
}
