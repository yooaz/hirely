/**
 * Contact phone normalization — strict patterns; OCR char repair inside phone spans only.
 */

const EMAIL_IN_PHONE_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const URL_IN_CONTACT_RE = /https?:\/\/\S+/gi;
const SOCIAL_LABEL_RE =
  /\b(instagram|linkedin|portfolio|behance|dribbble|twitter|facebook|github|www\.)\b/gi;

export const PHONE_DISPLAY_CONFIDENCE_MIN = 95;

/**
 * Strip URLs, social labels, and contact-line separators from a raw contact fragment.
 * @param {string} raw
 */
export function stripContactLineNoise(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  s = s.replace(URL_IN_CONTACT_RE, ' ');
  s = s.replace(SOCIAL_LABEL_RE, ' ');
  s = s.replace(/\s*[·|•/]\s*/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return stripPhoneYearPollution(s);
}

/** Standalone year range — not a phone. */
const STANDALONE_YEAR_RANGE_RE = /^(?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2}|present|présent|current|now)$/i;

/** French postal code glued to contact (e.g. 75011). */
const POSTAL_CODE_RE = /\b\d{5}\b/;

/** OCR junk glued to phone (e.g. "38 impressions", "2011 2014"). */
const PHONE_CONTEXT_JUNK_RE =
  /\b(?:\d{1,2}\s+impressions?|(?:19|20)\d{2}\s+(?:19|20)\d{2})\b/i;

const DATE_RANGE_IN_PHONE_RE =
  /\b(19|20)\d{2}\s*[-–—:]\s*((?:19|20)\d{2}|present|présent|current|now)\b/i;

/** Trailing year range glued to phone (e.g. "+33649434839 2011-2020"). */
const TRAILING_YEAR_RANGE_RE =
  /\s+(?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2}|present|présent|current|now)\s*$/i;

/** Page footer glued to contact (e.g. "+33 6 12 34 56 78 Page 2 of 3"). */
const PAGE_NUMBER_IN_PHONE_RE = /\bpage\s+\d{1,3}\s*(?:of|\/)\s*\d{1,3}\b/i;

/** Trailing page fraction (e.g. "0612345678 2/3"). */
const TRAILING_PAGE_FRACTION_RE = /\s+\d{1,3}\s*\/\s*\d{1,3}\s*$/;

/** Strict phone patterns — no partial digit consumption (negative lookahead blocks extra digits). */
const STRICT_PHONE_PATTERNS = [
  /\+33[\s.-]?(?:6|7)(?:[\s.-]?\d){8}(?!\d)/,
  /\+33[\s.-]?[1-5](?:[\s.-]?\d){8}(?!\d)/,
  /\+33\d{9}(?!\d)/,
  /0[1-9](?:[\s.-]?\d{2}){4}(?!\d)/,
  /\+44[\s.-]?7(?:[\s.-]?\d){9}(?!\d)/,
  /\+44[\s.-]?\d{2}[\s.-]?\d{4}[\s.-]?\d{4}(?!\d)/,
  /\+44(?:[\s.-]?\d){10}(?!\d)/,
  /\+234(?:[\s.-]?\d){10}(?!\d)/,
  /\+1[\s.-]?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/,
  /\+(?:41|32|31|49|34|39|352|353)(?:[\s.-]?\d){8,12}(?!\d)/,
  /\+(?:1|41|44|32|31|49|34|39|234|352|353)\d{8,12}(?!\d)/,
];

const OCR_PHONE_CHAR_MAP = {
  O: '0',
  o: '0',
  l: '1',
  I: '1',
  S: '5',
  s: '5',
};

/**
 * Repair OCR-confused characters only inside phone-like spans (never global prose).
 * O→0, l/I→1, S→5 within +country or 0x national prefixes.
 * @param {string} raw
 */
export function repairOcrPhoneChars(raw) {
  const src = String(raw || '');
  if (!src) return '';

  let out = '';
  let i = 0;
  while (i < src.length) {
    const intl = src.slice(i).match(/^(\+\d{1,3}[\s.-]?)([0-9OlIS\s.\-/()]+)/);
    if (intl) {
      const body = intl[2].replace(/[OolIS]/g, (ch) => OCR_PHONE_CHAR_MAP[ch] || ch);
      out += intl[1] + body;
      i += intl[0].length;
      continue;
    }
    const nat = src.slice(i).match(/^(0[1-9])([0-9OlIS\s.\-/()]{8,18})/);
    if (nat && (i === 0 || /[\s·|•/(@]/.test(src[i - 1]))) {
      const body = nat[2].replace(/[OolIS]/g, (ch) => OCR_PHONE_CHAR_MAP[ch] || ch);
      out += nat[1] + body;
      i += nat[0].length;
      continue;
    }
    out += src[i];
    i += 1;
  }
  return out;
}

const SUSPICIOUS_DIGIT_REPEAT_RE = /(\d)\1{4,}/;

/** City/region label after phone on a contact line — not pollution. */
const TRAILING_LOCATION_LABEL_RE = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.,'-]{0,48}$/;

function phoneHasTrailingJunkAfterMatch(s) {
  const cleaned = stripContactLineNoise(String(s || '').trim());
  if (!cleaned) return false;
  for (const re of STRICT_PHONE_PATTERNS) {
    const m = cleaned.match(re);
    if (!m) continue;
    const after = cleaned.slice(m.index + m[0].length).trim();
    if (!after) return false;
    if (PAGE_NUMBER_IN_PHONE_RE.test(after)) return true;
    if (TRAILING_PAGE_FRACTION_RE.test(after)) return true;
    if (DATE_RANGE_IN_PHONE_RE.test(after)) return true;
    if (TRAILING_YEAR_RANGE_RE.test(after)) return true;
    if (/\b(?:19|20)\d{2}\b/.test(after)) return true;
    if (TRAILING_LOCATION_LABEL_RE.test(after)) return false;
    return true;
  }
  return false;
}

/**
 * @param {string} raw
 */
export function phoneHasYearOrDatePollution(raw) {
  let s = String(raw || '').trim();
  if (!s) return false;
  if (STANDALONE_YEAR_RANGE_RE.test(s)) return true;
  if (PHONE_CONTEXT_JUNK_RE.test(s)) return true;
  if (/\s+(?:19|20)\s*$/.test(s)) return true;
  if (EMAIL_IN_PHONE_RE.test(s)) s = s.replace(EMAIL_IN_PHONE_RE, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return false;
  if (DATE_RANGE_IN_PHONE_RE.test(s)) return true;
  if (TRAILING_YEAR_RANGE_RE.test(s)) return true;
  if (PAGE_NUMBER_IN_PHONE_RE.test(s)) return true;
  if (TRAILING_PAGE_FRACTION_RE.test(s)) return true;
  if (/\s+(?:19|20)\d{2}\b/.test(s)) return true;
  if (phoneHasTrailingJunkAfterMatch(s)) return true;
  const digits = s.replace(/\D/g, '');
  if (digits.length > 11 && /(?:19|20)\d{2}$/.test(digits)) return true;
  if (POSTAL_CODE_RE.test(s) && !STRICT_PHONE_PATTERNS.some((re) => re.test(s))) return true;
  return false;
}

/**
 * @param {string} raw
 */
export function stripPhoneYearPollution(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (EMAIL_IN_PHONE_RE.test(s)) s = s.replace(EMAIL_IN_PHONE_RE, ' ').trim();
  s = s
    .replace(PAGE_NUMBER_IN_PHONE_RE, '')
    .replace(TRAILING_PAGE_FRACTION_RE, '')
    .replace(DATE_RANGE_IN_PHONE_RE, '')
    .replace(TRAILING_YEAR_RANGE_RE, '')
    .trim();
  s = s.replace(/\s+(?:19|20)\d{2}\s*$/i, '').trim();
  const tailShortYear = s.match(/^(.+?)\s+(\d{1,2})\s*$/);
  if (tailShortYear) {
    const head = tailShortYear[1];
    const tail = tailShortYear[2];
    const digits = head.replace(/\D/g, '');
    if (digits.length >= 10 && (tail === '20' || tail === '19' || /^[0-9]{2}$/.test(tail))) {
      s = head.trim();
    }
  }
  return s;
}

/**
 * @param {string} digits
 */
function isValidPhoneDigitLength(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (!d) return false;
  if (/^(19|20)\d{2}/.test(d)) return false;
  if (d.startsWith('33')) {
    const national = d.slice(2);
    return national.length === 9 && /^[1-79]/.test(national);
  }
  if (d.startsWith('44') && d.length === 12) {
    const national = d.slice(2);
    return national.length === 10 && /^[1-9]/.test(national);
  }
  if (d.startsWith('234') && d.length === 13) {
    const national = d.slice(3);
    return national.length === 10 && /^[789]/.test(national);
  }
  if (d.startsWith('0') && d.length === 10) return /^0[1-79]/.test(d);
  if (d.length >= 8 && d.length <= 15) {
    if (/(?:19|20)\d{2}$/.test(d) && d.length > 11) return false;
    return true;
  }
  return false;
}

/**
 * @param {string} cleanedDigits
 * @param {string} formattedDigits
 */
function digitsEqualAllowNationalConversion(cleanedDigits, formattedDigits) {
  const c = String(cleanedDigits || '').replace(/\D/g, '');
  const f = String(formattedDigits || '').replace(/\D/g, '');
  if (!c || !f) return false;
  if (c === f) return true;
  if (c.length === 10 && c.startsWith('0') && f === `33${c.slice(1)}`) return true;
  if (c.length === 12 && c.startsWith('44') && f === c) return true;
  if (c.length === 13 && c.startsWith('234') && f === c) return true;
  return false;
}

/**
 * Format only when digits are already complete — never truncate or invent.
 * @param {string} digits
 * @param {string} rawMatch
 */
function formatPhoneE164ish(digits, rawMatch) {
  const d = String(digits || '').replace(/\D/g, '');
  if (!d || !isValidPhoneDigitLength(d)) return '';
  if (d.startsWith('33') && d.length === 11) return `+${d}`;
  if (d.length === 10 && d.startsWith('0')) return `+33${d.slice(1)}`;
  if (String(rawMatch || '').trim().startsWith('+')) return `+${d}`;
  if (d.length >= 8 && d.length <= 15) return `+${d}`;
  return '';
}

/**
 * @param {string} phone
 */
export function validatePhoneStrict(phone) {
  const s = String(phone || '').trim();
  if (!s || EMAIL_IN_PHONE_RE.test(s)) return false;
  if (STANDALONE_YEAR_RANGE_RE.test(s)) return false;
  if (PHONE_CONTEXT_JUNK_RE.test(s)) return false;
  if (phoneHasYearOrDatePollution(s)) return false;
  const digits = s.replace(/\D/g, '');
  if (!isValidPhoneDigitLength(digits)) return false;
  if (SUSPICIOUS_DIGIT_REPEAT_RE.test(digits)) return false;
  return true;
}

/**
 * @param {string} raw
 * @param {string} [phone]
 */
export function scorePhoneExtraction(raw, phone) {
  const original = String(raw || '').trim();
  const p = String(phone || '').trim();
  if (!p || !validatePhoneStrict(p)) return 0;

  let score = 96;
  const rawDigits = original.replace(/\D/g, '');
  const phoneDigits = p.replace(/\D/g, '');

  if (phoneHasYearOrDatePollution(original)) score -= 28;
  if (/\s+(?:19|20)\d{2}\b/.test(original)) score -= 22;
  if (SUSPICIOUS_DIGIT_REPEAT_RE.test(phoneDigits)) score -= 35;

  if (!digitsEqualAllowNationalConversion(rawDigits, phoneDigits)) {
    const cleaned = repairOcrPhoneChars(stripPhoneYearPollution(stripContactLineNoise(original)));
    const cleanedDigits = cleaned.replace(/\D/g, '');
    if (!digitsEqualAllowNationalConversion(cleanedDigits, phoneDigits)) return 0;
    const ocrCharRepair = /[OolIS]/.test(original);
    score -= ocrCharRepair ? 1 : 12;
  }

  if (rawDigits.length === 10 && rawDigits.startsWith('0') && phoneDigits === `33${rawDigits.slice(1)}`) {
    score -= 6;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Extract a single phone candidate from raw text (strict — no partial digit match).
 * @param {string} raw
 */
export function extractPhoneCandidate(raw) {
  const cleaned = repairOcrPhoneChars(stripPhoneYearPollution(stripContactLineNoise(raw)));
  if (!cleaned) return '';

  for (const re of STRICT_PHONE_PATTERNS) {
    const m = cleaned.match(re);
    if (!m) continue;
    const candidate = m[0].trim();
    const digits = candidate.replace(/\D/g, '');
    if (!isValidPhoneDigitLength(digits)) continue;
    if (DATE_RANGE_IN_PHONE_RE.test(candidate)) continue;

    const cleanedDigits = candidate.replace(/\D/g, '');
    const formatted = formatPhoneE164ish(digits, candidate);
    if (!formatted || !validatePhoneStrict(formatted)) continue;
    if (!digitsEqualAllowNationalConversion(cleanedDigits, formatted.replace(/\D/g, ''))) continue;

    return formatted;
  }
  return '';
}

/**
 * @param {string} raw
 * @returns {{ phone: string, uncertain: boolean, confidence: number, original: string, reviewRequired: boolean }}
 */
export function normalizeContactPhone(raw) {
  const original = String(raw || '').trim();
  if (!original) {
    return { phone: '', uncertain: false, confidence: 0, original: '', reviewRequired: false };
  }

  const cleaned = repairOcrPhoneChars(stripContactLineNoise(original));
  const polluted = phoneHasYearOrDatePollution(original) || cleaned !== original;
  const phone = extractPhoneCandidate(cleaned || original);
  const confidence = scorePhoneExtraction(original, phone);
  const reviewRequired = !phone || confidence < PHONE_DISPLAY_CONFIDENCE_MIN;
  const uncertain = polluted || reviewRequired || phone.replace(/\D/g, '') !== original.replace(/\D/g, '');

  if (phone && confidence >= PHONE_DISPLAY_CONFIDENCE_MIN) {
    return { phone, uncertain, confidence, original, reviewRequired: false };
  }

  return { phone: '', uncertain: uncertain || original.length > 0, confidence, original, reviewRequired: true };
}

/**
 * @param {string} original
 * @param {string} [normalized]
 * @param {number} [confidence]
 */
export function buildPhoneReviewItem(original, normalized = '', confidence = 0) {
  const src = String(original || '').trim();
  if (!src) return null;
  const conf = confidence || (normalized ? 72 : 40);
  return {
    id: `contact-phone-${src.slice(0, 20).replace(/\W/g, '') || 'unknown'}`,
    field: 'identity.phone',
    section: 'contact',
    sourceText: src,
    detected: normalized || src,
    status: 'pending',
    confidence: conf,
    category: 'contact',
    reason:
      conf < PHONE_DISPLAY_CONFIDENCE_MIN
        ? 'Phone confidence below threshold — confirm contact number'
        : normalized
          ? 'Phone normalized — confirm contact number'
          : 'Phone could not be parsed safely — confirm contact',
  };
}
