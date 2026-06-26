/**
 * Local Tesseract paths — no CDN (CSP worker-src 'self').
 */

export const TESSERACT_VENDOR_ROOT = '/vendor/tesseract';

export const TESSERACT_VENDOR_PATHS = Object.freeze({
  main: `${TESSERACT_VENDOR_ROOT}/tesseract.min.js`,
  worker: `${TESSERACT_VENDOR_ROOT}/worker.min.js`,
  core: `${TESSERACT_VENDOR_ROOT}/core`,
  lang: `${TESSERACT_VENDOR_ROOT}/lang`,
});

/** Files required for fra+eng LSTM OCR in browser. */
export const TESSERACT_REQUIRED_ASSETS = Object.freeze([
  TESSERACT_VENDOR_PATHS.main,
  TESSERACT_VENDOR_PATHS.worker,
  `${TESSERACT_VENDOR_PATHS.core}/tesseract-core-simd-lstm.wasm.js`,
  `${TESSERACT_VENDOR_PATHS.core}/tesseract-core-simd-lstm.wasm`,
  `${TESSERACT_VENDOR_PATHS.core}/tesseract-core-lstm.wasm.js`,
  `${TESSERACT_VENDOR_PATHS.core}/tesseract-core-lstm.wasm`,
  `${TESSERACT_VENDOR_PATHS.lang}/eng.traineddata.gz`,
  `${TESSERACT_VENDOR_PATHS.lang}/fra.traineddata.gz`,
]);

export class OcrUnavailableError extends Error {
  constructor(message = 'OCR assets unavailable', code = 'OCR_UNAVAILABLE') {
    super(message);
    this.name = 'OcrUnavailableError';
    this.code = code;
  }
}

/**
 * Runtime options passed to every Tesseract.recognize / createWorker call.
 */
export function getLocalTesseractOptions(extra = {}) {
  return {
    workerPath: TESSERACT_VENDOR_PATHS.worker,
    corePath: TESSERACT_VENDOR_PATHS.core,
    langPath: TESSERACT_VENDOR_PATHS.lang,
    workerBlobURL: false,
    gzip: true,
    ...extra,
  };
}

/**
 * Verify vendored OCR assets exist (browser HEAD).
 */
export async function verifyTesseractVendorAssets(paths = TESSERACT_REQUIRED_ASSETS) {
  const report = await verifyTesseractVendorAssetsDetailed(paths);
  return report.ok;
}

/**
 * Per-asset HEAD check — used by setup:ocr and browser diagnostics.
 * @returns {Promise<{ ok: boolean, missing: string[], loaded: Record<string, boolean> }>}
 */
export async function verifyTesseractVendorAssetsDetailed(
  paths = TESSERACT_REQUIRED_ASSETS
) {
  const loaded = {};
  const missing = [];
  if (typeof fetch !== 'function') {
    return { ok: false, missing: [...paths], loaded };
  }
  for (const assetPath of paths) {
    try {
      const res = await fetch(assetPath, { method: 'HEAD', cache: 'no-store' });
      const ok = res.ok;
      loaded[assetPath] = ok;
      if (!ok) missing.push(assetPath);
    } catch {
      loaded[assetPath] = false;
      missing.push(assetPath);
    }
  }
  return { ok: missing.length === 0, missing, loaded };
}
