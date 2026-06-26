/**
 * OCR Contamination Firewall — normalization-only guards against section anchors,
 * URL/social leaks, impossible dates, and inferred clients.
 */

import { CLIENT_COMPANY_KEYWORDS } from '../../data/dictionaries/clientCompanyKeywords.js';
import {
  EMAIL_RE,
  PHONE_RE,
  URL_RE,
  isValidEducationItem,
  isValidExperienceLine,
  isValidTitleField,
  lineIsClientList,
} from './field-sanitize.js';
import { extractDateRangeFromText } from './parser-recovery.js';
import { normalizeAllEducation } from './education-normalization-layer.js';
import { INTERNSHIP_RE, FREELANCE_RE } from './generic-career-signals.js';
import { cleanHeaderField } from './header-cleaner.js';

const BAD_NAME_RE =
  /^(candidate|your\s+name|name\s+here|nom\s+prénom|votre\s+nom)$/i;

export const OCR_CONTAMINATION_FIREWALL = 'OCR_CONTAMINATION_FIREWALL';

const CURRENT_YEAR = new Date().getFullYear();
const MIN_PLAUSIBLE_YEAR = 1950;
const MAX_EDUCATION_SPAN_YEARS = 10;

const SECTION_ANCHOR_EXACT = new Set(
  [
    'education',
    'formation',
    'formations',
    'experience',
    'experiences',
    'expérience',
    'expériences',
    'skills',
    'skill',
    'compétences',
    'competences',
    'tools',
    'outils',
    'languages',
    'langues',
    'clients',
    'client',
    'projects',
    'projets',
    'summary',
    'profile',
    'contact',
  ].map((x) => x.toLowerCase())
);

const SECTION_ANCHOR_RE =
  /^(education|formation|formations|experience|experiences|expérience|expériences|skills?|compétences|competences|tools?|outils|languages?|langues|clients?|projects?|projets)\s*$/i;

const EDU_SOCIAL_URL_RE =
  /https?:\/\/|www\.|instagram\.com|linkedin\.com|behance\.net|dribbble\.com|facebook\.com|twitter\.com|x\.com/i;

const YEAR_TOKEN_RE = /\b((?:19|20)\d{2})\b/g;
const MULTI_DATE_SPLIT_RE =
  /\s*(?:·|•|\||\/{2,}|(?<=[a-zà-ÿ0-9])\s{2,}(?=[A-ZÀ-Ö]))\s*|\s+—\s+(?=(?:internship|intern\b|stage\b|freelance|illustrator|designer)\b)/i;

const CLIENT_LOWER = new Map(
  CLIENT_COMPANY_KEYWORDS.map((c) => [c.toLowerCase(), c])
);

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} text
 */
export function isSectionAnchorField(text) {
  const raw = normSpace(text);
  if (!raw) return false;
  const bare = raw
    .toLowerCase()
    .replace(/[.:;|/\\-]+$/g, '')
    .trim();
  if (SECTION_ANCHOR_EXACT.has(bare)) return true;
  if (SECTION_ANCHOR_RE.test(raw)) return true;
  if (/^(EDUCATION|FORMATION|EXPERIENCE|SKILLS|TOOLS|LANGUAGES|CLIENTS)$/i.test(raw)) return true;
  return false;
}

/**
 * @param {string} value
 * @param {'name'|'title'|'email'|'phone'} field
 */
export function rejectHeaderField(value, field) {
  const cleaned = cleanHeaderField(value, field);
  const s = normSpace(cleaned.value);
  if (!s) return '';

  if (field === 'name') {
    if (BAD_NAME_RE.test(s) || /\d{3,}/.test(s) || /\\|\/|_/.test(s)) return '';
  }

  if (field === 'title' && !isValidTitleField(s)) return '';

  return s;
}

/**
 * @param {number|string} year
 */
export function isPlausibleYear(year) {
  const n = parseInt(String(year || ''), 10);
  if (Number.isNaN(n)) return false;
  if (n < MIN_PLAUSIBLE_YEAR || n > CURRENT_YEAR + 1) return false;
  return true;
}

/**
 * @param {string} text
 */
export function educationHasUrlContamination(text) {
  return EDU_SOCIAL_URL_RE.test(String(text || ''));
}

/**
 * @param {string} startDate
 * @param {string} endDate
 */
export function educationSpanYears(startDate, endDate) {
  const s = parseInt(String(startDate || ''), 10);
  const e = parseInt(String(endDate || startDate || ''), 10);
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.abs(e - s) + 1;
}

/**
 * @param {string} text
 */
export function extractYearsFromText(text) {
  return [...String(text || '').matchAll(YEAR_TOKEN_RE)].map((m) => m[1]);
}

/**
 * @param {string} text
 */
export function educationDatesPlausible(text) {
  const years = extractYearsFromText(text);
  if (!years.length) return true;
  for (const y of years) {
    if (!isPlausibleYear(y)) return false;
  }
  const range = extractDateRangeFromText(text);
  const start = range.startDate || years[0] || '';
  const end = range.endDate || years[years.length - 1] || start;
  if (start && !isPlausibleYear(start)) return false;
  if (end && !/present|présent|current|now|actuel/i.test(end) && !isPlausibleYear(end)) return false;
  if (start && end && !/present|présent|current|now|actuel/i.test(end)) {
    if (educationSpanYears(start, end) > MAX_EDUCATION_SPAN_YEARS) return false;
  }
  return true;
}

/**
 * @param {string} line
 */
export function rejectEducationContamination(line) {
  const s = normSpace(line);
  if (!s) return '';
  if (educationHasUrlContamination(s)) return '';
  if (!educationDatesPlausible(s)) return '';
  if (!isValidEducationItem(s)) return '';
  return s;
}

/**
 * Split merged experience strings (internship vs job, multiple date ranges).
 * @param {string[]} experience
 */
export function splitExperienceContamination(experience = []) {
  const out = [];

  for (const raw of experience || []) {
    const line = normSpace(
      typeof raw === 'object'
        ? [raw.role, raw.company, raw.dates, ...(raw.bullets || [])].filter(Boolean).join(' — ')
        : raw
    );
    if (!line) continue;

    const chunks = splitExperienceLine(line);
    for (const chunk of chunks) {
      const cleaned = normSpace(chunk);
      if (cleaned && isValidExperienceLine(cleaned)) out.push(cleaned);
    }
  }

  return dedupeExperienceLines(out).slice(0, 12);
}

/**
 * @param {string} line
 */
function splitExperienceLine(line) {
  const l = normSpace(line);
  if (!l) return [];

  const dateMatches = [...l.matchAll(/\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|actuel)\b/gi)];
  if (dateMatches.length > 1) {
    const parts = [];
    let cursor = 0;
    dateMatches.forEach((m, idx) => {
      const start = idx === 0 ? 0 : m.index;
      const end = idx < dateMatches.length - 1 ? dateMatches[idx + 1].index : l.length;
      const slice = normSpace(l.slice(start, end));
      if (slice.length >= 10) parts.push(slice);
      cursor = end;
    });
    if (parts.length > 1) return parts;
  }

  if (INTERNSHIP_RE.test(l) && FREELANCE_RE.test(l)) {
    const internIdx = l.search(INTERNSHIP_RE);
    const freeIdx = l.search(FREELANCE_RE);
    if (internIdx >= 0 && freeIdx >= 0 && Math.abs(internIdx - freeIdx) > 8) {
      const pivot = Math.min(internIdx, freeIdx);
      const a = normSpace(l.slice(0, pivot));
      const b = normSpace(l.slice(pivot));
      const parts = [a, b].filter((p) => p.length >= 10);
      if (parts.length > 1) return parts;
    }
  }

  if (MULTI_DATE_SPLIT_RE.test(l)) {
    const parts = l
      .split(MULTI_DATE_SPLIT_RE)
      .map((p) => normSpace(p))
      .filter((p) => p.length >= 10);
    if (parts.length > 1) return parts;
  }

  const internParts = l.split(/\b(?=internship\b|intern\b|stage\b)/i).map((p) => normSpace(p));
  if (internParts.length > 1 && internParts.every((p) => p.length >= 8)) {
    return internParts;
  }

  return [l];
}

function dedupeExperienceLines(lines) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

/**
 * Only keep explicit client list items (comma/bullet) that match recognized brands.
 * Never infer clients from prose fields.
 * @param {string[]} clients
 */
export function sanitizeClientsFirewall(clients = []) {
  const out = new Set();

  for (const raw of clients || []) {
    const s = String(raw || '').trim();
    if (!s) continue;

    const pieces = /[,·•/|]/.test(s)
      ? s
          .split(/[,·•/|]/)
          .map((p) => p.trim())
          .filter((p) => p.length >= 2)
      : [s];

    for (const piece of pieces) {
      const canon = resolveRecognizedBrand(piece);
      if (canon) out.add(canon);
    }
  }

  return [...out].slice(0, 12);
}

/**
 * @param {string} token
 */
function resolveRecognizedBrand(token) {
  const t = normSpace(token);
  if (!t || t.length < 2 || t.length > 48) return '';
  const low = t.toLowerCase();
  if (CLIENT_LOWER.has(low)) return CLIENT_LOWER.get(low);
  for (const [key, canon] of CLIENT_LOWER) {
    if (key.length < 4) continue;
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(t)) return canon;
  }
  return '';
}

/**
 * @param {object} cvData
 */
export function applyOcrContaminationFirewall(cvData) {
  if (!cvData || typeof cvData !== 'object') return cvData;

  const d = { ...cvData };
  const identity = {
    name: d.name,
    email: d.email,
    phone: d.phone,
  };

  d.name = rejectHeaderField(d.name, 'name');
  d.title = rejectHeaderField(d.title, 'title');
  if (d.email) d.email = rejectHeaderField(d.email, 'email');
  if (d.phone) d.phone = rejectHeaderField(d.phone, 'phone');

  d.education = normalizeAllEducation(
    (d.education || []).map((e) => rejectEducationContamination(String(e || ''))).filter(Boolean),
    { identity }
  );

  d.experience = splitExperienceContamination(d.experience || []);

  d.clients = sanitizeClientsFirewall(d.clients || []);

  d._ocrFirewall = OCR_CONTAMINATION_FIREWALL;
  return d;
}
