/**
 * Exact transcription import — extraction only, no CV parser / template path.
 */

import { IMPORT_STATE, mapImportStateToLegacy } from './import-status.js';
import { buildExactTranscription } from '../extraction/exact-transcription-pipeline.js';
import { attachExactTranscriptionArtifactsClient } from '../extraction/exact-transcription-artifacts.client.js';
import {
  assessOcrImportUsability,
  hydrateExtractedImportText,
  importMustNotPasteAfterUsableOcr,
  isScannedPdfWithoutNativeText,
  resolveFinalImportState,
  logImportFinal,
} from './ocr-import-usability.js';
import { peekLastEnterpriseExtraction } from '../extraction/extraction-session.js';
import { attachUniversalImportMeta } from './universal-import-pipeline.js';
import { buildEmptyExtractPasteResult } from './real-cv-import-root.js';
import { OCR_FALLBACK_V1_PASTE_MAX_CHARS } from './ocr-fallback-v1.js';
import { REAL_CV_IMPORT_FAILURE_REASONS } from './real-cv-import-constants.js';
import { hirelyProductLog } from '../runtime/hirely-debug.js';

const PLACEHOLDER_MARKERS = [
  'Nom à vérifier',
  'Name to verify',
  'Titre à vérifier',
  'Title to verify',
];

/**
 * Structured CV parser path — explicit opt-in only.
 * @param {object} [opts]
 */
export function isStructuredImportMode(opts = {}) {
  if (opts.exactTranscription === true) return false;
  if (opts.mode === 'exact_transcription') return false;
  if (opts.exactTranscription === false) return true;
  if (opts.mode === 'structured') return true;
  if (opts.structuredImport === true) return true;
  return true;
}

/**
 * Exact transcription is debug/internal only — product upload uses automatic structured import.
 * @param {object} [opts]
 */
export function isExactTranscriptionMode(opts = {}) {
  if (isStructuredImportMode(opts)) return false;
  if (opts.exactTranscription === true) return true;
  if (opts.mode === 'exact_transcription') return true;
  if (globalThis.HIRELY_EXACT_TRANSCRIPTION === true) return true;
  if (globalThis.HIRELY_EXACT_TRANSCRIPTION_ACTIVE === true) return true;
  const search = globalThis.location?.search;
  if (typeof search === 'string') {
    if (/[?&]exactTranscription=1(?:&|$)/.test(search)) return true;
    if (/[?&]mode=transcription(?:&|$)/.test(search)) return true;
    if (/[?&]mode=structured(?:&|$)/.test(search)) return false;
  }
  return false;
}

/**
 * Set runtime flags so OCR/extraction uses fidelity settings before import UI applies.
 * @param {boolean} [active=true]
 */
export function activateExactTranscriptionExtraction(active = true) {
  if (typeof globalThis === 'undefined') return;
  try {
    globalThis.HIRELY_EXACT_TRANSCRIPTION_ACTIVE = !!active;
    if (active) globalThis.HIRELY_EXACT_TRANSCRIPTION = true;
    else {
      globalThis.HIRELY_EXACT_TRANSCRIPTION = false;
    }
  } catch {
    /* ignore */
  }
}

/**
 * @param {File|object} file
 * @param {object} extracted
 * @param {object} transcription
 */
export function buildExactTranscriptionImportResult(file, extracted, transcription) {
  const plain = String(transcription?.plain_text || '').trim();
  const warnings = [...(extracted.warnings || []), 'EXACT_TRANSCRIPTION_MODE'];
  const errors = [...(extracted.errors || [])];

  const result = {
    exactTranscription: true,
    parserSkipped: true,
    templateSuppressed: true,
    fileType: extracted.fileType,
    rawText: plain,
    cleanedText: plain,
    extractionMethod: extracted.extractionMethod,
    importState: IMPORT_STATE.IMPORT_READY,
    importStatus: 'EXACT_TRANSCRIPTION_READY',
    warnings,
    errors,
    enterprise: extracted.enterprise || null,
    extractionDebug: extracted.extractionDebug || extracted.enterprise?.metadata?.extractionDebug || null,
    transcription,
    resumeData: null,
    structuredResume: null,
    templateData: null,
    blocks: [],
    ocrConfidence: transcription?.diff_report?.ocr_confidence_summary?.avg ?? null,
  };

  try {
    globalThis.__HIRELY_EXACT_TRANSCRIPTION__ = transcription;
    attachExactTranscriptionArtifactsClient(transcription);
  } catch {
    /* ignore */
  }

  hirelyProductLog('IMPORT_FINAL', IMPORT_STATE.IMPORT_READY);

  return result;
}

/**
 * Exact transcription may open only when extracted/OCR text is usable — never on nativeTextLength === 0 alone as stop,
 * but also never fake READY when OCR produced nothing.
 * @param {object} hydrated
 * @param {object} [opts]
 */
function exactTranscriptionHasUsableContent(hydrated, opts = {}) {
  const usability = assessOcrImportUsability(hydrated, opts);
  const plain = Math.max(
    String(hydrated.rawText || '').trim().length,
    String(hydrated.cleanedText || '').trim().length
  );
  const fileType = String(opts.fileType || hydrated.fileType || '').toLowerCase();
  const scannedNoNative = isScannedPdfWithoutNativeText({
    fileType,
    nativeTextLength: usability.nativeTextLength,
    extractionMethod: hydrated.extractionMethod,
    enterprise: hydrated.enterprise,
    pdfExtraction: hydrated.pdfExtraction,
    ocrAttempted: usability.ocrAttempted,
  });

  if (usability.usable) return true;
  if (!scannedNoNative && plain > OCR_FALLBACK_V1_PASTE_MAX_CHARS) return true;
  if (['txt', 'docx', 'doc', 'paste'].includes(fileType) && plain > OCR_FALLBACK_V1_PASTE_MAX_CHARS) {
    return true;
  }
  return false;
}

/**
 * Run exact transcription build + import result wrapper.
 * @param {File|object} file
 * @param {object} extracted
 * @param {object} [opts]
 */
export function exactTranscriptionFromExtracted(file, extracted, opts = {}) {
  const sessionEnt = peekLastEnterpriseExtraction();
  const hydrated = hydrateExtractedImportText({
    ...extracted,
    enterprise: extracted.enterprise || sessionEnt,
  });
  const fileType = opts.fileType || hydrated.fileType;

  if (!exactTranscriptionHasUsableContent(hydrated, { ...opts, fileType })) {
    const usability = assessOcrImportUsability(hydrated, opts);
    const sessionHydrated = sessionEnt
      ? hydrateExtractedImportText({
          ...hydrated,
          enterprise: sessionEnt,
          ocrAttempted: true,
        })
      : null;
    if (
      sessionHydrated &&
      importMustNotPasteAfterUsableOcr({ ...sessionHydrated, ocrAttempted: true })
    ) {
      return buildExactTranscriptionFromHydrated(file, sessionHydrated, opts, fileType);
    }
    const failureReason =
      usability.ocrAttempted && !usability.usable
        ? REAL_CV_IMPORT_FAILURE_REASONS.ocr_quality
        : REAL_CV_IMPORT_FAILURE_REASONS.empty_extract;
    const paste = buildEmptyExtractPasteResult({ ...hydrated, file }, fileType, failureReason);
    if (paste.importState !== IMPORT_STATE.IMPORT_NEEDS_PASTE) {
      const retryHydrated = hydrateExtractedImportText({
        ...hydrated,
        ...paste,
        enterprise: paste.enterprise || sessionEnt || hydrated.enterprise,
        ocrAttempted: true,
      });
      return buildExactTranscriptionFromHydrated(file, retryHydrated, opts, fileType);
    }
    paste.ocrAttempted = usability.ocrAttempted;
    paste.ocrUsable = false;
    logImportFinal(IMPORT_STATE.IMPORT_NEEDS_PASTE, hydrated);
    return attachUniversalImportMeta(paste, { ...hydrated, file });
  }

  return buildExactTranscriptionFromHydrated(file, hydrated, opts, fileType);
}

function buildExactTranscriptionFromHydrated(file, hydrated, opts, fileType) {
  const transcription = buildExactTranscription({
    enterprise: hydrated.enterprise,
    extracted: hydrated,
    file,
    fileName: file?.name || opts.fileName,
    extractionMethod: hydrated.extractionMethod,
    fileType,
  });

  const json = JSON.stringify(transcription);
  for (const marker of PLACEHOLDER_MARKERS) {
    if (json.includes(marker)) {
      throw new Error(`EXACT_TRANSCRIPTION_PLACEHOLDER_LEAK:${marker}`);
    }
  }

  const result = buildExactTranscriptionImportResult(file, hydrated, transcription);
  result.ocrAttempted = hydrated.ocrAttempted === true;
  result.ocrUsable = assessOcrImportUsability(hydrated, opts).usable;
  return attachUniversalImportMeta(result, { ...hydrated, file });
}
