/**
 * OCR word bbox validation and canvas → PDF page coordinate mapping.
 */

import { logExtractionStep } from './file-buffer.js';
import { hirelyProductLog } from '../runtime/hirely-debug.js';

/** @type {object[]} */
const zeroBboxTraceBuffer = [];

/**
 * @param {object|null|undefined} bbox
 */
export function isZeroWordBbox(bbox) {
  if (!bbox) return true;
  const x = Number(bbox.x ?? bbox.x0);
  const y = Number(bbox.y ?? bbox.y0);
  const w = Number(bbox.w ?? bbox.width ?? (bbox.x1 != null && bbox.x0 != null ? bbox.x1 - bbox.x0 : 0));
  const h = Number(bbox.h ?? bbox.height ?? (bbox.y1 != null && bbox.y0 != null ? bbox.y1 - bbox.y0 : 0));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
  if ((!w || w <= 0) && (!h || h <= 0) && x === 0 && y === 0) return true;
  if (w === 0 && h === 0) return true;
  return false;
}

/**
 * @param {object|null|undefined} bbox
 */
export function isValidWordBbox(bbox) {
  if (!bbox || isZeroWordBbox(bbox)) return false;
  const x = Number(bbox.x ?? bbox.x0);
  const y = Number(bbox.y ?? bbox.y0);
  const w = Number(bbox.w ?? bbox.width ?? (bbox.x1 != null && bbox.x0 != null ? bbox.x1 - bbox.x0 : 0));
  const h = Number(bbox.h ?? bbox.height ?? (bbox.y1 != null && bbox.y0 != null ? bbox.y1 - bbox.y0 : 0));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return false;
  if (w <= 1 && h <= 1 && x === 0 && y === 0) return false;
  return Number.isFinite(x) && Number.isFinite(y);
}

/**
 * Exact transcription output must never ship [0,0 0x0]. Returns null instead.
 * @param {object|null|undefined} bbox
 */
export function sanitizeExactWordBbox(bbox) {
  if (!bbox || isZeroWordBbox(bbox) || !isValidWordBbox(bbox)) return null;
  const x = Math.round(Number(bbox.x ?? bbox.x0) || 0);
  const y = Math.round(Number(bbox.y ?? bbox.y0) || 0);
  const w = Math.round(Number(bbox.w ?? bbox.width) || 0);
  const h = Math.round(Number(bbox.h ?? bbox.height) || 0);
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

export function resetZeroBboxTrace() {
  zeroBboxTraceBuffer.length = 0;
}

export function getZeroBboxTraceReport() {
  return [...zeroBboxTraceBuffer];
}

/**
 * Zero bbox in exact output is a pipeline bug — record where normalization failed.
 * @param {string} stage
 * @param {object} [detail]
 */
export function traceZeroBboxPipelineBug(stage, detail = {}) {
  const entry = {
    at: new Date().toISOString(),
    stage: String(stage || 'unknown'),
    ...detail,
  };
  zeroBboxTraceBuffer.push(entry);
  const text = entry.text ? ` text=${String(entry.text).slice(0, 40)}` : '';
  const reason = entry.reason ? ` reason=${entry.reason}` : '';
  logExtractionStep('ZERO_BBOX_PIPELINE_BUG', `${entry.stage}${text}${reason}`);
  hirelyProductLog('ZERO_BBOX_PIPELINE_BUG', entry);
}

/**
 * @param {string} stage
 * @param {object} word
 * @param {object|null} engineRaw
 * @param {string} reason
 */
export function traceBboxNormalizationFailure(stage, word, engineRaw, reason) {
  traceZeroBboxPipelineBug(stage, {
    reason,
    text: word?.text,
    page_number: word?.page_number ?? word?.page,
    engine_raw: engineRaw || null,
    incoming_bbox: word?.bbox || null,
  });
}

/**
 * Normalize Tesseract / engine word bbox to { x, y, width, height } in OCR canvas space.
 * @param {object} w
 */
export function extractEngineWordBbox(w) {
  const bb = w?.bbox ?? w;
  if (!bb) return null;
  if (Array.isArray(bb) && bb.length >= 4) {
    const [x0, y0, x1, y1] = bb.map(Number);
    const width = Math.max(0, Math.round(x1 - x0));
    const height = Math.max(0, Math.round(y1 - y0));
    const out = { x: Math.round(x0), y: Math.round(y0), width, height };
    if (isZeroWordBbox(out) || !isValidWordBbox(out)) return null;
    return out;
  }
  const x0 = Number(bb.x0 ?? bb.x);
  const y0 = Number(bb.y0 ?? bb.y);
  const x1 = Number(bb.x1 ?? (x0 + Number(bb.width ?? bb.w ?? 0)));
  const y1 = Number(bb.y1 ?? (y0 + Number(bb.height ?? bb.h ?? 0)));
  const width = Math.max(0, Math.round(x1 - x0));
  const height = Math.max(0, Math.round(y1 - y0));
  if (!Number.isFinite(x0) || !Number.isFinite(y0)) return null;
  const out = { x: Math.round(x0), y: Math.round(y0), width, height };
  if (isZeroWordBbox(out) || !isValidWordBbox(out)) return null;
  return out;
}

/**
 * @param {object} meta preprocess meta from preprocessCanvasForOcr
 * @param {object} [opts]
 */
export function buildOcrGeometryTransform(meta = {}, opts = {}) {
  const viewportWidth = Number(opts.viewportWidth ?? meta.viewportWidth) || 0;
  const viewportHeight = Number(opts.viewportHeight ?? meta.viewportHeight) || 0;
  const renderScale =
    Number(opts.renderScale) ||
    (viewportWidth > 0 && meta.inputWidth ? meta.inputWidth / viewportWidth : 1);
  const cropLeft = Number(meta.cropLeft ?? meta.marginBounds?.left) || 0;
  const cropTop = Number(meta.cropTop ?? meta.marginBounds?.top) || 0;
  const croppedWidth = Number(meta.croppedWidth) || meta.inputWidth || 0;
  const croppedHeight = Number(meta.croppedHeight) || meta.inputHeight || 0;
  const ocrWidth = Number(meta.width ?? meta.ocrCanvasWidth) || 0;
  const ocrHeight = Number(meta.height ?? meta.ocrCanvasHeight) || 0;
  const scaleToOcr =
    croppedWidth > 0 && ocrWidth > 0 ? ocrWidth / croppedWidth : 1;
  const rotationDeg = Number(opts.rotationDeg ?? meta.rotationDeg) || 0;
  const renderWidth = Number(opts.renderWidth ?? meta.renderWidth) || 0;
  const renderHeight = Number(opts.renderHeight ?? meta.renderHeight) || 0;
  return {
    cropLeft,
    cropTop,
    scaleToOcr,
    renderScale: renderScale > 0 ? renderScale : 1,
    rotationDeg,
    renderWidth,
    renderHeight,
    ocrInputWidth: Number(meta.inputWidth) || 0,
    ocrInputHeight: Number(meta.inputHeight) || 0,
    viewportWidth,
    viewportHeight,
  };
}

/**
 * Inverse-rotate a point from rotated canvas space back to pre-rotation render canvas.
 * @param {number} x
 * @param {number} y
 * @param {number} rotationDeg
 * @param {number} renderW
 * @param {number} renderH
 */
export function unrotatePointFromCanvas(x, y, rotationDeg, renderW, renderH) {
  const deg = ((Number(rotationDeg) || 0) % 360 + 360) % 360;
  if (!deg) return { x, y };
  const rx = Number(x);
  const ry = Number(y);
  const W = Number(renderW) || 0;
  const H = Number(renderH) || 0;
  if (deg === 90) return { x: H - ry, y: rx };
  if (deg === 180) return { x: W - rx, y: H - ry };
  if (deg === 270) return { x: ry, y: W - rx };
  return { x: rx, y: ry };
}

/**
 * Map bbox from OCR canvas pixels to PDF viewport (scale 1) coordinates.
 * @param {{ x: number, y: number, width: number, height: number }} bbox
 * @param {ReturnType<typeof buildOcrGeometryTransform>} transform
 */
export function mapWordBboxToPageSpace(bbox, transform) {
  if (!bbox || !transform) return null;
  const scale = transform.scaleToOcr > 0 ? transform.scaleToOcr : 1;
  const xCrop = bbox.x / scale + transform.cropLeft;
  const yCrop = bbox.y / scale + transform.cropTop;
  const wCrop = bbox.width / scale;
  const hCrop = bbox.height / scale;
  const cx = xCrop + wCrop / 2;
  const cy = yCrop + hCrop / 2;
  unrotatePointFromCanvas(
    cx,
    cy,
    transform.rotationDeg,
    transform.renderWidth,
    transform.renderHeight
  );
  const topLeft = unrotatePointFromCanvas(
    xCrop,
    yCrop,
    transform.rotationDeg,
    transform.renderWidth,
    transform.renderHeight
  );
  const rs = transform.renderScale > 0 ? transform.renderScale : 1;
  const x = Math.round(topLeft.x / rs);
  const y = Math.round(topLeft.y / rs);
  const width = Math.max(1, Math.round(wCrop / rs));
  const height = Math.max(1, Math.round(hCrop / rs));
  const mapped = { x, y, width, height };
  if (!isValidWordBbox(mapped)) {
    traceBboxNormalizationFailure(
      'mapWordBboxToPageSpace',
      { bbox: { input: bbox } },
      bbox,
      'canvas_to_page_invalid'
    );
    return null;
  }
  return mapped;
}

/**
 * @param {object[]} words
 * @param {object} transform
 */
export function normalizeOcrWordsToPageSpace(words, transform) {
  return (words || [])
    .map((w) => {
      const text = String(w.text || '').trim();
      if (!text) return null;
      const raw = extractEngineWordBbox(w);
      if (!raw || !isValidWordBbox(raw)) {
        if (w.bbox && isZeroWordBbox(w.bbox)) {
          traceBboxNormalizationFailure('normalizeOcrWordsToPageSpace', w, w.bbox, 'engine_zero_bbox');
        }
        return null;
      }
      const mapped = mapWordBboxToPageSpace(raw, transform);
      if (!mapped || !isValidWordBbox(mapped)) {
        traceBboxNormalizationFailure('normalizeOcrWordsToPageSpace', w, raw, 'page_map_failed');
        return null;
      }
      return {
        text,
        bbox: mapped,
        confidence: Math.round(w.confidence ?? 70),
        source: w.source || 'ocr',
        inferred: false,
        page_number: w.page_number ?? w.page ?? null,
      };
    })
    .filter(Boolean);
}

export function wordHasRealOcrGeometry(w) {
  if (!w?.bbox || !isValidWordBbox(w.bbox)) return false;
  if (w.source === 'inferred') return false;
  if (w.source === 'ocr') return true;
  return w.inferred !== true;
}

/**
 * Real OCR engine geometry always wins over inferred flags.
 * @param {object} w
 */
export function coerceWordRealGeometry(w) {
  const text = String(w?.text || '').trim();
  if (!text) return null;
  const bbox = w.bbox || null;
  if (bbox && isZeroWordBbox(bbox)) {
    traceZeroBboxPipelineBug('coerceWordRealGeometry', {
      text,
      reason: 'incoming_zero_bbox',
      page_number: w.page_number ?? w.page ?? null,
    });
  }
  const hasReal = wordHasRealOcrGeometry({ ...w, bbox: isZeroWordBbox(bbox) ? null : bbox });
  return {
    text,
    bbox: isZeroWordBbox(bbox) ? null : bbox,
    confidence: Math.round(w.confidence ?? 70),
    inferred: hasReal ? false : w.inferred === true,
    source: hasReal ? 'ocr' : w.source || (w.inferred ? 'inferred' : 'ocr'),
    page_number: w.page_number ?? w.page ?? null,
  };
}

/**
 * @param {object[]} words
 */
export function lineHasRealWordBoxes(line) {
  const words = line?.words || [];
  if (!words.length) return false;
  return words.some((w) => wordHasRealOcrGeometry(w));
}

/**
 * Never label a line inferred-only when any word has real OCR geometry.
 * @param {object} line
 */
export function lineMayUseInferredOnlyWeakReason(line) {
  if (line?.real_word_boxes === true) return false;
  if (lineHasRealWordBoxes(line)) return false;
  const words = line?.words || [];
  if (!words.length) return true;
  return words.every((w) => w.inferred === true || !wordHasRealOcrGeometry(w));
}
