/**
 * HIRELY Enterprise Extraction Engine
 * PDF/Image → text layer detection → native pdf.js → OCR fallback → line archive
 */

import { normalizeRawExtract } from '../parsing/clean.js';
import { postProcessOcrText } from '../parsing/ocr-postprocess.js';
import { isBrowser } from './ocr.js';
import { extractNativePdfLines } from './pdf-lines-native.js';
import { ocrPdfPageToLines } from './ocr-lines.js';
import { runCachedTimedPdfOcr } from './pdf-ocr-run.js';
import { probePdfWithPdfLib } from './pdf-lib-probe.js';
import {
  linesToPlainText,
  summarizeLines,
  NATIVE_DEFAULT_CONFIDENCE,
} from './extracted-line.js';
import { buildDocumentTextsFromLines } from './extraction-line-enrich.js';
import { recognizeCanvasWithLines } from './ocr-tesseract.js';
import { preprocessCanvasForOcr } from './ocr-preprocess.js';
import { pushOcrPreprocessPreview } from './extraction-session.js';
import { runOcrWithFusion, isOcrFusionEnabled } from './ocr-multipass.js';
import { ensureTesseract } from './ocr-tesseract.js';
import { corruptionScoreText } from '../parsing/corruption-detector.js';
import {
  isNativeTextRecoverable,
  isNativePageTrusted,
  nativeTrustAudit,
} from './native-text-trust.js';
import { extractHybridPdfPages } from './pdf-hybrid-extract.js';
import { pdfExtractionBudgetMs } from './pdf-extraction-timeout.js';
import {
  recordExtractionAuditStage,
  dedupeExtractedLines,
  dedupePlainText,
} from './extraction-audit.js';
import { isExactTranscriptionExtractionActive, filterExactEmptyNoiseLines, trivialTranscriptionNormalize } from './exact-transcription-truth.js';
import { logOcrPropagation, logOcrPropagate } from './ocr-propagation-trace.js';
import {
  isExtractionLocked,
  shouldRunOcrForTextLength,
  logExtractionLockSkip,
  EXTRACTION_LOCK_OCR_MIN_CHARS,
} from './extraction-lock.js';

import { extractionSourceLabel, fileTypeLabel } from './file-type-detect.js';
import { detectDocumentStage } from './stages/document-detection.js';
import { planPdfExtraction, PDF_ROUTES, assertNativePdfLines } from './pdf-router.js';
import { selectBestTextSource } from './best-text-source-selection.js';
import {
  REAL_CV_IMPORT_MIN_CHARS,
  REAL_CV_IMPORT_FAILURE_REASONS,
} from '../import/real-cv-import-constants.js';
import { assessOcrImportUsability } from '../import/ocr-import-usability.js';
import { OCR_FALLBACK_V1_PASTE_MAX_CHARS } from '../import/ocr-fallback-v1.js';
import { preparePdfLinesForParsing } from './pdf-post-extract.js';
import { buildLayoutMemory } from '../layout/layout-memory.js';
import {
  spatialBlocksFromReconstruction,
  spatialBlocksToPlainText,
} from '../layout/spatial-block.js';
import {
  classifyDocumentPages,
  filterLinesForResumeParsing,
  filterSpatialBlocksForResumeParsing,
  buildPageDocumentClassificationDebug,
} from '../layout/page-document-classifier.js';
import { buildExtractionDebugBundle } from './extraction-debug-bundle.js';
import { hasPositionedPdfLines } from '../layout/pdf-block-engine.js';
import { extractLockedIdentity, extractNameFromFileName } from '../parsing/identity-extraction.js';
import { resolveStructureFirstParserText } from './structure-first-parser-text.js';
import { assessPdfTextLayer } from './pdf-text-quality.js';
import { hirelyDebugLog, hirelyDebugWarn, hirelyProductLog } from '../runtime/hirely-debug.js';
import {
  setLastEnterpriseExtraction,
  setLastNativePdfProbe,
} from './extraction-session.js';
import { selectBestOcrRotation } from './ocr-rotation-select.js';
import {
  evaluateOcrParserGate,
  OCR_QUALITY_FAIL_MSG,
} from './ocr-quality-score.js';
import { OCR_STATUS, resolveOcrQualityStatus } from './ocr-quality-status.js';
import { isOcrAutoImportEnabled } from '../import/ocr-auto-import.js';
import { peekLastOcrRotationDecision } from './extraction-session.js';

/**
 * @typedef {import('./extracted-line.js').ExtractedLine} ExtractedLine
 * @typedef {import('./extracted-line.js').EnterpriseExtractionMethod} EnterpriseExtractionMethod
 */

/**
 * @typedef {object} EnterpriseExtractionResult
 * @property {string} rawExtraction
 * @property {string} cleanedText
 * @property {string} text legacy alias of cleanedText
 * @property {ExtractedLine[]} lines
 * @property {EnterpriseExtractionMethod} method
 * @property {object} metadata
 * @property {object} pdfExtraction legacy pdf meta for pipeline
 */

function linesFromPlainText(text, source = 'native') {
  const conf = source === 'ocr' ? 75 : NATIVE_DEFAULT_CONFIDENCE;
  return String(text || '')
    .split('\n')
    .map((t, i) => t.trim())
    .filter((t) => t.length > 0)
    .map((t, line) => ({
      text: t,
      rawExtraction: t,
      cleanedText: t,
      confidence: conf,
      source,
      page: 1,
      line,
      x: 0,
      y: 0,
    }));
}

/**
 * @param {File} file
 * @returns {Promise<EnterpriseExtractionResult>}
 */
export async function extractImageEnterprise(file) {
  if (!isBrowser()) throw new Error('Image OCR requires a browser.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const debug =
      typeof globalThis !== 'undefined' &&
      /(?:\?|&)debug=true/.test(String(globalThis.location?.search || ''));
    if (debug) {
      const prep = preprocessCanvasForOcr(c, {
        viewportWidth: img.naturalWidth,
        viewportHeight: img.naturalHeight,
        debug: true,
        page: 1,
        variant: 'standard',
      });
      if (prep.previews) {
        pushOcrPreprocessPreview({
          page: 1,
          before: prep.previews.before,
          after: prep.previews.after,
          meta: prep.meta,
        });
      }
    }

    const rotationPick = await selectBestOcrRotation(c, {
      viewportWidth: img.naturalWidth,
      viewportHeight: img.naturalHeight,
      page: 1,
    });
    const ocrCanvas = rotationPick.canvas;

    let rawOcr = '';
    let normalizedLines = [];
    if (isOcrFusionEnabled()) {
      const fused = await runOcrWithFusion(ocrCanvas, {
        viewportWidth: img.naturalWidth,
        viewportHeight: img.naturalHeight,
        page: 1,
        skipAutoRotate: true,
        rotationDeg: rotationPick.rotationDeg,
      });
      rawOcr = fused.text;
      normalizedLines = fused.lines;
    } else {
      const prep = preprocessCanvasForOcr(ocrCanvas, {
        viewportWidth: img.naturalWidth,
        viewportHeight: img.naturalHeight,
        variant: rotationPick.variant || 'standard',
        skipAutoRotate: true,
        rotationDeg: rotationPick.rotationDeg,
        page: 1,
      });
      const ocr = await recognizeCanvasWithLines(prep.canvas, 'fra+eng', {
        preprocessed: true,
        tessPsm: prep.meta.suggestedPsm,
      });
      rawOcr = ocr.text;
      normalizedLines = (ocr.lines || []).map((ln, i) => ({
        text: ln.text,
        rawExtraction: ln.text,
        confidence: Math.round(ln.confidence ?? 0),
        source: 'ocr',
        page: 1,
        line: ln.line ?? i,
        x: ln.x ?? 0,
        y: ln.y ?? 0,
      }));
    }
    const imageGate = evaluateOcrParserGate(rawOcr, normalizedLines);
    const ocrLen = String(rawOcr || '').trim().length;
    if (
      !imageGate.pass &&
      !(isOcrAutoImportEnabled() && ocrLen >= REAL_CV_IMPORT_MIN_CHARS)
    ) {
      throw Object.assign(new Error(OCR_QUALITY_FAIL_MSG), {
        code: 'OCR_QUALITY_FAILED',
        importStatus: 'PDF_TEXT_EMPTY',
        ocrStatus: OCR_STATUS.FAILED_LOW_QUALITY,
        ocrQuality: imageGate,
      });
    }
    return buildResult({
      lines: normalizedLines,
      ocrDocument: true,
      method: 'ocr',
      fileType: 'image',
      textLayerFound: false,
      confidence: Math.round(
        normalizedLines.reduce((s, l) => s + (l.confidence || 0), 0) /
          Math.max(1, normalizedLines.length)
      ),
      pages: 1,
      pdfExtraction: { method: 'image-ocr', decision: 'ocr', fileType: 'image' },
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Weak selectable native layer — try local OCR and pick/merge best source.
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 * @param {File|null} file
 * @param {import('./extracted-line.js').ExtractedLine[]} nativeLines
 * @param {string} nativeText
 */
async function supplementWeakNativeWithOcr(pdf, file, nativeLines, nativeText) {
  const nativeLen = String(nativeText || '').trim().length;
  if (nativeLen >= REAL_CV_IMPORT_MIN_CHARS || nativeLen < 12) return null;
  try {
    await ensureTesseract();
    const ocrOut = await runCachedTimedPdfOcr(pdf, file, {
      fusion: pdf.numPages === 1 && isOcrFusionEnabled(),
      bestPass: true,
      allowSecondPass: globalThis.HIRELY_FORCE_PDF_OCR_RETRY === true,
      existingTextLength: nativeLen,
      existingText: nativeText,
      existingLines: nativeLines,
    });
    const ocrLines = ocrOut.lines || [];
    const ocrText = String(ocrOut.text || linesToPlainText(ocrLines)).trim();
    if (ocrText.length < 12) return null;

    const picked = selectBestTextSource({
      nativeText,
      nativeLines,
      ocrText,
      ocrLines,
    });
    const pickedText = String(picked.text || '').trim();
    if (!pickedText || pickedText.length <= nativeLen) return null;

    const outLines =
      picked.lines?.length ?
        picked.lines
      : picked.selectedSource === 'ocr' ?
        ocrLines
      : nativeLines;

    return {
      lines: outLines,
      text: pickedText,
      method: picked.selectedSource === 'ocr' ? 'ocr' : picked.selectedSource === 'merged' ? 'mixed' : 'native_pdf',
      weakNativeSupplemented: true,
      textSourceAudit: picked.audit,
      selectedSource: picked.selectedSource,
      ocrCharCount: ocrText.length,
    };
  } catch (err) {
    hirelyProductLog('WEAK_NATIVE_OCR_SUPPLEMENT_FAILED', {
      reason: REAL_CV_IMPORT_FAILURE_REASONS.weak_native,
      message: String(err?.message || err),
    });
    return null;
  }
}

/**
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 * @param {ArrayBuffer} buffer — clone dedicated to pdf-lib (never shared with pdf.js)
 * @param {{ file?: File }} [ctx]
 */
export async function extractPdfEnterprise(pdf, buffer, ctx = {}) {
  const file = ctx.file || null;
  try {
    globalThis.HIRELY_PDF_PAGE_COUNT = pdf.numPages;
  } catch {
    /* ignore */
  }
  const extractionBudgetMs = pdfExtractionBudgetMs(pdf.numPages);
  const pdfLibMeta = await probePdfWithPdfLib(buffer);
  const { pages, firstPageHeaderLines } = await extractNativePdfLines(pdf);
  const allNativeText = pages.map((p) => p.lines.map((l) => l.text).join('\n')).join('\n\n');
  const nativeCorruption = corruptionScoreText(allNativeText);
  const nativeTextBroken =
    nativeCorruption >= 46 &&
    (assessPdfTextLayer(allNativeText).garbageLineRatio > 0.35 ||
      assessPdfTextLayer(allNativeText).alphaRatio < 0.5);

  const { classification: profile, quality: fullQuality, plan, pdfClassification } =
    planPdfExtraction(pages, allNativeText, { nativeTextBroken });

  hirelyDebugLog('HIRELY ENTERPRISE PDF', {
    pages: pdf.numPages,
    fileType: profile.fileType,
    route: plan.route,
    reason: plan.reason,
    textLayerFound: profile.textLayerFound,
    hasSelectableText: profile.hasSelectableText,
    nativeChars: profile.nativeCharCount,
    quality: profile.confidence,
    neverOcrNative: plan.ocrAllowed === false,
    pdfLib: pdfLibMeta,
  });

  /** Route: selectable text layer → native PDF; weak native may supplement with local OCR. */
  if (plan.route === PDF_ROUTES.NATIVE) {
    let lines = pages.flatMap((p) => p.lines);
    assertNativePdfLines(lines);
    let nativeText = linesToPlainText(lines).trim();
    let method = 'native_pdf';
    let fileType = 'pdf_text';
    let pdfDecision = plan.reason;
    let supplementMeta = null;

    if (plan.ocrMode === 'supplement' && plan.ocrAllowed) {
      const supplemented = await supplementWeakNativeWithOcr(pdf, file, lines, nativeText);
      if (supplemented) {
        lines = supplemented.lines;
        nativeText = supplemented.text;
        method = supplemented.method;
        fileType = method === 'ocr' ? 'pdf_scanned' : method === 'mixed' ? 'pdf_mixed' : 'pdf_text';
        pdfDecision = 'weak_native_ocr_supplement';
        supplementMeta = supplemented;
      }
    }

    const quality = assessPdfTextLayer(nativeText);
    return buildResult({
      lines,
      rawExtraction: nativeText,
      cleanedText: nativeText,
      method,
      fileType,
      textLayerFound: true,
      confidence: Math.max(profile.confidence, quality.confidence),
      pages: pdf.numPages,
      pdfExtraction: {
        method,
        decision: pdfDecision,
        fileType,
        extractionSource: extractionSourceLabel(method),
        why: supplementMeta ? 'Weak native layer — OCR supplement applied' : fullQuality.reason,
        charCount: nativeText.length,
        wordCount: quality.wordCount,
        textLayerFound: true,
        ocrSkipped: !supplementMeta,
        neverOcrNative: !supplementMeta,
        weakNativeSupplemented: Boolean(supplementMeta),
        textSourceAudit: supplementMeta?.textSourceAudit || null,
        selectedSource: supplementMeta?.selectedSource || 'native',
        ocrCharCount: supplementMeta?.ocrCharCount || 0,
        routing: plan,
        firstPageHeaderLines,
        pdfLib: pdfLibMeta,
        classification: pdfClassification,
      },
    });
  }

  if (!isBrowser()) {
    throw new Error('Ce PDF semble scanné. Collez le texte du CV ou utilisez TXT/DOCX.');
  }

  /** Route: mixed — native pages + OCR only on pages without text. */
  if (plan.route === PDF_ROUTES.HYBRID) {
    const extractionBudgetMs = pdfExtractionBudgetMs(pdf.numPages);
    const deadlineAt = Date.now() + extractionBudgetMs;
    const hybridNativeOnly =
      isExtractionLocked() &&
      !shouldRunOcrForTextLength(allNativeText.trim().length, {
        weakNative: allNativeText.trim().length < REAL_CV_IMPORT_MIN_CHARS,
        usable: fullQuality.usable,
        strongTextLayer: fullQuality.strongTextLayer,
      });
    if (hybridNativeOnly) {
      logExtractionLockSkip('hybrid_route', allNativeText.trim().length);
      const lines = pages.flatMap((p) => (isNativePageTrusted(p) ? p.lines || [] : []));
      return buildResult({
        lines,
        method: 'mixed',
        ocrDocument: false,
        fileType: 'pdf_mixed',
        textLayerFound: profile.textLayerFound,
        confidence: profile.confidence,
        pages: pdf.numPages,
        pdfExtraction: {
          method: 'mixed',
          decision: 'hybrid_native_only_locked',
          fileType: 'pdf_mixed',
          extractionSource: extractionSourceLabel('mixed'),
          why: `EXTRACTION_LOCK: native text ≥ ${EXTRACTION_LOCK_OCR_MIN_CHARS} chars — per-page OCR skipped`,
          charCount: fullQuality.charCount,
          wordCount: fullQuality.wordCount,
          textLayerFound: profile.textLayerFound,
          nativePages: pdf.numPages,
          ocrPages: 0,
          ocrSkippedByLock: true,
          extractionLocked: true,
          routing: plan,
          firstPageHeaderLines,
          pdfLib: pdfLibMeta,
          classification: pdfClassification,
          extractionBudgetMs,
          nativeTrustAudit: nativeTrustAudit(allNativeText),
        },
      });
    }

    await ensureTesseract();
    const hybridOut = await extractHybridPdfPages(pdf, pages, {
      fusion: pdf.numPages === 1 && isOcrFusionEnabled(),
      bestPass: true,
      allowSecondPass: globalThis.HIRELY_FORCE_PDF_OCR_RETRY === true,
      deadlineAt,
    });
    const hybridLines = hybridOut.lines;
    const pageRuntimeTrace = hybridOut.pageRuntimeTrace;

    if (!hybridLines.length) {
      throw Object.assign(new Error('HYBRID_EXTRACTION_EMPTY'), {
        code: hybridOut.deadlineExceeded ? 'OCR_TIMEOUT' : 'HYBRID_EXTRACTION_EMPTY',
        importStatus: hybridOut.deadlineExceeded ? 'PDF_OCR_TIMEOUT' : 'PDF_TEXT_EMPTY',
        pageRuntimeTrace,
      });
    }

    return buildResult({
      lines: hybridLines,
      method: 'mixed',
      ocrDocument: true,
      fileType: 'pdf_mixed',
      textLayerFound: profile.textLayerFound,
      confidence: profile.confidence,
      pages: pdf.numPages,
      pdfExtraction: {
        method: 'mixed',
        decision: 'hybrid',
        fileType: 'pdf_mixed',
        extractionSource: extractionSourceLabel('mixed'),
        why: `Hybrid per-page: ${hybridOut.nativePages} native, ${hybridOut.ocrPages} OCR page(s)`,
        charCount: fullQuality.charCount,
        wordCount: fullQuality.wordCount,
        textLayerFound: profile.textLayerFound,
        nativePages: hybridOut.nativePages,
        ocrPages: hybridOut.ocrPages,
        corruptNativeRejectedPages: hybridOut.corruptNativeRejectedPages,
        pageRuntimeTrace,
        ocrWordsByPage: hybridOut.ocrWordsByPage || {},
        extractionBudgetMs,
        deadlineExceeded: hybridOut.deadlineExceeded,
        routing: plan,
        firstPageHeaderLines,
        pdfLib: pdfLibMeta,
        classification: pdfClassification,
        nativeTrustAudit: nativeTrustAudit(allNativeText),
      },
    });
  }

  const nativeFlatLines = pages.flatMap((p) => p.lines || []);
  const nativePartialText = linesToPlainText(nativeFlatLines).trim();

  if (
    !shouldRunOcrForTextLength(nativePartialText.length, {
      weakNative: nativePartialText.length < REAL_CV_IMPORT_MIN_CHARS,
      usable: fullQuality.usable,
      strongTextLayer: fullQuality.strongTextLayer,
    })
  ) {
    logExtractionLockSkip('enterprise_full_ocr', nativePartialText.length);
    return buildResult({
      lines: nativeFlatLines,
      method: 'native_pdf',
      fileType: 'pdf_text',
      textLayerFound: profile.textLayerFound,
      confidence: Math.max(profile.confidence, 50),
      pages: pdf.numPages,
      pdfExtraction: {
        method: 'native_pdf',
        decision: 'native_locked_skip_ocr',
        fileType: 'pdf_text',
        extractionSource: extractionSourceLabel('native_pdf'),
        why: `EXTRACTION_LOCK: ${nativePartialText.length} native chars — full OCR skipped`,
        charCount: nativePartialText.length,
        wordCount: fullQuality.wordCount,
        textLayerFound: profile.textLayerFound,
        ocrSkippedByLock: true,
        extractionLocked: true,
        firstPageHeaderLines,
        pdfLib: pdfLibMeta,
        classification: pdfClassification,
      },
    });
  }

  /** Stash native probe before OCR — recoverable only when text layer is trustworthy. */
  if (
    nativePartialText.length >= 12 &&
    nativeFlatLines.length &&
    isNativeTextRecoverable(nativePartialText, nativeFlatLines)
  ) {
    setLastNativePdfProbe({ lines: nativeFlatLines, text: nativePartialText });
    setLastEnterpriseExtraction({
      rawExtraction: nativePartialText,
      text: nativePartialText,
      cleanedText: nativePartialText,
      lines: nativeFlatLines.map((l) => ({ ...l })),
      method: 'native_pdf',
      metadata: { fileType: 'pdf_text', nativeProbe: true },
      pdfExtraction: {
        method: 'native_pdf',
        decision: 'native_probe_before_ocr',
        nativePartialFallback: true,
      },
    });
  }

  /** Route: scanned PDF → full-document OCR only */
  await ensureTesseract();
  let ocrLines = [];
  let ocrPlain = '';
  let ocrRecovered = false;
  try {
    const ocrOpts = {
      fusion: pdf.numPages === 1 && isOcrFusionEnabled(),
      bestPass: true,
      allowSecondPass: globalThis.HIRELY_FORCE_PDF_OCR_RETRY === true,
      existingTextLength: nativePartialText.length,
      existingText: nativePartialText,
      existingLines: nativeFlatLines,
      deadlineAt: Date.now() + extractionBudgetMs,
    };
    const ocrOut = await runCachedTimedPdfOcr(pdf, file, ocrOpts);
    ocrLines = ocrOut.lines || [];
    ocrPlain = String(ocrOut.text || linesToPlainText(ocrLines)).trim();
    ocrRecovered = ocrOut.recoveredAfterTimeout === true;
    const ocrWordsByPage = ocrOut.ocrWordsByPage || {};
    logOcrPropagate('ENTERPRISE_AFTER_OCR', {
      ENTERPRISE_RESULT_TEXT_LENGTH: ocrPlain.length,
      OCR_LINES_COUNT: ocrLines.length,
    });
    logOcrPropagation('ENTERPRISE_AFTER_OCR', { text: ocrPlain, lines: ocrLines });
  } catch (err) {
    const ocrTimedOut =
      err?.code === 'OCR_TIMEOUT' ||
      err?.code === 'OCR_ABSOLUTE_TIMEOUT' ||
      err?.skippedAfterTimeout === true;
    if (ocrTimedOut) {
      hirelyProductLog('OCR_TIMEOUT', { phase: 'enterprise_ocr' });
    } else if (err?.code !== 'OCR_QUALITY_FAILED' && err?.code !== 'OCR_EMPTY') {
      hirelyDebugWarn('HIRELY PDF OCR failed', err?.message || err);
    }
    if (err?.code === 'OCR_QUALITY_FAILED' || err?.code === 'OCR_EMPTY') {
      throw err;
    }
    if (ocrTimedOut && nativePartialText.length < REAL_CV_IMPORT_MIN_CHARS) {
      throw err;
    }
    if (
      nativePartialText.length >= REAL_CV_IMPORT_MIN_CHARS &&
      nativeFlatLines.length &&
      isNativeTextRecoverable(nativePartialText, nativeFlatLines)
    ) {
      console.warn('HIRELY PDF OCR fallback → partial native', nativePartialText.length);
      return buildResult({
        lines: nativeFlatLines,
        method: 'native_pdf',
        fileType: 'pdf_text',
        textLayerFound: profile.textLayerFound,
        confidence: Math.max(profile.confidence, 50),
        pages: pdf.numPages,
        pdfExtraction: {
          method: 'native_pdf',
          decision: 'native_after_ocr_fail',
          fileType: 'pdf_text',
          extractionSource: extractionSourceLabel('native_pdf'),
          why: 'OCR failed — partial native PDF text retained',
          charCount: nativePartialText.length,
          nativePartialFallback: true,
          ocrFailed: true,
          firstPageHeaderLines,
          pdfLib: pdfLibMeta,
          classification: pdfClassification,
        },
      });
    }
    throw new Error(
      'OCR du PDF impossible (réseau ou fichier protégé). Collez le texte du CV ou utilisez TXT/DOCX.'
    );
  }
  logOcrPropagation('ENTERPRISE_BEFORE_BUILD', {
    text: ocrPlain || linesToPlainText(ocrLines),
    lines: ocrLines,
  });

  const ocrGate = evaluateOcrParserGate(ocrPlain, ocrLines);
  const rotationMeta = peekLastOcrRotationDecision();
  if (!ocrGate.pass && !ocrRecovered) {
    throw Object.assign(new Error(OCR_QUALITY_FAIL_MSG), {
      code: 'OCR_QUALITY_FAILED',
      importStatus: 'PDF_TEXT_EMPTY',
      ocrStatus: OCR_STATUS.FAILED_LOW_QUALITY,
      ocrQuality: ocrGate,
    });
  }
  const ocrUsability = assessOcrImportUsability({
    rawText: ocrPlain,
    cleanedText: ocrPlain,
    extractionMethod: 'ocr',
    ocrAttempted: true,
    enterprise: {
      lines: ocrLines,
      rawExtraction: ocrPlain,
      cleanedText: ocrPlain,
      method: 'ocr',
      pdfExtraction: { method: 'ocr', ocrCharCount: ocrPlain.length },
    },
  });
  if (
    !ocrUsability.usable &&
    ocrPlain.length <= OCR_FALLBACK_V1_PASTE_MAX_CHARS
  ) {
    throw Object.assign(new Error('OCR_INSUFFICIENT_TEXT'), {
      code: 'OCR_INSUFFICIENT_TEXT',
      importStatus: 'PDF_TEXT_EMPTY',
      textLength: ocrPlain.length,
    });
  }

  const chosenRotation = rotationMeta?.chosenRotation ?? 0;
  const ocrStatus = resolveOcrQualityStatus({
    text: ocrPlain,
    lines: ocrLines,
    gatePass: true,
    chosenRotation,
    acceptedByParser: true,
  });

  return buildResult({
    lines: ocrLines,
    rawExtraction: ocrPlain,
    cleanedText: ocrPlain,
    method: 'ocr',
    ocrDocument: true,
    fileType: 'pdf_scanned',
    textLayerFound: profile.textLayerFound,
    confidence: profile.confidence,
    pages: pdf.numPages,
    pdfExtraction: {
      method: 'ocr',
      decision: 'ocr',
      fileType: 'pdf_scanned',
      extractionSource: extractionSourceLabel('ocr'),
      why: plan.reason,
      charCount: fullQuality.charCount,
      wordCount: fullQuality.wordCount,
      textLayerFound: profile.textLayerFound,
      ocrCharCount: ocrPlain.length || linesToPlainText(ocrLines).trim().length,
      ocrQualityScore: ocrGate.qualityScore,
      ocrStatus,
      ocrRotation: chosenRotation,
      ocrRotationTrials: rotationMeta?.trials ?? null,
      ocrWordsByPage,
      recoveredAfterTimeout: ocrRecovered,
      ocrPages: pdf.numPages,
      nativePages: 0,
      neverOcrNative: false,
      routing: plan,
      firstPageHeaderLines,
      pdfLib: pdfLibMeta,
      classification: pdfClassification,
    },
  });
}

function buildResult({
  rawExtraction: rawExtractionIn,
  cleanedText: cleanedTextIn,
  lines,
  method,
  pdfExtraction,
  fileType = null,
  textLayerFound = null,
  confidence = null,
  pages = null,
  ocrDocument = false,
}) {
  const useOcrClean = ocrDocument || method === 'ocr' || method === 'mixed' || method === 'image';
  const exactTruth = isExactTranscriptionExtractionActive();
  recordExtractionAuditStage('pre_dedupe_lines', { lines, pageCount: pages });

  let workingLines = lines || [];
  if (exactTruth) {
    workingLines = filterExactEmptyNoiseLines(workingLines);
  } else {
    const dedupe = dedupeExtractedLines(lines);
    workingLines = dedupe.lines;
    if (dedupe.removedLines > 0 || dedupe.removedPages > 0) {
      console.warn('HIRELY extraction dedupe', {
        removedLines: dedupe.removedLines,
        removedPages: dedupe.removedPages,
        before: dedupe.before,
        after: dedupe.after,
      });
    }
  }

  const allLines = workingLines;
  const pageDocumentClassification = classifyDocumentPages(allLines, {
    pageMeta: pdfExtraction?.pageMeta || null,
  });
  const parsingLines = filterLinesForResumeParsing(allLines, pageDocumentClassification);
  const resumeCoreLineCount = parsingLines.length;
  if (
    pageDocumentClassification.portfolio_pages?.length &&
    resumeCoreLineCount < allLines.length
  ) {
    hirelyDebugLog('HIRELY extraction portfolio pages excluded', {
      portfolioPages: pageDocumentClassification.portfolio_pages,
      allLines: allLines.length,
      resumeCoreLines: resumeCoreLineCount,
    });
  }

  const docTexts = buildDocumentTextsFromLines(
    resumeCoreLineCount > 0 ? parsingLines : allLines,
    { ocr: exactTruth ? false : useOcrClean, preserveRaw: exactTruth }
  );
  let enrichedLines = docTexts.lines;
  let rawExtraction = rawExtractionIn ?? docTexts.rawExtraction;
  let cleanedText = cleanedTextIn ?? docTexts.cleanedText;

  if (exactTruth) {
    rawExtraction = trivialTranscriptionNormalize(rawExtraction);
    cleanedText = trivialTranscriptionNormalize(cleanedText);
  } else {
    const textDedupe = dedupePlainText(rawExtraction);
    if (textDedupe.beforeChars !== textDedupe.afterChars) {
      rawExtraction = textDedupe.text;
    }
    const cleanDedupe = dedupePlainText(cleanedText);
    if (cleanDedupe.beforeChars !== cleanDedupe.afterChars) {
      cleanedText = cleanDedupe.text;
    }
  }

  recordExtractionAuditStage('cleaned_text', {
    lines: enrichedLines,
    rawText: rawExtraction,
    cleanText: cleanedText,
    pageCount: pages,
  });

  const prepared = exactTruth
    ? { lines: allLines, layout: null, reading: null, usedGeometryReadingOrder: false }
    : preparePdfLinesForParsing(enrichedLines, {
        rawText: rawExtraction,
        cleanedText,
        ocrLayout: pdfExtraction?.ocrLayout || null,
        pdfExtraction,
      });
  enrichedLines = exactTruth ? allLines : prepared.lines?.length ? prepared.lines : enrichedLines;
  const layoutStage = prepared.layout;
  const readingStage = prepared.reading;
  const layoutMemory = exactTruth
    ? { lines: allLines, spatialBlocks: [], orderedLines: allLines }
    : buildLayoutMemory(enrichedLines, {
        layout: layoutStage,
        orderedLines: readingStage?.orderedLines,
        rawText: rawExtraction,
        cleanedText,
        ocrLayout: pdfExtraction?.ocrLayout || null,
        pageLayouts: prepared.pdfBlockEngine?.pageLayouts || null,
      });
  enrichedLines = exactTruth ? allLines : layoutMemory.lines?.length ? layoutMemory.lines : enrichedLines;

  let spatialBlocks = exactTruth ? [] : layoutMemory.spatialBlocks || [];
  if (!exactTruth) {
    const reconSpatial = spatialBlocksFromReconstruction(prepared.pdfBlockEngine);
    if (reconSpatial.length > spatialBlocks.length) {
      spatialBlocks = reconSpatial;
    }
    spatialBlocks = filterSpatialBlocksForResumeParsing(
      spatialBlocks,
      pageDocumentClassification
    );
    if (!String(cleanedText || '').trim() && spatialBlocks.length) {
      cleanedText = spatialBlocksToPlainText(spatialBlocks);
    }
  }

  const layoutMemoryWithSpatial = {
    ...layoutMemory,
    spatialBlocks,
    parserText: spatialBlocksToPlainText(spatialBlocks),
  };

  const summary = summarizeLines(enrichedLines);
  const resolvedConfidence =
    confidence ??
    (summary.lineCount
      ? Math.round(
          enrichedLines.reduce((s, l) => s + (l.confidence || 0), 0) / summary.lineCount
        )
      : 0);
  const documentStage = detectDocumentStage({
    method,
    fileType: fileType || pdfExtraction?.fileType,
    pdfClassification: pdfExtraction?.classification || null,
  });

  logOcrPropagate('ENTERPRISE_BUILD_RESULT', {
    ENTERPRISE_RESULT_TEXT_LENGTH: String(rawExtraction || '').trim().length,
    OCR_LINES_COUNT: enrichedLines.length,
  });
  logOcrPropagation('ENTERPRISE_BUILD_RESULT', {
    text: rawExtraction,
    lines: enrichedLines,
    note: `method=${method}`,
  });

  const spatialBlockCount =
    spatialBlocks?.length ||
    layoutMemoryWithSpatial.spatialBlocks?.length ||
    0;
  const positionedLineCount = enrichedLines.filter(
    (l) => Number.isFinite(l?.x) && (l.x > 0 || l.y > 0) && Number.isFinite(l?.y)
  ).length;

  const extractionDebug = buildExtractionDebugBundle({
    allLines,
    parsingLines: resumeCoreLineCount > 0 ? parsingLines : allLines,
    pageDocumentClassification,
    layoutStage,
    readingStage,
    layoutMemory: layoutMemoryWithSpatial,
    spatialBlocks,
    pdfExtraction,
    method,
    rawExtraction,
    cleanedText,
  });

  const hintsSourceLines = resumeCoreLineCount > 0 ? parsingLines : allLines;
  const headerTexts = hintsSourceLines
    .map((l) => String(l.cleanedText ?? l.text ?? '').trim())
    .filter(Boolean);
  const identityRecoveryHints = extractLockedIdentity(headerTexts, {
    fileName: pdfExtraction?.fileName || null,
  });
  identityRecoveryHints.fileNameHint = extractNameFromFileName(pdfExtraction?.fileName);

  const structureFirstPreview = resolveStructureFirstParserText({
    lines: enrichedLines,
    linesAllPages: allLines,
    cleanedText,
    rawExtraction,
    metadata: { pageDocumentClassification, spatialBlocks, extractionDebug, layoutMemory: layoutMemoryWithSpatial },
    spatialBlocks,
    layoutMemory: layoutMemoryWithSpatial,
  });
  extractionDebug.runtime = {
    ...(extractionDebug.runtime || {}),
    parserTextSource: structureFirstPreview.source,
    structureFirstParser: structureFirstPreview.structureFirst,
  };

  const metadata = {
    extractionMethod: method,
    extractionSource: extractionSourceLabel(method),
    fileType: fileType || pdfExtraction?.fileType || method,
    fileTypeLabel: fileTypeLabel(fileType || pdfExtraction?.fileType),
    documentType: documentStage.documentType,
    layoutType: layoutStage?.layoutType ?? prepared.layoutType ?? 'unknown',
    layoutLabel: prepared.layoutType ?? layoutStage?.layoutLabel ?? layoutStage?.layoutType ?? 'unknown',
    confidence: resolvedConfidence,
    pages: pages ?? summary.pageCount,
    textLayerFound: textLayerFound ?? pdfExtraction?.textLayerFound ?? null,
    rawExtraction,
    cleanedText,
    lineCount: summary.lineCount,
    allLineCount: allLines.length,
    resumeCoreLineCount,
    nativeLineCount: summary.nativeLineCount,
    ocrLineCount: summary.ocrLineCount,
    lowConfidenceCount: summary.lowConfidenceCount,
    pageCount: summary.pageCount,
    pdfLib: pdfExtraction?.pdfLib || null,
    engine: 'hirely-production-extraction-v1',
    documentStage,
    layoutStage,
    readingStage,
    layoutMemory: layoutMemoryWithSpatial,
    spatialBlocks,
    spatialParseInput: spatialBlockCount >= 3 || positionedLineCount >= 3,
    positionedLineCount,
    pageDocumentClassification,
    pageDocumentClassificationDebug:
      buildPageDocumentClassificationDebug(pageDocumentClassification),
    extractionDebug,
    ocrWordsByPage: pdfExtraction?.ocrWordsByPage || {},
    identityRecoveryHints,
    nameCandidates: identityRecoveryHints.nameCandidates || [],
    titleCandidates: identityRecoveryHints.titleCandidates || [],
    portfolioPagesExcluded: pageDocumentClassification.portfolio_pages || [],
    resumeCorePages: pageDocumentClassification.resume_core_pages || [],
    structureFirstExtraction: true,
    flatTextFallbackSuppressed:
      hasPositionedPdfLines(resumeCoreLineCount > 0 ? parsingLines : allLines) &&
      prepared.documentReconstruction === true,
    readingOrderBeforeParse: true,
    usedGeometryReadingOrder: prepared.usedGeometryReadingOrder,
    usedColumnReconstruction: prepared.usedColumnReconstruction,
    neverRawPdfLineOrder: prepared.neverRawPdfLineOrder,
    neverParseRawPdfText: prepared.neverParseRawPdfText === true,
    parseFromDocumentBlocksOnly: prepared.parseFromDocumentBlocksOnly === true,
    parseFromVisualStructureOnly: prepared.pdfBlockEngine?.parseFromVisualStructureOnly === true,
    documentReconstruction: prepared.documentReconstruction === true,
    visualStructure: prepared.visualStructure || prepared.pdfBlockEngine?.visualStructure || null,
    reconstructionError: prepared.reconstructionError || null,
    documentBlocks: prepared.documentBlocks || [],
    pdfBlockEngine: prepared.pdfBlockEngine || null,
    at: new Date().toISOString(),
  };
  try {
    globalThis.__HIRELY_LAST_EXTRACTION_RUNTIME__ = {
      at: metadata.at,
      method,
      extractionBudgetMs: pdfExtraction?.extractionBudgetMs || null,
      pageRuntimeTrace: pdfExtraction?.pageRuntimeTrace || null,
      nativeTrustAudit: pdfExtraction?.nativeTrustAudit || null,
      extractionDebug,
      identityRecoveryHints,
      parserInputSource: structureFirstPreview.source,
      resumeCoreLineCount,
      positionedLineCount,
      spatialBlockCount,
      portfolioPagesExcluded: pageDocumentClassification.portfolio_pages || [],
    };
    globalThis.__HIRELY_EXTRACTION_RECOVERY_DEBUG__ = {
      at: metadata.at,
      method,
      parserInputSource: structureFirstPreview.source,
      pageRuntimeTrace: pdfExtraction?.pageRuntimeTrace || null,
      identityRecoveryHints,
      pageDocumentClassification,
    };
  } catch {
    /* ignore */
  }
  return {
    rawExtraction,
    cleanedText,
    text: cleanedText,
    lines: enrichedLines,
    linesAllPages: allLines,
    layoutMemory: layoutMemoryWithSpatial,
    spatialBlocks,
    method,
    metadata,
    documentBlocks: prepared.documentBlocks || [],
    pdfExtraction: { ...pdfExtraction, metadata },
  };
}

/**
 * Wrap plain text imports (paste/txt) with line archive.
 * @param {string} text
 * @param {'paste'|'txt'|'docx'} method
 */
export function extractPlainTextEnterprise(text, method = 'paste') {
  const lines = linesFromPlainText(normalizeRawExtract(text), 'native');
  const fileType = method === 'docx' ? 'docx' : method === 'txt' ? 'txt' : 'txt';
  return buildResult({
    lines,
    method: method === 'docx' ? 'docx' : method === 'txt' ? 'txt' : 'paste',
    fileType,
    textLayerFound: true,
    confidence: NATIVE_DEFAULT_CONFIDENCE,
    pages: 1,
    pdfExtraction: null,
  });
}
