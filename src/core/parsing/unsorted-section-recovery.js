/**
 * Recover structured sections from unsorted lines when section headers were lost upstream.
 */

import { fuzzySectionKey } from './section-fuzzy.js';
import { splitBySectionHeaders } from './section-mapper.js';
import { splitListItems } from './rich-parser.js';
import { passesExperienceGate } from './line-cleaner.js';
import {
  parseEducationLineWithContact,
  parseFreelanceCareerLine,
  parseInternshipLine,
  parseUrlMergedExperienceLine,
} from './classification-fixes.js';
import { hasUrlOrDomainSignal } from './ocr-classification-rules.js';
import { parseStrictExperiencesFromLines } from './experience-parser.js';
import { extractDateRangeFromText } from './parser-recovery.js';
import { isValidEducationItem } from './field-sanitize.js';
import {
  extractStrictLanguageLine,
  isStrictLanguageEntry,
} from './strict-language-extraction.js';
import { applySkillsRoutingPass } from './skills-routing.js';

function normalizeLanguageLine(line) {
  const result = extractStrictLanguageLine(line);
  return result.ok ? result.display : '';
}

const RECOVERABLE_SECTIONS = new Set([
  'experience',
  'education',
  'skills',
  'tools',
  'languages',
]);

const DEGREE_MARKERS_RE =
  /\b(b\.?\s*s\.?|b\.?\s*a\.?|m\.?\s*s\.?c?\.?|m\.?\s*b\.?\s*a\.?|mba|ph\.?\s*d\.?|bachelor|master|diploma|licence|license)\b/i;

const UNIVERSITY_MARKERS_RE =
  /\b(university|college|institute|école|ecole|school|academy|polytechnic)\b/i;

const EXPERIENCE_ROLE_MARKERS_RE =
  /\b(engineer|developer|manager|director|analyst|consultant|recruiter|designer|illustrator|executive|specialist|coordinator|lead|senior|intern)\b/i;

const LANGUAGE_LINE_RE =
  /\b(english|french|spanish|german|dutch|italian|portuguese|mandarin|arabic|français|anglais|espagnol|allemand)\b/i;

const SKIP_LINE_RE =
  /^\(missing\s+(experience|education|skills?|tools?|languages?)\)/i;

function pushUnique(list, item) {
  const s = String(item || '').trim();
  if (!s) return list;
  const k = s.toLowerCase();
  if (list.some((x) => String(x).trim().toLowerCase() === k)) return list;
  return [...list, s];
}

function isExperienceLine(line) {
  const s = String(line || '').trim();
  if (!s || s.length < 12) return false;
  if (/^[-•*]\s+/.test(s)) return false;
  if (!/\b(19|20)\d{2}\b/.test(s)) return false;
  if (!EXPERIENCE_ROLE_MARKERS_RE.test(s)) return false;
  if (UNIVERSITY_MARKERS_RE.test(s) && DEGREE_MARKERS_RE.test(s)) return false;
  return passesExperienceGate(s) || /\s[—–-]\s/.test(s);
}

function isGenericEducationLine(line) {
  const s = String(line || '').trim();
  if (!s || s.length < 8) return false;
  if (hasUrlOrDomainSignal(s)) return false;
  if (isExperienceLine(s)) return false;
  if (!/\b(19|20)\d{2}\b/.test(s)) return false;
  if (parseEducationLineWithContact(s)?.education) return true;
  if (DEGREE_MARKERS_RE.test(s)) return true;
  if (UNIVERSITY_MARKERS_RE.test(s)) return true;
  const parts = s.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2 && parts.length <= 4 && !EXPERIENCE_ROLE_MARKERS_RE.test(parts[0])) {
    return isValidEducationItem(s);
  }
  return false;
}

function isLanguageLine(line) {
  const s = String(line || '').trim();
  if (!s || s.length > 56) return false;
  return LANGUAGE_LINE_RE.test(s) && isStrictLanguageEntry(s);
}

function experienceKey(exp) {
  return `${exp.role || ''}|${exp.company || ''}|${exp.startDate || ''}`.toLowerCase();
}

function mergeExperiences(existing, incoming) {
  const out = [...(existing || [])];
  const seen = new Set(out.map(experienceKey));
  for (const exp of incoming || []) {
    const key = experienceKey(exp);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(exp);
  }
  return out;
}

function parseExperiencesFromLines(lines) {
  const strict = parseStrictExperiencesFromLines(lines || []);
  if (strict.experiences?.length) return strict.experiences;

  const out = [];
  for (const line of lines || []) {
    const s = String(line || '').trim();
    const urlMerged = parseUrlMergedExperienceLine(s);
    if (urlMerged) {
      out.push({ ...urlMerged, clients: [], location: '' });
      continue;
    }
    if (!isExperienceLine(s)) continue;
    const freelance = parseFreelanceCareerLine(s);
    if (freelance) {
      out.push({ ...freelance, clients: [], location: '' });
      continue;
    }
    const intern = parseInternshipLine(s);
    if (intern) {
      out.push({ ...intern, clients: [], location: '' });
      continue;
    }
    const dates = extractDateRangeFromText(s);
    const withoutDates = s.replace(/\b(19|20)\d{2}\s*[-–—]\s*(?:\d{4}|present|présent|current|now)\b/gi, '').trim();
    const parts = withoutDates.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      out.push({
        role: parts[0],
        company: parts[1],
        location: parts.length > 2 ? parts[2] : '',
        startDate: dates.startDate || '',
        endDate: dates.endDate || '',
        dates: dates.startDate ? `${dates.startDate}–${dates.endDate || 'Present'}` : '',
        bullets: [],
        clients: [],
      });
    }
  }
  return out;
}

function recoverFromRawTextBlocks(rd) {
  const raw = String(rd.meta?.rawText || rd.meta?.cleanedText || '').trim();
  if (!raw) return rd;

  rd = applySkillsRoutingPass(rd);

  const blocks = splitBySectionHeaders(raw);

  for (const line of blocks.education || []) {
    const s = String(line || '').trim();
    if (!s || !isGenericEducationLine(s)) continue;
    const edu = parseEducationLineWithContact(s)?.education || s;
    rd.education = pushUnique(rd.education, edu);
  }

  for (const line of blocks.skills || []) {
    for (const item of splitListItems(line)) rd.skills = pushUnique(rd.skills, item);
  }

  for (const line of blocks.tools || []) {
    for (const item of splitListItems(line)) rd.tools = pushUnique(rd.tools, item);
  }

  for (const line of blocks.languages || []) {
    const norm = normalizeLanguageLine(line);
    if (norm) rd.languages = pushUnique(rd.languages, norm);
  }

  for (const line of blocks.experience || []) {
    const s = String(line || '').trim();
    if (!s || /^[-•*]\s+/.test(s)) continue;
    if (isExperienceLine(s)) {
      rd.experiences = mergeExperiences(rd.experiences, parseExperiencesFromLines([s]));
    }
  }

  return rd;
}

/**
 * @param {import('../resume-data.js').ResumeData} rd
 * @returns {import('../resume-data.js').ResumeData}
 */
export function recoverSectionsFromUnsorted(rd) {
  if (!rd) return rd;
  rd = recoverFromRawTextBlocks(rd);
  if (!(rd.unsorted || []).length) return rd;

  const remaining = [];
  let section = null;

  for (const raw of rd.unsorted) {
    const line = String(raw || '').trim();
    if (!line || SKIP_LINE_RE.test(line)) continue;

    const headerKey = fuzzySectionKey(line.replace(/[:：]\s*$/, ''));
    if (headerKey && RECOVERABLE_SECTIONS.has(headerKey)) {
      section = headerKey;
      const inline = line.match(/^[^:]+:\s*(.+)$/);
      if (inline?.[1]?.trim()) {
        for (const item of splitListItems(inline[1])) {
          if (headerKey === 'skills') rd.skills = pushUnique(rd.skills, item);
          else if (headerKey === 'tools') rd.tools = pushUnique(rd.tools, item);
        }
      }
      continue;
    }

    if (/^(summary|profile|interests?|contact)$/i.test(line)) {
      section = null;
      remaining.push(line);
      continue;
    }

    const urlMerged = parseUrlMergedExperienceLine(line);
    if (urlMerged) {
      rd.experiences = mergeExperiences(rd.experiences, [
        { ...urlMerged, clients: [], location: '' },
      ]);
      continue;
    }

    if (section === 'skills') {
      for (const item of splitListItems(line)) rd.skills = pushUnique(rd.skills, item);
      continue;
    }

    if (section === 'tools') {
      for (const item of splitListItems(line)) rd.tools = pushUnique(rd.tools, item);
      continue;
    }

    if (section === 'languages') {
      const norm = normalizeLanguageLine(line);
      if (norm) rd.languages = pushUnique(rd.languages, norm);
      continue;
    }

    if (section === 'education') {
      const edu = parseEducationLineWithContact(line)?.education || (isGenericEducationLine(line) ? line : '');
      if (edu) {
        rd.education = pushUnique(rd.education, edu);
        continue;
      }
    }

    if (section === 'experience') {
      if (/^[-•*]\s+/.test(line)) continue;
      if (isExperienceLine(line)) {
        rd.experiences = mergeExperiences(rd.experiences, parseExperiencesFromLines([line]));
        continue;
      }
    }

    if (isGenericEducationLine(line)) {
      const edu = parseEducationLineWithContact(line)?.education || line;
      rd.education = pushUnique(rd.education, edu);
      continue;
    }

    if (isLanguageLine(line)) {
      const norm = normalizeLanguageLine(line);
      if (norm) rd.languages = pushUnique(rd.languages, norm);
      continue;
    }

    if (isExperienceLine(line)) {
      rd.experiences = mergeExperiences(rd.experiences, parseExperiencesFromLines([line]));
      continue;
    }

    remaining.push(line);
  }

  rd.unsorted = remaining;
  return rd;
}
