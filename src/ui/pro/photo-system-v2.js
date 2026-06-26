/**
 * PHOTO_SYSTEM_V2 — browser facade (safe zones, auto crop).
 */
(function (global) {
  const ENGINE = 'PHOTO_SYSTEM_V2';

  const SAFE = Object.freeze({
    maxSizePx: 88,
    pdfMaxSizePx: 88,
    textGapPx: 12,
    exportSizePx: 512,
    portraitFocusY: 38,
    landscapeFocusY: 45,
    squareFocusY: 42,
  });

  const CROP_DEFAULT = Object.freeze({ zoom: 1, x: 50, y: 50 });

  function inferPortraitFocusPoint(w, h) {
    const width = Math.max(1, Number(w) || 1);
    const height = Math.max(1, Number(h) || 1);
    const ratio = height / width;
    if (ratio > 1.15) return { x: 50, y: SAFE.portraitFocusY };
    if (ratio < 0.85) return { x: 50, y: SAFE.landscapeFocusY };
    return { x: 50, y: SAFE.squareFocusY };
  }

  function computeSquareCropRect(imgW, imgH, focus, zoom) {
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

  function autoCropPhotoDataUrl(dataUrl, opts) {
    opts = opts || {};
    if (!dataUrl) return Promise.resolve(null);
    const size = opts.size || SAFE.exportSizePx;
    const quality = opts.quality != null ? opts.quality : 0.92;
    const doc = global.document;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const focus = opts.focus || inferPortraitFocusPoint(img.width, img.height);
        const rect = computeSquareCropRect(img.width, img.height, focus, opts.zoom || 1);
        const canvas = doc.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: dataUrl, focus: focus });
          return;
        }
        ctx.drawImage(img, rect.sx, rect.sy, rect.size, rect.size, 0, 0, size, size);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), focus: focus });
      };
      img.onerror = () => resolve({ dataUrl: dataUrl, focus: CROP_DEFAULT });
      img.src = dataUrl;
    });
  }

  function sanitizePhotoCrop(crop) {
    crop = crop || {};
    return {
      zoom: 1,
      x: Math.max(0, Math.min(100, Number(crop.x != null ? crop.x : 50))),
      y: Math.max(0, Math.min(100, Number(crop.y != null ? crop.y : 50))),
    };
  }

  function buildPhotoImgHtml(photoDataUrl, crop) {
    if (!photoDataUrl) return '';
    const c = sanitizePhotoCrop(crop || CROP_DEFAULT);
    const style = 'object-fit:cover;object-position:' + c.x + '% ' + c.y + '%';
    return (
      '<div class="cvPhotoWrap cvPhotoWrap--safe" data-photo-v2="1">' +
      '<img class="cvPhoto" src="' +
      photoDataUrl +
      '" alt="" style="' +
      style +
      '" decoding="async"></div>'
    );
  }

  function getPhotoHtmlFromState(state, templateId, isActiveFn) {
    if (!state || !state.photo) return '';
    const active = typeof isActiveFn === 'function' ? isActiveFn(state, templateId) : !!state.includePhoto;
    if (!active) return '';
    return buildPhotoImgHtml(state.photo, state.photoCrop || CROP_DEFAULT);
  }

  global.HirelyPhotoSystemV2 = {
    ENGINE,
    PHOTO_SAFE_ZONE: SAFE,
    PHOTO_CROP_DEFAULT: CROP_DEFAULT,
    inferPortraitFocusPoint,
    computeSquareCropRect,
    autoCropPhotoDataUrl,
    sanitizePhotoCrop,
    buildPhotoImgHtml,
    getPhotoHtmlFromState,
  };
})(typeof window !== 'undefined' ? window : globalThis);
