/**
 * PHOTO_SYSTEM_V2 — safe zones, auto crop, face-centered positioning.
 * Browser + Node (import as .mjs with createRequire or duplicate in QA via vm).
 */

export const PHOTO_SYSTEM_V2 = 'PHOTO_SYSTEM_V2';

export const PHOTO_SAFE_ZONE = Object.freeze({
  /** Max rendered diameter in CV header (px). */
  maxSizePx: 88,
  /** PDF export cap (px). */
  pdfMaxSizePx: 88,
  /** Padding between photo edge and text (px). */
  textGapPx: 12,
  /** Square export resolution after auto-crop. */
  exportSizePx: 512,
  /** Portrait images: vertical focus for face region (%). */
  portraitFocusY: 38,
  landscapeFocusY: 45,
  squareFocusY: 42,
});

export const PHOTO_CROP_DEFAULT = Object.freeze({ zoom: 1, x: 50, y: 50 });

/**
 * Heuristic face-center focus (no ML dependency).
 * @param {number} w
 * @param {number} h
 */
export function inferPortraitFocusPoint(w, h) {
  const width = Math.max(1, Number(w) || 1);
  const height = Math.max(1, Number(h) || 1);
  const ratio = height / width;
  if (ratio > 1.15) return { x: 50, y: PHOTO_SAFE_ZONE.portraitFocusY };
  if (ratio < 0.85) return { x: 50, y: PHOTO_SAFE_ZONE.landscapeFocusY };
  return { x: 50, y: PHOTO_SAFE_ZONE.squareFocusY };
}

/**
 * Compute square crop window from focus point.
 */
export function computeSquareCropRect(imgW, imgH, focus = { x: 50, y: 50 }, zoom = 1) {
  const w = Math.max(1, imgW);
  const h = Math.max(1, imgH);
  const z = Math.max(1, Math.min(3, Number(zoom) || 1));
  const min = Math.min(w, h);
  const base = min / z;
  const fx = (Number(focus.x) / 100) * w;
  const fy = (Number(focus.y) / 100) * h;
  let sx = fx - base / 2;
  let sy = fy - base / 2;
  sx = Math.max(0, Math.min(w - base, sx));
  sy = Math.max(0, Math.min(h - base, sy));
  return { sx, sy, size: base };
}

/**
 * @param {string} dataUrl
 * @param {{ focus?: {x:number,y:number}, zoom?: number, size?: number, quality?: number }} [opts]
 * @returns {Promise<{ dataUrl: string, focus: {x:number,y:number} }|null>}
 */
export function autoCropPhotoDataUrl(dataUrl, opts = {}) {
  if (!dataUrl || typeof dataUrl !== 'string') return Promise.resolve(null);

  const size = opts.size || PHOTO_SAFE_ZONE.exportSizePx;
  const quality = opts.quality ?? 0.92;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const focus = opts.focus || inferPortraitFocusPoint(img.width, img.height);
      const { sx, sy, size: cropSize } = computeSquareCropRect(
        img.width,
        img.height,
        focus,
        opts.zoom ?? 1
      );
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl, focus });
        return;
      }
      ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, size, size);
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), focus });
    };
    img.onerror = () => resolve({ dataUrl, focus: PHOTO_CROP_DEFAULT });
    img.src = dataUrl;
  });
}

/**
 * Safe HTML — no transform:scale (prevents text overlap). Crop baked into image.
 * @param {string} photoDataUrl
 * @param {{ x?: number, y?: number }} [crop]
 */
export function buildPhotoImgHtml(photoDataUrl, crop = PHOTO_CROP_DEFAULT) {
  if (!photoDataUrl) return '';
  const x = Number(crop.x ?? 50);
  const y = Number(crop.y ?? 50);
  const style = `object-fit:cover;object-position:${x}% ${y}%`;
  return `<div class="cvPhotoWrap cvPhotoWrap--safe" data-photo-v2="1"><img class="cvPhoto" src="${photoDataUrl}" alt="" style="${style}" decoding="async"></div>`;
}

/**
 * Strip dangerous inline scale from legacy photos.
 */
export function sanitizePhotoCrop(crop = {}) {
  return {
    zoom: 1,
    x: Math.max(0, Math.min(100, Number(crop.x ?? 50))),
    y: Math.max(0, Math.min(100, Number(crop.y ?? 50))),
  };
}

/**
 * @param {object} state
 * @param {string} templateId
 * @param {(state: object, templateId: string) => boolean} isActiveFn
 */
export function getPhotoHtmlFromState(state, templateId, isActiveFn) {
  if (!state?.photo) return '';
  const active = typeof isActiveFn === 'function' ? isActiveFn(state, templateId) : !!state.includePhoto;
  if (!active) return '';
  const crop = sanitizePhotoCrop(state.photoCrop || PHOTO_CROP_DEFAULT);
  return buildPhotoImgHtml(state.photo, crop);
}
