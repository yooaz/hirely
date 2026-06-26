/**
 * Paste-first flow — first-class path when automatic extraction fails.
 */
import {
  SIMPLE_IMPORT_MIN_CHARS,
  PASTE_FIRST_TITLE,
  PASTE_FIRST_LEAD,
  PASTE_FIRST_FORMATS_NOTE,
  PASTE_FIRST_CTA,
  OCR_FAILURE_PASTE_TITLE,
  OCR_FAILURE_PASTE_LEAD,
  OCR_FAILURE_PASTE_CTA,
  V1_PHOTO_PASTE_MSG,
  isV1ImportMode,
} from './v1-import-constants.js';
import { createResumeFromText } from './text-first-engine.js';
import { renderRawTextFallbackBundle } from './raw-text-fallback-render.js';
import { IMPORT_STATE } from './import-state.js';

export const PASTE_FIRST_FLOW_VERSION = 'PASTE_FIRST_V1';

export {
  PASTE_FIRST_TITLE,
  PASTE_FIRST_LEAD,
  PASTE_FIRST_FORMATS_NOTE,
  PASTE_FIRST_CTA,
};

/** Calm paste panel after OCR could not read enough text. */
export function buildOcrFailurePanelCopy() {
  return {
    title: OCR_FAILURE_PASTE_TITLE,
    lead: OCR_FAILURE_PASTE_LEAD,
    formatsNote: '',
    cta: OCR_FAILURE_PASTE_CTA,
    placeholder: 'Collez ici le texte complet de votre CV…',
  };
}

/** OCR ran but text too short — soft paste UX (no error styling). */
export function isOcrCalmPasteFlow(_opts = {}, { pdfTimeout = false, ocrFailure = false } = {}) {
  return ocrFailure === true && pdfTimeout !== true;
}

export function buildPasteFirstPanelCopy(opts = {}) {
  const reason = String(
    opts.reason || opts.extractionDebug?.pasteReason || opts.result?.pasteReason || ''
  ).trim();
  const photoFlow =
    reason === 'v1_image' ||
    reason === 'V1_IMAGE_UNSUPPORTED' ||
    reason === 'V1_UNSUPPORTED_FORMAT';
  return {
    title: photoFlow ? V1_PHOTO_PASTE_MSG : PASTE_FIRST_TITLE,
    lead: PASTE_FIRST_LEAD,
    formatsNote: PASTE_FIRST_FORMATS_NOTE,
    cta: PASTE_FIRST_CTA,
    placeholder: 'Collez ici le texte complet de votre CV…',
  };
}

export function pasteFirstTextSufficient(rawText) {
  return String(rawText || '').trim().length > SIMPLE_IMPORT_MIN_CHARS;
}

export function shouldUsePasteFirstPanel(opts = {}) {
  if (!isV1ImportMode()) return false;
  if (opts.pasteFirst === true) return true;
  const reason = String(opts.reason || opts.extractionDebug?.pasteReason || '').trim();
  if (
    reason === 'PDF_IMAGE_OCR_DISABLED' ||
    reason === 'PDF_IMAGE_OCR_NOT_ATTEMPTED' ||
    reason === 'V1_IMAGE_UNSUPPORTED' ||
    reason === 'v1_image' ||
    reason === 'v1_short_text'
  ) {
    return true;
  }
  if (opts.ocrFailure || opts.pdfTimeout) return true;
  return false;
}

/** Image-only / no-text PDF — calm paste path (not timeout/OCR failure tone). */
export function isImagePdfPasteFlow(opts = {}, { pdfTimeout = false, ocrFailure = false } = {}) {
  if (pdfTimeout || ocrFailure) return false;
  const reason = String(
    opts.reason || opts.extractionDebug?.pasteReason || opts.result?.pasteReason || ''
  ).trim();
  if (
    reason === 'PDF_IMAGE_OCR_DISABLED' ||
    reason === 'PDF_IMAGE_OCR_NOT_ATTEMPTED' ||
    reason === 'V1_IMAGE_UNSUPPORTED' ||
    reason === 'v1_image' ||
    reason === 'NO_TEXT_EXTRACTED' ||
    reason === 'TEXT_TOO_SHORT'
  ) {
    return true;
  }
  if (opts.pasteFirst === true && !pdfTimeout && !ocrFailure) {
    const docType = String(opts.extractionDebug?.documentType || opts.result?.fileType || '').toLowerCase();
    if (docType === 'pdf' || docType === 'image') return true;
  }
  return false;
}

/**
 * Guaranteed paste path — clean text, resume object, preview HTML. Sync, no parser gates.
 * @param {string} rawText
 * @param {(s: string) => string} [esc]
 */
export function applyPasteGuaranteedFlow(rawText, esc = (s) => String(s ?? '')) {
  const text = String(rawText || '').trim();
  if (text.length <= SIMPLE_IMPORT_MIN_CHARS) {
    return {
      ok: false,
      reason: 'TEXT_TOO_SHORT',
      minChars: SIMPLE_IMPORT_MIN_CHARS,
      charCount: text.length,
    };
  }
  const resumeData = createResumeFromText(text);
  const bundle = renderRawTextFallbackBundle(text, text, esc);
  const cleanText = bundle.ok ? bundle.cleanText : text;
  const html = bundle.ok && bundle.html ? bundle.html : '';
  return {
    ok: true,
    rawText: text,
    cleanText,
    resumeData,
    cvData: bundle.ok ? bundle.cvData : null,
    html,
    importStatus: IMPORT_STATE.IMPORT_READY,
    pasteGuaranteed: true,
    charCount: text.length,
  };
}
