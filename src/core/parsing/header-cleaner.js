/**
 * HEADER_CLEANER — keep identity header fields free of section titles and mixed OCR blobs.
 *
 * Allowed header fields: name, title, email, phone, location.
 * Forbidden tokens: EDUCATION, FORMATION, COMPETENCES, LANGUES, CLIENTS (+ related section anchors).
 */

import { EMAIL_RE, PHONE_RE } from './field-sanitize.js';
import { isBadTitleCandidate } from './parser-recovery.js';
import { isValidIdentityName } from './identity-extraction.js';
import { extractPhoneCandidate, validatePhoneStrict } from './phone-normalize.js';

function isValidEmail(value) {
  const s = String(value || '').trim();
  return !!(s && EMAIL_RE.test(s) && s.length < 80 && !/\s/.test(s));
}

function isValidPhone(value) {
  return validatePhoneStrict(value);
}

function isValidLocation(value) {
  const loc = String(value || '').trim();
  return !!(loc && loc.length >= 3 && loc.length <= 72 && !EMAIL_RE.test(loc) && !isValidPhone(loc));
}

export const HEADER_CLEANER = 'HEADER_CLEANER';

const FORBIDDEN_SECTION_WORDS = [
  'education',
  'formation',
  'formations',
  'competences',
  'compétences',
  'competencies',
  'langues',
  'languages',
  'clients',
  'client',
  'skills',
  'skill',
  'outils',
  'tools',
  'experience',
  'experiences',
  'expérience',
  'expériences',
  'projects',
  'projets',
  'summary',
  'profile',
  'contact',
  'references',
];

const FORBIDDEN_SECTION_RE = new RegExp(
  `\\b(${FORBIDDEN_SECTION_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'gi'
);

const FORBIDDEN_SECTION_EXACT_RE =
  /^(education|formation|formations|competences|compétences|competencies|langues|languages|clients|client|skills?|outils|tools?|experience|experiences|expérience|expériences|projects?|projets)$/i;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} text
 */
export function headerContainsForbiddenSection(text) {
  const s = normSpace(text);
  if (!s) return false;
  if (FORBIDDEN_SECTION_EXACT_RE.test(s)) return true;
  return FORBIDDEN_SECTION_RE.test(s);
}

/**
 * @param {string} text
 */
export function stripForbiddenSectionsFromText(text) {
  const raw = normSpace(text);
  if (!raw) return { cleaned: '', stripped: [] };

  const stripped = [...raw.matchAll(FORBIDDEN_SECTION_RE)].map((m) => m[0]);
  const cleaned = raw.replace(FORBIDDEN_SECTION_RE, ' ').replace(/\s+/g, ' ').trim();
  return { cleaned, stripped };
}

/**
 * @param {string} text
 */
export function extractEmailFromHeaderText(text) {
  const m = String(text || '').match(EMAIL_RE);
  return m ? m[0] : '';
}

/**
 * @param {string} text
 */
export function extractPhoneFromHeaderText(text) {
  return extractPhoneCandidate(text);
}

/**
 * @param {string} value
 * @param {'name'|'title'|'email'|'phone'|'location'} field
 */
export function cleanHeaderField(value, field) {
  const raw = normSpace(value);
  if (!raw) return { value: '', stripped: [] };

  if (field === 'email') {
    const email = extractEmailFromHeaderText(raw);
    if (!email || !isValidEmail(email)) {
      return { value: '', stripped: raw ? [raw] : [] };
    }
    return { value: email, stripped: raw !== email ? [raw] : [] };
  }

  if (field === 'phone') {
    const phone = extractPhoneFromHeaderText(raw);
    if (!phone || !isValidPhone(phone)) {
      return { value: '', stripped: raw ? [raw] : [] };
    }
    return { value: phone, stripped: raw !== phone ? [raw] : [] };
  }

  const { cleaned, stripped } = stripForbiddenSectionsFromText(raw);
  let result = cleaned
    .replace(EMAIL_RE, ' ')
    .replace(PHONE_RE, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const allStripped = [...stripped];
  const email = extractEmailFromHeaderText(raw);
  const phone = extractPhoneFromHeaderText(raw);
  if (email) allStripped.push(email);
  if (phone) allStripped.push(phone);

  if (field === 'name') {
    if (!result || !isValidIdentityName(result) || headerContainsForbiddenSection(result)) {
      return { value: '', stripped: allStripped.length ? allStripped : [raw] };
    }
    return { value: result, stripped: allStripped };
  }

  if (field === 'title') {
    if (!result || isBadTitleCandidate(result) || headerContainsForbiddenSection(result)) {
      return { value: '', stripped: allStripped.length ? allStripped : [raw] };
    }
    return { value: result, stripped: allStripped };
  }

  if (field === 'location') {
    if (!result || headerContainsForbiddenSection(result) || !isValidLocation(result)) {
      return { value: '', stripped: allStripped.length ? allStripped : [raw] };
    }
    return { value: result, stripped: allStripped };
  }

  if (headerContainsForbiddenSection(result)) {
    return { value: '', stripped: allStripped.length ? allStripped : [raw] };
  }

  return { value: result, stripped: allStripped };
}

/**
 * @param {object} cvData
 */
export function applyHeaderCleaner(cvData) {
  if (!cvData || typeof cvData !== 'object') return cvData;

  const d = { ...cvData };
  const source = {
    name: d.name,
    title: d.title,
    email: d.email,
    phone: d.phone,
    location: d.location,
  };
  const strippedAll = [];
  const unsorted = [...(d.unsorted || [])];

  for (const field of ['name', 'title', 'email', 'phone', 'location']) {
    const result = cleanHeaderField(source[field], field);
    if (result.stripped?.length) strippedAll.push(...result.stripped.filter(Boolean));
    d[field] = result.value;
  }

  if (!d.email) {
    for (const src of [source.name, source.title, source.location, source.phone]) {
      const email = extractEmailFromHeaderText(src);
      if (email && isValidEmail(email)) {
        d.email = email;
        break;
      }
    }
  }

  if (!d.phone) {
    for (const src of [source.name, source.title, source.location, source.email]) {
      const phone = extractPhoneFromHeaderText(src);
      if (phone && isValidPhone(phone)) {
        d.phone = phone;
        break;
      }
    }
  }

  for (const piece of strippedAll) {
    const token = normSpace(piece);
    if (!token || unsorted.includes(token)) continue;
    if (FORBIDDEN_SECTION_EXACT_RE.test(token) || headerContainsForbiddenSection(token)) {
      unsorted.push(token);
    }
  }

  if (unsorted.length) d.unsorted = [...new Set(unsorted)].slice(0, 24);
  d._headerCleaner = HEADER_CLEANER;
  return d;
}

/**
 * @param {object} cvData
 */
export function headerFieldsBlob(cvData) {
  return [cvData?.name, cvData?.title, cvData?.email, cvData?.phone, cvData?.location]
    .filter(Boolean)
    .join(' | ');
}
