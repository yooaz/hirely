/**
 * FILE IMPORT REWRITE — HIRELY Import Decision Final.
 */
import { detectInputFileType } from '../extraction/file-type-detect.js';
import { buildPdfExtractionDebug } from '../extraction/pdf-extraction-debug.js';
import { IMPORT_STATE } from './import-state.js';
import { isOcrAutoImportEnabled } from './ocr-auto-import.js';
import { PDF_IMAGE_PASTE_MSG } from './v1-import-constants.js';
import { simpleExtractTextFromFile } from './simple-import-mode.js';
import { createResumeFromText } from './text-first-engine.js';
import { OCR_FALLBACK_V1_OCR_MAX_MS } from './ocr-fallback-v1.js';
import {
  decideAndLogImport,
  IMPORT_DECISION_DESTINATION,
  IMPORT_DECISION_REASON,
} from './import-decision-final.js';
import { buildImportDecisionFromExtracted } from './ocr-import-usability.js';

export const FILE_IMPORT_REWRITE_VERSION = 'FILE_IMPORT_REWRITE_DECISION_FINAL';

export const FILE_IMPORT_MAX_MS = 5000;

export const FILE_IMPORT_OCR_MAX_MS =
  typeof globalThis !== 'undefined' && Number(globalThis.HIRELY_PDF_EXTRACTION_MAX_MS) > 0
    ? Number(globalThis.HIRELY_PDF_EXTRACTION_MAX_MS)
    : OCR_FALLBACK_V1_OCR_MAX_MS;

function fileImportTimeoutMs(file) {
  const kind = detectInputFileType(file).kind;
  if (isOcrAutoImportEnabled() && kind === 'pdf') {
    return FILE_IMPORT_OCR_MAX_MS;
  }
  return FILE_IMPORT_MAX_MS;
}

export function withFileImportTimeout(promise, ms = FILE_IMPORT_MAX_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('FILE_IMPORT_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function extractFileTextNoOcr(file, timeoutMs) {
  const budget = timeoutMs ?? fileImportTimeoutMs(file);
  const kind = detectInputFileType(file).kind;
  try {
    return await withFileImportTimeout(simpleExtractTextFromFile(file), budget);
  } catch (err) {
    const extractionDebug = await buildPdfExtractionDebug(file, {
      rawText: '',
      ocrAttempted: isOcrAutoImportEnabled() && kind === 'pdf',
      ocrResultLength: 0,
    });
    extractionDebug.pasteReason = 'FILE_IMPORT_TIMEOUT';
    extractionDebug.userMessage =
      'La lecture a pris trop de temps. Collez le texte pour continuer.';
    return {
      fileType: kind,
      rawText: '',
      cleanedText: '',
      extractionMethod: 'timeout',
      warnings: ['FILE_IMPORT_TIMEOUT', 'NO_RETRY'],
      errors: [String(err?.message || 'FILE_IMPORT_TIMEOUT')],
      extractionDebug,
      ocrAttempted: isOcrAutoImportEnabled() && kind === 'pdf',
      nativeCharCount: 0,
    };
  }
}

function buildDecisionContext(file, extracted, raw, opts = {}) {
  const fileType = extracted.fileType || detectInputFileType(file).kind;
  return buildImportDecisionFromExtracted(
    {
      ...extracted,
      fileType,
      rawText: raw,
      cleanedText: String(extracted.cleanedText || raw).trim(),
    },
    {
      ocrDisabled: !isOcrAutoImportEnabled(),
      importMode: opts.importMode,
      mode: opts.mode,
      exactTranscription: opts.exactTranscription,
      unsupported:
        fileType === 'image' ||
        fileType === 'unknown' ||
        fileType === 'rtf' ||
        extracted.extractionMethod === 'v1-unsupported',
    }
  );
}

async function buildPasteResult(file, extracted, raw, clean, decision) {
  const extractionDebug =
    extracted.extractionDebug ||
    (await buildPdfExtractionDebug(file, {
      rawText: raw,
      ocrAttempted: extracted.ocrAttempted === true,
      ocrResultLength: extracted.ocrResultLength || 0,
    }));

  if (!extractionDebug.pasteReason) {
    extractionDebug.pasteReason = decision.reason;
  }
  if (!extractionDebug.userMessage) extractionDebug.userMessage = PDF_IMAGE_PASTE_MSG;

  return {
    file: { name: file.name, type: file.type || '', size: file.size || 0 },
    rawText: raw,
    cleanedText: clean,
    importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
    importStatus: 'PASTE_FALLBACK_REQUIRED',
    blocks: [],
    structuredResume: null,
    templateData: null,
    resumeData: null,
    errors: extracted.errors?.length ? extracted.errors : [decision.reason],
    warnings: [...(extracted.warnings || []), 'FILE_IMPORT_NEEDS_PASTE', decision.reason, 'NO_RETRY'],
    extractionMethod: extracted.extractionMethod || detectInputFileType(file).kind,
    extractionDebug,
    pasteReason: decision.reason,
    pasteMessage: extractionDebug.userMessage,
    importDecisionReason: decision.reason,
    importDecisionDestination: decision.destination,
    success: false,
    textFirst: true,
    ocrAttempted: extracted.ocrAttempted === true,
  };
}

/**
 * @param {File} file
 * @param {object} [opts]
 */
export async function rewriteImportFromFile(file, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? fileImportTimeoutMs(file);
  const extracted = await extractFileTextNoOcr(file, timeoutMs);
  const raw = String(extracted.rawText || '').trim();
  const clean = String(extracted.cleanedText || raw).trim();

  const decisionCtx = buildDecisionContext(file, extracted, raw, opts);
  const decision = decideAndLogImport(decisionCtx);

  if (decision.destination === IMPORT_DECISION_DESTINATION.PASTE) {
    return buildPasteResult(file, extracted, raw, clean, decision);
  }

  if (
    decision.destination === IMPORT_DECISION_DESTINATION.EXACT_TRANSCRIPTION ||
    decision.destination === IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR
  ) {
    extracted.warnings = [
      ...(extracted.warnings || []),
      decision.reason,
      decision.destination === IMPORT_DECISION_DESTINATION.STRUCTURED_FROM_OCR
        ? 'STRUCTURED_FROM_OCR'
        : 'EXACT_TRANSCRIPTION_AUTO',
    ];
  }

  const resumeData = createResumeFromText(clean || raw);

  const extractionDebug =
    extracted.extractionDebug ||
    (await buildPdfExtractionDebug(file, {
      rawText: raw,
      ocrAttempted: extracted.ocrAttempted === true,
      ocrResultLength: extracted.ocrResultLength || 0,
    }));

  return {
    file: { name: file.name, type: file.type || '', size: file.size || 0 },
    rawText: raw,
    cleanedText: clean,
    importState: IMPORT_STATE.IMPORT_READY,
    importStatus: 'IMPORT_SUCCESS',
    blocks: extracted.enterprise?.lines || [],
    structuredResume: null,
    templateData: null,
    resumeData,
    errors: extracted.errors || [],
    warnings: [
      ...(extracted.warnings || []),
      'TEXT_FIRST_IMPORT',
      decision.reason,
      'NO_PARSER',
      'NO_RETRY',
    ],
    extractionMethod: extracted.extractionMethod,
    extractionDebug,
    importDecisionReason: decision.reason,
    importDecisionDestination: decision.destination,
    success: true,
    textFirst: true,
    ocrAttempted: extracted.ocrAttempted === true,
    engine: 'createResumeFromText',
  };
}

export { IMPORT_DECISION_REASON };
