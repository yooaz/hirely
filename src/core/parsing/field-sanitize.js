/**
 * Field-level sanitization — strip contact/OCR noise and segregate categories.
 */

import { CLIENT_COMPANY_KEYWORDS } from '../../data/dictionaries/clientCompanyKeywords.js';
import { termMatchesHay } from '../../data/dictionaries/match-utils.js';
import { isGarbageLine } from '../../data/dictionaries/garbagePatterns.js';
import { isLineCorruptedForExport } from './corruption-detector.js';
import { partitionSkillsAndInterests } from './line-cleaner.js';
import { passesExperienceGate, hasExperienceDate } from './section-sanity.js';
import { lineMatchesSchool } from '../../data/dictionaries/schools.js';

const EMAIL_SRC = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_SRC =
  /(?:\+?(?:33|31|32|1|41|49|34|39|44|352|353|351|358|45|46|47|48|39)[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}|\+\d{1,3}[\s.-]?\d[\d\s().-]{6,16}\d/gi;
const URL_SRC = /https?:\/\/[^\s)]+|www\.[^\s)]+/gi;
const LINKEDIN_SRC = /linkedin\.com\/[\w\-/]+/gi;

export const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
export const PHONE_RE =
  /(?:\+?(?:33|31|32|1|41|49|34|39|44|352|353|351|358|45|46|47|48|39)[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}|\+\d{1,3}[\s.-]?\d[\d\s().-]{6,16}\d/;
export const URL_RE = /https?:\/\/[^\s)]+|www\.[^\s)]+/i;

const CLIENT_LOWER = new Set(CLIENT_COMPANY_KEYWORDS.map((c) => c.toLowerCase()));

const OCR_FRAGMENT_RE =
  /(?:\b[a-z]{1,2}\s+){4,}|[|¦‖§¶†‡◆◇◈◉]|(?:\bNF\b|\bPs\b)|\bundefined\b|\bnull\b/i;

const SUMMARY_JUNK_RE =
  /^(profile|profil|summary|about|objective|contact|coordonnées|experience|skills?|tools?|languages?|education)\s*$/i;

/** Remove emails, phones, URLs from prose (not from dedicated contact fields). */
export function stripContactFromProse(text) {
  return String(text || '')
    .replace(EMAIL_SRC, ' ')
    .replace(PHONE_SRC, ' ')
    .replace(URL_SRC, ' ')
    .replace(LINKEDIN_SRC, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s|·•\-–—.,;:]+|[\s|·•\-–—.,;:]+$/g, '')
    .trim();
}

export function clientNamesInText(text) {
  const hay = String(text || '');
  if (!hay) return [];
  return CLIENT_COMPANY_KEYWORDS.filter((c) => termMatchesHay(hay, c));
}

export function lineIsClientList(line) {
  const hits = clientNamesInText(line);
  const words = String(line || '').split(/\s+/).filter(Boolean);
  return hits.length >= 2 || (words.length >= 2 && hits.length / words.length >= 0.45);
}

export function isOcrGarbageText(text) {
  const s = String(text || '').trim();
  if (!s || s.length < 4) return true;
  if (isLineCorruptedForExport(s)) return true;
  if (isGarbageLine(s)) return true;
  if (OCR_FRAGMENT_RE.test(s)) return true;
  if (SUMMARY_JUNK_RE.test(s)) return true;
  if (/\b[a-z]{3,}\s+hie\.?\s*je\b/i.test(s)) return true;
  if (/\b\w+\s+more\)$/i.test(s)) return true;
  if (/[a-z]{2,}\)\.?$/i.test(s) && s.length < 36) return true;
  if (/\w\)\.?$/.test(s) && s.length < 32 && !/\b(19|20)\d{2}\b/.test(s)) return true;
  const letters = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  if (letters / s.length < 0.35) return true;
  return false;
}

export function isValidSummaryField(text) {
  const s = stripContactFromProse(text);
  if (!s || s.length < 24 || s.length > 520) return false;
  if (isOcrGarbageText(s)) return false;
  if (lineIsClientList(s)) return false;
  if (EMAIL_RE.test(s) || PHONE_RE.test(s)) return false;
  return true;
}

const TITLE_FRAGMENT_RE =
  /^(a\s+mail|mail\s*:|e\s*mail\s*:|contact\s*info)\b|^visual\s+communication$/i;

const HEADER_SECTION_ANCHOR_RE =
  /^(education|formation|experience|skills?|tools?|languages?|clients?|projects?|summary|profile|contact)\s*$/i;

const EDU_URL_CONTAMINATION_RE =
  /https?:\/\/|www\.|instagram\.com|linkedin\.com|behance\.net|tumblr\.com|be\.net/i;

const EDU_OCR_NOISE_RE =
  /\bic\)\s*\w+|\bignfin\b|\b[a-z]{2,}\s+hie\.?\s*je\b|\)\s*yoaz|@\s*man\b/i;

export function isValidTitleField(text) {
  const s = String(text || '').trim();
  if (!s || s.length < 3 || s.length > 72) return false;
  if (HEADER_SECTION_ANCHOR_RE.test(s)) return false;
  if (isOcrGarbageText(s)) return false;
  if (TITLE_FRAGMENT_RE.test(s)) return false;
  if (EMAIL_RE.test(s) || PHONE_RE.test(s) || URL_RE.test(s)) return false;
  if (lineIsClientList(s) && !/\b(designer|illustrator|director)\b/i.test(s)) return false;
  return true;
}

export function isValidExperienceLine(text) {
  const s = String(text || '').trim();
  if (!s || s.length < 10 || s.length > 280) return false;
  if (isOcrGarbageText(s)) return false;
  if (EMAIL_RE.test(s)) return false;
  if (PHONE_RE.test(s) && !hasExperienceDate(s)) return false;
  if (lineIsClientList(s) && !EXPERIENCE_ROLE_RE.test(s)) return false;
  if (!passesExperienceGate(s)) return false;
  return true;
}

export function isValidListItem(text, { allowClients = false } = {}) {
  const s = String(text || '').trim().slice(0, 56);
  if (!s || s.length < 2) return false;
  try {
    return isValidListItemInner(s, allowClients);
  } catch {
    return s.length >= 2 && s.length <= 56;
  }
}

function isValidListItemInner(s, allowClients = false) {
  if (!s || s.length < 2 || s.length > 56) return false;
  if (isOcrGarbageText(s)) return false;
  if (!allowClients && CLIENT_LOWER.has(s.toLowerCase())) return false;
  if (!allowClients && lineIsClientList(s)) return false;
  return true;
}

export function isValidEducationItem(text) {
  const s = String(text || '').trim();
  if (!s || s.length < 3 || s.length > 120) return false;
  if (/^\s*(?:19|20)\d{2}\s*[–—-]\s*(?:(?:19|20)\d{2}|present|présent|current)\s*$/i.test(s)) {
    return true;
  }
  const commaParts = s.split(/[,;·]/).map((p) => p.trim()).filter((p) => p.length > 1);
  if (commaParts.length >= 3 && !/\b(19|20)\d{2}\b/.test(s) && !lineMatchesSchool(s)) {
    return false;
  }
  const structuredEducation =
    (lineMatchesSchool(s) || /universit|college|[eé]cole|institute|faculty/i.test(s)) &&
    /\b(19|20)\d{2}\b/.test(s) &&
    /\b(b\.?\s*s\.?|b\.?\s*a\.?|m\.?\s*s\.?c?\.?|mba|bachelor|master|licence|diploma|degree)\b/i.test(s);
  if (isOcrGarbageText(s) && !structuredEducation) return false;
  if (EDU_URL_CONTAMINATION_RE.test(s)) return false;
  if (EDU_OCR_NOISE_RE.test(s)) return false;
  if (EMAIL_RE.test(s)) return false;
  if (PHONE_RE.test(s) && !/\b(19|20)\d{2}\b/.test(s)) return false;
  const years = [...s.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => parseInt(m[1], 10));
  const maxYear = new Date().getFullYear() + 1;
  for (const y of years) {
    if (y < 1950 || y > maxYear) return false;
  }
  return true;
}

export const EXPERIENCE_ROLE_RE =
  /\b(freelance|illustrator|graphic\s+designer|designer|art\s+director|creative\s+director|product\s+designer|visual\s+designer|motion\s+designer|senior\s+designer|lead\s+designer|graphiste|directeur\s+artistique|directeur\s+créatif|illustrateur)\b/i;

export function sanitizeSummaryText(summary, knownContact = {}) {
  let s = stripContactFromProse(summary);
  if (knownContact.email) s = s.replace(knownContact.email, ' ');
  if (knownContact.phone) s = s.replace(knownContact.phone, ' ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return isValidSummaryField(s) ? s.slice(0, 520) : '';
}

/** Move brand names out of summary/skills/education into clients. */
export function segregateClientBrands(cvData) {
  const d = { ...cvData, interests: [...(cvData?.interests || [])] };
  const clients = new Set((d.clients || []).map((c) => c.trim()).filter(Boolean));

  if (lineIsClientList(d.summary)) {
    clientNamesInText(d.summary).forEach((c) => clients.add(c));
  }
  d.summary = sanitizeSummaryText(
    String(d.summary || '')
      .split(/\s+/)
      .filter((w) => !CLIENT_LOWER.has(w.replace(/[^A-Za-zÀ-ÿ]/g, '').toLowerCase()))
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim(),
    { email: d.email, phone: d.phone }
  );

  const stripClients = (arr) =>
    (arr || [])
      .map((x) => String(x || '').trim())
      .filter((x) => {
        if (!x) return false;
        if (CLIENT_LOWER.has(x.toLowerCase())) {
          const match = CLIENT_COMPANY_KEYWORDS.find((c) => c.toLowerCase() === x.toLowerCase());
          if (match) clients.add(match);
          return false;
        }
        if (lineIsClientList(x) && !isValidListItem(x, { allowClients: true })) {
          clientNamesInText(x).forEach((c) => clients.add(c));
          return false;
        }
        return true;
      });

  let skillsStripped = stripClients(d.skills).filter((x) => isValidListItem(x));
  const part = partitionSkillsAndInterests(skillsStripped);
  skillsStripped = part.skills;
  const interestMap = new Map((d.interests || []).map((x) => [String(x).toLowerCase(), x]));
  part.interests.forEach((x) => interestMap.set(x.toLowerCase(), x));
  d.interests = [...interestMap.values()].slice(0, 8);
  d.skills = skillsStripped;
  d.education = stripClients(d.education).filter((x) => isValidEducationItem(x));
  d.tools = (d.tools || []).filter((x) => isValidListItem(x));
  d.languages = (d.languages || []).filter((x) => isValidListItem(x));
  d.clients = [...clients].slice(0, 12);
  d.extra = (d.extra || []).filter((x) => isValidListItem(x) && !CLIENT_LOWER.has(x.toLowerCase()));

  return d;
}

export function structuredCompleteness(cvData) {
  const d = cvData || {};
  const sections = {
    name: !!(d.name && d.name.length > 1),
    title: !!(d.title && d.title.length > 1),
    contact: !!(d.email || d.phone),
    summary: !!(d.summary && d.summary.length > 20),
    experience: !!(d.experience && d.experience.length),
    clients: !!(d.clients && d.clients.length),
    education: !!(d.education && d.education.length),
    skills: !!(d.skills && d.skills.length),
    tools: !!(d.tools && d.tools.length),
    languages: !!(d.languages && d.languages.length),
  };
  const missing = Object.entries(sections)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  const filled = Object.values(sections).filter(Boolean).length;
  return { sections, missing, pct: Math.round((filled / Object.keys(sections).length) * 100) };
}
