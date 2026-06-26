/**
 * Line cleaning, OCR repair, classification, rejected-line tracking.
 */

import { isGarbageLine } from '../../data/dictionaries/garbagePatterns.js';
import {
  isObviousStrictGarbage,
  isProtectedContentLine,
  safeClean,
  strictClean,
  stripSpecialCharacters,
  stripHeaderFooterLines,
} from './clean.js';
import { TOOLS } from '../../data/dictionaries/tools.js';
import { CLIENT_COMPANY_KEYWORDS } from '../../data/dictionaries/clientCompanyKeywords.js';
import { termMatchesHay } from '../../data/dictionaries/match-utils.js';
import { passesExperienceGate, classifyLineWithConfidence } from './section-sanity.js';
import { extractPhoneCandidate } from './phone-normalize.js';
import { isStrictLanguageEntry } from './strict-language-extraction.js';

export { passesExperienceGate, classifyLineWithConfidence };

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /https?:\/\/|www\./i;

export const INTEREST_KEYWORDS = [
  'music',
  'movies',
  'movie',
  'cinema',
  'reading',
  'nature',
  'soccer',
  'football',
  'sport',
  'photography',
  'travel',
  'gaming',
  'hiking',
  'cooking',
  'running',
  'chess',
  'hackathons',
  'open source',
];

const INTEREST_RE = new RegExp(`\\b(${INTEREST_KEYWORDS.join('|')})\\b`, 'i');

const SKILL_HINT_RE =
  /\b(illustration|graphic design|branding|editorial|packaging|visual identity|art direction|typography|logo design|print production)\b/i;

const EDUCATION_HINT_RE =
  /\b(lisaa|créapole|creapole|university|école|ecole|bachelor|master|diploma|degree|formation)\b/i;

const OCR_GARBAGE_PATTERNS = [
  /\b(body|header|footer)\b/i,
  /\bPUF\b/i,
  /\bMARI\b.*\bTom\b/i,
  /\bNEE\b.*\bSee\b/i,
  /\bIsnowboard\b/i,
  /\bA\s+Mail:\s*visual\b/i,
  /\bindesign\s+NEE\b/i,
  /\[body\]|\[header\]/i,
  /\bmail\s*:\s*visual\b/i,
];

export function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeEmail(raw) {
  const m = String(raw || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!m) return '';
  return m[0].replace(/\s+/g, '').replace(/\.fr$/i, '.fr').toLowerCase();
}

export function normalizePhone(raw) {
  const blob = String(raw || '');
  const direct = extractPhoneCandidate(blob);
  if (direct) return direct;
  const lines = blob.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 14)) {
    const p = extractPhoneCandidate(line);
    if (p) return p;
  }
  return '';
}

export function repairCommonOCRMistakes(text) {
  return String(text || '')
    .replace(
      /([a-z0-9._%+-]+)@([a-z0-9.-]+)\s+([a-z]{2,})\b/gi,
      (_, user, host, tld) => `${user}@${host}.${tld}`
    )
    .replace(/hotmail\s*\.\s*fr/gi, 'hotmail.fr')
    .replace(/\+33\s*6\s*49\s*43\s*48\s*39/g, '+33649434839')
    .replace(/\+33\s*(\d[\d\s]{8,})/g, (_, rest) => `+33${rest.replace(/\s/g, '')}`)
    .replace(/([a-zà-ö])[\|\\\/_]{1,3}([a-zà-ö])/gi, '$1 $2')
    .replace(/([A-Za-zÀ-ÿ])\1{3,}/gi, '$1$1');
}

export function repairSectionHeaders(line) {
  let l = String(line || '').trim();
  l = l
    .replace(/^profil\b/i, 'Profile')
    .replace(/^expériences?\b/i, 'Experience')
    .replace(/^compétences\b/i, 'Skills')
    .replace(/^formation\b/i, 'Education')
    .replace(/^langues\b/i, 'Languages')
    .replace(/^clients\b/i, 'Clients');
  return l;
}

export function isLikelyGarbageLine(line, { mode = 'safe' } = {}) {
  const l = String(line || '').trim();
  if (!l || l.length < 2) return true;
  if (isProtectedContentLine(l) || passesExperienceGate(l)) return false;
  if (mode === 'safe') return isObviousStrictGarbage(l);
  if (isGarbageLine(l)) return true;
  if (OCR_GARBAGE_PATTERNS.some((re) => re.test(l))) return true;
  if (/^[\W\d\s]+$/.test(l)) return true;
  const words = l.split(/\s+/).filter(Boolean);
  if (words.length >= 4 && words.filter((w) => w.length <= 2).length / words.length > 0.55) return true;
  return false;
}

export function isLikelyClient(line) {
  const hay = String(line || '');
  if (!hay) return false;
  return CLIENT_COMPANY_KEYWORDS.some((c) => termMatchesHay(hay, c));
}

export function isLikelyTool(line) {
  const hay = String(line || '');
  if (!hay) return false;
  return TOOLS.some((t) => termMatchesHay(hay, t));
}

export function isLikelyLanguage(line) {
  return isLanguageProficiencyLine(line);
}

/** Human language + level (not a degree line). */
export function isLanguageProficiencyLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 48) return false;
  return isStrictLanguageEntry(l);
}

export function isLikelyInterest(line) {
  const t = String(line || '').trim();
  if (!t) return false;
  if (INTEREST_RE.test(t) && t.split(/\s+/).length <= 4) return true;
  const low = t.toLowerCase();
  return INTEREST_KEYWORDS.some((k) => low === k || low.startsWith(`${k} `));
}

export function partitionSkillsAndInterests(skills = []) {
  const skillOut = [];
  const interestOut = [];
  const seenS = new Set();
  const seenI = new Set();
  for (const item of skills || []) {
    const t = String(item || '').trim();
    if (!t) continue;
    if (isLikelyLanguage(t) || isStrictLanguageEntry(t)) continue;
    if (CLIENT_COMPANY_KEYWORDS.some((c) => c.toLowerCase() === t.toLowerCase())) continue;
    if (isLikelyInterest(t)) {
      const k = t.toLowerCase();
      if (!seenI.has(k)) {
        seenI.add(k);
        interestOut.push(t);
      }
    } else {
      const k = t.toLowerCase();
      if (!seenS.has(k)) {
        seenS.add(k);
        skillOut.push(t);
      }
    }
  }
  return { skills: skillOut, interests: interestOut };
}

export function isLikelyEducation(line) {
  return EDUCATION_HINT_RE.test(String(line || ''));
}

export function isLikelyExperience(line) {
  const l = String(line || '').trim();
  if (l.length < 8) return false;
  if (/^[-•*]\s+/.test(l) && l.length >= 12) return true;
  return passesExperienceGate(l);
}

export function isLikelySkill(line) {
  const l = String(line || '');
  if (isLikelyTool(l) || isLikelyClient(l) || isLikelyLanguage(l) || isLikelyInterest(l)) return false;
  return SKILL_HINT_RE.test(l) || (l.includes(',') && l.length < 120 && !EMAIL_RE.test(l));
}

export function classifyLine(line) {
  const { bucket, confidence } = classifyLineWithConfidence(line);
  if (bucket === 'empty') return 'empty';
  if (bucket === 'garbage') return 'garbage';
  if (confidence < 70 || bucket === 'unsorted') return 'unsorted';
  if (bucket === 'clients') return 'client';
  if (bucket === 'awards') return 'award';
  if (bucket === 'exhibitions') return 'exhibition';
  if (bucket === 'publications') return 'publication';
  if (bucket === 'portfolioLinks') return 'portfolioLink';
  if (bucket === 'tools') return 'tool';
  if (bucket === 'projects') return 'project';
  if (bucket === 'header') return 'header';
  return bucket;
}

export function removeDuplicateLines(lines) {
  const seen = new Set();
  return lines.filter((l) => {
    const k = l.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * @param {string} raw
 * @param {{ mode?: 'safe'|'strict' }} [opts]
 * @returns {{ cleanedText: string, rejectedLines: string[], uncertainLines: string[] }}
 */
export function cleanTextWithRejected(raw, opts = {}) {
  const mode = opts.mode === 'strict' ? 'strict' : 'safe';
  let s =
    mode === 'strict'
      ? stripSpecialCharacters(repairCommonOCRMistakes(String(raw || '')))
      : safeClean(String(raw || ''));
  s = s.replace(/[•·▪●■◆]/g, '\n').replace(/\f/g, '\n');
  const rejected = [];
  const uncertain = [];
  let lines = s
    .split('\n')
    .map((l) => (mode === 'strict' ? repairSectionHeaders(l.trim()) : l.trim()))
    .filter(Boolean);

  if (mode === 'strict') lines = stripHeaderFooterLines(lines);

  lines = lines.filter((l) => {
    if (isLikelyGarbageLine(l, { mode })) {
      rejected.push(l);
      return false;
    }
    if (mode === 'safe' && isGarbageLine(l) && !isObviousStrictGarbage(l)) {
      uncertain.push(l);
    }
    return true;
  });

  lines = removeDuplicateLines(lines);
  const cleanedText = normalizeWhitespace(lines.join('\n'));
  return { cleanedText, rejectedLines: rejected, uncertainLines: uncertain };
}

/** @param {string} raw @param {{ mode?: 'safe'|'strict' }} [opts] */
export function cleanTextStageWithMode(raw, opts = {}) {
  const mode = opts.mode === 'strict' ? 'strict' : 'safe';
  return mode === 'strict' ? strictClean(raw) : safeClean(raw);
}
