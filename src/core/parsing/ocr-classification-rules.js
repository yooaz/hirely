/**
 * Generic OCR classification rules — no candidate-specific strings.
 * Used by identity, experience recovery, and display sanitization.
 */

/** URL, domain, or social-platform fragments (OCR-merged lines). */
export const URL_OR_DOMAIN_SIGNAL_RE =
  /(?:https?:\/\/|www\.|\.com[a-z]{0,8}\b|\.net\b|\.org\b|\.io\b|\.be\b|\.fr\b|tumblr|behance|dribbble|linkedin|instagram|facebook|blogspot|portfolio)/i;

/** OCR prefix noise on merged URL + career lines. */
export const URL_MERGED_LINE_PREFIX_RE = /^\s*\+\+|^\s*[@»¢]\s*/i;

/** Social / portfolio tokens that must not appear in person names. */
export const SOCIAL_WEB_IN_NAME_RE =
  /\b(tumblr|behance|dribbble|linkedin|instagram|facebook|portfolio|blogspot|wordpress|pinterest)\b/i;

/**
 * Header/category words OCR mistakes for given names (e.g. "Address Illustrations").
 * Generic tokens only — no fixture-specific literals.
 */
export const OCR_HEADER_CATEGORY_IN_NAME_RE =
  /\b(adress|address|mustration|mustrations|illustrations?|expertise|specialized|specialised|portfolio|category|categories)\b/i;

/** Combined name rejection (social + category + domain). */
export const NON_PERSON_NAME_SIGNAL_RE = new RegExp(
  `${SOCIAL_WEB_IN_NAME_RE.source}|${OCR_HEADER_CATEGORY_IN_NAME_RE.source}|${URL_OR_DOMAIN_SIGNAL_RE.source}`,
  'i'
);

/** Career role / employment signals for experience-line recovery. */
export const CAREER_ROLE_COMPANY_SIGNAL_RE =
  /\b(freelanc|independent|self[- ]?employed|designer|illustrator|director|agency|studio|consultant|manager|engineer|developer|analyst|intern(?:ship)?)\b/i;

const YEAR_IN_TEXT_RE = /\b(19|20)\d{2}\b/;
export const PERSON_NAME_CAPS_SEGMENT_RE =
  /\b([A-ZÀ-Ö][a-zà-ö'-]{2,})\s+([A-ZÀ-Ö]{2,})\b/;

export const PERSON_NAME_SEGMENT_RE = /^([A-ZÀ-Ö][a-zà-ö'-]+)\s+([A-ZÀ-Ö]{2,})$/;

const GENERIC_EMAIL_LOCAL_STOP = new Set(
  [
    'contact',
    'info',
    'hello',
    'admin',
    'mail',
    'email',
    'cv',
    'resume',
    'career',
    'jobs',
    'work',
  ].map((x) => x.toLowerCase())
);

/**
 * @param {string} line
 */
export function hasPersonCompanySeparators(line) {
  const parts = String(line || '')
    .split(/\s*[-–—]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length >= 2;
}

/**
 * @param {string} line
 */
export function hasUrlOrDomainSignal(line) {
  const s = String(line || '').trim();
  return URL_OR_DOMAIN_SIGNAL_RE.test(s) || URL_MERGED_LINE_PREFIX_RE.test(s);
}

/**
 * @param {string} line
 */
export function hasCareerRoleCompanySignal(line) {
  return CAREER_ROLE_COMPANY_SIGNAL_RE.test(String(line || ''));
}

/**
 * URL-merged OCR experience line — generic gate (no fixture literals).
 * @param {string} line
 */
export function qualifiesUrlMergedExperienceLine(line) {
  const raw = String(line || '').trim();
  if (!raw || raw.length < 18) return false;
  if (!YEAR_IN_TEXT_RE.test(raw)) return false;
  if (!hasPersonCompanySeparators(raw)) return false;

  const urlSignal = hasUrlOrDomainSignal(raw);
  const careerSignal = hasCareerRoleCompanySignal(raw);
  const nameSegment = /\b[A-ZÀ-Ö][a-zà-ö'-]{2,}\s+[A-ZÀ-Ö]{2,}\b/.test(raw);

  if (urlSignal && (nameSegment || careerSignal)) return true;
  if (careerSignal && nameSegment) return true;
  return false;
}

/**
 * Email local-part token usable as a search hint (not a fabricated name).
 * @param {string} email
 */
export function emailLocalPartNameHint(email) {
  const local = String(email || '').split('@')[0]?.toLowerCase() || '';
  if (!local || local.length < 3 || local.length > 24) return '';
  if (!/^[a-z][a-z0-9._-]*$/.test(local)) return '';

  const tokens = local.split(/[._-]+/).filter((t) => t.length >= 3 && /^[a-z]+$/.test(t));
  for (const token of tokens) {
    if (!GENERIC_EMAIL_LOCAL_STOP.has(token)) return token;
  }
  return '';
}

/**
 * Mangled domain / social handle noise in tools, suggestions, education OCR.
 */
export const MANGLED_DOMAIN_NOISE_RE =
  /\b[a-z]{1,6}\.(?:net|com|be|fr|org)\b|tumblr|behance|dribbble/i;

/**
 * Symbol + handle OCR garbage (e.g. cent sign + domain fragment).
 */
export const SYMBOL_HANDLE_OCR_RE = /¢\s*[a-z]{2,}(?:\.[a-z]{2,})?/i;

/**
 * Label-paren OCR garbage before handles (e.g. "Ic) handle:").
 */
export const LABEL_PAREN_HANDLE_RE = /\b[a-z]{1,3}\)\s*[a-z0-9]{2,}\s*:/gi;
