/**
 * Canonical product import — single path for file/paste/sample/replace.
 *
 * detectFileType → extractText → normalizeText → buildResumeData
 */

import { detectInputFileType } from '../extraction/file-type-detect.js';
import { extractFromFileDetailed } from '../extraction/extract-file.js';
import { resolveStructureFirstParserText } from '../extraction/structure-first-parser-text.js';
import { getCachedPdfOcrIfReady } from '../extraction/pdf-ocr-cache-store.js';
import { runHirelyImportFromText } from '../pipeline/hirely-import.js';
import { normalizePipelineTexts, coerceParserInputText } from '../pipeline/pipeline-contract.js';
import {
  buildResumeData,
  assertResumeDataContract,
  resumeDataFromImport,
  normalizeResumeData,
} from '../resume-data.js';
import { shouldSkipRemoteOcr } from '../runtime/static-mode.js';
import {
  IMPORT_STATUS,
  IMPORT_STATE,
  resolveImportStatus,
  resolveImportState,
  mapImportStateToLegacy,
  importStateAllowsParser,
} from './import-status.js';
import { logOcrPropagation, logOcrPropagate } from '../extraction/ocr-propagation-trace.js';
import {
  hasRenderableImportText,
  hasMeaningfulImportText,
} from './import-render-guard.js';
import {
  assessOcrBeforeParser,
  buildOcrParserBlockedResult,
} from './ocr-parser-gate.js';
import {
  REAL_CV_IMPORT_MIN_CHARS,
  REAL_CV_IMPORT_FAILURE_REASONS,
} from './real-cv-import-constants.js';
import {
  buildEmptyExtractPasteResult,
  ensureImportContentAccounting,
} from './real-cv-import-root.js';
import { OCR_QUALITY_FAIL_MSG } from '../extraction/ocr-quality-score.js';
import { OCR_PARTIAL_REVIEW_MSG } from '../extraction/pdf-extraction-timeout.js';
import { hirelyProductLog } from '../runtime/hirely-debug.js';
import { logResumeDataCounts } from '../runtime/runtime-version.js';
import { resolveHonestImportState } from '../validation/extraction-reliability.js';
import { attachUniversalImportMeta } from './universal-import-pipeline.js';
import {
  enterpriseHasSpatialParseInput,
  resolveBridgeLockedFromImport,
  buildImportPathDebug,
} from '../parsing/cv-block-parser-bridge.js';
import {
  isSimpleImportMode,
  simpleCanonicalImportFromFile,
} from './simple-import-mode.js';
import {
  fileNeedsOcrPipeline,
  isOcrAutoImportEnabled,
  ocrConfidenceWarning,
} from './ocr-auto-import.js';
import {
  buildGuaranteedImportResult,
  importFailureUserMessage,
} from './import-fallback-chain.js';
import {
  isExactTranscriptionMode,
  exactTranscriptionFromExtracted,
  activateExactTranscriptionExtraction,
} from './exact-transcription-import.js';
import {
  assessOcrImportUsability,
  assessOcrImportUsabilityRaw,
  hydrateExtractedImportText,
  coerceImportStateForUsableOcr,
  importMustNotPasteAfterUsableOcr,
  logImportFinal,
  guardPasteImportResult,
  awaitOcrSettlementBeforeImportPaste,
  buildImportDecisionFromExtracted,
} from './ocr-import-usability.js';
import {
  OCR_SETTLEMENT,
  resolveOcrSettlementState,
  markPdfImageOnlyOcrSettled,
  isPdfImageOnlyRoute,
} from './ocr-settlement.js';
import { pdfImportBarrierTimeoutMs } from '../extraction/pdf-extraction-timeout.js';
import { peekLastEnterpriseExtraction } from '../extraction/extraction-session.js';
import { attachImportDecisionToResult } from './import-ui-routing.js';
import { resolveAutomaticImportRoute } from './import-decision-final.js';

export { detectInputFileType as detectFileType };
export { isExactTranscriptionMode } from './exact-transcription-import.js';

/**
 * Normalize canonical result metrics before automatic import routing.
 * @param {object} result
 * @param {object} [opts]
 */
function withCanonicalImportRouteMetrics(result = {}, opts = {}) {
  const metrics = buildImportDecisionFromExtracted(
    {
      ...result,
      enterprise: result.enterprise || result.enterpriseExtraction,
      fileType: result.fileType || opts.fileType,
    },
    opts
  );
  const ocrAttempted = result.ocrAttempted === true || metrics.ocrAttempted === true;
  const ocrUsable = result.ocrUsable === true || metrics.ocrUsable === true;
  const ocrTextLength =
    ocrUsable || ocrAttempted
      ? Math.max(
          0,
          Number(result.ocrTextLength) || 0,
          Number(metrics.ocrTextLength) || 0
        )
      : 0;
  return {
    ...result,
    fileType: result.fileType || metrics.fileType || opts.fileType,
    nativeTextLength: result.nativeTextLength ?? metrics.nativeTextLength ?? 0,
    ocrTextLength,
    ocrUsable,
    ocrAttempted,
  };
}

/**
 * Commit IMPORT_DECISION from canonical pipeline result (policy SSOT fields).
 * @param {object} result
 * @param {object} [opts]
 */
function commitCanonicalImportDecision(result, opts = {}) {
  const normalized = withCanonicalImportRouteMetrics(result, opts);
  const decision = resolveAutomaticImportRoute({
    fileType: normalized.fileType,
    nativeTextLength: normalized.nativeTextLength,
    ocrTextLength: normalized.ocrTextLength,
    ocrUsable: normalized.ocrUsable,
    resumeData: normalized.resumeData,
    structuredInput: normalized.structuredInput,
    ocrStructuredInput: normalized.ocrStructuredInput,
    ocrAttempted: normalized.ocrAttempted,
    unsupported: result.unsupported === true,
    forceExactTranscription: isExactTranscriptionMode(opts),
  });
  return attachImportDecisionToResult(normalized, decision, { ...opts, skipDecisionLog: true });
}

/**
 * @param {File} file
 */
function fileKind(file) {
  return detectInputFileType(file).kind;
}

/**
 * PDF/DOCX uploads must use the structure-first production pipeline (spatial bridge SSOT).
 * Simple text-first rewrite is only for paste/TXT and legacy V1 paths.
 * @param {File} file
 * @param {object} [opts]
 */
function shouldUseFullStructureImport(file, opts = {}) {
  if (opts.structureFirst === false) return false;
  if (opts.structureFirst === true) return true;
  const kind = fileKind(file);
  return kind === 'pdf' || kind === 'docx';
}

/**
 * @param {object} extracted
 */
function guaranteedOrPaste(extracted, file, fileType, reason) {
  const guaranteed = buildGuaranteedImportResult(
    { ...extracted, file, fileType },
    { fileType, extractionMethod: extracted.extractionMethod }
  );
  if (guaranteed) {
    guaranteed.warnings = [...(guaranteed.warnings || []), reason || 'GUARANTEED_FALLBACK'];
    return attachUniversalImportMeta(guaranteed, { ...extracted, file });
  }
  return attachUniversalImportMeta(
    buildEmptyExtractPasteResult(
      { ...extracted, file },
      fileType,
      extracted.importFailureReason || reason || resolveExtractFailureReason(extracted)
    ),
    { ...extracted, file }
  );
}

/**
 * @param {object} extracted
 */
function resolveExtractFailureReason(extracted) {
  if (extracted.importStatus === IMPORT_STATUS.PDF_OCR_TIMEOUT) {
    return REAL_CV_IMPORT_FAILURE_REASONS.ocr_timeout;
  }
  if (extracted.ocrGate && extracted.ocrGate.pass === false) {
    return REAL_CV_IMPORT_FAILURE_REASONS.ocr_quality;
  }
  return REAL_CV_IMPORT_FAILURE_REASONS.empty_extract;
}

/**
 * @param {File} file
 * @returns {Promise<{ fileType: string, rawText: string, cleanedText: string, extractionMethod: string, warnings: string[], errors: string[], enterprise?: object, pdfExtraction?: object }>}
 */
export async function extractTextFromFile(file) {
  const fileType = fileKind(file);
  const warnings = [];
  const errors = [];

  if (shouldSkipRemoteOcr()) {
    warnings.push('STATIC_MODE_SKIP_REMOTE_OCR');
  }

  try {
    const detailed = await extractFromFileDetailed(file);
    let ent = detailed.enterprise || {};
    let raw = String(ent.rawExtraction || detailed.text || '').trim();
    let cleaned = String(ent.cleanedText || raw).trim();
    const hydrated = hydrateExtractedImportText({
      fileType,
      rawText: raw,
      cleanedText: cleaned,
      extractionMethod: detailed.method || fileType,
      enterprise: ent,
      pdfExtraction: detailed.pdfExtraction,
      warnings,
      errors,
      importState: detailed.importState,
      importStatus: detailed.importStatus,
    });
    raw = String(hydrated.rawText || '').trim();
    cleaned = String(hydrated.cleanedText || raw).trim();
    ent = hydrated.enterprise || ent;
    const usabilityRaw = assessOcrImportUsabilityRaw(hydrated);
    const settledExtracted = markPdfImageOnlyOcrSettled(
      { ...hydrated, fileType },
      usabilityRaw,
      isPdfImageOnlyRoute({ fileType, nativeTextLength: usabilityRaw.nativeTextLength })
        ? resolveOcrSettlementState(usabilityRaw, {})
        : undefined
    );
    const usability = assessOcrImportUsability(settledExtracted);
    logOcrPropagate('CANONICAL_EXTRACT', { CANONICAL_RAW_TEXT_LENGTH: raw.length });
    logOcrPropagation('CANONICAL_EXTRACT', { text: raw, lines: ent.lines || detailed.lines });
    let importState =
      detailed.importState ||
      resolveImportState(raw, {
        errors,
        method: detailed.method,
        extractionMethod: detailed.method || fileType,
        ocrUsable: usability.usable,
      });
    if (usability.usable && importState === IMPORT_STATE.IMPORT_NEEDS_PASTE) {
      importState =
        raw.length >= REAL_CV_IMPORT_MIN_CHARS
          ? IMPORT_STATE.IMPORT_READY
          : IMPORT_STATE.IMPORT_PARTIAL;
    }
    if (
      detailed.enterprise?.pdfExtraction?.recoveredAfterTimeout &&
      raw.length >= REAL_CV_IMPORT_MIN_CHARS
    ) {
      importState = IMPORT_STATE.IMPORT_PARTIAL;
    }
    const importStatus = mapImportStateToLegacy(importState);
    hirelyProductLog('EXTRACTION_EXTRACTED', {
      importState,
      chars: raw.length,
      ocrUsable: usability.usable,
      ocrAttempted: usability.ocrAttempted,
      ocrSettled: settledExtracted.ocrSettled,
    });
    return {
      fileType,
      rawText: raw,
      cleanedText: cleaned,
      extractionMethod: detailed.method || fileType,
      importState,
      importStatus,
      warnings: usability.usable ? [...warnings, 'OCR_USABLE_CONTINUE'] : warnings,
      errors,
      enterprise: ent,
      pdfExtraction: detailed.pdfExtraction,
      ocrAttempted: usability.ocrAttempted,
      ocrUsable: usability.usable,
      ocrSettlement: settledExtracted.ocrSettlement,
      ocrSettled: settledExtracted.ocrSettled,
    };
  } catch (err) {
    const ocrTimedOut =
      err?.code === 'OCR_TIMEOUT' ||
      err?.code === 'OCR_ABSOLUTE_TIMEOUT' ||
      err?.message === 'PDF_EXTRACTION_TIMEOUT';
    if (!ocrTimedOut) {
      console.error('EXTRACT_TEXT_FAILED', err);
    } else {
      hirelyProductLog('OCR_TIMEOUT', { code: err?.code || 'OCR_TIMEOUT' });
    }
    if (ocrTimedOut) {
      const pageCount =
        Number(globalThis.HIRELY_PDF_PAGE_COUNT) > 0
          ? Number(globalThis.HIRELY_PDF_PAGE_COUNT)
          : 2;
      const settled = await awaitOcrSettlementBeforeImportPaste(file, {
        fileType,
        timedOut: true,
        pageCount,
        maxWaitMs: pdfImportBarrierTimeoutMs(pageCount),
      });
      if (settled.ocrUsable && importMustNotPasteAfterUsableOcr(settled)) {
        const rawSettled = String(settled.rawText || '').trim();
        const importStateSettled =
          rawSettled.length >= REAL_CV_IMPORT_MIN_CHARS
            ? IMPORT_STATE.IMPORT_READY
            : IMPORT_STATE.IMPORT_PARTIAL;
        hirelyProductLog('OCR_SETTLEMENT_LATE_SUCCESS', {
          chars: rawSettled.length,
          settlement: settled.ocrSettlement,
        });
        logImportFinal(importStateSettled, {
          fileType,
          enterprise: settled.enterprise || peekLastEnterpriseExtraction(),
          ocrAttempted: true,
          ocrUsable: true,
          ocrSettlement: settled.ocrSettlement,
          ocrSettledBeforeCommit: true,
        });
        return {
          fileType,
          rawText: rawSettled,
          cleanedText: String(settled.cleanedText || rawSettled).trim(),
          extractionMethod: settled.extractionMethod || fileType,
          importState: importStateSettled,
          importStatus: mapImportStateToLegacy(importStateSettled),
          warnings: [...warnings, 'OCR_SETTLEMENT_RECOVERED'],
          errors,
          enterprise: settled.enterprise || peekLastEnterpriseExtraction(),
          ocrAttempted: true,
          ocrUsable: true,
          ocrSettlement: settled.ocrSettlement,
          ocrSettled: true,
        };
      }
      if (
        settled.ocrSettlement === OCR_SETTLEMENT.TIMED_OUT_PENDING ||
        settled.ocrInFlight === true
      ) {
        logImportFinal(IMPORT_STATE.IMPORT_PARTIAL, {
          fileType,
          ocrAttempted: true,
          ocrSettlement: settled.ocrSettlement,
          ocrSettledBeforeCommit: false,
        });
        return {
          fileType,
          rawText: '',
          cleanedText: '',
          extractionMethod: fileType,
          importState: IMPORT_STATE.IMPORT_PARTIAL,
          importStatus: IMPORT_STATUS.PARTIAL_TEXT_RECOVERED,
          warnings: [...warnings, 'OCR_SETTLEMENT_PENDING'],
          errors,
          ocrAttempted: true,
          ocrInFlight: true,
          ocrSettlement: settled.ocrSettlement,
          ocrSettled: false,
        };
      }
      const cached = getCachedPdfOcrIfReady(file);
      const cachedText = String(cached?.text || '').trim();
      if (cachedText.length >= REAL_CV_IMPORT_MIN_CHARS) {
        logOcrPropagate('CANONICAL_EXTRACT', {
          CANONICAL_RAW_TEXT_LENGTH: cachedText.length,
          note: 'timeout_cache_recovery',
        });
        hirelyProductLog('OCR_TIMEOUT', { code: err?.code || 'OCR_TIMEOUT', recovered: true });
        hirelyProductLog('IMPORT_FINAL', IMPORT_STATE.IMPORT_PARTIAL);
        return {
          fileType,
          rawText: cachedText,
          cleanedText: cachedText,
          extractionMethod: fileType,
          importState: IMPORT_STATE.IMPORT_PARTIAL,
          importStatus: IMPORT_STATUS.PARTIAL_TEXT_RECOVERED,
          warnings: [...warnings, 'OCR_TIMEOUT'],
          errors,
          enterprise: { rawExtraction: cachedText, lines: cached?.lines || [], method: 'ocr' },
        };
      }
      const msg = OCR_PARTIAL_REVIEW_MSG;
      errors.push(msg);
      hirelyProductLog('OCR_TIMEOUT', { code: err?.code || 'OCR_TIMEOUT' });
      const timeoutPaste = guardPasteImportResult(
        {
          fileType,
          rawText: '',
          cleanedText: '',
          extractionMethod: fileType,
          importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
          importStatus: IMPORT_STATUS.PDF_OCR_TIMEOUT,
          warnings: [...warnings, 'OCR_TIMEOUT'],
          errors,
          importFailureReason: REAL_CV_IMPORT_FAILURE_REASONS.ocr_timeout,
          enterprise: peekLastEnterpriseExtraction(),
          ocrAttempted: true,
          ocrSettlement: OCR_SETTLEMENT.TIMED_OUT_FINAL,
          ocrSettled: true,
          ocrSettledBeforeCommit: true,
        },
        { fileType, enterprise: peekLastEnterpriseExtraction(), ocrAttempted: true }
      );
      logImportFinal(timeoutPaste.importState, {
        fileType,
        enterprise: timeoutPaste.enterprise || peekLastEnterpriseExtraction(),
        ocrAttempted: true,
        ocrUsable: timeoutPaste.ocrUsable,
        ocrSettlement: timeoutPaste.ocrSettlement || OCR_SETTLEMENT.TIMED_OUT_FINAL,
        ocrSettledBeforeCommit: true,
      });
      return timeoutPaste;
    }
    if (err?.code === 'OCR_QUALITY_FAILED') {
      const msg = String(err?.message || OCR_QUALITY_FAIL_MSG);
      errors.push(msg);
      const sessionEntEarly = peekLastEnterpriseExtraction();
      if (sessionEntEarly) {
        const recoveredEarly = hydrateExtractedImportText({
          fileType,
          rawText: sessionEntEarly.rawExtraction || sessionEntEarly.text || '',
          cleanedText: sessionEntEarly.cleanedText || sessionEntEarly.rawExtraction || '',
          extractionMethod: sessionEntEarly.method || fileType,
          enterprise: sessionEntEarly,
          ocrAttempted: true,
        });
        const usabilityEarly = assessOcrImportUsability(recoveredEarly);
        if (usabilityEarly.usable) {
          const rawEarly = String(recoveredEarly.rawText || '').trim();
          const importStateEarly =
            rawEarly.length >= REAL_CV_IMPORT_MIN_CHARS
              ? IMPORT_STATE.IMPORT_READY
              : IMPORT_STATE.IMPORT_PARTIAL;
          hirelyProductLog('EXTRACTION_EXTRACTED', {
            importState: importStateEarly,
            chars: rawEarly.length,
            ocrUsable: true,
            recovered: 'OCR_QUALITY_FAILED',
          });
          return {
            fileType,
            rawText: rawEarly,
            cleanedText: String(recoveredEarly.cleanedText || rawEarly).trim(),
            extractionMethod: recoveredEarly.extractionMethod || fileType,
            importState: importStateEarly,
            importStatus: mapImportStateToLegacy(importStateEarly),
            warnings: [...warnings, 'OCR_SESSION_RECOVERY', 'OCR_QUALITY_GATE'],
            errors,
            enterprise: recoveredEarly.enterprise || sessionEntEarly,
            ocrAttempted: true,
            ocrUsable: true,
          };
        }
      }
      const qualityPaste = guardPasteImportResult(
        {
          fileType,
          rawText: '',
          cleanedText: '',
          extractionMethod: fileType,
          importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
          importStatus: IMPORT_STATUS.PDF_TEXT_EMPTY,
          warnings: [...warnings, 'OCR_QUALITY_GATE'],
          errors,
          ocrGate: err.ocrQuality || null,
          importFailureReason: REAL_CV_IMPORT_FAILURE_REASONS.ocr_quality,
          enterprise: peekLastEnterpriseExtraction(),
          ocrAttempted: true,
        },
        { fileType, enterprise: peekLastEnterpriseExtraction(), ocrAttempted: true }
      );
      logImportFinal(qualityPaste.importState, {
        fileType,
        enterprise: qualityPaste.enterprise || peekLastEnterpriseExtraction(),
        ocrAttempted: true,
        ocrUsable: qualityPaste.ocrUsable,
      });
      return qualityPaste;
    }
    const cached = getCachedPdfOcrIfReady(file);
    const cachedText = String(cached?.text || '').trim();
    const cachedGate = assessOcrBeforeParser(cachedText, {
      method: fileType,
      extractionMethod: fileType,
      lines: cached?.lines,
    });
    if (cachedText.length >= REAL_CV_IMPORT_MIN_CHARS && cachedGate.pass) {
      logOcrPropagate('CANONICAL_EXTRACT', {
        CANONICAL_RAW_TEXT_LENGTH: cachedText.length,
        note: 'cache_recovery',
      });
      return {
        fileType,
        rawText: cachedText,
        cleanedText: cachedText,
        extractionMethod: fileType,
        importState: IMPORT_STATE.IMPORT_PARTIAL,
        importStatus: IMPORT_STATUS.PARTIAL_TEXT_RECOVERED,
        warnings: [...warnings, 'OCR_CACHE_RECOVERY'],
        errors,
      };
    }
    logOcrPropagate('CANONICAL_EXTRACT', {
      CANONICAL_RAW_TEXT_LENGTH: 0,
      note: err?.code || err?.message || 'EXTRACT_FAILED',
    });
    const msg = String(err?.message || 'EXTRACT_FAILED');
    errors.push(msg);
    const sessionEnt = peekLastEnterpriseExtraction();
    if (
      (err?.code === 'OCR_INSUFFICIENT_TEXT' || err?.code === 'OCR_QUALITY_FAILED') &&
      sessionEnt
    ) {
      const recovered = hydrateExtractedImportText({
        fileType,
        rawText: sessionEnt.rawExtraction || sessionEnt.text || '',
        cleanedText: sessionEnt.cleanedText || sessionEnt.rawExtraction || '',
        extractionMethod: sessionEnt.method || fileType,
        enterprise: sessionEnt,
        ocrAttempted: true,
      });
      const usability = assessOcrImportUsability(recovered);
      if (usability.usable) {
        const raw = String(recovered.rawText || '').trim();
        const importState =
          raw.length >= REAL_CV_IMPORT_MIN_CHARS
            ? IMPORT_STATE.IMPORT_READY
            : IMPORT_STATE.IMPORT_PARTIAL;
        hirelyProductLog('EXTRACTION_EXTRACTED', {
          importState,
          chars: raw.length,
          ocrUsable: true,
          recovered: err?.code,
        });
        return {
          fileType,
          rawText: raw,
          cleanedText: String(recovered.cleanedText || raw).trim(),
          extractionMethod: recovered.extractionMethod || fileType,
          importState,
          importStatus: mapImportStateToLegacy(importState),
          warnings: [...warnings, 'OCR_SESSION_RECOVERY', String(err?.code || '')],
          errors,
          enterprise: recovered.enterprise || sessionEnt,
          ocrAttempted: true,
          ocrUsable: true,
        };
      }
    }
    const importState = resolveImportState('', { errors, method: fileType });
    hirelyProductLog('IMPORT_FINAL', importState);
    return {
      fileType,
      rawText: '',
      cleanedText: '',
      extractionMethod: fileType,
      importState,
      importStatus: mapImportStateToLegacy(importState),
      warnings,
      errors,
    };
  }
}

/**
 * @param {string} rawText
 * @param {string} [cleanedText]
 */
export function normalizeText(rawText, cleanedText = '') {
  const texts = normalizePipelineTexts(rawText, cleanedText || rawText);
  const clean = coerceParserInputText(texts.cleanedText, texts.rawText);
  return { rawText: texts.rawText, cleanedText: clean || texts.rawText };
}

/**
 * Run full import for a file (extract + parse → resumeData).
 * @param {File} file
 * @param {object} [opts]
 */
export async function canonicalImportFromFile(file, opts = {}) {
  if (isExactTranscriptionMode(opts)) {
    activateExactTranscriptionExtraction(true);
    const fileType = fileKind(file);
    const extracted = await extractTextFromFile(file);
    let result = exactTranscriptionFromExtracted(file, extracted, { ...opts, fileType });
    if (
      result.importState === IMPORT_STATE.IMPORT_NEEDS_PASTE &&
      (extracted.ocrUsable || importMustNotPasteAfterUsableOcr(extracted))
    ) {
      const sessionEnt = peekLastEnterpriseExtraction();
      const retryExtracted = hydrateExtractedImportText({
        ...extracted,
        enterprise: extracted.enterprise || sessionEnt,
        ocrAttempted: true,
      });
      if (importMustNotPasteAfterUsableOcr(retryExtracted)) {
        result = exactTranscriptionFromExtracted(file, retryExtracted, { ...opts, fileType });
      }
    }
    return result;
  }
  activateExactTranscriptionExtraction(false);
  if (isSimpleImportMode() && !shouldUseFullStructureImport(file, opts)) {
    return simpleCanonicalImportFromFile(file, opts);
  }
  const fileType = fileKind(file);
  const extracted = await extractTextFromFile(file);
  return canonicalImportFromExtracted(file, extracted, { ...opts, fileType });
}

/**
 * Run canonical parse + resumeData build after extraction (product path + QA hooks).
 * @param {File} file
 * @param {object} extracted — output of extractTextFromFile
 * @param {object} [opts]
 */
export async function canonicalImportFromExtracted(file, extracted, opts = {}) {
  if (isExactTranscriptionMode(opts)) {
    activateExactTranscriptionExtraction(true);
    return exactTranscriptionFromExtracted(file, extracted, opts);
  }
  activateExactTranscriptionExtraction(false);

  const hydratedExtracted = hydrateExtractedImportText(extracted);
  const usability = assessOcrImportUsability(hydratedExtracted, {
    strictParser: !isExactTranscriptionMode(opts),
  });

  const ocrAuto = isOcrAutoImportEnabled() && fileNeedsOcrPipeline(file);
  const fileType = opts.fileType || fileKind(file);
  let importState =
    hydratedExtracted.importState ||
    resolveImportState(hydratedExtracted.rawText, {
      errors: hydratedExtracted.errors,
      extractionMethod: hydratedExtracted.extractionMethod,
      ocrUsable: usability.usable,
    });
  if (usability.usable && importState === IMPORT_STATE.IMPORT_NEEDS_PASTE) {
    importState =
      String(hydratedExtracted.rawText || '').trim().length >= REAL_CV_IMPORT_MIN_CHARS
        ? IMPORT_STATE.IMPORT_READY
        : IMPORT_STATE.IMPORT_PARTIAL;
  }

  if (!hasRenderableImportText(hydratedExtracted.rawText, hydratedExtracted.cleanedText) && !usability.usable) {
    if (ocrAuto && String(hydratedExtracted.rawText || hydratedExtracted.cleanedText || '').trim().length > 0) {
      hydratedExtracted.warnings = [...(hydratedExtracted.warnings || []), 'OCR_PARTIAL_EMPTY_REVIEW'];
    } else {
      return guaranteedOrPaste(
        { ...hydratedExtracted, file },
        file,
        fileType,
        hydratedExtracted.importFailureReason || resolveExtractFailureReason(hydratedExtracted)
      );
    }
  }

  if (
    !hasMeaningfulImportText(hydratedExtracted.rawText, hydratedExtracted.cleanedText) &&
    !usability.usable
  ) {
    return guaranteedOrPaste({ ...hydratedExtracted, file }, file, fileType, 'thin_text');
  }

  if (!importStateAllowsParser(importState) && !usability.usable) {
    return guaranteedOrPaste(
      { ...hydratedExtracted, file },
      file,
      fileType,
      resolveExtractFailureReason(hydratedExtracted)
    );
  }

  const norm = normalizeText(hydratedExtracted.rawText, hydratedExtracted.cleanedText);
  const structureText = resolveStructureFirstParserText(hydratedExtracted.enterprise);
  const parserNorm = normalizeText(
    structureText.structureFirst && structureText.rawText ? structureText.rawText : norm.rawText,
    structureText.structureFirst && structureText.cleanedText
      ? structureText.cleanedText
      : norm.cleanedText
  );
  const ocrGate = assessOcrBeforeParser(parserNorm.rawText, {
    method: extracted.extractionMethod,
    extractionMethod: extracted.extractionMethod,
    fileType: extracted.fileType,
    enterprise: extracted.enterprise,
    lines: extracted.enterprise?.lines,
  });
  const ocrConfidence = Number(ocrGate.qualityScore) || 0;
  const lowConfWarn = ocrConfidenceWarning(ocrConfidence);
  const ocrWarnings = [...extracted.warnings];
  if (lowConfWarn && !ocrGate.skipped) {
    ocrWarnings.push('OCR_LOW_CONFIDENCE');
  }
  if (!ocrGate.pass && !ocrGate.skipped) {
    if (usability.usable) {
      ocrWarnings.push('OCR_PARSER_GATE_BYPASSED_USABLE');
    } else {
      const guaranteed = buildGuaranteedImportResult(
      {
        ...extracted,
        file,
        fileType,
        rawText: norm.rawText,
        cleanedText: norm.cleanedText,
        extractionMethod: extracted.extractionMethod,
        warnings: [...ocrWarnings, 'OCR_PARSER_GATE'],
        errors: extracted.errors,
        ocrConfidence,
        ocrLowConfidenceWarning: lowConfWarn,
      },
      { fileType, extractionMethod: extracted.extractionMethod }
    );
    if (guaranteed) {
      return attachUniversalImportMeta(guaranteed, {
        ...extracted,
        file,
        rawText: norm.rawText,
        cleanedText: norm.cleanedText,
      });
    }
    return attachUniversalImportMeta(
      buildOcrParserBlockedResult(ocrGate, {
        fileType,
        rawText: norm.rawText,
        cleanedText: norm.cleanedText,
        extractionMethod: extracted.extractionMethod,
        warnings: [...ocrWarnings, 'OCR_PARSER_GATE'],
        errors: extracted.errors,
        enterprise: extracted.enterprise,
        pdfExtraction: extracted.pdfExtraction,
        file,
      }),
      { ...extracted, file, rawText: norm.rawText, cleanedText: norm.cleanedText }
    );
    }
  }
  logOcrPropagation('CANONICAL_BEFORE_PARSER', {
    text: parserNorm.rawText,
    note: `${importState}|parser_source=${structureText.source}|structure_first=${structureText.structureFirst}`,
  });
  const imported = await runHirelyImportFromText(parserNorm.rawText, {
    ...opts,
    file,
    extractionMethod: extracted.extractionMethod,
    enterpriseExtraction: extracted.enterprise,
    pdfExtraction: extracted.pdfExtraction,
    structureFirst: structureText.structureFirst,
    parserTextSource: structureText.source,
    extractionLines: structureText.lines,
    spatialBlocks: structureText.spatialBlocks,
  });

  const bridgeCtx = resolveBridgeLockedFromImport(imported);
  const bridgeLocked = bridgeCtx.applied;
  const spatialInput = enterpriseHasSpatialParseInput(extracted.enterprise);

  let resumeData;
  if (bridgeLocked && imported.resumeData?.meta?.blockParserBridgeApplied) {
    resumeData = buildResumeData({
      importResult: imported,
      structured: imported.structuredResume,
      rawText: parserNorm.rawText,
      cleanedText: String(imported.cleanedText || parserNorm.cleanedText),
      sourceText: parserNorm.rawText,
      file,
      fileType,
      extractionMethod: extracted.extractionMethod,
      warnings: [...ocrWarnings, ...(imported.warnings || [])],
      errors: [...extracted.errors, ...(imported.errors || [])],
      ocrConfidence: ocrGate.skipped ? null : ocrConfidence,
      blockParserBridgeApplied: true,
    });
    resumeData.meta = {
      ...resumeData.meta,
      fileName: file?.name || resumeData.meta.fileName || '',
      fileType: fileType || resumeData.meta.fileType || '',
      extractionMethod: extracted.extractionMethod || resumeData.meta.extractionMethod || '',
      rawText: parserNorm.rawText,
      cleanedText: String(imported.cleanedText || parserNorm.cleanedText),
      extractionFileRawText: norm.rawText,
      parserTextSource: structureText.source,
      structureFirstParser: structureText.structureFirst,
      flatTextFallbackSuppressed: structureText.structureFirst,
      warnings: [
        ...new Set([
          ...(resumeData.meta.warnings || []),
          ...ocrWarnings,
          ...(imported.warnings || []),
        ]),
      ],
      errors: [
        ...new Set([
          ...(resumeData.meta.errors || []),
          ...extracted.errors,
          ...(imported.errors || []),
        ]),
      ],
      blockParserBridgeApplied: true,
      spatialParseInput: resumeData.meta.spatialParseInput ?? spatialInput,
      flatRepairSkipped: true,
      parseResponseSchema: bridgeCtx.parseResponse?.schema || 'hirely.parse_response.v1',
      ocrConfidence: ocrGate.skipped ? resumeData.meta.ocrConfidence : ocrConfidence,
    };
  } else {
    if (spatialInput && !bridgeLocked) {
      ocrWarnings.push('SPATIAL_PARSE_DEGRADED');
    }
    resumeData = buildResumeData({
      importResult: imported,
      structured: imported.structuredResume,
      rawText: parserNorm.rawText,
      cleanedText: String(imported.cleanedText || parserNorm.cleanedText),
      file,
      fileType,
      extractionMethod: extracted.extractionMethod,
      warnings: [...ocrWarnings, ...(imported.warnings || [])],
      errors: [...extracted.errors, ...(imported.errors || [])],
      ocrConfidence: ocrGate.skipped ? null : ocrConfidence,
      blockParserBridgeApplied: bridgeLocked,
    });
    resumeData.meta = {
      ...resumeData.meta,
      extractionFileRawText: norm.rawText,
      parserTextSource: structureText.source,
      structureFirstParser: structureText.structureFirst,
      flatTextFallbackSuppressed: structureText.structureFirst,
    };
  }

  const importDebug = {
    ...buildImportPathDebug(imported, resumeData, {
      enterprise: extracted.enterprise,
    }),
    spatial_parse_input: spatialInput,
    bridge_locked: bridgeLocked,
    flat_repair_skipped: bridgeLocked,
    page_document_classification:
      bridgeCtx.parseResponse?.page_document_classification ||
      imported.structuredResume?.metadata?.pageDocumentClassification ||
      null,
    parse_response_schema: bridgeCtx.parseResponse?.schema || imported.parseResponse?.schema || null,
    parser_text_source: structureText.source,
    structure_first_parser: structureText.structureFirst,
    extraction_line_count: structureText.lines?.length || extracted.enterprise?.lines?.length || 0,
    spatial_block_count:
      extracted.enterprise?.spatialBlocks?.length ||
      extracted.enterprise?.metadata?.spatialBlocks?.length ||
      0,
  };

  const accounted = ensureImportContentAccounting({
    rawText: parserNorm.rawText,
    resumeData,
    reviewQueue: imported.reviewQueue || [],
    rejectedGarbage: resumeData.meta?.rejectedGarbage || [],
  });
  resumeData = accounted.resumeData;

  logResumeDataCounts(resumeData, 'canonicalImportFromFile');

  const honest = resolveHonestImportState({
    proposedState: extracted.importState,
    rawText: parserNorm.rawText,
    cleanedText: String(imported.cleanedText || parserNorm.cleanedText),
    resumeData,
    ocrUsable: usability.usable,
    ocrAttempted: usability.ocrAttempted,
    enterprise: extracted.enterprise,
  });
  importState = coerceImportStateForUsableOcr(honest.state, {
    ...hydratedExtracted,
    rawText: parserNorm.rawText,
    cleanedText: String(imported.cleanedText || parserNorm.cleanedText),
    ocrUsable: usability.usable,
    ocrAttempted: usability.ocrAttempted,
  });

  return attachUniversalImportMeta(
    {
      fileType,
      rawText: parserNorm.rawText,
      cleanedText: String(imported.cleanedText || parserNorm.cleanedText),
      extractionMethod: extracted.extractionMethod,
      importState,
      importStatus: imported.importStatus || IMPORT_STATUS.IMPORT_SUCCESS,
      structuredResume: imported.structuredResume,
      templateData: imported.templateData,
      resumeData,
      warnings: resumeData.meta.warnings,
      errors: resumeData.meta.errors,
      blocks: imported.blocks || [],
      debugReport: imported.debugReport || null,
      parseResponse: imported.parseResponse || bridgeCtx.parseResponse || null,
      importDebug,
      reviewQueue: accounted.reviewQueue,
      rejectedGarbage: accounted.rejectedGarbage,
      ocrConfidence: ocrGate.skipped ? null : ocrConfidence,
      ocrLowConfidenceWarning: lowConfWarn,
      ocrAttempted: usability.ocrAttempted,
      ocrUsable: usability.usable,
      file,
    },
    {
      ...extracted,
      file,
      rawText: parserNorm.rawText,
      cleanedText: String(imported.cleanedText || parserNorm.cleanedText),
    }
  );
}

/**
 * Paste / sample / replace text — same parser path as file.
 * @param {string} text
 * @param {object} [opts]
 */
export async function canonicalImportFromText(text, opts = {}) {
  const norm = normalizeText(text, text);
  const imported = await runHirelyImportFromText(norm.rawText, opts);
  const resumeData = buildResumeData({
    importResult: imported,
    rawText: norm.rawText,
    cleanedText: String(imported.cleanedText || norm.cleanedText),
    file: opts.file || null,
    fileType: opts.fileType || 'paste',
    extractionMethod: opts.extractionMethod || opts.source || 'paste',
    warnings: imported.warnings || [],
    errors: imported.errors || [],
  });

  return {
    fileType: opts.fileType || 'paste',
    rawText: norm.rawText,
    cleanedText: String(imported.cleanedText || norm.cleanedText),
    extractionMethod: opts.extractionMethod || 'paste',
    structuredResume: imported.structuredResume,
    templateData: imported.templateData,
    resumeData,
    warnings: resumeData.meta.warnings,
    errors: resumeData.meta.errors,
    blocks: imported.blocks || [],
    debugReport: imported.debugReport || null,
    reviewQueue: imported.reviewQueue || [],
  };
}
