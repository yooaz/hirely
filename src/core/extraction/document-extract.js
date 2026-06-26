/**
 * Document extraction router — one entry per format (PDF / DOCX / TXT / image).
 * PDF: native text layer first; OCR only for scans or weak pages.
 * DOCX / TXT: no OCR. Images: OCR only.
 */

import { normalizeRawExtract } from '../parsing/clean.js';
import { extractDocxWithRecovery } from './docx-extract.js';
import { auditDocxStructureRecovery } from './docx-structure-recovery.js';
import { detectInputFileType, fileTypeLabel } from './file-type-detect.js';
import {
  extractPdfEnterprise,
  extractImageEnterprise,
  extractPlainTextEnterprise,
} from './enterprise-engine.js';
import { ensureTesseract } from './ocr-tesseract.js';
import { isBrowser } from './ocr.js';
import { assessPdfTextLayer } from './pdf-text-quality.js';
import {
  evaluateOcrParserGate,
  OCR_QUALITY_FAIL_MSG,
} from './ocr-quality-score.js';
import {
  readFileBuffer,
  cloneArrayBuffer,
  logExtractionStep,
} from './file-buffer.js';
import { logOcrPropagation, logOcrPropagate } from './ocr-propagation-trace.js';

const PDF_SCANNED_MSG =
  'Ce PDF semble scanné ou protégé. Collez le texte du CV ou utilisez TXT/DOCX.';

import {
  REAL_CV_IMPORT_MIN_CHARS,
} from '../import/real-cv-import-constants.js';
import {
  isOcrAutoImportEnabled,
  ocrConfidenceWarning,
} from '../import/ocr-auto-import.js';

/** Minimum chars to accept OCR output — below → paste fallback. */
export const OCR_MIN_CHARS_HARD = REAL_CV_IMPORT_MIN_CHARS;
export const OCR_MIN_CHARS_SOFT = REAL_CV_IMPORT_MIN_CHARS;

/**
 * @typedef {object} DocumentExtractResult
 * @property {string} text
 * @property {string} method
 * @property {string} [fileType]
 * @property {string} [fileTypeLabel]
 * @property {import('./enterprise-engine.js').EnterpriseExtractionResult} enterprise
 * @property {object} [pdfExtraction]
 * @property {import('./extracted-line.js').ExtractedLine[]} [lines]
 * @property {object} [metadata]
 */

/**
 * @param {File} file
 * @returns {Promise<DocumentExtractResult>}
 */
export async function extractDocument(file) {
  const input = detectInputFileType(file);

  switch (input.kind) {
    case 'txt':
      return extractTxtDocument(file);
    case 'docx':
      return extractDocxDocument(file);
    case 'doc':
      return extractDocDocument(file);
    case 'rtf':
      return extractRtfDocument(file);
    case 'pdf':
      return extractPdfDocument(file);
    case 'image':
      return extractImageDocument(file);
    default:
      throw new Error('Format non supporté. Utilise PDF, DOCX, DOC, RTF, TXT ou image.');
  }
}

/**
 * @param {File} file
 */
export async function extractTxtDocument(file) {
  const text = normalizeRawExtract(await file.text());
  const enterprise = extractPlainTextEnterprise(text, 'txt');
  return wrapPlain(enterprise, 'txt');
}

/**
 * @param {File} file
 */
export async function extractDocxDocument(file) {
  const mammoth = globalThis.mammoth || globalThis.window?.mammoth || null;
  const buffer = await file.arrayBuffer();
  const recovery = await extractDocxWithRecovery(buffer, mammoth);
  const text = String(recovery.text || '').trim();
  if (text.length < 20) {
    throw new Error('DOCX illisible. Collez le texte du CV.');
  }
  const enterprise = extractPlainTextEnterprise(text, 'docx');
  const docxAudit = auditDocxStructureRecovery(recovery);
  enterprise.metadata = {
    ...(enterprise.metadata || {}),
    fileType: 'docx',
    docxRecovery: docxAudit,
    docxRetentionPct: recovery.retention?.pct ?? 0,
    docxVisibleWords: recovery.retention?.visibleWords ?? 0,
    docxRetainedWords: recovery.retention?.retainedWords ?? 0,
    docxParts: recovery.parts || [],
  };
  return wrapPlain(enterprise, 'docx');
}

/**
 * Legacy .doc — mammoth when possible; same native path as DOCX.
 * @param {File} file
 */
export async function extractDocDocument(file) {
  const mammoth = globalThis.mammoth || globalThis.window?.mammoth || null;
  const buffer = await file.arrayBuffer();
  let text = '';
  try {
    const legacy = await extractDocxWithRecovery(buffer, mammoth);
    text = legacy.text;
  } catch {
    text = '';
  }
  if (text.length < 20) {
    throw new Error('DOC illisible (format binaire). Enregistrez en DOCX ou collez le texte.');
  }
  const enterprise = extractPlainTextEnterprise(text, 'docx');
  enterprise.metadata = { ...(enterprise.metadata || {}), fileType: 'doc', legacyDoc: true };
  return {
    text: enterprise.rawExtraction,
    method: 'docx',
    fileType: 'doc',
    fileTypeLabel: fileTypeLabel('doc'),
    enterprise,
    pdfExtraction: null,
    lines: enterprise.lines,
    metadata: enterprise.metadata,
  };
}

/**
 * Strip RTF control words to plain text (native extraction, no OCR).
 * @param {string} rtf
 */
export function stripRtfToPlain(rtf) {
  let s = String(rtf || '');
  s = s.replace(/\\'([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  s = s.replace(/\\par[d]?\b/gi, '\n');
  s = s.replace(/\\line\b/gi, '\n');
  s = s.replace(/\\tab\b/gi, '\t');
  s = s.replace(/\\[a-z]+-?\d* ?/gi, '');
  s = s.replace(/[{}]/g, '');
  return normalizeRawExtract(s);
}

/**
 * @param {File} file
 */
export async function extractRtfDocument(file) {
  const raw = await file.text();
  const text = stripRtfToPlain(raw);
  if (text.length < 12) {
    throw new Error('RTF illisible. Collez le texte du CV.');
  }
  const enterprise = extractPlainTextEnterprise(text, 'txt');
  enterprise.method = 'txt';
  enterprise.metadata = { ...(enterprise.metadata || {}), fileType: 'rtf', inputFormat: 'rtf' };
  return {
    text: enterprise.rawExtraction,
    method: 'txt',
    fileType: 'rtf',
    fileTypeLabel: fileTypeLabel('rtf'),
    enterprise,
    pdfExtraction: null,
    lines: enterprise.lines,
    metadata: enterprise.metadata,
  };
}

/**
 * @param {File} file
 */
export async function extractImageDocument(file) {
  if (!isBrowser()) {
    throw new Error('OCR image nécessite le navigateur. Collez le texte du CV.');
  }
  await ensureTesseract();
  const enterprise = await extractImageEnterprise(file);
  validateOcrEnterprise(enterprise, 'Image illisible. Collez le texte du CV.');
  return {
    text: enterprise.rawExtraction,
    method: 'ocr',
    fileType: 'image',
    fileTypeLabel: fileTypeLabel('image'),
    enterprise,
    pdfExtraction: enterprise.pdfExtraction,
    lines: enterprise.lines,
    metadata: enterprise.metadata,
  };
}

/**
 * @param {File} file
 */
export async function extractPdfDocument(file) {
  const pdfjsLib = globalThis.pdfjsLib || globalThis.window?.pdfjsLib;
  if (!pdfjsLib) {
    throw new Error('PDF.js non chargé. Collez le texte du CV.');
  }

  const master = await readFileBuffer(file);
  const pdfJsBuf = cloneArrayBuffer(master);
  logExtractionStep('PDF_BUFFER_CLONED_FOR_PDF_JS', `${pdfJsBuf.byteLength}b`);
  const pdfLibBuf = cloneArrayBuffer(master);
  logExtractionStep('PDF_BUFFER_CLONED_FOR_PDF_LIB', `${pdfLibBuf.byteLength}b`);
  logExtractionStep('PDF_BUFFER_CLONED_FOR_OCR', 'pdfjs-proxy');

  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: pdfJsBuf, isEvalSupported: false }).promise;
  } catch (err) {
    console.error('HIRELY PDF.js open failed', err);
    throw new Error(PDF_SCANNED_MSG);
  }

  /** Tesseract loads on-demand inside enterprise engine — only when OCR route is chosen. */

  const enterprise = await extractPdfEnterprise(pdf, pdfLibBuf, { file });
  const docTextLen = String(enterprise.rawExtraction || '').trim().length;
  logOcrPropagate('DOCUMENT_EXTRACT', {
    DOCUMENT_RESULT_TEXT_LENGTH: docTextLen,
    OCR_LINES_COUNT: enterprise.lines?.length ?? 0,
  });
  logOcrPropagation('DOCUMENT_EXTRACT', {
    text: enterprise.rawExtraction,
    lines: enterprise.lines,
    note: enterprise.method,
  });
  return {
    text: enterprise.rawExtraction,
    method: enterprise.method,
    fileType: enterprise.metadata?.fileType || enterprise.pdfExtraction?.fileType,
    fileTypeLabel:
      enterprise.metadata?.fileTypeLabel ||
      fileTypeLabel(enterprise.metadata?.fileType),
    enterprise,
    pdfExtraction: enterprise.pdfExtraction,
    lines: enterprise.lines,
    metadata: enterprise.metadata,
  };
}

function wrapPlain(enterprise, method) {
  return {
    text: enterprise.rawExtraction,
    method,
    fileType: method,
    fileTypeLabel: fileTypeLabel(method),
    enterprise,
    pdfExtraction: null,
    lines: enterprise.lines,
    metadata: enterprise.metadata,
  };
}

/**
 * Post-process OCR PDF results — lenient thresholds for short CVs.
 * @param {import('./enterprise-engine.js').EnterpriseExtractionResult} enterprise
 */
export function applyPdfOcrPolicy(enterprise) {
  const meta = enterprise.metadata || {};
  const pdfMeta = enterprise.pdfExtraction || {};

  if (enterprise.method === 'native_pdf') {
    const partial =
      pdfMeta.partialNative ||
      pdfMeta.decision === 'native_partial' ||
      pdfMeta.nativePartialFallback;
    if (partial) {
      enterprise.metadata = {
        ...meta,
        nativePartialFallback: true,
        ocrWarning:
          'Texte PDF partiel. Vérifiez le rendu ou collez le texte du CV.',
      };
    }
    return;
  }

  if (enterprise.method !== 'ocr' && enterprise.method !== 'mixed') return;

  const len = String(enterprise.rawExtraction || '').trim().length;
  const gate = evaluateOcrParserGate(enterprise.rawExtraction, enterprise.lines);
  const autoOcr = isOcrAutoImportEnabled();

  enterprise.metadata = {
    ...meta,
    ocrConfidence: gate.qualityScore,
    ocrQualityScore: gate.qualityScore,
  };
  const confWarn = ocrConfidenceWarning(gate.qualityScore);
  if (confWarn) {
    enterprise.metadata.ocrWarning = confWarn;
    enterprise.metadata.ocrLowConfidence = true;
  }

  if (len < OCR_MIN_CHARS_HARD) {
    if (autoOcr) {
      enterprise.metadata = {
        ...enterprise.metadata,
        ocrPartial: true,
        ocrWarning:
          len > 0
            ? confWarn || 'Extraction OCR partielle — vérifiez le contenu dans Relecture.'
            : 'Extraction OCR vide — complétez votre CV dans Relecture.',
      };
      return;
    }
    throw new Error(PDF_SCANNED_MSG);
  }

  if (len < OCR_MIN_CHARS_SOFT) {
    enterprise.metadata = {
      ...enterprise.metadata,
      ocrPartial: true,
      ocrWarning:
        confWarn ||
        'OCR partiel — vérifiez le CV ou collez le texte pour de meilleurs résultats.',
    };
  }

  if (!gate.pass && !autoOcr) {
    throw Object.assign(new Error(OCR_QUALITY_FAIL_MSG), {
      code: 'OCR_QUALITY_FAILED',
      importStatus: 'PDF_TEXT_EMPTY',
      ocrQuality: gate,
    });
  }
}

/**
 * @param {import('./enterprise-engine.js').EnterpriseExtractionResult} enterprise
 * @param {string} emptyMsg
 */
function validateOcrEnterprise(enterprise, emptyMsg) {
  const len = String(enterprise.rawExtraction || '').trim().length;
  if (len < OCR_MIN_CHARS_HARD) {
    if (isOcrAutoImportEnabled()) {
      enterprise.metadata = {
        ...(enterprise.metadata || {}),
        ocrPartial: true,
        ocrWarning:
          len > 0
            ? 'Extraction OCR partielle — vérifiez le contenu dans Relecture.'
            : 'Extraction OCR vide — complétez votre CV dans Relecture.',
      };
      return;
    }
    throw new Error(emptyMsg);
  }
}
