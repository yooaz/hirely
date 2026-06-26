/**
 * Cover letter exporter — TXT download and clipboard.
 */

/**
 * @param {string} text
 * @param {string} [filename]
 */
export function downloadLetterTxt(text, filename = 'cover-letter.txt') {
  const body = String(text || '').trim();
  if (!body) return false;
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/**
 * @param {string} text
 */
export async function copyLetterToClipboard(text) {
  const body = String(text || '').trim();
  if (!body) return false;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(body);
    return true;
  }
  const ta = document.createElement('textarea');
  ta.value = body;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  return ok;
}

export const LETTER_PDF_A4_WIDTH_PX = 794;
const A4_WIDTH_PX = LETTER_PDF_A4_WIDTH_PX;

export function buildLetterPdfElement(text) {
  const sheet = document.createElement('div');
  sheet.className = 'coverLetterPdfSheet';
  sheet.setAttribute('aria-hidden', 'true');
  sheet.style.cssText = [
    `width:${A4_WIDTH_PX}px`,
    'min-height:1123px',
    'padding:56px 64px',
    'box-sizing:border-box',
    'font:15px/1.55 Georgia,Times New Roman,serif',
    'color:#111',
    'background:#fff',
    'white-space:pre-wrap',
  ].join(';');
  sheet.textContent = String(text || '').trim();
  return sheet;
}

/**
 * Node-safe PDF readiness check (browser export still uses html2pdf).
 * @param {string} text
 */
export function validateLetterPdfExport(text) {
  const body = String(text || '').trim();
  return {
    ok: body.length >= 80,
    charCount: body.length,
    a4WidthPx: A4_WIDTH_PX,
  };
}

/**
 * @param {string} text
 * @param {string} [filename]
 */
export async function downloadLetterPdf(text, filename = 'cover-letter.pdf') {
  const body = String(text || '').trim();
  if (!body) return false;
  const html2pdf = typeof window !== 'undefined' ? window.html2pdf : null;
  if (!html2pdf) return false;

  const sheet = buildLetterPdfElement(body);
  sheet.style.position = 'fixed';
  sheet.style.left = '-9999px';
  sheet.style.top = '0';
  document.body.appendChild(sheet);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const opt = {
      margin: [12, 12, 12, 12],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        width: A4_WIDTH_PX,
        windowWidth: A4_WIDTH_PX,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    await html2pdf().set(opt).from(sheet).save();
    return true;
  } finally {
    sheet.remove();
  }
}
