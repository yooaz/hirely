/**
 * Hirely — email exported CV PDF via /api/send-cv-email (Resend on Vercel).
 */
(function (global) {
  const API_PATH = '/api/send-cv-email';

  function isEmail(s) {
    return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const comma = dataUrl.indexOf(',');
        resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read PDF'));
      reader.readAsDataURL(blob);
    });
  }

  function randomExportId() {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * @param {{ to: string, pdfBlob: Blob, filename: string, candidateName?: string, exportId?: string }} opts
   */
  async function sendCvPdfByEmail(opts) {
    const to = opts?.to?.trim();
    if (!isEmail(to)) throw new Error('INVALID_EMAIL');
    if (!opts?.pdfBlob || opts.pdfBlob.size < 100) throw new Error('PDF_MISSING');

    const pdfBase64 = await blobToBase64(opts.pdfBlob);
    const res = await fetch(API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        pdfBase64,
        filename: opts.filename || 'hirely-cv.pdf',
        candidateName: opts.candidateName || '',
        exportId: opts.exportId || randomExportId(),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || 'EMAIL_SEND_FAILED');
      err.code = data?.code || 'EMAIL_SEND_FAILED';
      err.status = res.status;
      throw err;
    }
    return data;
  }

  global.HirelyEmailExport = {
    isEmail,
    sendCvPdfByEmail,
  };
})(typeof window !== 'undefined' ? window : globalThis);
