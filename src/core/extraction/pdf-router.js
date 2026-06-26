/**
 * PDF extraction routing — selectable text → native PDF; scanned → OCR only.
 * Never run full-document OCR when a usable text layer is present.
 */

import { classifyPdfForExtraction } from './file-type-detect.js';
import { assessPdfTextLayer } from './pdf-text-quality.js';
import { REAL_CV_IMPORT_MIN_CHARS } from '../import/real-cv-import-constants.js';

/** @typedef {'native_pdf'|'ocr'|'mixed'} PdfExtractionRoute */

export const PDF_ROUTES = {
  NATIVE: 'native_pdf',
  OCR: 'ocr',
  HYBRID: 'mixed',
};

/**
 * @typedef {object} PdfRoutingPlan
 * @property {PdfExtractionRoute} route
 * @property {string} reason
 * @property {boolean} ocrAllowed — false = never OCR this document
 * @property {'none'|'per_page'|'full'} ocrMode
 * @property {boolean} useNativePdfExtraction
 * @property {boolean} useFullDocumentOcr
 */

/**
 * Decide extraction path from pdf.js native probe (before OCR).
 * @param {ReturnType<typeof classifyPdfForExtraction>} classification
 * @param {object} [opts]
 * @param {boolean} [opts.nativeTextBroken] — garbled native layer (still native if selectable)
 */
export function routePdfExtraction(classification, opts = {}) {
  const {
    hasSelectableText,
    extractionRoute,
    fileType,
    textLayerFound,
    nativeCharCount = 0,
    quality,
  } = classification;

  /** Rule 1: selectable text layer → native PDF. Rule 2: weak native → local OCR supplement. */
  if (
    hasSelectableText ||
    (textLayerFound && nativeCharCount >= 24 && extractionRoute === 'native')
  ) {
    const weakNative = nativeCharCount > 0 && nativeCharCount < REAL_CV_IMPORT_MIN_CHARS;
    return {
      route: PDF_ROUTES.NATIVE,
      reason: weakNative ? 'selectable_text_weak_native' : 'selectable_text_layer',
      ocrAllowed: weakNative,
      ocrMode: weakNative ? 'supplement' : 'none',
      useNativePdfExtraction: true,
      useFullDocumentOcr: false,
    };
  }

  /** Rule 2: mixed PDF — native pages + OCR only on pages without text. */
  if (fileType === 'pdf_mixed' || extractionRoute === 'hybrid') {
    return {
      route: PDF_ROUTES.HYBRID,
      reason: 'mixed_native_and_scanned_pages',
      ocrAllowed: true,
      ocrMode: 'per_page',
      useNativePdfExtraction: true,
      useFullDocumentOcr: false,
    };
  }

  /** Rule 3: scanned / no usable text layer → OCR only. */
  if (
    fileType === 'pdf_scanned' ||
    extractionRoute === 'ocr' ||
    (!hasSelectableText && !textLayerFound && nativeCharCount < 24)
  ) {
    return {
      route: PDF_ROUTES.OCR,
      reason: textLayerFound
        ? 'text_layer_too_weak'
        : 'scanned_no_selectable_text',
      ocrAllowed: true,
      ocrMode: 'full',
      useNativePdfExtraction: false,
      useFullDocumentOcr: true,
    };
  }

  /** Residual text layer (short creative PDFs) — still native, never OCR. */
  if (textLayerFound && nativeCharCount >= 24) {
    return {
      route: PDF_ROUTES.NATIVE,
      reason: opts.nativeTextBroken ? 'native_text_layer_partial' : 'text_layer_present',
      ocrAllowed: false,
      ocrMode: 'none',
      useNativePdfExtraction: true,
      useFullDocumentOcr: false,
    };
  }

  return {
    route: PDF_ROUTES.OCR,
    reason: 'default_scanned_fallback',
    ocrAllowed: true,
    ocrMode: 'full',
    useNativePdfExtraction: false,
    useFullDocumentOcr: true,
  };
}

/**
 * Classify + route in one step (used by enterprise engine).
 * @param {Array<{ page?: number, charCount?: number, lines?: object[], usable?: boolean }>} pages
 * @param {string} allNativeText
 * @param {object} [opts]
 */
export function planPdfExtraction(pages, allNativeText, opts = {}) {
  const classification = classifyPdfForExtraction(pages, allNativeText);
  const quality = classification.quality || assessPdfTextLayer(allNativeText);
  const plan = routePdfExtraction(classification, opts);

  return {
    classification,
    quality,
    plan,
    pdfClassification: {
      fileType: classification.fileType,
      documentKind: classification.documentKind,
      extractionRoute: classification.extractionRoute,
      routingRoute: plan.route,
      routingReason: plan.reason,
      textLayerFound: classification.textLayerFound,
      hasSelectableText: classification.hasSelectableText,
      nativeCharCount: classification.nativeCharCount,
      confidence: classification.confidence,
      neverOcrNative: plan.route === PDF_ROUTES.NATIVE,
    },
  };
}

/**
 * Guard: native PDF path must not contain OCR-sourced lines.
 * @param {import('./extracted-line.js').ExtractedLine[]} lines
 */
export function assertNativePdfLines(lines) {
  const ocrCount = (lines || []).filter((l) => l.source === 'ocr').length;
  if (ocrCount > 0) {
    console.warn('HIRELY PDF ROUTER: native path must not include OCR lines', ocrCount);
  }
  return ocrCount === 0;
}
