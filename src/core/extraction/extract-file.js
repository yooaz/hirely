/**
 * File extraction — routes by document type (PDF / DOCX / TXT / image).
 * No parsing; delegates to document-extract.js + enterprise engine.
 */

import {
  extractDocument,
  applyPdfOcrPolicy,
} from './document-extract.js';
import {
  setLastPdfExtraction,
  setLastOcrForensic,
  setLastEnterpriseExtraction,
  clearOcrPreprocessPreviews,
  clearLastOcrFusionInternal,
  clearLastOcrRotationDecision,
  clearLastNativePdfProbe,
  peekLastNativePdfProbe,
} from './extraction-session.js';
import { peekImportRunId } from '../import/import-run-guard.js';
import { logExtractionStep } from './file-buffer.js';
import {
  resolveImportStatus,
  resolveImportState,
  IMPORT_STATUS,
  IMPORT_STATE,
} from '../import/import-status.js';
import { hirelyDebugLog, hirelyProductLog } from '../runtime/hirely-debug.js';
import { detectInputFileType } from './file-type-detect.js';
import {
  PDF_EXTRACTION_MAX_MS,
  OCR_PARTIAL_REVIEW_MSG,
  withExtractionTimeout,
  pdfExtractionBudgetMs,
  pdfImportBarrierTimeoutMs,
} from './pdf-extraction-timeout.js';
import { isNativeTextRecoverable } from './native-text-trust.js';
import { evaluateOcrParserGate } from './ocr-quality-score.js';
import {
  getCachedPdfOcrIfReady,
  markPdfOcrTimedOut,
} from './pdf-ocr-cache-store.js';
import { awaitOcrSettlementForFile } from './pdf-ocr-settlement.js';
import { peekLastEnterpriseExtraction } from './extraction-session.js';
import { setOcrFailReason } from './ocr-runtime-diagnostics.js';
import {
  REAL_CV_IMPORT_MIN_CHARS,
} from '../import/real-cv-import-constants.js';
import {
  clearExtractionAuditTrail,
  recordExtractionAuditStage,
  printExtractionAuditSummary,
} from './extraction-audit.js';
import { logOcrPropagation, logOcrPropagate, joinedTextLength } from './ocr-propagation-trace.js';
import { buildExtractionSafeFallback } from '../runtime/runtime-stability-guard.js';
import { enrichMultiFormatExtraction } from './multi-format-extraction-engine.js';
import {
  buildUniversalImportLog,
  logUniversalImportPipeline,
} from '../import/universal-import-pipeline.js';
import {
  assessOcrImportUsability,
  assessOcrImportUsabilityRaw,
  hydrateExtractedImportText,
  coerceImportStateForUsableOcr,
} from '../import/ocr-import-usability.js';
import {
  OCR_SETTLEMENT,
  attachOcrSettlementMeta,
  markPdfImageOnlyOcrSettled,
  isPdfImageOnlyRoute,
  resolveOcrSettlementState,
} from '../import/ocr-settlement.js';

export { OCR_MIN_CHARS_HARD, OCR_MIN_CHARS_SOFT } from './document-extract.js';

/** Raw text + method + full line archive (before parsing/clean pipeline). */
export async function extractFromFileDetailed(file) {
  clearOcrPreprocessPreviews();
  clearLastOcrFusionInternal();
  clearLastOcrRotationDecision();
  clearLastNativePdfProbe();
  clearExtractionAuditTrail();
  const importRunId = peekImportRunId();
  logExtractionStep('EXTRACTION_IMPORT_RUN', importRunId);
  try {
    globalThis.HIRELY_EXTRACTION_RUN_ID = importRunId;
  } catch {
    /* ignore */
  }

  hirelyDebugLog('HIRELY FILE', {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  recordExtractionAuditStage('file', { note: `${file.name} ${file.size}b` });

  const inputKind = detectInputFileType(file).kind;
  let result;
  try {
    if (inputKind === 'pdf') {
      const pdfBudget = pdfExtractionBudgetMs(
        Number(globalThis.HIRELY_PDF_PAGE_COUNT) > 0
          ? Number(globalThis.HIRELY_PDF_PAGE_COUNT)
          : 2
      );
      result = await withExtractionTimeout(
        extractDocument(file),
        pdfBudget,
        'OCR_TIMEOUT'
      );
    } else {
      result = await extractDocument(file);
    }
  } catch (err) {
    if (
      err?.code === 'OCR_TIMEOUT' ||
      err?.code === 'OCR_ABSOLUTE_TIMEOUT' ||
      err?.message === 'PDF_EXTRACTION_TIMEOUT'
    ) {
      hirelyProductLog('OCR_TIMEOUT', { ms: PDF_EXTRACTION_MAX_MS, phase: 'extract_barrier' });
      logExtractionStep('OCR_TIMEOUT', 'pdf_extraction_max_await_settlement');
      const pageCount =
        Number(globalThis.HIRELY_PDF_PAGE_COUNT) > 0
          ? Number(globalThis.HIRELY_PDF_PAGE_COUNT)
          : 2;
      const settlement = await awaitOcrSettlementForFile(file, {
        pageCount,
        timedOut: true,
        maxWaitMs: pdfImportBarrierTimeoutMs(pageCount),
      });
      if (settlement.usable && settlement.extracted) {
        const ent = {
          ...settlement.extracted.enterprise,
          rawExtraction: settlement.text,
          text: settlement.text,
          cleanedText: settlement.text,
          lines: settlement.lines,
          method: 'ocr',
          metadata: { fileType: 'pdf_scanned', recoveredAfterTimeout: true },
          pdfExtraction: {
            method: 'ocr',
            recoveredAfterTimeout: true,
            decision: 'ocr_settlement_after_timeout',
            ocrCharCount: settlement.text.length,
          },
        };
        setLastEnterpriseExtraction(ent);
        logExtractionStep('OCR_SETTLEMENT_LATE_SUCCESS', `${settlement.text.length}c`);
        hirelyProductLog('OCR_DONE', {
          phase: 'settlement_recovery',
          chars: settlement.text.length,
          settlement: settlement.state,
        });
        return attachOcrSettlementMeta(
          {
            text: settlement.text,
            importState: IMPORT_STATE.IMPORT_PARTIAL,
            importStatus: IMPORT_STATUS.PARTIAL_TEXT_RECOVERED,
            method: 'ocr',
            fileType: 'pdf_scanned',
            enterprise: ent,
            pdfExtraction: ent.pdfExtraction,
            lines: settlement.lines,
            metadata: ent.metadata,
            warnings: ['OCR_TIMEOUT', 'OCR_SETTLEMENT_RECOVERED'],
            errors: [OCR_PARTIAL_REVIEW_MSG],
            ocrAttempted: true,
            ocrUsable: true,
          },
          settlement.state,
          { settledBeforeCommit: true }
        );
      }
      if (settlement.state === OCR_SETTLEMENT.TIMED_OUT_PENDING) {
        logExtractionStep('OCR_SETTLEMENT_STILL_PENDING', 'import_barrier');
        return attachOcrSettlementMeta(
          {
            text: '',
            importState: IMPORT_STATE.IMPORT_PARTIAL,
            importStatus: IMPORT_STATUS.PARTIAL_TEXT_RECOVERED,
            method: 'ocr',
            fileType: 'pdf',
            warnings: ['OCR_SETTLEMENT_PENDING'],
            errors: [],
            ocrAttempted: true,
            ocrInFlight: true,
          },
          settlement.state,
          { settledBeforeCommit: false }
        );
      }
      markPdfOcrTimedOut(file);
      const cached = getCachedPdfOcrIfReady(file);
      const cachedText = String(cached?.text || '').trim();
      const ent = peekLastEnterpriseExtraction();
      const probe = peekLastNativePdfProbe();
      const nativePartial =
        ent?.method === 'native_pdf' ||
        ent?.pdfExtraction?.method === 'native_pdf' ||
        Boolean(probe?.text);
      const partial =
        cachedText ||
        String(ent?.rawExtraction || ent?.cleanedText || ent?.text || probe?.text || '').trim();
      const partialLines = cached?.lines || ent?.lines || probe?.lines || [];
      const ocrGate =
        cachedText && partialLines.length
          ? evaluateOcrParserGate(partial, partialLines)
          : { pass: false };
      const nativeRecoverable = isNativeTextRecoverable(partial, partialLines);
      const mayRecover =
        partial.length >= REAL_CV_IMPORT_MIN_CHARS &&
        (ocrGate.pass || nativeRecoverable);
      if (mayRecover) {
        logExtractionStep('OCR_TIMEOUT_PARTIAL_RECOVERY', `${partial.length}c`);
        const enterprise = ent || {
          rawExtraction: partial,
          text: partial,
          cleanedText: partial,
          lines: cached?.lines || ent?.lines || probe?.lines || [],
          method: nativePartial ? 'native_pdf' : 'ocr',
          metadata: {
            fileType: nativePartial ? 'pdf_text' : 'pdf_scanned',
            recoveredAfterTimeout: true,
          },
          pdfExtraction: {
            recoveredAfterTimeout: true,
            decision: nativePartial ? 'native_timeout_partial' : 'timeout_partial',
            method: nativePartial ? 'native_pdf' : 'ocr',
          },
        };
        if (enterprise.pdfExtraction) {
          enterprise.pdfExtraction.recoveredAfterTimeout = true;
        } else {
          enterprise.pdfExtraction = { recoveredAfterTimeout: true, decision: 'timeout_partial' };
        }
        setLastEnterpriseExtraction(enterprise);
        return {
          text: partial,
          importState: IMPORT_STATE.IMPORT_PARTIAL,
          importStatus: IMPORT_STATUS.PARTIAL_TEXT_RECOVERED,
          method: enterprise.method || 'ocr',
          fileType: 'pdf_scanned',
          enterprise,
          pdfExtraction: enterprise.pdfExtraction,
          lines: enterprise.lines,
          metadata: enterprise.metadata,
          warnings: ['OCR_TIMEOUT'],
          errors: [OCR_PARTIAL_REVIEW_MSG],
        };
      }
      logExtractionStep('OCR_TIMEOUT_PASTE_FALLBACK', 'no_recoverable_text');
      setOcrFailReason('OCR_TIMEOUT:no_recoverable_text');
      return attachOcrSettlementMeta(
        {
          text: '',
          importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
          importStatus: IMPORT_STATUS.PDF_OCR_TIMEOUT,
          method: 'ocr',
          fileType: 'pdf',
          warnings: ['OCR_TIMEOUT'],
          errors: [],
          ocrAttempted: true,
        },
        OCR_SETTLEMENT.TIMED_OUT_FINAL,
        { settledBeforeCommit: true }
      );
    }
    hirelyProductLog('EXTRACTION_FAILED', { code: err?.code, msg: err?.message });
    logExtractionStep('EXTRACTION_FAILED', String(err?.message || err?.code || 'unknown'));
    const safe = buildExtractionSafeFallback(inputKind, err, {
      importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
      importStatus: IMPORT_STATUS.PASTE_FALLBACK_REQUIRED,
    });
    return {
      text: '',
      importState: safe.data.importState || IMPORT_STATE.IMPORT_NEEDS_PASTE,
      importStatus: safe.data.importStatus || IMPORT_STATUS.PASTE_FALLBACK_REQUIRED,
      method: 'failed',
      fileType: inputKind,
      enterprise: safe.data.enterprise,
      warnings: safe.warnings,
      errors: safe.errors,
    };
  }
  const enterprise = result.enterprise;

  const fileText = result.text || enterprise?.rawExtraction || '';
  logOcrPropagate('FILE_EXTRACT', {
    FILE_RESULT_TEXT_LENGTH: joinedTextLength(fileText, enterprise?.lines),
    OCR_LINES_COUNT: enterprise?.lines?.length ?? 0,
  });
  logOcrPropagation('FILE_EXTRACT', {
    text: fileText,
    lines: enterprise?.lines,
    note: result.method,
  });

  recordExtractionAuditStage('line_archive', {
    lines: enterprise.lines,
    rawText: enterprise.rawExtraction,
    cleanText: enterprise.cleanedText,
    pageCount: enterprise.metadata?.pages,
  });

  setLastEnterpriseExtraction(enterprise);
  if (result.pdfExtraction) setLastPdfExtraction(result.pdfExtraction);

  if (enterprise.method !== 'native_pdf') {
    setLastOcrForensic({ rawOcr: enterprise.rawExtraction, method: enterprise.method });
  }

  const isPdf =
    String(result.fileType || '').startsWith('pdf') ||
    String(enterprise.metadata?.fileType || '').startsWith('pdf');
  if (isPdf) applyPdfOcrPolicy(enterprise);

  const meta = enterprise.metadata || {};
  hirelyDebugLog('HIRELY EXTRACT →', {
    method: enterprise.method,
    fileType: meta.fileType || result.fileType,
    extractionSource: meta.extractionSource,
    textLayerFound: meta.textLayerFound,
    documentType: meta.documentType,
    pages: meta.pages,
    lineCount: meta.lineCount,
    confidence: meta.confidence,
  });

  const rawText = String(enterprise.rawExtraction || '').trim();
  const hydrated = hydrateExtractedImportText({
    rawText,
    cleanedText: enterprise.cleanedText,
    enterprise,
    extractionMethod: enterprise.method,
    fileType: meta.fileType || result.fileType,
  });
  const usabilityRaw = assessOcrImportUsabilityRaw(hydrated);
  const settledHydrated = markPdfImageOnlyOcrSettled(
    hydrated,
    usabilityRaw,
    isPdfImageOnlyRoute({
      fileType: meta.fileType || result.fileType,
      nativeTextLength: usabilityRaw.nativeTextLength,
    })
      ? resolveOcrSettlementState(usabilityRaw, {})
      : undefined
  );
  const usability = assessOcrImportUsability(settledHydrated);
  const effectiveRaw = String(hydrated.rawText || rawText).trim();
  if (effectiveRaw.length > rawText.length) {
    enterprise.rawExtraction = effectiveRaw;
    enterprise.cleanedText = String(hydrated.cleanedText || effectiveRaw).trim();
  }

  let importState = resolveImportState(effectiveRaw, {
    method: enterprise.method,
    extractionMethod: enterprise.method,
    ocrUsable: usability.usable,
  });
  importState = coerceImportStateForUsableOcr(importState, {
    ...settledHydrated,
    ocrUsable: usability.usable,
  });
  if (enterprise.pdfExtraction?.recoveredAfterTimeout && rawText.length >= REAL_CV_IMPORT_MIN_CHARS) {
    importState = IMPORT_STATE.IMPORT_PARTIAL;
  }
  const importStatus = resolveImportStatus(effectiveRaw, {
    method: enterprise.method,
    extractionMethod: enterprise.method,
    ocrUsable: usability.usable,
  });

  printExtractionAuditSummary({
    rawChars: effectiveRaw.length,
    cleanChars: enterprise.cleanedText?.length ?? 0,
    uniqueLines: meta.lineCount,
    duplicateLines: 0,
    parserInputChars: enterprise.cleanedText?.length ?? 0,
  });

  logExtractionStep('IMPORT_STATUS', importStatus);
  hirelyProductLog('EXTRACTION_DONE', {
    chars: effectiveRaw.length,
    method: enterprise.method,
    ocrUsable: usability.usable,
    ocrAttempted: usability.ocrAttempted,
    ocrSettled: settledHydrated.ocrSettled,
  });

  const enriched = enrichMultiFormatExtraction(
    attachOcrSettlementMeta(
      {
        text: enterprise.rawExtraction,
        importState,
        importStatus,
        method: enterprise.method,
        fileType: result.fileType || meta.fileType,
        fileTypeLabel: result.fileTypeLabel || meta.fileTypeLabel,
        enterprise,
        pdfExtraction: result.pdfExtraction,
        lines: enterprise.lines,
        metadata: meta,
        ocrAttempted: usability.ocrAttempted,
        ocrUsable: usability.usable,
      },
      settledHydrated.ocrSettlement || OCR_SETTLEMENT.DONE_USABLE,
      {
        settledBeforeCommit: true,
        ocrAttempted: usabilityRaw.ocrAttempted,
        ocrUsable: usability.usable,
      }
    ),
    { inputKind, fileName: file.name }
  );

  hirelyDebugLog('HIRELY MULTI_FORMAT', enriched.multiFormat);

  const pipelineLog = buildUniversalImportLog(
    {
      file,
      rawText: enriched.text,
      cleanedText: enterprise.cleanedText,
      fileType: enriched.fileType || meta.fileType,
      extractionMethod: enriched.method,
      enterprise: enriched.enterprise,
      pdfExtraction: enriched.pdfExtraction,
      errors: enriched.errors,
      warnings: enriched.warnings,
      importState: enriched.importState,
    },
    { importState: enriched.importState }
  );
  logUniversalImportPipeline(pipelineLog);
  enriched.universalImportLog = pipelineLog;
  if (enriched.enterprise?.metadata) {
    enriched.enterprise.metadata.universalImport = pipelineLog;
  }

  return enriched;
}

export async function extractFromFile(file) {
  const { text } = await extractFromFileDetailed(file);
  return text;
}

/** Map legacy method strings for callers expecting pdf-text / pdf-ocr */
export function normalizeExtractionMethod(method) {
  const m = String(method || '').toLowerCase();
  if (m === 'pdf-text' || m === 'native_pdf') return 'native_pdf';
  if (m === 'pdf-ocr' || m === 'image-ocr') return 'ocr';
  if (m === 'mixed') return 'mixed';
  return method || 'paste';
}
