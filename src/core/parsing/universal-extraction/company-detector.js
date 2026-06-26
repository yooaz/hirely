/**
 * UNIVERSAL_COMPANY_DETECTOR — context-based employer detection (no brand dictionary required).
 */
import { detectDatesInText } from './date-detector.js';
import { UNIVERSAL_COMPANY_DETECTOR } from './types.js';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL_RE = /https?:\/\/|www\./i;
const BULLET_RE = /^[-•*]\s+/;

const ORG_SUFFIX_RE =
  /\b(inc\.?|ltd\.?|llc|gmbh|corp\.?|corporation|company|co\.?|group|holdings|ag|sa|sarl|sas|bv|plc|studio|studios|agency|agence|partners|consulting|consultancy)\b/i;

const FREELANCE_RE =
  /\b(freelance|freelancer|independent|self[- ]?employed|contractor|sole\s+proprietor|auto[- ]?entrepreneur)\b/i;

const SECTION_HEADER_RE =
  /^(experience|work experience|employment|education|skills|tools|languages|projects|clients|summary|profile|contact)\b/i;

const TOOL_ONLY_RE =
  /\b(photoshop|illustrator|indesign|figma|after effects|premiere|javascript|python|sql|excel|word|powerpoint)\b/i;

function titleCaseRatio(text) {
  const words = String(text || '')
    .split(/\s+/)
    .filter((w) => w.length > 1);
  if (!words.length) return 0;
  const capped = words.filter((w) => /^[A-ZÀ-Ö]/.test(w) && !/^(The|And|For|With|At|In|De|La|Le|Les)$/i.test(w));
  return capped.length / words.length;
}

function looksLikeProperNounPhrase(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 2 || t.length > 80) return false;
  if (EMAIL_RE.test(t) || URL_RE.test(t) || BULLET_RE.test(t)) return false;
  if (SECTION_HEADER_RE.test(t)) return false;
  if (TOOL_ONLY_RE.test(t) && t.split(/\s+/).length <= 2) return false;
  const ratio = titleCaseRatio(t);
  if (ratio >= 0.5 && t.split(/\s+/).length <= 6) return true;
  if (ORG_SUFFIX_RE.test(t)) return true;
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}$/.test(t)) return true;
  return false;
}

/**
 * @param {string} line
 * @param {{ before?: string, after?: string, hasDate?: boolean, hasRole?: boolean }} [ctx]
 */
export function detectCompanyInLine(line, ctx = {}) {
  const raw = String(line || '').trim();
  if (!raw || raw.length < 2) {
    return { company: '', confidence: 0, engine: UNIVERSAL_COMPANY_DETECTOR };
  }

  if (FREELANCE_RE.test(raw)) {
    const label = /independent/i.test(raw) ? 'Independent / Freelance' : 'Freelance';
    return { company: label, confidence: 0.9, engine: UNIVERSAL_COMPANY_DETECTOR, kind: 'freelance' };
  }

  // Strip dates and bullets for company residue
  const dates = detectDatesInText(raw);
  let residue = raw
    .replace(/\b((?:19|20)\d{2})\s*[-–—→]\s*((?:19|20)\d{2}|present|présent|current|now)\b/gi, ' ')
    .replace(BULLET_RE, '')
    .replace(/\s+/g, ' ')
    .trim();

  // "Role — Company" or "Company | Role"
  const dashParts = residue.split(/\s*[—–|@]\s*/).map((p) => p.trim()).filter(Boolean);
  if (dashParts.length >= 2) {
    for (const part of dashParts) {
      if (looksLikeProperNounPhrase(part) && !/\b(designer|developer|engineer|manager|director|illustrator)\b/i.test(part)) {
        return { company: part, confidence: 0.82, engine: UNIVERSAL_COMPANY_DETECTOR };
      }
    }
    if (looksLikeProperNounPhrase(dashParts[0])) {
      return { company: dashParts[0], confidence: 0.72, engine: UNIVERSAL_COMPANY_DETECTOR };
    }
  }

  if (dates.startDate && residue.length >= 2) {
    residue = residue.replace(/\b((?:19|20)\d{2})\b/g, '').replace(/\s+/g, ' ').trim();
  }

  if (looksLikeProperNounPhrase(residue)) {
    let conf = 0.55 + titleCaseRatio(residue) * 0.25;
    if (ctx.hasDate) conf += 0.1;
    if (ctx.hasRole) conf += 0.08;
    if (ORG_SUFFIX_RE.test(residue)) conf += 0.12;
    return { company: residue, confidence: Math.min(0.95, conf), engine: UNIVERSAL_COMPANY_DETECTOR };
  }

  // Single capitalized token (Nike, Adobe, Marvel, Google, Meta)
  const single = residue.match(/^([A-Z][A-Za-z0-9&.'-]{1,28})$/);
  if (single && !/\b(19|20)\d{2}\b/.test(single[1])) {
    return { company: single[1], confidence: 0.68, engine: UNIVERSAL_COMPANY_DETECTOR };
  }

  return { company: '', confidence: 0, engine: UNIVERSAL_COMPANY_DETECTOR };
}
