/**
 * Block 11 — Client-side security helpers (upload validation, calm errors, localhost checks).
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_CV_EXTENSIONS = new Set(['pdf', 'docx', 'txt', 'jpg', 'jpeg', 'png']);

/** Extensions rejected even if MIME is misleading. */
export const BLOCKED_CV_EXTENSIONS = new Set([
  'html', 'htm', 'xhtml', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx',
  'exe', 'bat', 'cmd', 'sh', 'php', 'asp', 'aspx', 'jar', 'msi',
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'dmg', 'pkg', 'svg', 'webp', 'gif', 'bmp'
]);

export function isLocalHost() {
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

function fileExtension(name = '') {
  const base = String(name || '').toLowerCase().trim();
  const i = base.lastIndexOf('.');
  return i >= 0 ? base.slice(i + 1) : '';
}

/**
 * Validate CV upload before reading file contents.
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateCvUpload(file) {
  if (!file || !file.size) {
    return { ok: false, message: 'No file selected.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      message: 'This file is too large. Please use a CV under 5 MB.'
    };
  }

  const ext = fileExtension(file.name);
  if (BLOCKED_CV_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      message: `“.${ext}” files are not allowed. Use PDF, DOCX, TXT, JPG, or PNG.`
    };
  }
  if (!ALLOWED_CV_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      message: 'Unsupported format. Upload PDF, DOCX, TXT, JPG, or PNG only.'
    };
  }

  return { ok: true };
}

/** Validate optional profile photo (images only). */
export function validatePhotoUpload(file) {
  if (!file || !file.size) return { ok: false, message: 'No image selected.' };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: 'This image is too large. Please use a photo under 5 MB.' };
  }
  const ext = fileExtension(file.name);
  if (!['jpg', 'jpeg', 'png'].includes(ext)) {
    return { ok: false, message: 'Profile photo must be JPG or PNG.' };
  }
  return { ok: true };
}

const TECHNICAL_RE =
  /GEMINI|API_KEY|sk_live|sk_test|whsec_|AIza|VERCEL_OIDC|stripe\.com\/.*secret|at\s+\w+\s*\(|TypeError:|SyntaxError:|fetch failed|ECONNREFUSED|Unexpected token|html2canvas|mammoth|pdfjsLib/i;

/**
 * Map errors to calm, non-technical copy for end users.
 */
export function userFriendlyError(err, context = 'general') {
  const name = err?.name || '';
  const raw = String(err?.message || err || '').trim();

  if (name === 'AbortError' || /aborted|timeout/i.test(raw)) {
    return 'This took too long. Please try again or paste your CV text.';
  }
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(raw)) {
    return 'Connection issue. Check your network or paste your CV text.';
  }
  if (raw && raw.length <= 140 && !TECHNICAL_RE.test(raw) && !/^\s*at\s/m.test(raw)) {
    return raw;
  }
  if (context === 'import') {
    return 'We could not read this file. Try PDF, DOCX, TXT, or paste your CV text.';
  }
  if (context === 'generate') {
    return 'Generation did not complete. Your text is safe — try again in a moment.';
  }
  if (context === 'pdf') {
    return 'PDF export did not complete. Try again or download TXT.';
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Strip technical details from API warning strings shown in UI.
 */
export function sanitizeApiWarnings(warnings = []) {
  return (warnings || []).map(w => {
    const s = String(w || '');
    if (TECHNICAL_RE.test(s) || /Gemini|HTTP \d|Server error|API error/i.test(s)) {
      return 'Professional draft generated. Advanced AI enhancement can improve depth.';
    }
    return s.length > 180 ? `${s.slice(0, 177)}…` : s;
  });
}

export default {
  MAX_UPLOAD_BYTES,
  ALLOWED_CV_EXTENSIONS,
  BLOCKED_CV_EXTENSIONS,
  isLocalHost,
  validateCvUpload,
  validatePhotoUpload,
  userFriendlyError,
  sanitizeApiWarnings
};
