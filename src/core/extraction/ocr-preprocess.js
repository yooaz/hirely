/**
 * OCR image preprocessing — browser Canvas only.
 * Does not modify extracted text; improves pixels before OCR.
 */

import { isExactTranscriptionExtractionActive } from './exact-transcription-truth.js';

export const OCR_TARGET_DPI = 320;
export const OCR_EXACT_TARGET_DPI = 400;
export const OCR_MAX_CANVAS_EDGE = 4096;
export const DEFAULT_THRESHOLD = 165;
const CONTRAST = 1.42;
const PREVIEW_MAX_EDGE = 720;
const OCR_CANVAS_2D = { willReadFrequently: true };

/** Canvas 2d for OCR preprocess (many getImageData readbacks). */
function ocrCanvas2d(canvas) {
  return canvas.getContext('2d', OCR_CANVAS_2D);
}

function toGrayscale(data) {
  const g = new Float32Array(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    g[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return g;
}

function canvasFromImageData(imageData) {
  const c = document.createElement('canvas');
  c.width = imageData.width;
  c.height = imageData.height;
  ocrCanvas2d(c).putImageData(imageData, 0, 0);
  return c;
}

function getImageData(canvas) {
  const ctx = ocrCanvas2d(canvas);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function drawToCanvas(source, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = ocrCanvas2d(c);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return c;
}

export function resolveOcrTargetDpi() {
  if (
    typeof globalThis !== 'undefined' &&
    (globalThis.HIRELY_EXACT_TRANSCRIPTION_ACTIVE === true ||
      globalThis.HIRELY_EXACT_TRANSCRIPTION === true)
  ) {
    return OCR_EXACT_TARGET_DPI;
  }
  return OCR_TARGET_DPI;
}

/** Scale factor to approach target DPI from pdf.js viewport at scale 1 (~72 dpi). */
export function getOcrDpiScale(viewportWidth, viewportHeight, targetDpi = resolveOcrTargetDpi()) {
  const base = targetDpi / 72;
  const w = viewportWidth * base;
  const h = viewportHeight * base;
  const edge = Math.max(w, h);
  if (edge > OCR_MAX_CANVAS_EDGE) {
    return base * (OCR_MAX_CANVAS_EDGE / edge);
  }
  return base;
}

/**
 * @param {Float32Array|Uint8ClampedArray} gray
 * @param {number} width
 * @param {number} height
 * @param {number} whiteMin 0–255
 */
export function detectContentBounds(gray, width, height, whiteMin = 248) {
  const rowDark = new Uint8Array(height);
  const colDark = new Uint8Array(width);
  for (let y = 0; y < height; y++) {
    let dark = 0;
    for (let x = 0; x < width; x++) {
      if (gray[y * width + x] < whiteMin) dark++;
    }
    rowDark[y] = dark > width * 0.008 ? 1 : 0;
  }
  for (let x = 0; x < width; x++) {
    let dark = 0;
    for (let y = 0; y < height; y++) {
      if (gray[y * width + x] < whiteMin) dark++;
    }
    colDark[x] = dark > height * 0.008 ? 1 : 0;
  }

  let top = 0;
  while (top < height && !rowDark[top]) top++;
  let bottom = height - 1;
  while (bottom > top && !rowDark[bottom]) bottom--;
  let left = 0;
  while (left < width && !colDark[left]) left++;
  let right = width - 1;
  while (right > left && !colDark[right]) right--;

  const pad = 4;
  return {
    left: Math.max(0, left - pad),
    top: Math.max(0, top - pad),
    right: Math.min(width - 1, right + pad),
    bottom: Math.min(height - 1, bottom + pad),
  };
}

export function cropCanvasToBounds(canvas, bounds) {
  const w = bounds.right - bounds.left + 1;
  const h = bounds.bottom - bounds.top + 1;
  if (w < 8 || h < 8) return canvas;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = ocrCanvas2d(c);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(
    canvas,
    bounds.left,
    bounds.top,
    w,
    h,
    0,
    0,
    w,
    h
  );
  return c;
}

/** Remove dark scan borders (black edges). */
export function cleanupPageBorders(canvas, darkMax = 55) {
  let c = canvas;
  const maxStrip = Math.min(40, Math.floor(Math.min(c.width, c.height) * 0.04));
  for (let pass = 0; pass < maxStrip; pass++) {
    const img = getImageData(c);
    const g = toGrayscale(img.data);
    const w = img.width;
    const h = img.height;
    const edgeMean = (indices) => {
      let s = 0;
      let n = 0;
      for (const [x, y] of indices) {
        s += g[y * w + x];
        n++;
      }
      return n ? s / n : 255;
    };
    const top = edgeMean(
      Array.from({ length: w }, (_, x) => [x, 0])
    );
    const bottom = edgeMean(
      Array.from({ length: w }, (_, x) => [x, h - 1])
    );
    const left = edgeMean(
      Array.from({ length: h }, (_, y) => [0, y])
    );
    const right = edgeMean(
      Array.from({ length: h }, (_, y) => [w - 1, y])
    );
    let crop = null;
    if (top < darkMax) crop = { left: 0, top: 1, right: w - 1, bottom: h - 1 };
    else if (bottom < darkMax) crop = { left: 0, top: 0, right: w - 1, bottom: h - 2 };
    else if (left < darkMax) crop = { left: 1, top: 0, right: w - 1, bottom: h - 1 };
    else if (right < darkMax) crop = { left: 0, top: 0, right: w - 2, bottom: h - 1 };
    if (!crop) break;
    c = cropCanvasToBounds(c, crop);
  }
  return c;
}

/** 3×3 median denoise on grayscale buffer. */
export function medianDenoise(gray, width, height) {
  const out = new Float32Array(gray.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const vals = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            vals.push(gray[ny * width + nx]);
          }
        }
      }
      vals.sort((a, b) => a - b);
      out[y * width + x] = vals[Math.floor(vals.length / 2)];
    }
  }
  return out;
}

export function enhanceContrast(gray, factor = CONTRAST) {
  const out = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = Math.max(0, Math.min(255, ((gray[i] / 255 - 0.5) * factor + 0.5) * 255));
  }
  return out;
}

/** Otsu global threshold. */
export function otsuThreshold(gray) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    const b = Math.max(0, Math.min(255, Math.round(gray[i])));
    hist[b]++;
  }
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let max = 0;
  let threshold = DEFAULT_THRESHOLD;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > max) {
      max = between;
      threshold = t;
    }
  }
  return threshold;
}

/** Local adaptive threshold (block mean − C). */
export function adaptiveThresholdLocal(gray, width, height, blockSize = 31, C = 8) {
  const half = Math.floor(blockSize / 2);
  const out = new Float32Array(gray.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            sum += gray[ny * width + nx];
            n++;
          }
        }
      }
      const mean = n ? sum / n : 128;
      out[y * width + x] = gray[y * width + x] < mean - C ? 0 : 255;
    }
  }
  return out;
}

export function binarizeFromGray(gray, width, height, thresholdOrMap) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    const thr =
      typeof thresholdOrMap === 'number' ? thresholdOrMap : thresholdOrMap[i];
    const v = gray[i] < thr ? 0 : 255;
    out[p] = out[p + 1] = out[p + 2] = v;
    out[p + 3] = 255;
  }
  return new ImageData(out, width, height);
}

/** @deprecated use binarizeFromGray */
export function binarizeGray(gray, width, height, threshold) {
  return binarizeFromGray(gray, width, height, threshold);
}

function horizontalScore(gray, width, height) {
  let score = 0;
  for (let y = 0; y < height; y++) {
    let transitions = 0;
    let prev = 1;
    for (let x = 0; x < width; x++) {
      const dark = gray[y * width + x] < 128 ? 1 : 0;
      if (dark !== prev) transitions++;
      prev = dark;
    }
    score += transitions;
  }
  return score;
}

function scoreCanvasForText(canvas) {
  const small = document.createElement('canvas');
  const scale = Math.min(1, 400 / Math.max(canvas.width, canvas.height));
  small.width = Math.max(1, Math.round(canvas.width * scale));
  small.height = Math.max(1, Math.round(canvas.height * scale));
  const sctx = ocrCanvas2d(small);
  sctx.drawImage(canvas, 0, 0, small.width, small.height);
  const g = toGrayscale(sctx.getImageData(0, 0, small.width, small.height).data);
  const denoised = medianDenoise(g, small.width, small.height);
  return horizontalScore(denoised, small.width, small.height);
}

/** Rotate canvas by fixed degrees (0 = same canvas reference). */
export function rotateCanvasByDegrees(sourceCanvas, deg) {
  const angle = ((Number(deg) || 0) % 360 + 360) % 360;
  if (!angle) return sourceCanvas;
  const c = document.createElement('canvas');
  if (angle === 90 || angle === 270) {
    c.width = sourceCanvas.height;
    c.height = sourceCanvas.width;
  } else {
    c.width = sourceCanvas.width;
    c.height = sourceCanvas.height;
  }
  const ctx = ocrCanvas2d(c);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
  return c;
}

/** Auto-rotate 0° / 90° / 180° / 270° to maximize text-line continuity. */
export function autoRotateCanvas(sourceCanvas) {
  const angles = [0, 90, 180, 270];
  let best = sourceCanvas;
  let bestAngle = 0;
  let bestScore = Infinity;
  for (const deg of angles) {
    const c = rotateCanvasByDegrees(sourceCanvas, deg);
    const score = scoreCanvasForText(c);
    if (score < bestScore) {
      bestScore = score;
      bestAngle = deg;
      best = c;
    }
  }
  return { canvas: best, rotationDeg: bestAngle };
}

export function estimateDeskewDegrees(canvas, range = 2.5, step = 0.5) {
  const small = document.createElement('canvas');
  const scale = Math.min(1, 400 / Math.max(canvas.width, canvas.height));
  small.width = Math.max(1, Math.round(canvas.width * scale));
  small.height = Math.max(1, Math.round(canvas.height * scale));
  const sctx = ocrCanvas2d(small);
  sctx.drawImage(canvas, 0, 0, small.width, small.height);
  const baseGray = toGrayscale(sctx.getImageData(0, 0, small.width, small.height).data);

  let bestAngle = 0;
  let bestScore = Infinity;
  for (let a = -range; a <= range; a += step) {
    const rot = document.createElement('canvas');
    rot.width = small.width;
    rot.height = small.height;
    const rctx = ocrCanvas2d(rot);
    rctx.fillStyle = '#fff';
    rctx.fillRect(0, 0, rot.width, rot.height);
    rctx.translate(rot.width / 2, rot.height / 2);
    rctx.rotate((a * Math.PI) / 180);
    rctx.drawImage(small, -small.width / 2, -small.height / 2);
    const g = toGrayscale(rctx.getImageData(0, 0, rot.width, rot.height).data);
    const denoised = medianDenoise(g, rot.width, rot.height);
    const score = horizontalScore(denoised, rot.width, rot.height);
    if (score < bestScore) {
      bestScore = score;
      bestAngle = a;
    }
  }
  return Math.abs(bestAngle) < 0.25 ? 0 : bestAngle;
}

export function deskewCanvas(sourceCanvas, angleDeg) {
  if (!angleDeg) return sourceCanvas;
  const rad = (angleDeg * Math.PI) / 180;
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const nw = Math.ceil(w * cos + h * sin);
  const nh = Math.ceil(w * sin + h * cos);
  const c = document.createElement('canvas');
  c.width = nw;
  c.height = nh;
  const ctx = ocrCanvas2d(c);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, nw, nh);
  ctx.translate(nw / 2, nh / 2);
  ctx.rotate(rad);
  ctx.drawImage(sourceCanvas, -w / 2, -h / 2);
  return c;
}

/**
 * Detect 1 vs 2 column layout from dark-pixel x histogram.
 * @returns {{ columnCount: number, suggestedPsm: string, gapX: number|null }}
 */
export function detectMultiColumn(gray, width, height) {
  const bins = 48;
  const hist = new Float32Array(bins);
  for (let y = Math.floor(height * 0.12); y < Math.floor(height * 0.88); y++) {
    for (let x = 0; x < width; x++) {
      if (gray[y * width + x] < 140) {
        const b = Math.min(bins - 1, Math.floor((x / width) * bins));
        hist[b]++;
      }
    }
  }
  const max = Math.max(...hist, 1);
  const threshold = max * 0.12;
  let inGap = false;
  let gapStart = 0;
  let bestGap = null;
  let bestGapScore = 0;
  const centerLo = Math.floor(bins * 0.35);
  const centerHi = Math.floor(bins * 0.65);
  for (let b = centerLo; b < centerHi; b++) {
    if (hist[b] < threshold) {
      if (!inGap) {
        inGap = true;
        gapStart = b;
      }
    } else if (inGap) {
      const gapLen = b - gapStart;
      const score = gapLen * (1 - hist[gapStart] / max);
      if (score > bestGapScore && gapLen >= 2) {
        bestGapScore = score;
        bestGap = Math.round(((gapStart + b) / 2 / bins) * width);
      }
      inGap = false;
    }
  }
  const left = hist.slice(0, Math.floor(bins * 0.42)).reduce((a, v) => a + v, 0);
  const right = hist.slice(Math.floor(bins * 0.58)).reduce((a, v) => a + v, 0);
  const columnCount = bestGap && left > max * 2 && right > max * 2 ? 2 : 1;
  return {
    columnCount,
    gapX: bestGap,
    suggestedPsm: columnCount >= 2 ? '1' : '6',
  };
}

function upscaleCanvas(source, factor) {
  if (factor <= 1.01) return source;
  const w = Math.round(source.width * factor);
  const h = Math.round(source.height * factor);
  return drawToCanvas(source, w, h);
}

function previewDataUrl(canvas) {
  const max = PREVIEW_MAX_EDGE;
  const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
  if (scale >= 0.99) {
    return canvas.toDataURL('image/png', 0.85);
  }
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const p = document.createElement('canvas');
  p.width = w;
  p.height = h;
  ocrCanvas2d(p).drawImage(canvas, 0, 0, w, h);
  return p.toDataURL('image/png', 0.85);
}

/**
 * Full OCR preprocessing pipeline.
 * @param {HTMLCanvasElement} sourceCanvas
 * @param {{ targetDpi?: number, viewportWidth?: number, viewportHeight?: number, debug?: boolean, page?: number }} [opts]
 * @returns {{ canvas: HTMLCanvasElement, imageData: ImageData, meta: object, previews?: { before: string, after: string } }}
 */
const VARIANT_CONFIG = {
  standard: { contrast: CONTRAST, extraScale: 1, adaptiveC: 8, softBinarize: false, forcePsm: null },
  high_contrast: { contrast: 2.05, extraScale: 1, adaptiveC: 12, softBinarize: false, forcePsm: null },
  large_font: { contrast: 1.35, extraScale: 1.38, adaptiveC: 7, softBinarize: false, forcePsm: '6' },
  layout: { contrast: 1.25, extraScale: 1.05, adaptiveC: 6, softBinarize: true, forcePsm: '1' },
  exact_fidelity: {
    contrast: 1.22,
    extraScale: 1.12,
    adaptiveC: 5,
    softBinarize: true,
    forcePsm: '3',
  },
};

export function preprocessCanvasForOcr(sourceCanvas, opts = {}) {
  const variantKey = opts.variant || 'standard';
  const vcfg = VARIANT_CONFIG[variantKey] || VARIANT_CONFIG.standard;
  const steps = [`variant_${variantKey}`];
  const beforePreview = opts.debug ? previewDataUrl(sourceCanvas) : null;
  let c = sourceCanvas;
  const exactGeomPreserve = isExactTranscriptionExtractionActive();
  const inputWidth = c.width;
  const inputHeight = c.height;
  let cropLeft = 0;
  let cropTop = 0;
  let croppedWidth = inputWidth;
  let croppedHeight = inputHeight;

  const img0 = getImageData(c);
  let gray = toGrayscale(img0.data);
  const bounds = detectContentBounds(gray, img0.width, img0.height);
  if (
    !exactGeomPreserve &&
    bounds.right - bounds.left < img0.width - 6 &&
    bounds.bottom - bounds.top < img0.height - 6
  ) {
    c = cropCanvasToBounds(c, bounds);
    cropLeft = bounds.left;
    cropTop = bounds.top;
    croppedWidth = c.width;
    croppedHeight = c.height;
    steps.push('white_margin_crop');
  } else if (exactGeomPreserve) {
    steps.push('exact_geometry_preserve_crop');
  }

  const bordered = exactGeomPreserve ? c : cleanupPageBorders(c);
  if (bordered !== c) {
    c = bordered;
    steps.push('border_cleanup');
  }

  let appliedRotationDeg = opts.rotationDeg || 0;
  if (opts.skipAutoRotate) {
    if (opts.rotationDeg) steps.push(`fixed_rotate_${opts.rotationDeg}`);
  } else {
    const rotated = autoRotateCanvas(c);
    c = rotated.canvas;
    appliedRotationDeg = rotated.rotationDeg;
    if (rotated.rotationDeg) steps.push(`auto_rotate_${rotated.rotationDeg}`);
  }

  const angle = exactGeomPreserve ? 0 : estimateDeskewDegrees(c);
  if (angle) {
    c = deskewCanvas(c, angle);
    steps.push(`deskew_${angle.toFixed(1)}`);
  } else if (exactGeomPreserve) {
    steps.push('exact_geometry_preserve_deskew');
  }

  let dpiFactor = 1;
  if (opts.viewportWidth && opts.viewportHeight) {
    const targetScale = getOcrDpiScale(opts.viewportWidth, opts.viewportHeight, opts.targetDpi);
    const currentScale = c.width / opts.viewportWidth;
    dpiFactor = targetScale / Math.max(currentScale, 0.01);
    if (dpiFactor > 1.05) {
      c = upscaleCanvas(c, dpiFactor);
      steps.push(`dpi_upscale_${Math.round(opts.targetDpi || OCR_TARGET_DPI)}`);
    }
  } else if (c.width < 1200) {
    const factor = Math.min(2.5, 1200 / Math.max(c.width, 1));
    if (factor > 1.1) {
      c = upscaleCanvas(c, factor);
      steps.push('upscale');
    }
  }

  if (vcfg.extraScale > 1.05) {
    c = upscaleCanvas(c, vcfg.extraScale);
    steps.push('variant_scale');
  }

  const img = getImageData(c);
  gray = enhanceContrast(toGrayscale(img.data), vcfg.contrast);
  const denoised = medianDenoise(gray, img.width, img.height);
  const globalT = otsuThreshold(denoised);
  const localBin = adaptiveThresholdLocal(denoised, img.width, img.height, 31, vcfg.adaptiveC);
  const merged = new Float32Array(denoised.length);
  for (let i = 0; i < denoised.length; i++) {
    if (vcfg.softBinarize) {
      merged[i] = denoised[i] < globalT ? 0 : 255;
    } else {
      merged[i] = localBin[i] === 0 || denoised[i] < globalT ? 0 : 255;
    }
  }
  steps.push('contrast');
  steps.push('denoise');
  steps.push('adaptive_threshold');

  const columnInfo = detectMultiColumn(denoised, img.width, img.height);
  if (columnInfo.columnCount >= 2) steps.push('multi_column_2');

  const imageData = binarizeFromGray(merged, img.width, img.height, 128);
  const outCanvas = canvasFromImageData(imageData);

  const meta = {
    steps,
    rotationDeg: appliedRotationDeg,
    deskewDeg: angle || 0,
    marginBounds: bounds,
    cropLeft,
    cropTop,
    croppedWidth,
    croppedHeight,
    inputWidth,
    inputHeight,
    ocrCanvasWidth: outCanvas.width,
    ocrCanvasHeight: outCanvas.height,
    columnCount: columnInfo.columnCount,
    columnGapX: columnInfo.gapX,
    variant: variantKey,
    suggestedPsm: vcfg.forcePsm || columnInfo.suggestedPsm,
    otsuThreshold: globalT,
    targetDpi: opts.targetDpi || OCR_TARGET_DPI,
    viewportWidth: opts.viewportWidth || 0,
    viewportHeight: opts.viewportHeight || 0,
    renderWidth: opts.renderWidth || inputWidth,
    renderHeight: opts.renderHeight || inputHeight,
    width: outCanvas.width,
    height: outCanvas.height,
    exactGeometryPreserve: exactGeomPreserve,
  };

  const result = { canvas: outCanvas, imageData, meta };
  if (opts.debug && beforePreview) {
    result.previews = { before: beforePreview, after: previewDataUrl(outCanvas) };
  }
  return result;
}

/** Legacy API — returns ImageData for callers that expect it. */
export function preprocessCanvas(sourceCanvas, upscale = 2) {
  const factor = upscale > 1 ? upscale : 1;
  const prep = preprocessCanvasForOcr(sourceCanvas, {
    viewportWidth: sourceCanvas.width / factor,
    viewportHeight: sourceCanvas.height / factor,
    targetDpi: OCR_TARGET_DPI,
  });
  return prep.imageData;
}
