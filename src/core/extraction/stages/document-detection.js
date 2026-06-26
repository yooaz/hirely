/**
 * Stage 1 — Document classification (pdf_text / pdf_scan / docx / txt / image).
 * Policy: use PDF text layer when present; OCR only scanned pages.
 */

import { detectInputFileType, classifyPdfForExtraction } from '../file-type-detect.js';

/** Canonical pipeline document types */
export const DOCUMENT_TYPES = {
  PDF_TEXT: 'pdf_text',
  PDF_SCAN: 'pdf_scan',
  PDF_MIXED: 'pdf_mixed',
  DOCX: 'docx',
  TXT: 'txt',
  IMAGE: 'image',
  PASTE: 'paste',
  UNKNOWN: 'unknown',
};

/** @deprecated aliases */
export const LEGACY_DOCUMENT_TYPES = {
  NATIVE_PDF: 'pdf_text',
  SCANNED_PDF: 'pdf_scan',
  MIXED_PDF: 'pdf_mixed',
};

/**
 * @param {object} opts
 * @param {File|{ name?: string, type?: string }} [opts.file]
 * @param {string} [opts.method] enterprise extraction method
 * @param {string} [opts.fileType] resolved file type label
 * @param {object} [opts.pdfClassification] from classifyPdfForExtraction
 */
export function detectDocumentStage(opts = {}) {
  const method = String(opts.method || '').toLowerCase();
  const input = opts.file ? detectInputFileType(opts.file) : null;
  const pdfClass = opts.pdfClassification || null;

  let documentType = DOCUMENT_TYPES.UNKNOWN;
  let useOcr = false;
  let nativeTextLayer = false;
  let ocrPolicy = 'none';

  if (input?.kind === 'txt' || method === 'txt') {
    documentType = DOCUMENT_TYPES.TXT;
    nativeTextLayer = true;
    ocrPolicy = 'none';
  } else if (input?.kind === 'docx' || method === 'docx') {
    documentType = DOCUMENT_TYPES.DOCX;
    nativeTextLayer = true;
    ocrPolicy = 'none';
  } else if (input?.kind === 'image' || method === 'image' || method === 'image-ocr') {
    documentType = DOCUMENT_TYPES.IMAGE;
    useOcr = true;
    ocrPolicy = 'full';
  } else if (method === 'paste') {
    documentType = DOCUMENT_TYPES.PASTE;
    nativeTextLayer = true;
    ocrPolicy = 'none';
  } else if (
    method === 'native_pdf' ||
    method === 'pdf_text' ||
    pdfClass?.fileType === 'pdf_text'
  ) {
    documentType = DOCUMENT_TYPES.PDF_TEXT;
    nativeTextLayer = true;
    useOcr = false;
    ocrPolicy = 'none';
  } else if (method === 'mixed' || pdfClass?.fileType === 'pdf_mixed') {
    documentType = DOCUMENT_TYPES.PDF_MIXED;
    nativeTextLayer = true;
    useOcr = true;
    ocrPolicy = 'scanned_pages_only';
  } else if (
    method === 'ocr' ||
    method === 'pdf_scanned' ||
    method === 'pdf-ocr' ||
    method === 'pdf_scan' ||
    pdfClass?.fileType === 'pdf_scanned'
  ) {
    documentType = DOCUMENT_TYPES.PDF_SCAN;
    useOcr = true;
    ocrPolicy = 'full';
  } else if (pdfClass) {
    if (pdfClass.documentKind === 'native_pdf' || pdfClass.textLayerFound) {
      documentType = DOCUMENT_TYPES.PDF_TEXT;
      nativeTextLayer = pdfClass.textLayerFound !== false;
      useOcr = false;
      ocrPolicy = 'none';
    } else if (pdfClass.documentKind === 'pdf_mixed') {
      documentType = DOCUMENT_TYPES.PDF_MIXED;
      nativeTextLayer = true;
      useOcr = true;
      ocrPolicy = 'scanned_pages_only';
    } else {
      documentType = DOCUMENT_TYPES.PDF_SCAN;
      useOcr = true;
      ocrPolicy = 'full';
    }
  } else if (input?.kind === 'pdf') {
    documentType = DOCUMENT_TYPES.PDF_TEXT;
    nativeTextLayer = true;
    useOcr = false;
    ocrPolicy = 'none';
  }

  const label =
    documentType === DOCUMENT_TYPES.PDF_TEXT
      ? 'PDF text layer (no OCR)'
      : documentType === DOCUMENT_TYPES.PDF_SCAN
        ? 'PDF scan (OCR required)'
        : documentType === DOCUMENT_TYPES.PDF_MIXED
          ? 'PDF mixed (text + OCR on scan pages)'
          : documentType;

  return {
    stage: 1,
    documentType,
    label,
    useOcr,
    nativeTextLayer,
    ocrPolicy,
    inputKind: input?.kind || null,
    method: method || null,
    fileType: opts.fileType || pdfClass?.fileType || documentType,
    confidence: pdfClass?.confidence ?? (nativeTextLayer ? 92 : 72),
    at: new Date().toISOString(),
  };
}

export { detectInputFileType, classifyPdfForExtraction };
