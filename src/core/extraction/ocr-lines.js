/**
 * OCR extraction with per-line confidence (Tesseract / Vision).
 * Multi-pass fusion runs internally — not exposed to UI.
 */

import { runOcrOnCanvasWithLines } from './ocr-pipeline.js';
import { renderPdfPageToCanvas } from './pdf-ocr-render.js';
import { preprocessCanvasForOcr } from './ocr-preprocess.js';
import { pushOcrPreprocessPreview } from './extraction-session.js';
import { runOcrWithFusion, isOcrFusionEnabled } from './ocr-multipass.js';
import { runOcrBestPass, isOcrBestPassEnabled } from './ocr-best-pass.js';
import { selectBestOcrRotation } from './ocr-rotation-select.js';
import { postProcessOcrText } from '../parsing/ocr-postprocess.js';
import { OCR_FALLBACK_CONFIDENCE, coerceOcrExtractedLine } from './extracted-line.js';
import { recordExtractionAuditStage } from './extraction-audit.js';
import { logExtractionStep } from './file-buffer.js';
import { logOcrPropagation, logOcrPropagate } from './ocr-propagation-trace.js';
import { shouldRunOcrForTextLength, logExtractionLockSkip } from './extraction-lock.js';
import { REAL_CV_IMPORT_MIN_CHARS } from '../import/real-cv-import-constants.js';
import { clusterOcrWordsIntoLineGroups } from './extraction-column-split.js';
import { isExactEmptyNoiseText } from './exact-transcription-truth.js';
import {
  buildOcrGeometryTransform,
  normalizeOcrWordsToPageSpace,
  isValidWordBbox,
} from './ocr-geometry.js';

function isDebugPreprocess() {
  if (typeof globalThis === 'undefined') return false;
  if (globalThis.HIRELY_OCR_PREPROCESS_DEBUG) return true;
  try {
    return /(?:\?|&)debug=true/.test(String(globalThis.location?.search || ''));
  } catch {
    return false;
  }
}

function isExactTranscriptionExtract() {
  if (typeof globalThis === 'undefined') return false;
  return (
    globalThis.HIRELY_EXACT_TRANSCRIPTION === true ||
    globalThis.HIRELY_EXACT_TRANSCRIPTION_ACTIVE === true
  );
}

function exactOcrVariant() {
  return isExactTranscriptionExtract() ? 'exact_fidelity' : null;
}

function storeExactOcrPagePreview(page, canvas) {
  if (!isExactTranscriptionExtract() || typeof document === 'undefined') return;
  try {
    const max = 720;
    const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
    let dataUrl;
    if (scale >= 0.99) {
      dataUrl = canvas.toDataURL('image/png', 0.82);
    } else {
      const p = document.createElement('canvas');
      p.width = Math.max(1, Math.round(canvas.width * scale));
      p.height = Math.max(1, Math.round(canvas.height * scale));
      p.getContext('2d', { willReadFrequently: true }).drawImage(canvas, 0, 0, p.width, p.height);
      dataUrl = p.toDataURL('image/png', 0.82);
    }
    globalThis.__HIRELY_OCR_PAGE_PREVIEWS__ = globalThis.__HIRELY_OCR_PAGE_PREVIEWS__ || {};
    globalThis.__HIRELY_OCR_PAGE_PREVIEWS__[page] = dataUrl;
  } catch {
    /* ignore */
  }
}

function polishOcrLines(lines) {
  if (isExactTranscriptionExtract()) {
    return (lines || [])
      .map((ln) => {
        const raw = String(ln.rawExtraction ?? ln.text ?? '');
        if (isExactEmptyNoiseText(raw)) return null;
        return {
          ...ln,
          text: raw,
          cleanedText: raw,
          rawExtraction: raw,
        };
      })
      .filter(Boolean);
  }
  return (lines || []).map((ln) => {
    const raw = String(ln.rawExtraction ?? ln.text ?? '').trim();
    const cleaned = postProcessOcrText(raw);
    if (!cleaned) return null;
    return {
      ...ln,
      text: cleaned,
      cleanedText: cleaned,
      rawExtraction: raw,
    };
  }).filter(Boolean);
}

/** Keep Tesseract text when line polish strips everything (charCount > 0 but join empty). */
function finalizeOcrCanvasOutput(result, page = 1, geometryCtx = {}) {
  const raw = String(result?.text || '').trim();
  let words = result?.words || [];
  if (words.length && geometryCtx.preprocessMeta) {
    const transform = buildOcrGeometryTransform(geometryCtx.preprocessMeta, {
      viewportWidth: geometryCtx.viewportWidth,
      viewportHeight: geometryCtx.viewportHeight,
      renderScale: geometryCtx.renderScale,
      rotationDeg: geometryCtx.rotationDeg,
      renderWidth: geometryCtx.renderWidth,
      renderHeight: geometryCtx.renderHeight,
    });
    const normalized = normalizeOcrWordsToPageSpace(words, transform);
    if (normalized.length) {
      words = normalized.map((w) => ({ ...w, page }));
    }
  }
  let polished = result?.lines?.length ? polishOcrLines(result.lines) : [];
  let joined = polished.map((l) => l.text).join('\n').trim();
  let lines = polished;

  if (isExactTranscriptionExtract() && words.length >= 3) {
    const pageWidth = Math.max(
      200,
      ...words
        .filter((w) => isValidWordBbox(w.bbox))
        .map((w) => (w.bbox?.x ?? 0) + (w.bbox?.width ?? w.bbox?.w ?? 0))
    );
    const groups = clusterOcrWordsIntoLineGroups(
      words.map((w) => {
        const bb = w.bbox || {};
        const x0 = bb.x ?? 0;
        const y0 = bb.y ?? 0;
        const x1 = x0 + (bb.width ?? bb.w ?? 0);
        const y1 = y0 + (bb.height ?? bb.h ?? 0);
        return {
          text: w.text,
          bbox: { x0, y0, x1, y1 },
          confidence: w.confidence,
        };
      }),
      pageWidth
    );
    if (groups.length) {
      lines = groups.map((g, i) => {
        const lineWords = words.filter((w) => {
          if (!w.bbox || !isValidWordBbox(w.bbox)) return false;
          const h = w.bbox.height ?? w.bbox.h ?? 12;
          const cy = (w.bbox.y ?? 0) + h / 2;
          const lineTop = g.y;
          const lineH = g.height || 12;
          return cy >= lineTop - 2 && cy <= lineTop + lineH + 2;
        });
        return coerceOcrExtractedLine(
          {
            text: g.text,
            rawExtraction: g.text,
            cleanedText: g.text,
            x: g.x,
            y: g.y,
            width: g.width,
            height: g.height,
            words: lineWords,
          },
          {
            text: g.text,
            rawExtraction: g.text,
            page,
            line: i,
            confidence: g.confidence || 72,
          }
        );
      });
      joined = lines.map((l) => l.text).join('\n').trim();
    }
  }

  if (!joined && raw) {
    const recovered = isExactTranscriptionExtract() ? raw : postProcessOcrText(raw) || raw;
    joined = String(recovered).trim();
    lines = polishOcrLines(
      joined.split('\n').map((t, i) =>
        coerceOcrExtractedLine({ text: t }, { text: t, rawExtraction: t, page, line: i })
      )
    );
    if (!lines.length && joined) {
      lines = [coerceOcrExtractedLine({ text: joined }, { text: joined, rawExtraction: raw, page, line: 0 })];
    }
    if (joined) {
      logExtractionStep('OCR_TEXT_RECOVERED', `${joined.length}c page=${page}`);
    }
  }

  logOcrPropagate('OCR_CANVAS', {
    OCR_RESULT_TEXT_LENGTH: raw.length,
    OCR_LINES_COUNT: lines.length,
    OCR_JOINED_TEXT_LENGTH: joined.length,
    page,
  });

  return { text: joined, lines, words: result?.words || [] };
}

async function ocrCanvasSinglePass(canvas, opts = {}) {
  const page = opts.page || 1;
  const debug = opts.debugPreprocess ?? isDebugPreprocess();
  const renderWidth = opts.renderWidth || opts.viewportWidth || canvas.width;
  const renderHeight = opts.renderHeight || opts.viewportHeight || canvas.height;
  const renderScale =
    opts.renderScale ||
    (opts.viewportWidth > 0 ? renderWidth / opts.viewportWidth : 1);
  const prep = preprocessCanvasForOcr(canvas, {
    viewportWidth: opts.viewportWidth || canvas.width,
    viewportHeight: opts.viewportHeight || canvas.height,
    renderWidth,
    renderHeight,
    targetDpi: opts.targetDpi,
    variant: opts.preferredVariant || opts.variant || exactOcrVariant() || 'standard',
    skipAutoRotate: opts.skipAutoRotate === true,
    rotationDeg: opts.rotationDeg || 0,
    debug,
    page,
  });
  if (prep.previews) {
    pushOcrPreprocessPreview({ page, before: prep.previews.before, after: prep.previews.after, meta: prep.meta });
  }
  storeExactOcrPagePreview(page, prep.canvas);
  try {
    const result = await runOcrOnCanvasWithLines(prep.canvas, {
      lang: opts.lang || 'fra+eng',
      preprocessed: true,
      tessPsm: prep.meta.suggestedPsm,
      preprocessMeta: prep.meta,
    });
    if (result.lines?.length || result.text) {
      return finalizeOcrCanvasOutput(
        {
          text: result.text,
          words: result.words || [],
          lines: (result.lines || []).map((ln, i) =>
            coerceOcrExtractedLine(ln, {
              text: ln.text,
              rawExtraction: ln.text,
              page,
              line: ln.line ?? i,
            })
          ),
        },
        page,
        {
          preprocessMeta: prep.meta,
          viewportWidth: opts.viewportWidth,
          viewportHeight: opts.viewportHeight,
          renderScale,
          rotationDeg: opts.rotationDeg || 0,
          renderWidth,
          renderHeight,
        }
      );
    }
  } catch (e) {
    console.warn('HIRELY OCR lines', e);
  }
  return { text: '', lines: [] };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ lang?: string, page?: number, fusion?: boolean }} [opts]
 */
export async function ocrCanvasToLines(canvas, opts = {}) {
  if (opts.variant && opts.fusion !== true) {
    const debug = opts.debugPreprocess ?? isDebugPreprocess();
    const prep = preprocessCanvasForOcr(canvas, {
      viewportWidth: opts.viewportWidth || canvas.width,
      viewportHeight: opts.viewportHeight || canvas.height,
      targetDpi: opts.targetDpi,
      variant: opts.variant || exactOcrVariant() || 'standard',
      skipAutoRotate: opts.skipAutoRotate === true,
      rotationDeg: opts.rotationDeg || 0,
      debug,
      page: opts.page || 1,
    });
    if (prep.previews) {
      pushOcrPreprocessPreview({
        page: opts.page || 1,
        before: prep.previews.before,
        after: prep.previews.after,
        meta: prep.meta,
      });
    }
    storeExactOcrPagePreview(opts.page || 1, prep.canvas);
    const result = await runOcrOnCanvasWithLines(prep.canvas, {
      lang: opts.lang || 'fra+eng',
      preprocessed: true,
      tessPsm: prep.meta.suggestedPsm,
      preprocessMeta: prep.meta,
    });
    if (result.lines?.length || result.text) {
      return finalizeOcrCanvasOutput(result, opts.page || 1);
    }
    return { text: '', lines: [] };
  }
  if (!isExactTranscriptionExtract() && isOcrFusionEnabled(opts)) {
    const debug = opts.debugPreprocess ?? isDebugPreprocess();
    if (debug) {
      const prep = preprocessCanvasForOcr(canvas, {
        viewportWidth: opts.viewportWidth || canvas.width,
        viewportHeight: opts.viewportHeight || canvas.height,
        debug: true,
        page: opts.page || 1,
        variant: 'standard',
      });
      if (prep.previews) {
        pushOcrPreprocessPreview({
          page: opts.page || 1,
          before: prep.previews.before,
          after: prep.previews.after,
          meta: prep.meta,
        });
      }
    }
    const fused = await runOcrWithFusion(canvas, opts);
    if (fused.text || fused.lines.length) {
      return finalizeOcrCanvasOutput(fused, opts.page || 1);
    }
  }
  if (!isExactTranscriptionExtract() && isOcrBestPassEnabled(opts)) {
    const best = await runOcrBestPass(canvas, opts);
    if (best.lines?.length || best.text) {
      const out = finalizeOcrCanvasOutput(best, opts.page || 1);
      return { ...out, ocrBestPass: best.winnerPass };
    }
  }
  return ocrCanvasSinglePass(canvas, opts);
}

/**
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 * @param {number} pageNumber 1-based
 */
export async function ocrPdfPageToLines(pdf, pageNumber, opts = {}) {
  if (opts.deadlineAt && Date.now() >= opts.deadlineAt) {
    logExtractionStep('OCR_PAGE_DEADLINE', `page=${pageNumber}`);
    return { text: '', lines: [], deadlineExceeded: true };
  }
  const existingLen = Number(opts.existingTextLength ?? 0) || 0;
  if (
    !shouldRunOcrForTextLength(existingLen, {
      weakNative: existingLen < REAL_CV_IMPORT_MIN_CHARS,
      usable: opts.usable,
      strongTextLayer: opts.strongTextLayer,
    })
  ) {
    logExtractionLockSkip(`ocr_pdf_page_${pageNumber}`, existingLen);
    return { text: '', lines: [], extractionLockSkip: true };
  }

  const page = await pdf.getPage(pageNumber);
  const vp1 = page.getViewport({ scale: 1 });
  const canvas = await renderPdfPageToCanvas(page, opts.scale);
  const renderWidth = canvas.width;
  const renderHeight = canvas.height;
  const renderScale = renderWidth / vp1.width;
  const rotationPick = await selectBestOcrRotation(canvas, {
    lang: opts.lang,
    page: pageNumber,
    viewportWidth: vp1.width,
    viewportHeight: vp1.height,
    targetDpi: opts.targetDpi,
    deadlineAt: opts.deadlineAt,
  });
  const base = {
    ...opts,
    page: pageNumber,
    viewportWidth: vp1.width,
    viewportHeight: vp1.height,
    renderWidth,
    renderHeight,
    renderScale,
    skipAutoRotate: true,
    rotationDeg: rotationPick.rotationDeg,
    preferredVariant: rotationPick.variant,
  };
  let out = await ocrCanvasToLines(rotationPick.canvas, {
    ...base,
    bestPass: isExactTranscriptionExtract() ? false : opts.bestPass !== false,
    fusion: isExactTranscriptionExtract() ? false : opts.fusion,
  });
  if (!out.lines?.length && !opts.variant && opts.allowSecondPass && !isExactTranscriptionExtract()) {
    out = await ocrCanvasToLines(rotationPick.canvas, {
      ...base,
      variant: 'high_contrast',
      bestPass: false,
    });
  }
  recordExtractionAuditStage(`ocr_page_${pageNumber}`, {
    lines: out.lines,
    rawText: out.text,
    pageCount: 1,
    note: `page ${pageNumber} rotation=${rotationPick.rotationDeg}° score=${rotationPick.qualityScore}`,
  });
  return { ...out, ocrRotation: rotationPick };
}

/**
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 */
export async function ocrPdfAllPagesToLines(pdf, opts = {}) {
  const lines = [];
  const pageTexts = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const { text, lines: pageLines } = await ocrPdfPageToLines(pdf, n, opts);
    if (text) pageTexts.push(text);
    lines.push(...pageLines);
  }
  const merged = pageTexts.join('\n\n');
  const joinedLen = merged.trim().length;
  logOcrPropagate('OCR_ALL_PAGES', {
    OCR_LINES_COUNT: lines.length,
    OCR_JOINED_TEXT_LENGTH: joinedLen,
    OCR_RESULT_TEXT_LENGTH: joinedLen,
    pages: pdf.numPages,
  });
  logOcrPropagation('OCR_ALL_PAGES', { text: merged, lines, note: `pages=${pdf.numPages}` });
  return { lines, text: merged };
}
