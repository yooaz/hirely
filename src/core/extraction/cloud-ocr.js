/**
 * Optional cloud OCR fallback (e.g. Google Vision, Azure, custom proxy).
 * Set `window.HIRELY_CLOUD_OCR_URL` to a POST endpoint accepting multipart `file`.
 * Response: `{ "text": "..." }` or plain text body.
 */

export function cloudOcrConfigured() {
  if (typeof globalThis === 'undefined') return false;
  return Boolean(globalThis.HIRELY_CLOUD_OCR_URL || globalThis.HIRELY_CLOUD_OCR_ENDPOINT);
}

function endpoint() {
  return String(globalThis.HIRELY_CLOUD_OCR_URL || globalThis.HIRELY_CLOUD_OCR_ENDPOINT || '').trim();
}

/**
 * @param {Blob|File} file
 * @param {{ lang?: string }} [opts]
 * @returns {Promise<string|null>} null if not configured or request failed
 */
export async function tryCloudOcr(file, opts = {}) {
  const url = endpoint();
  if (!url || typeof fetch !== 'function') return null;

  const form = new FormData();
  form.append('file', file, file.name || 'scan.png');
  if (opts.lang) form.append('lang', opts.lang);

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: form,
      headers: globalThis.HIRELY_CLOUD_OCR_KEY
        ? { Authorization: `Bearer ${globalThis.HIRELY_CLOUD_OCR_KEY}` }
        : undefined,
    });
    if (!res.ok) {
      console.warn('HIRELY cloud OCR HTTP', res.status);
      return null;
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const json = await res.json();
      const text = json.text ?? json.fullText ?? json.content ?? '';
      return String(text).trim() || null;
    }
    const text = await res.text();
    return String(text).trim() || null;
  } catch (e) {
    console.warn('HIRELY cloud OCR failed', e);
    return null;
  }
}
