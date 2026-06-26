/**
 * OCR usability gate — scanned PDFs must continue after OCR, not jump to paste.
 */
import { linesToPlainText } from '../extraction/extracted-line.js';
import { peekLastEnterpriseExtraction } from '../extraction/extraction-session.js';
import {
  OCR_FALLBACK_V1_PASTE_MAX_CHARS,
  ocrFallbackV1TextUsable,
} from './ocr-fallback-v1.js';
import {
  REAL_CV_IMPORT_MIN_CHARS,
  REAL_CV_IMPORT_RENDER_MIN_CHARS,
} from './real-cv-import-constants.js';
import { IMPORT_STATE } from './import-state.js';
import { hirelyProductLog } from '../runtime/hirely-debug.js';
import {
  importMustNotCommitPasteWhileOcrPending,
  logImportFinalWithSettlement,
  attachOcrSettlementMeta,
  applyPdfImageOnlyOcrFlagGate,
  isPdfImageOnlyRoute,
  ocrSettlementIsComplete,
  markPdfImageOnlyOcrSettled,
  OCR_SETTLEMENT,
  resolveOcrSettlementState,
} from './ocr-settlement.js';
import { awaitOcrSettlementForFile } from '../extraction/pdf-ocr-settlement.js';
import { pdfImportBarrierTimeoutMs } from '../extraction/pdf-extraction-timeout.js';

export const OCR_IMPORT_USABILITY_VERSION = 'OCR_IMPORT_USABILITY_V2';

/**
 * Hard rule: scanned/image-only PDFs have no native text layer — nativeTextLength === 0 is normal.
 * It must never be the sole stop condition; final decision uses OCR usability only.
 */
export const SCANNED_PDF_NATIVE_EMPTY_IS_NORMAL = true;

export const OCR_IMPORT_MIN_WORDS = 8;
export const OCR_IMPORT_MIN_LINES = 3;
export const OCR_IMPORT_MIN_AVG_CONFIDENCE = 40;

/**
 * @param {object} extracted
 */
export function collectOcrImportSignals(extracted = {}) {
  const enterprise = extracted.enterprise || {};
  const lines = Array.isArray(enterprise.lines)
    ? enterprise.lines
    : Array.isArray(extracted.lines)
      ? extracted.lines
      : [];
  const rawText = String(
    extracted.rawText || enterprise.rawExtraction || extracted.text || ''
  ).trim();
  const cleanedText = String(
    extracted.cleanedText || enterprise.cleanedText || rawText
  ).trim();
  const linePlain = linesToPlainText(lines).trim();
  const textLength = Math.max(rawText.length, cleanedText.length, linePlain.length);

  const meaningfulLines = lines.filter((ln) => {
    const t = String(ln.cleanedText || ln.text || '').trim();
    return t.length > 1;
  });

  let wordCount = 0;
  const wordSource = linePlain || cleanedText || rawText;
  if (wordSource) {
    wordCount = wordSource.split(/\s+/).filter((w) => w.length > 0).length;
  }
  for (const ln of meaningfulLines) {
    const extra = String(ln.cleanedText || ln.text || '')
      .split(/\s+/)
      .filter(Boolean).length;
    if (extra > wordCount) wordCount = extra;
  }

  const pagesWithContent = new Set(
    meaningfulLines.map((ln) => Number(ln.page) || 1)
  ).size;

  const pdfEx = enterprise.pdfExtraction || extracted.pdfExtraction || {};
  const method = String(extracted.extractionMethod || enterprise.method || pdfEx.method || '').toLowerCase();

  const ocrAttempted =
    extracted.ocrAttempted === true ||
    method === 'ocr' ||
    method === 'pdf-ocr' ||
    method === 'mixed' ||
    pdfEx.method === 'ocr' ||
    meaningfulLines.some((ln) => ln.source === 'ocr');

  const confidences = meaningfulLines
    .map((ln) => Number(ln.confidence))
    .filter((n) => Number.isFinite(n) && n > 0);
  const avgConfidence = confidences.length
    ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
    : 0;

  const nativeTextLength = Math.max(
    0,
    Number(
      extracted.nativeCharCount ??
        extracted.nativeTextLength ??
        pdfEx.nativeCharCount ??
        enterprise.metadata?.nativeCharCount ??
        0
    ) || 0
  );

  const coordinatesPresent = meaningfulLines.some((ln) => {
    const x = Number(ln.x);
    const y = Number(ln.y);
    return Number.isFinite(x) && Number.isFinite(y);
  });

  const ocrOnlyLines = meaningfulLines.filter((ln) => ln.source === 'ocr');
  const ocrLinePlain = linesToPlainText(ocrOnlyLines).trim();
  const ocrTextLength = ocrLinePlain.length;

  return {
    lines,
    meaningfulLines,
    textLength,
    ocrTextLength,
    lineCount: meaningfulLines.length,
    wordCount,
    pagesWithContent,
    ocrAttempted,
    nativeTextLength,
    avgConfidence,
    coordinatesPresent,
    method,
    pdfEx,
    enterprise,
    isScannedPdfWithoutNativeText:
      nativeTextLength === 0 &&
      (method === 'ocr' ||
        pdfEx.method === 'ocr' ||
        pdfEx.fileType === 'pdf_scanned' ||
        meaningfulLines.some((ln) => ln.source === 'ocr')),
  };
}

/**
 * @param {object} ctx
 */
export function isScannedPdfWithoutNativeText(ctx = {}) {
  const fileType = String(ctx.fileType || ctx.docType || 'pdf').toLowerCase();
  if (fileType !== 'pdf') return false;
  const native = Math.max(
    0,
    Number(ctx.nativeTextLength ?? ctx.pdfJsTotalLength ?? ctx.nativeCharCount ?? 0) || 0
  );
  if (native > 0) return false;
  const signals = collectOcrImportSignals(ctx);
  return (
    signals.isScannedPdfWithoutNativeText ||
    signals.method === 'ocr' ||
    signals.pdfEx?.fileType === 'pdf_scanned' ||
    signals.pdfEx?.method === 'ocr'
  );
}

/**
 * Returns true when import must continue (not paste) despite nativeTextLength === 0.
 * @param {object} ctx
 */
export function importMustNotStopOnNativeEmpty(ctx = {}) {
  if (!isScannedPdfWithoutNativeText(ctx)) return false;
  const usability = ctx.ocrUsable === true ? { usable: true } : assessOcrImportUsability(ctx);
  if (usability.usable) return true;
  if (ctx.ocrAttempted === true) return true;
  return ctx.ocrDisabled !== true;
}

/**
 * Authoritative text length for final import decision (OCR over native for scans).
 * @param {object} extracted
 */
export function effectiveImportTextLength(extracted = {}) {
  const signals = collectOcrImportSignals(extracted);
  return signals.textLength;
}

/**
 * Raw OCR usability (no PDF_IMAGE_ONLY pre-settlement gate).
 * @param {object} extracted
 * @param {{ strictParser?: boolean }} [opts]
 */
export function assessOcrImportUsabilityRaw(extracted = {}, opts = {}) {
  const signals = collectOcrImportSignals(extracted);
  const linePlain = linesToPlainText(signals.lines).trim();
  const rawText = String(extracted.rawText || signals.enterprise?.rawExtraction || '').trim();
  const cleanedText = String(extracted.cleanedText || signals.enterprise?.cleanedText || rawText).trim();
  const textUsable = ocrFallbackV1TextUsable(linePlain || cleanedText || rawText, {
    ocrAttempted: signals.ocrAttempted,
  });

  const linesOk =
    signals.lineCount >= OCR_IMPORT_MIN_LINES &&
    signals.textLength >= REAL_CV_IMPORT_RENDER_MIN_CHARS;
  const wordsOk =
    signals.wordCount >= OCR_IMPORT_MIN_WORDS && signals.pagesWithContent >= 1;
  const confidenceOk =
    signals.avgConfidence === 0 || signals.avgConfidence >= OCR_IMPORT_MIN_AVG_CONFIDENCE;

  const usable =
    signals.ocrAttempted &&
    confidenceOk &&
    (textUsable ||
      linesOk ||
      wordsOk ||
      (signals.textLength > OCR_FALLBACK_V1_PASTE_MAX_CHARS && signals.lineCount > 0));

  let reason = 'OCR_NOT_USABLE';
  if (usable) {
    reason =
      signals.textLength >= REAL_CV_IMPORT_MIN_CHARS
        ? 'OCR_TEXT_OK'
        : 'OCR_PARTIAL_USABLE';
  } else if (!signals.ocrAttempted && signals.nativeTextLength === 0) {
    reason = 'PDF_IMAGE_ONLY';
  } else if (signals.ocrAttempted && signals.textLength <= OCR_FALLBACK_V1_PASTE_MAX_CHARS) {
    reason = 'OCR_TEXT_TOO_SHORT';
  }

  return {
    usable,
    reason,
    strictParserBlocked:
      opts.strictParser === true &&
      signals.textLength > 0 &&
      signals.textLength < REAL_CV_IMPORT_MIN_CHARS,
    ...signals,
  };
}

/**
 * @param {object} extracted
 * @param {{ strictParser?: boolean }} [opts]
 */
export function assessOcrImportUsability(extracted = {}, opts = {}) {
  const raw = assessOcrImportUsabilityRaw(extracted, opts);
  const gateCtx = {
    ...extracted,
    fileType: extracted.fileType || extracted.docType || 'pdf',
    nativeTextLength: raw.nativeTextLength,
    ocrSettlement: extracted.ocrSettlement || extracted.ocr_settlement,
    ocrSettled: extracted.ocrSettled,
    ocrInFlight: extracted.ocrInFlight,
  };
  const gated = applyPdfImageOnlyOcrFlagGate(gateCtx, {
    ocrAttempted: raw.ocrAttempted,
    ocrUsable: raw.usable,
    usable: raw.usable,
  });
  let reason = raw.reason;
  if (gated.ocrFlagsDeferred && isPdfImageOnlyRoute(gateCtx)) {
    reason = 'PDF_IMAGE_ONLY';
  }
  return {
    ...raw,
    ocrAttempted: gated.ocrAttempted,
    usable: gated.ocrUsable,
    reason,
    ocrFlagsDeferred: gated.ocrFlagsDeferred === true,
    ocrPendingSettlement: gated.ocrPendingSettlement === true,
  };
}

/**
 * Fill raw/cleaned text from line archive when OCR text was dropped upstream.
 * @param {object} extracted
 */
export function hydrateExtractedImportText(extracted = {}) {
  if (!extracted || typeof extracted !== 'object') return extracted;
  const signals = collectOcrImportSignals(extracted);
  const gateCtx = {
    ...extracted,
    fileType: extracted.fileType || extracted.docType || 'pdf',
    nativeTextLength: signals.nativeTextLength,
    ocrSettlement: extracted.ocrSettlement || extracted.ocr_settlement,
    ocrSettled: extracted.ocrSettled,
    ocrInFlight: extracted.ocrInFlight,
  };
  const gatedAttempted = applyPdfImageOnlyOcrFlagGate(gateCtx, {
    ocrAttempted: signals.ocrAttempted,
  }).ocrAttempted;
  if (!signals.textLength) {
    return { ...extracted, ocrAttempted: gatedAttempted };
  }

  const linePlain = linesToPlainText(signals.lines).trim();
  const rawText = String(extracted.rawText || '').trim() || linePlain || String(extracted.cleanedText || '').trim();
  const cleanedText =
    String(extracted.cleanedText || '').trim() || rawText;

  return {
    ...extracted,
    rawText,
    cleanedText,
    ocrAttempted: gatedAttempted,
    ocrResultLength: Math.max(
      Number(extracted.ocrResultLength) || 0,
      signals.textLength
    ),
    nativeCharCount: signals.nativeTextLength,
    enterprise: extracted.enterprise
      ? {
          ...extracted.enterprise,
          rawExtraction: extracted.enterprise.rawExtraction || rawText,
          cleanedText: extracted.enterprise.cleanedText || cleanedText,
          lines: signals.lines.length ? signals.lines : extracted.enterprise.lines,
        }
      : extracted.enterprise,
  };
}

/**
 * Enrich browser/UI decision ctx with live extraction session (post OCR_DONE).
 * @param {object} ctx
 */
export function enrichImportDecisionContext(ctx = {}) {
  const sessionEnt =
    ctx.enterprise ||
    peekLastEnterpriseExtraction() ||
    (typeof globalThis !== 'undefined' ? globalThis.__HIRELY_LAST_ENTERPRISE__ : null);

  const rawText =
    ctx.rawText != null
      ? String(ctx.rawText)
      : String(ctx.rawTextLength != null ? '' : '').trim();
  const cleanedText =
    ctx.cleanedText != null ? String(ctx.cleanedText) : rawText;

  const hydrated = hydrateExtractedImportText({
    fileType: ctx.fileType || ctx.docType || 'pdf',
    rawText:
      rawText ||
      (ctx.rawTextLength > 0 ? 'x'.repeat(Number(ctx.rawTextLength) || 0) : ''),
    cleanedText:
      cleanedText ||
      (ctx.cleanTextLength > 0 ? 'x'.repeat(Number(ctx.cleanTextLength) || 0) : ''),
    cleanedTextLength: ctx.cleanTextLength,
    rawTextLength: ctx.rawTextLength,
    extractionMethod: ctx.extractionMethod,
    ocrAttempted: ctx.ocrAttempted,
    ocrUsable: ctx.ocrUsable,
    ocrSettlement: ctx.ocrSettlement || ctx.ocr_settlement,
    ocrSettled: ctx.ocrSettled,
    ocrInFlight: ctx.ocrInFlight,
    enterprise: sessionEnt,
    pdfExtraction: sessionEnt?.pdfExtraction || ctx.pdfExtraction,
    lines: sessionEnt?.lines || ctx.lines,
  });

  let decisionHydrated = hydrated;
  if (ocrSettlementIsComplete({ ...hydrated, ...ctx })) {
    const usabilityRaw = assessOcrImportUsabilityRaw(hydrated);
    decisionHydrated = markPdfImageOnlyOcrSettled(
      { ...hydrated, fileType: ctx.fileType || ctx.docType || 'pdf' },
      usabilityRaw,
      ctx.ocrSettlement ||
        resolveOcrSettlementState(usabilityRaw, { inFlight: false })
    );
    try {
      const runtime = globalThis.__HIRELY_LAST_EXTRACTION_RUNTIME__;
      if (runtime?.method === 'ocr' || runtime?.method === 'mixed') {
        decisionHydrated.ocrAttempted = true;
      }
    } catch {
      /* ignore */
    }
  }

  return buildImportDecisionFromExtracted(
    {
      ...ctx,
      ...decisionHydrated,
      fileType: ctx.fileType || ctx.docType || decisionHydrated.fileType,
      enterprise: decisionHydrated.enterprise || sessionEnt,
    },
    ctx
  );
}

/**
 * @param {object} extracted
 * @param {{ strictParser?: boolean }} [opts]
 */
export function buildImportDecisionFromExtracted(extracted = {}, opts = {}) {
  const sessionEnt =
    extracted.enterprise ||
    peekLastEnterpriseExtraction() ||
    null;
  const traceCtx =
    extracted.rawText == null &&
    extracted.cleanedText == null &&
    (extracted.rawTextLength != null || extracted.cleanTextLength != null);
  const hydrated = traceCtx
    ? hydrateExtractedImportText({
        fileType: extracted.docType || extracted.fileType || 'pdf',
        rawText: '',
        cleanedText: '',
        nativeCharCount: extracted.nativeTextLength ?? extracted.pdfJsTotalLength ?? 0,
        ocrAttempted: extracted.ocrAttempted === true,
        ocrUsable: extracted.ocrUsable === true,
        ocrResultLength: Number(extracted.ocrTextLength) || 0,
        extractionMethod: extracted.extractionMethod,
        enterprise: sessionEnt || {
          lines: [],
          pdfExtraction: { nativeCharCount: extracted.nativeTextLength ?? 0 },
        },
      })
    : hydrateExtractedImportText({
        ...extracted,
        enterprise: sessionEnt || extracted.enterprise,
      });

  if (traceCtx) {
    const textLen = Math.max(
      Number(extracted.rawTextLength) || 0,
      Number(extracted.cleanTextLength) || 0,
      Number(extracted.ocrTextLength) || 0,
      assessOcrImportUsabilityRaw(hydrated).textLength
    );
    if (textLen > 0) {
      hydrated.rawText = linesToPlainText(hydrated.enterprise?.lines || []).trim() || 'x'.repeat(textLen);
      hydrated.cleanedText = hydrated.rawText;
    }
    hydrated.ocrResultLength = Math.max(Number(hydrated.ocrResultLength) || 0, textLen);
    if (textLen > 0 && ocrSettlementIsComplete({ ...hydrated, ...extracted })) {
      if (extracted.ocrAttempted !== false) hydrated.ocrAttempted = true;
      if (extracted.ocrUsable === true) hydrated.ocrUsable = true;
    }
  }

  const rawUsability = assessOcrImportUsabilityRaw(hydrated, opts);
  const usability = assessOcrImportUsability(hydrated, opts);
  const importMode =
    opts.importMode ||
    opts.mode ||
    extracted.importMode ||
    (opts.exactTranscription === true || extracted.exactTranscription === true
      ? 'exact_transcription'
      : 'structured');

  return {
    fileType: String(hydrated.fileType || extracted.fileType || extracted.docType || 'pdf').toLowerCase(),
    nativeTextLength: usability.nativeTextLength,
    textLength: traceCtx
      ? Math.max(Number(extracted.rawTextLength) || 0, Number(extracted.cleanTextLength) || 0, usability.textLength)
      : usability.textLength,
    ocrAttempted: extracted.ocrAttempted === true || rawUsability.ocrAttempted,
    ocrTextLength: Math.max(
      0,
      Number(extracted.ocrTextLength) || 0,
      (extracted.ocrAttempted === true || rawUsability.ocrAttempted)
        ? Number(rawUsability.ocrTextLength) || 0
        : 0
    ),
    ocrUsable: extracted.ocrUsable === true || rawUsability.usable,
    ocrLineCount: usability.lineCount,
    ocrWordCount: usability.wordCount,
    ocrPageCount: usability.pagesWithContent,
    importMode,
    ocrDisabled: opts.ocrDisabled === true || extracted.ocrDisabled === true,
    extractionMethod: hydrated.extractionMethod,
    unsupported: opts.unsupported === true || extracted.unsupported === true,
    resumeData: extracted.resumeData ?? extracted.structuredResume ?? null,
    structuredInput: extracted.structuredInput ?? null,
    ocrStructuredInput: extracted.ocrStructuredInput ?? null,
  };
}

/**
 * Hard rule: after OCR_DONE with usable content, paste is a product bug.
 * @param {object} ctx
 */
export function importMustNotPasteAfterUsableOcr(ctx = {}) {
  if (isPdfImageOnlyRoute(ctx) && !ocrSettlementIsComplete(ctx)) return false;
  if (ctx.ocrUsable === true && ocrSettlementIsComplete(ctx)) return true;
  if (!ocrSettlementIsComplete(ctx) && isPdfImageOnlyRoute(ctx)) return false;
  return assessOcrImportUsability(ctx).usable;
}

/**
 * Authoritative final import state — scanned PDFs use OCR usability only.
 * nativeTextLength === 0 must never alone yield IMPORT_NEEDS_PASTE.
 * @param {string} proposedState
 * @param {object} [ctx]
 */
export function resolveFinalImportState(proposedState, ctx = {}) {
  const hydrated = hydrateExtractedImportText(ctx);
  const usability = assessOcrImportUsability(hydrated, ctx);
  const enriched = {
    ...hydrated,
    ocrUsable: ctx.ocrUsable === true || usability.usable,
    ocrAttempted: ctx.ocrAttempted === true || usability.ocrAttempted,
  };

  if (importMustNotPasteAfterUsableOcr(enriched)) {
    if (
      proposedState === IMPORT_STATE.IMPORT_NEEDS_PASTE ||
      proposedState === IMPORT_STATE.IMPORT_FAILED
    ) {
      const len = effectiveImportTextLength(enriched);
      return len >= REAL_CV_IMPORT_MIN_CHARS
        ? IMPORT_STATE.IMPORT_READY
        : IMPORT_STATE.IMPORT_PARTIAL;
    }
  }

  if (
    isScannedPdfWithoutNativeText(enriched) &&
    proposedState === IMPORT_STATE.IMPORT_NEEDS_PASTE &&
    enriched.ocrAttempted &&
    !importMustNotPasteAfterUsableOcr(enriched)
  ) {
    return proposedState;
  }

  if (
    isScannedPdfWithoutNativeText(enriched) &&
    proposedState === IMPORT_STATE.IMPORT_NEEDS_PASTE &&
    !enriched.ocrAttempted &&
    ctx.ocrDisabled !== true
  ) {
    return IMPORT_STATE.IMPORT_PARTIAL;
  }

  return proposedState;
}

/**
 * Never return IMPORT_NEEDS_PASTE when OCR output is usable — coerce to continue states.
 * @param {string} importState
 * @param {object} [extracted]
 */
export function coerceImportStateForUsableOcr(importState, extracted = {}) {
  return resolveFinalImportState(importState, extracted);
}

/**
 * Product rule: OCR_DONE + usable OCR must never log IMPORT_FINAL as IMPORT_NEEDS_PASTE.
 * @param {string} proposedState
 * @param {object} [ctx]
 * @returns {string}
 */
export function logImportFinal(proposedState, ctx = {}) {
  const finalState = resolveFinalImportState(proposedState, ctx);
  if (importMustNotCommitPasteWhileOcrPending(ctx)) {
    const blocked =
      finalState === IMPORT_STATE.IMPORT_NEEDS_PASTE
        ? IMPORT_STATE.IMPORT_PARTIAL
        : finalState;
    logImportFinalWithSettlement(blocked, {
      ...ctx,
      ocrSettlement: ctx.ocrSettlement || OCR_SETTLEMENT.TIMED_OUT_PENDING,
      ocrSettledBeforeCommit: false,
    });
    return blocked;
  }
  if (
    proposedState === IMPORT_STATE.IMPORT_NEEDS_PASTE &&
    finalState !== IMPORT_STATE.IMPORT_NEEDS_PASTE
  ) {
    logImportFinalWithSettlement(finalState, {
      ...ctx,
      ocrSettledBeforeCommit: ctx.ocrSettled !== false,
    });
    return finalState;
  }
  logImportFinalWithSettlement(finalState, {
    ...ctx,
    ocrSettledBeforeCommit: ctx.ocrSettled !== false,
  });
  return finalState;
}

/**
 * Coerce paste-shaped import results when OCR output is usable (do not discard OCR).
 * @param {object} result
 * @param {object} [extracted]
 */
export function guardPasteImportResult(result, extracted = {}) {
  if (!result || result.importState !== IMPORT_STATE.IMPORT_NEEDS_PASTE) {
    return result;
  }
  if (importMustNotCommitPasteWhileOcrPending({ ...extracted, ...result })) {
    hirelyProductLog('IMPORT_PASTE_BLOCKED_OCR_PENDING', {
      settlement: result.ocrSettlement || extracted.ocrSettlement,
    });
    return {
      ...result,
      importState: IMPORT_STATE.IMPORT_PARTIAL,
      warnings: [...(result.warnings || []), 'OCR_SETTLEMENT_PENDING'],
      ocrInFlight: true,
    };
  }
  const hydrated = hydrateExtractedImportText({ ...extracted, ...result });
  const finalState = resolveFinalImportState(result.importState, hydrated);
  if (finalState === IMPORT_STATE.IMPORT_NEEDS_PASTE) {
    return result;
  }
  const linePlain = linesToPlainText(hydrated.enterprise?.lines || []).trim();
  const raw = String(hydrated.rawText || linePlain || result.rawText || '').trim();
  const cleaned = String(hydrated.cleanedText || raw).trim();
  return {
    ...result,
    ...hydrated,
    rawText: raw,
    cleanedText: cleaned,
    importState: finalState,
    ocrUsable: true,
    ocrAttempted: hydrated.ocrAttempted === true || result.ocrAttempted === true,
    ocrSettlement: OCR_SETTLEMENT.DONE_USABLE,
    ocrSettled: true,
    ocrSettledBeforeCommit: true,
    warnings: [...(result.warnings || []), 'OCR_USABLE_ANTI_PASTE'],
    importFallback: null,
    pasteReason: null,
    pasteMessage: null,
  };
}

/**
 * Await in-flight OCR before committing paste for scanned PDFs.
 * @param {File} file
 * @param {object} [opts]
 */
export async function awaitOcrSettlementBeforeImportPaste(file, opts = {}) {
  const pageCount = Number(opts.pageCount) || 2;
  const settlement = await awaitOcrSettlementForFile(file, {
    pageCount,
    timedOut: opts.timedOut === true,
    maxWaitMs: opts.maxWaitMs ?? pdfImportBarrierTimeoutMs(pageCount),
  });
  const settledBeforeCommit = settlement.state !== OCR_SETTLEMENT.TIMED_OUT_PENDING;
  if (!settlement.usable || !settlement.extracted) {
    return attachOcrSettlementMeta(
      {
        fileType: opts.fileType || 'pdf',
        nativeTextLength: 0,
        rawText: settlement.text || '',
        cleanedText: settlement.text || '',
      },
      settlement.state,
      {
        settledBeforeCommit,
        ocrAttempted: settledBeforeCommit && settlement.ocrAttempted === true,
        ocrUsable: false,
      }
    );
  }
  const hydrated = hydrateExtractedImportText({
    ...settlement.extracted,
    fileType: opts.fileType || 'pdf',
  });
  const usability = assessOcrImportUsabilityRaw(hydrated);
  const marked = markPdfImageOnlyOcrSettled(hydrated, usability, settlement.state);
  return attachOcrSettlementMeta(marked, settlement.state, {
    settledBeforeCommit: true,
    ocrAttempted: usability.ocrAttempted,
    ocrUsable: usability.usable,
  });
}

/**
 * Recover usable OCR after IMPORT_FINAL committed paste — late OCR must not be ignored.
 * @param {File} file
 * @param {object} [opts]
 */
export async function recoverLateUsableOcrImport(file, opts = {}) {
  if (!file && !opts.settlement) {
    return { recovered: false, reason: 'no_file' };
  }
  const pageCount =
    Number(opts.pageCount) > 0
      ? Number(opts.pageCount)
      : Number(globalThis.HIRELY_PDF_PAGE_COUNT) > 0
        ? Number(globalThis.HIRELY_PDF_PAGE_COUNT)
        : 2;
  const settlement =
    opts.settlement ||
    (await awaitOcrSettlementForFile(file, {
      pageCount,
      timedOut: opts.timedOut !== false,
      maxWaitMs: opts.maxWaitMs ?? pdfImportBarrierTimeoutMs(pageCount),
    }));
  if (!settlement.usable || !String(settlement.text || '').trim()) {
    hirelyProductLog('OCR_LATE_RECOVERY_SKIPPED', {
      state: settlement.state,
      usable: settlement.usable,
    });
    return { recovered: false, settlement, reason: 'not_usable' };
  }
  const hydrated = hydrateExtractedImportText({
    ...(settlement.extracted || {}),
    fileType: 'pdf',
    nativeTextLength: 0,
    rawText: settlement.text,
    cleanedText: settlement.text,
    enterprise:
      settlement.extracted?.enterprise ||
      settlement.extracted?.enterpriseExtraction ||
      null,
  });
  const usability = assessOcrImportUsabilityRaw(hydrated);
  const marked = markPdfImageOnlyOcrSettled(
    hydrated,
    usability,
    settlement.state || OCR_SETTLEMENT.DONE_USABLE
  );
  const extracted = {
    ...attachOcrSettlementMeta(
      marked,
      marked.ocrSettlement || OCR_SETTLEMENT.DONE_USABLE,
      {
        settledBeforeCommit: false,
        lateRecovery: true,
        ocrAttempted: true,
        ocrUsable: usability.usable,
      }
    ),
    ...marked,
    ocrSettled: true,
    ocrSettledBeforeCommit: false,
    lateOcrRecovery: true,
  };
  hirelyProductLog('OCR_LATE_RECOVERY', {
    chars: settlement.text.length,
    settlement: extracted.ocrSettlement,
  });
  return { recovered: true, settlement, extracted, usability };
}
