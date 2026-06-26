/**
 * Locked identity extraction — name/title only from allowed document regions.
 * Never promote skills, unsorted, toClassify, or keyword clusters to identity.
 */

import {
  ROLE_KEYWORDS,
  lineLooksLikeRole,
  lineIsRoleOnly,
} from '../../data/dictionaries/roleKeywords.js';
import {
  EMAIL_RE,
  PHONE_RE,
  URL_RE,
  isValidTitleField,
  lineIsClientList,
} from './field-sanitize.js';
import { isLikelyTool } from './line-cleaner.js';
import {
  NON_PERSON_NAME_SIGNAL_RE,
  emailLocalPartNameHint,
  PERSON_NAME_SEGMENT_RE,
  PERSON_NAME_CAPS_SEGMENT_RE,
} from './ocr-classification-rules.js';
import { findLongestDictionaryTerm, CLIENT_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { extractEmailsFromSource } from '../validation/email-strictness.js';
import { isUncertainIdentityEmail } from '../display/undetected-label.js';

export const IDENTITY_CONFIDENCE_MIN = 85;
export const IDENTITY_DISPLAY_CONFIDENCE_MIN = 85;
export const NAME_PHONE_REWRITE_V1 = 'NAME_PHONE_REWRITE_V1';

/** Business / org tokens — never a person name. */
export const NAME_REJECT_BUSINESS_RE =
  /\b(agency|agencies|studio|studios|company|companies|group|groups|inc|ltd|llc|impressions?|creative|design|marketing|media|portfolio|freelance|freelancing|agence|groupe|sarl|sas|gmbh|holding|partners?)\b/i;

/** Name source priority (v2 rewrite). */
export const NAME_SOURCE_PRIORITY_V2 = Object.freeze({
  top_header: 1,
  largest_first_page_block: 2,
  above_email: 3,
  above_phone: 4,
  contact_neighbor: 5,
});
export const IDENTITY_SOURCE_PRIORITY_V1 = 'IDENTITY_SOURCE_PRIORITY_V1';
export const IDENTITY_FIRST_PAGE_TOP_PCT = 0.15;
export const IDENTITY_FIRST_PAGE_MAX_LINES = 48;
export const IDENTITY_FOOTER_ZONE_PCT = 0.15;

/** Source priority rank (lower = higher priority). */
export const IDENTITY_SOURCE_PRIORITY = Object.freeze({
  top_header: 1,
  largest_first_page_block: 2,
  above_email: 3,
  above_phone: 4,
  contact_neighbor: 5,
  top15pct: 1,
  largest_header_block: 2,
  manual_review: 6,
});

const FORBIDDEN_SECTION_TYPES = Object.freeze([
  ['experience', /^(experience|expérience|work experience|professional experience|emploi|parcours)\b/i],
  ['education', /^(education|formation|formations?|studies|academic)\b/i],
  ['clients', /^(clients?|customers?|brands?|marques)\b/i],
]);

const FOOTER_LINE_RE =
  /^(page\s+\d+\s*(?:of|\/)\s*\d+|\d+\s*\/\s*\d+|confidential|footer|©|copyright)\b/i;

/** Company/agency tokens that must never appear in a person name (any position). */
export const COMPANY_LIKE_NAME_RE =
  /\b(impressions?|agenc(?:y|e|ies)|studios?|compan(?:y|ies)|freelanc(?:e|ing)?|clients?|portfolios?|groupe?|groups?|imprimerie|printing|publicis|mccann|ogilvy|wpp|holding|sarl|sas|gmbh|inc|ltd|llc|creative|design|marketing|media)\b/i;

const IDENTITY_SECTION_BREAK_RE =
  /^(experience|expérience|work experience|professional experience|education|formation|formations?|skills?|compétences|tools?|outils|languages?|langues|projects?|clients?|interests?|contact|references?|cv|resume)\b/i;
export const IDENTITY_TOP_LINE_LIMIT = 20;
export const CONTACT_NEIGHBOR_RADIUS = 2;

const SOFTWARE_NAME_RE =
  /\b(photoshop|illustrator|indesign|figma|sketch|procreate|after effects|affinity|lightroom|blender|cinema\s*4d|xd|premiere)\b/i;

const SKILL_KEYWORD_CLUSTER_RE =
  /\b(print|logo|vector|illustration|reading|typography|branding|graphic design|movies?|music|nature|drawing|packaging|icon|layout|artwork|digital art)\b/i;

const RANDOM_KEYWORD_TITLE_RE =
  /\b(print\s*logo|vector\s*art|nature\s*music|art\s*reading|reading\s*nature)\b/i;

const OCR_GARBAGE_TITLE_RE = /[\\]|ILLUSTHATCH|\|\s*,|,\s*[A-Z]{2,}\s*,/i;

const SECTION_HEADER_REJECT =
  /^(profile|summary|about|experience|work experience|education|formation|skills|compétences|tools|outils|languages|langues|projects|clients|interests|contact|references|cv|resume)\b/i;

const SKILL_FRAGMENT_TITLE_RE =
  /\b(print|logo|vector|illustration|reading|typography|branding|packaging|photoshop|illustrator|indesign|figma|sketch|artwork|icon|layout)\b/i;

/** Education / CV-content tokens that must never appear in a person name. */
const NON_PERSON_NAME_WORD_RE =
  /\b(created?|creation|creative|school|college|university|école|ecole|web|weband|motion|design|designer|management|observation|maquette|packaging|program|programme|degree|bachelor|master|diploma|licence|license|internship|freelance|independent|graphic|illustration|portfolio|project|client|agency|studio|summary|profile|contact|skills?|tools?|languages?|native|fluent|english|french|reading|nature|movies?|interest|photograph|formation|education|experience|lisaa|creapole|visual|communication|animation|motiondesign|webdesign)\b/i;

/** OCR-merged fragments (e.g. "web and" → Weband). */
const OCR_MERGED_NAME_RE =
  /weband|motiondesign|webdesign|schoolmanagement|graphicdesign|createdweb|creativeweb/i;

/** First-token rejects — verbs/adjectives common in education lines, not given names. */
const NON_NAME_FIRST_TOKEN = new Set(
  [
    'created',
    'creation',
    'creative',
    'graphic',
    'motion',
    'visual',
    'digital',
    'professional',
    'freelance',
    'independent',
    'senior',
    'lead',
    'web',
    'school',
    'university',
    'management',
    'observation',
    'reading',
    'nature',
    'movies',
    'movie',
    'interest',
    'formation',
    'education',
    'experience',
    'profile',
    'contact',
    'expertise',
    'specialized',
    'specialised',
    'market',
    'reviews',
    'review',
    'impressions',
    'jb',
    'portfolio',
    'expert',
    'adress',
    'address',
    'mustrations',
    'mustration',
    'illustrations',
    'illustration',
  ].map((x) => x.toLowerCase())
);

/**
 * Low-confidence name hint from upload filename when OCR header is destroyed.
 * @param {string} fileName
 */
export function extractNameFromFileName(fileName) {
  const base = String(fileName || '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/^(cv|resume|curriculum|curriculum-vitae)[\s._-]*/i, '')
    .replace(/[\s._-]+(copie|copy|final|version|v\d+).*$/i, '')
    .replace(/[^a-zàâäéèêëïîôùûüç\s'-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base || base.length < 5) return '';
  const plausible = (token) => {
    if (!/^[a-zàâäéèêëïîôùûüç'-]{2,24}$/i.test(token)) return false;
    if (/\d/.test(token)) return false;
    if (/(.)\1{3,}/i.test(token)) return false;
    return true;
  };
  const tokens = base.split(' ').filter(plausible);
  if (tokens.length < 2) return '';
  const name = tokens
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return isAcceptablePersonName(name) ? name : '';
}

/**
 * @param {string[]} allLines
 * @param {number} [maxScan]
 */
export function extractIdentityHeaderLines(allLines = [], maxScan = 28) {
  const lines = (allLines || []).map((l) => String(l || '').trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < Math.min(lines.length, maxScan); i++) {
    if (i > 0 && IDENTITY_SECTION_BREAK_RE.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

/**
 * @param {string} text
 */
export function looksLikeCompanyOrAgencyName(text) {
  const s = String(text || '').trim();
  if (!s) return true;
  if (COMPANY_LIKE_NAME_RE.test(s)) return true;
  const clientHit = findLongestDictionaryTerm(s, CLIENT_TERMS);
  if (clientHit) {
    const hit = clientHit.toLowerCase();
    const norm = s.toLowerCase();
    if (norm === hit || norm.includes(hit) || hit.includes(norm)) return true;
  }
  return false;
}

/**
 * @param {string} name
 * @param {object[]} [experiences]
 */
export function nameCollidesWithEmployers(name, experiences = []) {
  const n = String(name || '').trim().toLowerCase();
  if (!n || n.length < 3) return false;
  for (const exp of experiences || []) {
    const company = String(exp?.company || '').trim().toLowerCase();
    if (!company || company.length < 3) continue;
    if (company === n || n.includes(company) || company.includes(n)) return true;
    const nameWords = n.split(/\s+/).filter((w) => w.length >= 3);
    const compWords = company.split(/\s+/).filter((w) => w.length >= 3);
    if (nameWords.length >= 2 && nameWords.every((w) => compWords.includes(w))) return true;
  }
  return false;
}

function lineFailsIdentityGuard(s) {
  if (!s || s.length < 3) return true;
  if (SKILL_FRAGMENT_TITLE_RE.test(s) && !lineLooksLikeRole(s)) return true;
  if (EMAIL_RE.test(s) || PHONE_RE.test(s) || URL_RE.test(s)) return true;
  if (lineIsClientList(s) && !lineLooksLikeRole(s)) return true;
  return false;
}

/**
 * OCR garbage must never become identity.
 * @param {string} line
 */
export function isOcrGarbageIdentityLine(line) {
  const s = String(line || '').trim();
  if (!s || s.length < 2) return true;
  if (NON_PERSON_NAME_SIGNAL_RE.test(s)) return true;
  if (OCR_GARBAGE_TITLE_RE.test(s)) return true;
  if (OCR_MERGED_NAME_RE.test(s)) return true;
  if (/[\\|]{2,}/.test(s)) return true;
  if (/\b(incision|wustrator|snoutors|illusthatch|gradric|mustrator|mustrations?)\b/i.test(s)) return true;
  if (/\d{4,}/.test(s) && !PHONE_RE.test(s)) return true;
  if (SOFTWARE_NAME_RE.test(s) && !lineLooksLikeRole(s)) return true;
  if (SKILL_KEYWORD_CLUSTER_RE.test(s) && !/\b(designer|director|illustrator|manager)\b/i.test(s)) {
    return true;
  }
  return false;
}

/**
 * @param {string[]} lines
 */
export function getFirstPageLineCount(lines = [], opts = {}) {
  if (Number.isFinite(opts.firstPageLineCount) && opts.firstPageLineCount > 0) {
    return Math.min(lines.length, opts.firstPageLineCount);
  }
  const pdfCount = opts.pdfMeta?.firstPageLineCount || opts.pdfExtraction?.firstPageLineCount;
  if (Number.isFinite(pdfCount) && pdfCount > 0) return Math.min(lines.length, pdfCount);
  const breakIdx = lines.findIndex((l) => FOOTER_LINE_RE.test(String(l || '').trim()) || /\f/.test(l));
  if (breakIdx > 6) return breakIdx;
  return Math.min(lines.length, IDENTITY_FIRST_PAGE_MAX_LINES);
}

/**
 * Line indices inside experience / clients / education sections and footer zone.
 * @param {string[]} lines
 * @returns {Map<number, string>}
 */
export function buildForbiddenIdentityIndices(lines = []) {
  const forbidden = new Map();
  const n = lines.length;
  const footerStart = Math.max(0, Math.floor(n * (1 - IDENTITY_FOOTER_ZONE_PCT)));
  for (let i = footerStart; i < n; i++) forbidden.set(i, 'footer');

  const headers = [];
  for (let i = 0; i < n; i++) {
    const line = String(lines[i] || '').trim();
    if (FOOTER_LINE_RE.test(line)) forbidden.set(i, 'footer');
    for (const [type, re] of FORBIDDEN_SECTION_TYPES) {
      if (re.test(line) && line.length < 48) {
        headers.push({ index: i, type });
        break;
      }
    }
  }

  for (let h = 0; h < headers.length; h++) {
    const { index, type } = headers[h];
    if (!['experience', 'clients', 'education'].includes(type)) continue;
    const end = h + 1 < headers.length ? headers[h + 1].index : n;
    for (let i = index; i < end; i++) forbidden.set(i, type);
  }
  return forbidden;
}

/**
 * @param {number} lineIndex
 * @param {Map<number, string>} forbidden
 */
export function isForbiddenIdentityLineIndex(lineIndex, forbidden) {
  return forbidden?.has(lineIndex) === true;
}

function getTop15PctIndices(firstPageCount) {
  const count = Math.max(2, Math.ceil(firstPageCount * IDENTITY_FIRST_PAGE_TOP_PCT));
  return new Set(Array.from({ length: count }, (_, i) => i));
}

function identitySourcePriorityRank(reason) {
  if (reason === 'top_header' || reason === 'top15pct' || reason === 'header' || reason === 'identity_block') {
    return IDENTITY_SOURCE_PRIORITY.top_header;
  }
  if (reason === 'largest_first_page_block' || reason === 'largest_header_block') {
    return IDENTITY_SOURCE_PRIORITY.largest_first_page_block;
  }
  if (reason === 'above_email') return IDENTITY_SOURCE_PRIORITY.above_email;
  if (reason === 'above_phone') return IDENTITY_SOURCE_PRIORITY.above_phone;
  if (reason === 'contact_neighbor') return IDENTITY_SOURCE_PRIORITY.contact_neighbor;
  return IDENTITY_SOURCE_PRIORITY.manual_review;
}

const CONFIDENCE_BY_NAME_SOURCE = Object.freeze({
  top_header: 96,
  top15pct: 96,
  header: 96,
  largest_first_page_block: 92,
  largest_header_block: 92,
  above_email: 90,
  above_phone: 88,
  contact_neighbor: 86,
});

function confidenceForIdentitySource(reason) {
  return CONFIDENCE_BY_NAME_SOURCE[reason] ?? 0;
}

/** Tokens that must never appear in a person name (profile, school, project, client). */
export const PERSON_NAME_FORBIDDEN_CONTEXT_RE =
  /\b(profile|summary|about|school|college|university|université|école|ecole|project|projects|projet|projets|client|clients|portfolio|portfolios?)\b/i;

/**
 * Hard reject — not a person name (v2 rules).
 * @param {string} text
 */
export function rejectAsPersonName(text) {
  const s = String(text || '').trim().slice(0, 120);
  if (!s || s.length < 3) return true;
  if (NAME_REJECT_BUSINESS_RE.test(s)) return true;
  if (looksLikeCompanyOrAgencyName(s)) return true;
  if (PERSON_NAME_FORBIDDEN_CONTEXT_RE.test(s)) return true;
  if (/\b(internship|internships?|interns?|stage|stages?|stagiaire|apprenticeship|apprenti|apprentice|trainee|alternance)\b/i.test(s)) {
    return true;
  }
  if (/\b(19|20)\d{2}\b|(?:19|20)\d{2}\s*[-–—]/.test(s)) return true;
  if (EMAIL_RE.test(s) || URL_RE.test(s) || /@/.test(s)) return true;
  if (/\d/.test(s)) return true;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length > 4 || words.length < 2) return true;
  return false;
}

/**
 * @param {string} text
 * @param {object[]} [experiences]
 */
export function isAcceptablePersonName(text, experiences = []) {
  const s = String(text || '').trim();
  if (!s || rejectAsPersonName(s)) return false;
  if (nameCollidesWithEmployers(s, experiences)) return false;
  return isValidIdentityName(s);
}

function findContactLineIndices(lines, firstPageCount) {
  const emails = [];
  const phones = [];
  for (let i = 0; i < firstPageCount; i++) {
    const line = String(lines[i] || '').trim();
    if (EMAIL_RE.test(line)) emails.push(i);
    if (PHONE_RE.test(line)) phones.push(i);
  }
  return { emails, phones };
}

function visualWeightForNameLine(line) {
  const s = String(line || '').trim();
  let w = s.length;
  if (/^[A-ZÀ-Ö][A-ZÀ-Ö\s'-]{4,}$/.test(s)) w += 24;
  if (/^[A-ZÀ-Ö][a-zà-ö'-]+(?:\s+[A-ZÀ-Ö][a-zà-ö'-]+){1,3}$/.test(s)) w += 18;
  return w;
}

/**
 * Strict person-name validation (never keyword clusters).
 * @param {string} text
 */
export function isValidIdentityName(text) {
  const s = String(text || '').trim().slice(0, 80);
  if (!s) return false;
  try {
    return isValidIdentityNameInner(s);
  } catch {
    return false;
  }
}

function isValidIdentityNameInner(s) {
  if (!s) return false;
  if (rejectAsPersonName(s)) return false;
  if (/^expertise\s+special/i.test(s)) return false;
  if (/^market\s+reviews?\)?$/i.test(s)) return false;
  if (/^jb\s+impressions?$/i.test(s)) return false;
  if (/\bimpressions?\b/i.test(s)) return false;
  if (/^(research|executive|professional|career)\s+summary$/i.test(s)) return false;
  if (looksLikeCompanyOrAgencyName(s)) return false;
  if (lineFailsIdentityGuard(s)) return false;
  if (/,/.test(s)) return false;
  if (/[\\|]/.test(s)) return false;
  if (SOFTWARE_NAME_RE.test(s)) return false;
  if (SKILL_KEYWORD_CLUSTER_RE.test(s) && !/\b(designer|director|illustrator|manager|lead)\b/i.test(s)) {
    return false;
  }
  if (lineIsRoleOnly(s)) return false;
  if (lineIsClientList(s)) return false;
  if (isLikelyTool(s)) return false;
  if (/\b(studio|agency|agence|group|inc|ltd|gmbh|sarl|sas)\b/i.test(s)) return false;
  const honorific = /^dr\.?\s+/i.test(s);
  const core = honorific ? s.replace(/^dr\.?\s+/i, '').trim() : s;
  if (/^(mba|bsc|bsn|b\.?a\.?|m\.?sc|m\.?a\.?|j\.?d\.?|b\.?eng|b\.?s\.?)\b/i.test(core)) return false;
  const words = core.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  if (NON_NAME_FIRST_TOKEN.has(words[0].toLowerCase())) return false;
  if (words.some((w) => NON_PERSON_NAME_WORD_RE.test(w))) return false;
  if (NON_PERSON_NAME_WORD_RE.test(core)) return false;
  if (NON_PERSON_NAME_SIGNAL_RE.test(core)) return false;
  let compact = '';
  for (let i = 0; i < core.length; i++) {
    const ch = core[i];
    if (ch !== ' ' && ch !== '\t') compact += ch;
  }
  if (OCR_MERGED_NAME_RE.test(compact)) return false;
  let alpha = 0;
  for (let i = 0; i < compact.length; i++) {
    const c = compact.charCodeAt(i);
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 192 && c <= 591)) alpha++;
  }
  if (!compact.length || alpha / compact.length < 0.85) return false;
  if (!/^[A-ZÀ-Ÿ][a-zà-ÿ'`-]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ'`-]+){1,3}$/.test(core)) return false;
  return true;
}

/**
 * Strict professional title validation.
 * @param {string} text
 */
export function isValidIdentityTitle(text) {
  const s = String(text || '').trim();
  if (!s || lineFailsIdentityGuard(s)) return false;
  if (RANDOM_KEYWORD_TITLE_RE.test(s)) return false;
  if (OCR_GARBAGE_TITLE_RE.test(s)) return false;
  if (/,/.test(s) && !/\b(designer|director|illustrator)\b/i.test(s)) return false;
  if (!lineLooksLikeRole(s)) return false;
  if (!isValidTitleField(s)) return false;
  if (SKILL_KEYWORD_CLUSTER_RE.test(s) && !lineLooksLikeRole(s)) return false;
  return true;
}

/**
 * Lines that must never feed identity (toClassify, unsorted, review queue).
 * @param {object} opts
 * @returns {Set<string>}
 */
export function blockedIdentityLineSet(opts = {}) {
  const blocked = new Set();
  const add = (line) => {
    const t = String(line || '').trim().toLowerCase();
    if (t) blocked.add(t);
  };
  for (const l of opts.unsortedLines || []) add(l);
  for (const l of opts.toClassifyLines || []) {
    add(typeof l === 'string' ? l : l?.text || l?.detected);
  }
  for (const l of opts.reviewQueueLines || []) {
    add(typeof l === 'string' ? l : l?.sourceText || l?.detected || l?.line);
  }
  for (const l of opts.skillsLines || []) add(l);
  for (const l of opts.interestsLines || []) add(l);
  for (const l of opts.toolsLines || []) add(l);
  return blocked;
}

/**
 * Build allowed identity source lines with provenance.
 * @param {string[]} allLines — full document lines (0-indexed)
 * @param {object} [opts]
 * @returns {Array<{ line: string, lineIndex: number, reason: string }>}
 */
export function buildIdentityCandidateLines(allLines = [], opts = {}) {
  const lines = (allLines || []).map((l) => String(l || '').trim()).filter(Boolean);
  const blocked = blockedIdentityLineSet(opts);
  const forbidden = buildForbiddenIdentityIndices(lines);
  const firstPageCount = getFirstPageLineCount(lines, opts);
  const seen = new Set();
  const out = [];

  const push = (line, lineIndex, reason) => {
    const t = String(line || '').trim();
    const idx = lineIndex >= 0 ? lineIndex : -1;
    if (!t || t.length < 2) return;
    if (idx >= 0 && isForbiddenIdentityLineIndex(idx, forbidden)) return;
    if (isOcrGarbageIdentityLine(t)) return;
    if (rejectAsPersonName(t)) return;
    const key = `${reason}:${t.toLowerCase()}`;
    if (blocked.has(t.toLowerCase()) || seen.has(key)) return;
    if (SECTION_HEADER_REJECT.test(t)) return;
    seen.add(key);
    out.push({ line: t, lineIndex: idx, reason });
  };

  const headerEnd = lines.findIndex((l, i) => i > 0 && IDENTITY_SECTION_BREAK_RE.test(l));
  const headerLimit = headerEnd > 0 ? headerEnd : firstPageCount;
  for (let i = 0; i < headerLimit; i++) {
    push(lines[i], i, 'top_header');
  }

  let largest = null;
  let largestWeight = 0;
  for (let i = 0; i < firstPageCount; i++) {
    if (isForbiddenIdentityLineIndex(i, forbidden)) continue;
    const line = lines[i];
    if (!isAcceptablePersonName(line, opts.experiences)) continue;
    const w = visualWeightForNameLine(line);
    if (w > largestWeight) {
      largestWeight = w;
      largest = { line, lineIndex: i, reason: 'largest_first_page_block' };
    }
  }
  if (largest) push(largest.line, largest.lineIndex, largest.reason);

  const { emails, phones } = findContactLineIndices(lines, firstPageCount);
  for (const ei of emails) {
    if (ei > 0) push(lines[ei - 1], ei - 1, 'above_email');
  }
  for (const pi of phones) {
    if (pi > 0) push(lines[pi - 1], pi - 1, 'above_phone');
  }

  for (const ci of [...emails, ...phones]) {
    for (let d = -CONTACT_NEIGHBOR_RADIUS; d <= CONTACT_NEIGHBOR_RADIUS; d++) {
      if (d === 0) continue;
      const ni = ci + d;
      if (ni < 0 || ni >= firstPageCount) continue;
      push(lines[ni], ni, 'contact_neighbor');
    }
  }

  for (const raw of [...(opts.identityLines || []), ...(opts.headerLines || [])]) {
    const t = String(raw || '').trim();
    const idx = lines.findIndex((l) => l === t);
    if (idx >= 0 && idx < firstPageCount) push(t, idx, 'top_header');
  }

  return out;
}

/**
 * Extract validated identity from allowed lines only.
 * @param {string[]} allLines
 * @param {object} [opts]
 * @returns {{
 *   name: string,
 *   title: string,
 *   nameConfidence: number,
 *   titleConfidence: number,
 *   nameSource: { lineIndex: number, line: string, reason: string } | null,
 *   titleSource: { lineIndex: number, line: string, reason: string } | null,
 *   nameCandidates: string[],
 *   titleCandidates: string[],
 * }}
 */
export function extractLockedIdentity(allLines = [], opts = {}) {
  const candidates = buildIdentityCandidateLines(allLines, opts);
  const contact = {
    email: opts.contact?.email || '',
    phone: opts.contact?.phone || '',
  };

  let name = '';
  let nameConfidence = 0;
  let nameSource = null;
  const nameCandidates = [];

  const nameHits = [];
  for (const entry of candidates) {
    if (!isAcceptablePersonName(entry.line, opts.experiences)) continue;
    if (contact.email && entry.line.includes(contact.email)) continue;
    if (contact.phone && entry.line.includes(contact.phone)) continue;
    nameCandidates.push(entry.line);
    nameHits.push({
      ...entry,
      nameConfidence: confidenceForIdentitySource(entry.reason),
    });
  }

  if (nameHits.length) {
    nameHits.sort((a, b) => {
      const pa = identitySourcePriorityRank(a.reason);
      const pb = identitySourcePriorityRank(b.reason);
      if (pa !== pb) return pa - pb;
      const ia = a.lineIndex >= 0 ? a.lineIndex : 9999;
      const ib = b.lineIndex >= 0 ? b.lineIndex : 9999;
      return ia - ib;
    });
    const best = nameHits[0];
    name = best.line;
    nameConfidence = best.nameConfidence ?? confidenceForIdentitySource(best.reason);
    nameSource = best;
  }

  if (nameConfidence < IDENTITY_CONFIDENCE_MIN) {
    const fileHint = extractNameFromFileName(opts.fileName);
    if (fileHint && isAcceptablePersonName(fileHint, opts.experiences)) {
      name = fileHint;
      nameConfidence = 86;
      nameSource = { line: fileHint, lineIndex: -1, reason: 'filename_hint' };
    } else {
      name = '';
      nameSource = null;
    }
  }

  let title = '';
  let titleConfidence = 0;
  let titleSource = null;
  const titleCandidates = [];
  const nameIdx = nameSource?.lineIndex ?? -1;

  const titlePool = candidates.filter((entry) => {
    if (entry.line === name) return false;
    if (name && entry.line.includes(name)) return false;
    return true;
  });

  const orderedTitlePool =
    nameIdx >= 0
      ? [
          ...titlePool.filter((e) => e.lineIndex > nameIdx && e.lineIndex <= nameIdx + 4),
          ...titlePool.filter((e) => e.lineIndex < nameIdx || e.lineIndex > nameIdx + 4),
        ]
      : titlePool;

  for (const entry of orderedTitlePool) {
    if (!isValidIdentityTitle(entry.line)) continue;
    titleCandidates.push(entry.line);
    if (!title) {
      title = entry.line;
      titleConfidence =
        entry.lineIndex >= 0 && nameIdx >= 0 && entry.lineIndex === nameIdx + 1 ? 92 : 82;
      titleSource = entry;
      break;
    }
  }

  if (titleConfidence < IDENTITY_CONFIDENCE_MIN) {
    title = '';
    titleSource = null;
  }

  return {
    name,
    title,
    nameConfidence,
    titleConfidence,
    nameSource,
    titleSource,
    nameCandidates: [...new Set(nameCandidates)].slice(0, 3),
    titleCandidates: [...new Set(titleCandidates)].slice(0, 3),
  };
}

/**
 * Debug-friendly identity source report.
 * @param {ReturnType<typeof extractLockedIdentity>} identity
 */
export function formatIdentitySourceReport(identity) {
  const fmt = (label, src) => {
    if (!src?.line) return `${label} source:\n(empty — confidence below ${IDENTITY_CONFIDENCE_MIN}% or no valid line)`;
    const idx = src.lineIndex >= 0 ? src.lineIndex + 1 : '?';
    return `${label} source:\nline ${idx}\n"${src.line}"\n(${src.reason})`;
  };
  return [fmt('identity.name', identity.nameSource), fmt('identity.title', identity.titleSource)].join(
    '\n\n'
  );
}

/** @deprecated internal — keyword-only title generation disabled */
export function keywordTitleGenerationDisabled() {
  return true;
}

function identityNameNeedsRepair(name) {
  const n = String(name || '').trim();
  return !n || /nom à confirmer|confirmer/i.test(n);
}

/** OCR often drops the dot before TLD: `user@hotmail fr` → `user@hotmail.fr`. */
function normalizeOcrEmailBlob(blob) {
  return String(blob || '').replace(
    /@([a-z0-9][a-z0-9._-]*)\s+([a-z]{2,})\b/gi,
    '@$1.$2'
  );
}

function extractEmailFromBlob(blob) {
  const raw = String(blob || '');
  const normalized = normalizeOcrEmailBlob(raw);
  const fromRaw = extractEmailsFromSource(raw);
  if (fromRaw.length) return fromRaw[0].normalized;
  const fromNorm = extractEmailsFromSource(normalized);
  if (fromNorm.length) return fromNorm[0].normalized;
  const loose = raw.match(/\b([a-z0-9._%+-]+@[a-z0-9._-]+)\s+([a-z]{2,})\b/i);
  if (loose) return `${loose[1]}.${loose[2].replace(/\s+/g, '')}`.toLowerCase();
  return '';
}

/**
 * Resolve identity from high-confidence OCR signals (email local-part, repeated name tokens).
 * Kept in identity-extraction.js to avoid circular imports with import-repair / resume-data.
 * @param {object} identity
 * @param {string} blob
 */
export function repairIdentityFromOcrSignals(identity = {}, blob = '') {
  const raw = String(blob || '');
  const id = { ...(identity || {}) };

  if (!id.email || isUncertainIdentityEmail(id.email)) {
    const email = extractEmailFromBlob(raw);
    if (email) id.email = email;
  }

  if (identityNameNeedsRepair(id.name) || !isValidIdentityName(id.name)) {
    const lines = extractIdentityHeaderLines(raw.split(/\r?\n/), 24);
    for (const line of lines) {
      if (!line || line.length > 55) continue;
      if (EMAIL_RE.test(line) || PHONE_RE.test(line)) continue;
      if (URL_RE.test(line) && !/\b[A-ZÀ-Ö]{2,}\b/.test(line)) continue;
      if (lineIsClientList(line) || lineLooksLikeRole(line)) continue;
      if (
        /^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zà-öø-ÿ'-]+){1,3}$/.test(line) ||
        /^[A-ZÀ-ÖØ-Þ]{2,}(?:\s+[A-ZÀ-ÖØ-Þ]{2,}){1,3}$/.test(line)
      ) {
        if (isValidIdentityName(line)) {
          id.name = line;
          break;
        }
      }
    }
    if (!isValidIdentityName(id.name)) {
      for (const line of extractIdentityHeaderLines(raw.split(/\r?\n/), 24)) {
        const parts = line.split(/\s*[-–—]\s*/).map((p) => p.trim()).filter(Boolean);
        for (const part of parts) {
          const caps = part.match(PERSON_NAME_SEGMENT_RE);
          if (caps) {
            const candidate = `${caps[1]} ${caps[2].charAt(0)}${caps[2].slice(1).toLowerCase()}`;
            if (isValidIdentityName(candidate)) {
              id.name = candidate;
              break;
            }
          }
        }
        if (isValidIdentityName(id.name)) break;
      }
    }
    if (!isValidIdentityName(id.name) && id.email) {
      const hint = emailLocalPartNameHint(id.email);
      if (hint) {
        for (const line of extractIdentityHeaderLines(raw.split(/\r?\n/), 24)) {
          if (!line.toLowerCase().includes(hint)) continue;
          const m = line.match(PERSON_NAME_CAPS_SEGMENT_RE);
          if (m && isValidIdentityName(`${m[1]} ${m[2]}`)) {
            id.name = `${m[1]} ${m[2]}`;
            break;
          }
        }
      }
    }
  }

  return id;
}

export { ROLE_KEYWORDS };
