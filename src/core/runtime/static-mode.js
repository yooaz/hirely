/**
 * Detect static/local dev — skip remote OCR API calls that always fail on python http.server.
 */

export const RESUME_DATA_JSON_MAX = 50000;

/** @returns {boolean} */
export function isStaticLocalMode() {
  if (typeof globalThis === 'undefined') return true;
  const g = globalThis;
  if (g.HIRELY_FORCE_CLOUD_OCR === true) return false;
  if (g.HIRELY_STATIC_MODE === false) return false;
  if (g.HIRELY_STATIC_MODE === true) return true;

  const loc = g.location;
  if (!loc || !loc.hostname) return typeof process !== 'undefined' && !process.env?.VERCEL;

  const host = String(loc.hostname || '').toLowerCase();
  const port = String(loc.port || '');
  const proto = String(loc.protocol || '');

  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]') {
    return true;
  }
  if (proto === 'file:') return true;
  if (port === '3001' || port === '8080' || port === '5500' || port === '5173') return true;
  return false;
}

/** @returns {boolean} */
export function shouldSkipRemoteOcr() {
  if (typeof globalThis !== 'undefined' && globalThis.HIRELY_SKIP_REMOTE_OCR === true) return true;
  return isStaticLocalMode();
}
