/**
 * PDF extraction diagnostics — why IMPORT_NEEDS_PASTE (no fake pass).
 */
import { readFileBuffer, cloneArrayBuffer } from './file-buffer.js';
import { extractNativePdfLines } from './pdf-lines-native.js';
import { detectInputFileType } from './file-type-detect.js';
import { isV1ImportMode, SIMPLE_IMPORT_MIN_CHARS, PDF_IMAGE_PASTE_MSG, V1_UNSUPPORTED_IMAGE_MSG } from '../import/v1-import-constants.js';
import { isOcrAutoImportEnabled } from '../import/ocr-auto-import.js';
import { OCR_FALLBACK_V1_PASTE_MAX_CHARS } from '../import/ocr-fallback-v1.js';
import { shouldSkipRemoteOcr } from '../runtime/static-mode.js';

export { PDF_IMAGE_PASTE_MSG, V1_UNSUPPORTED_IMAGE_MSG };

/**
 * @returns {{ ocrAvailable: boolean, ocrDisabledReason: string|null, simpleImportMode: boolean, pdfJsLoaded: boolean, tesseractLazy: boolean, remoteOcrSkipped: boolean }}
 */
export function probeOcrAvailability() {
  const g = globalThis;
  const simpleImportMode = isV1ImportMode() && !isOcrAutoImportEnabled();
  const pdfJsLoaded = !!(g.pdfjsLib || g.window?.pdfjsLib);
  const tesseractLazy = !!(g.HirelyLazy?.ensureTesseract);
  const remoteOcrSkipped = shouldSkipRemoteOcr();

  let ocrDisabledReason = null;
  if (simpleImportMode) ocrDisabledReason = 'SIMPLE_IMPORT_MODE';
  else if (g.HIRELY_OCR_DISABLED_V1 === true) ocrDisabledReason = 'OCR_DISABLED_V1';
  else if (!tesseractLazy) ocrDisabledReason = 'TESSERACT_NOT_LOADED';

  const ocrAvailable = !simpleImportMode && tesseractLazy && g.HIRELY_OCR_DISABLED_V1 !== true;

  return {
    ocrAvailable,
    ocrDisabledReason,
    simpleImportMode,
    pdfJsLoaded,
    tesseractLazy,
    remoteOcrSkipped,
  };
}

/**
 * Raw pdf.js text length per page (getTextContent items, not line grouping).
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 */
export async function pdfJsTextLengthPerPage(pdf) {
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const raw = (content.items || [])
      .map((item) => String(item.str || ''))
      .join('');
    const collapsed = raw.replace(/\s+/g, ' ').trim();
    pages.push({
      page: pageNumber,
      pdfJsTextLength: collapsed.length,
      pdfJsRawLength: raw.length,
    });
  }
  return pages;
}

/**
 * @param {number} pdfJsTotal
 * @param {number} rawLen
 * @param {{ ocrAttempted: boolean, ocrAvailable: boolean, ocrResultLength: number, simpleImportMode: boolean }} ocr
 */
export function resolveImportNeedsPasteReason(pdfJsTotal, rawLen, ocr) {
  const ocrLen = Math.max(0, Number(ocr.ocrResultLength) || 0);
  const effectiveLen = Math.max(rawLen, ocrLen);

  // Scanned PDFs: nativeTextLength/pdfJsTotal === 0 is normal — never stop on native alone.
  if (ocr.ocrAttempted && ocrLen > OCR_FALLBACK_V1_PASTE_MAX_CHARS) {
    return effectiveLen > SIMPLE_IMPORT_MIN_CHARS ? 'EXTRACTION_OK' : 'OCR_PARTIAL_USABLE';
  }
  if (ocr.ocrAttempted && ocrLen > 0 && ocrLen <= OCR_FALLBACK_V1_PASTE_MAX_CHARS) {
    return 'OCR_TEXT_TOO_SHORT';
  }
  if (pdfJsTotal === 0 && !ocr.ocrAttempted) {
    if (!ocr.ocrAvailable || ocr.simpleImportMode) return 'PDF_IMAGE_OCR_DISABLED';
    return 'PDF_IMAGE_OCR_PENDING';
  }
  if (pdfJsTotal > 0 && rawLen <= SIMPLE_IMPORT_MIN_CHARS) {
    return 'PDF_NATIVE_TEXT_TOO_SHORT';
  }
  if (effectiveLen <= SIMPLE_IMPORT_MIN_CHARS) return 'TEXT_TOO_SHORT';
  return 'UNKNOWN';
}

/**
 * @param {string} reason
 */
export function pasteMessageForReason(reason) {
  if (
    reason === 'PDF_IMAGE_OCR_DISABLED' ||
    reason === 'PDF_IMAGE_OCR_NOT_ATTEMPTED' ||
    reason === 'PDF_OPEN_FAILED' ||
    reason === 'PDF_PROTECTED'
  ) {
    return PDF_IMAGE_PASTE_MSG;
  }
  if (reason === 'PDF_NATIVE_TEXT_TOO_SHORT') {
    return 'Le texte natif du PDF est trop court. Collez le texte ou importez un DOCX/TXT.';
  }
  if (reason === 'OCR_TEXT_TOO_SHORT') {
    return 'La lecture OCR n’a pas produit assez de texte. Collez le texte du CV pour continuer.';
  }
  if (reason === 'TEXT_TOO_SHORT') {
    return 'Texte extrait insuffisant. Collez le texte du CV pour continuer.';
  }
  return null;
}

/**
 * Full PDF extraction debug report (native pdf.js probe).
 * @param {File} file
 * @param {{ rawText?: string, ocrAttempted?: boolean, ocrResultLength?: number }} [opts]
 */
export async function buildPdfExtractionDebug(file, opts = {}) {
  const input = detectInputFileType(file);
  const ocrProbe = probeOcrAvailability();
  const rawText = String(opts.rawText ?? '').trim();
  const ocrAttempted = opts.ocrAttempted === true;
  const ocrResultLength = Number(opts.ocrResultLength) || 0;

  const base = {
    fileName: file?.name || '',
    fileSize: file?.size || 0,
    fileType: file?.type || input.mime || '',
    detectedKind: input.kind,
    pdfPageCount: 0,
    pdfJsTextPerPage: [],
    pdfJsTotalLength: 0,
    nativeLineCharCountPerPage: [],
    nativeLineTotalLength: 0,
    totalRawTextLength: rawText.length,
    ocrAttempted,
    ocrAvailable: ocrProbe.ocrAvailable,
    ocrDisabledReason: ocrProbe.ocrDisabledReason,
    ocrResultLength,
    simpleImportMode: ocrProbe.simpleImportMode,
    remoteOcrSkipped: ocrProbe.remoteOcrSkipped,
    pdfJsLoaded: ocrProbe.pdfJsLoaded,
    extractedTextPreview: rawText.slice(0, 500),
    pasteReason: 'UNKNOWN',
    userMessage: null,
    needsPaste: rawText.length <= SIMPLE_IMPORT_MIN_CHARS,
  };

  if (input.kind !== 'pdf') {
    base.pasteReason = rawText.length <= SIMPLE_IMPORT_MIN_CHARS ? 'TEXT_TOO_SHORT' : 'EXTRACTION_OK';
    base.userMessage =
      base.pasteReason === 'TEXT_TOO_SHORT' ? pasteMessageForReason('TEXT_TOO_SHORT') : null;
    base.needsPaste = rawText.length <= SIMPLE_IMPORT_MIN_CHARS;
    return base;
  }

  const pdfjsLib = globalThis.pdfjsLib || globalThis.window?.pdfjsLib;
  if (!pdfjsLib) {
    base.pasteReason = 'PDFJS_MISSING';
    base.userMessage = 'PDF.js non chargé — impossible de lire le PDF.';
    base.needsPaste = true;
    return base;
  }

  try {
    const master = await readFileBuffer(file);
    const pdfJsBuf = cloneArrayBuffer(master);
    const pdf = await pdfjsLib.getDocument({ data: pdfJsBuf, isEvalSupported: false }).promise;
    base.pdfPageCount = pdf.numPages;
    base.pdfJsTextPerPage = await pdfJsTextLengthPerPage(pdf);
    base.pdfJsTotalLength = base.pdfJsTextPerPage.reduce((s, p) => s + p.pdfJsTextLength, 0);

    const native = await extractNativePdfLines(pdf);
    base.nativeLineCharCountPerPage = native.pages.map((p) => ({
      page: p.page,
      charCount: p.charCount,
      usable: p.usable,
    }));
    base.nativeLineTotalLength = native.pages.reduce((s, p) => s + (p.charCount || 0), 0);
  } catch (err) {
    base.openError = String(err?.message || err);
    base.pasteReason = /password|encrypt|protected|permission/i.test(base.openError)
      ? 'PDF_PROTECTED'
      : 'PDF_OPEN_FAILED';
    base.userMessage = PDF_IMAGE_PASTE_MSG;
    base.needsPaste = true;
    return base;
  }

  base.pasteReason = resolveImportNeedsPasteReason(base.pdfJsTotalLength, rawText.length, {
    ocrAttempted,
    ocrAvailable: ocrProbe.ocrAvailable,
    ocrResultLength,
    simpleImportMode: ocrProbe.simpleImportMode,
  });
  base.userMessage = pasteMessageForReason(base.pasteReason);
  const effectiveLen = Math.max(rawText.length, ocrResultLength);
  base.needsPaste =
    effectiveLen <= SIMPLE_IMPORT_MIN_CHARS &&
    !(ocrAttempted && ocrResultLength > OCR_FALLBACK_V1_PASTE_MAX_CHARS);
  base.ocrUsable = ocrAttempted && ocrResultLength > OCR_FALLBACK_V1_PASTE_MAX_CHARS;
  return base;
}

/**
 * Console-friendly one-liner summary.
 * @param {ReturnType<typeof buildPdfExtractionDebug> extends Promise<infer T> ? T : never} dbg
 */
export function formatExtractionDebugForConsole(dbg) {
  return {
    fileName: dbg.fileName,
    fileSize: dbg.fileSize,
    fileType: dbg.fileType,
    pdfPageCount: dbg.pdfPageCount,
    pdfJsTextPerPage: dbg.pdfJsTextPerPage,
    totalRawTextLength: dbg.totalRawTextLength,
    ocrAttempted: dbg.ocrAttempted,
    ocrAvailable: dbg.ocrAvailable,
    ocrResultLength: dbg.ocrResultLength,
    IMPORT_NEEDS_PASTE_reason: dbg.pasteReason,
    userMessage: dbg.userMessage,
  };
}
