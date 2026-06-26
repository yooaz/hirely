/**
 * EXPERIENCE_SEGMENTATION_ENGINE — split collapsed jobs into distinct experiences.
 *
 * Each experience requires: title, company, date range.
 * Split when: new company, new year range, or new title.
 */

import {
  isExperienceEntryStartLine,
  splitMergedExperienceByDates,
  parseExperienceEntryV2,
  extractExperienceDateRange,
  YEAR_RANGE_RE,
} from './experience-split-parser.js';
import { detectSectionHeaderId } from './section-detect-v2.js';
import { isSectionHeaderLine } from './rich-parser.js';

export const EXPERIENCE_SEGMENTATION_ENGINE = 'EXPERIENCE_SEGMENTATION_ENGINE';

const BULLET_RE = /^[-•*]\s+/;
const DATE_RANGE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|aujourd'?hui|actuel)\b/i;

const KNOWN_COMPANY_RE =
  /\b(mccann|nike|publicis|havas|betc|ddb|akqa|deloitte|stripe|dropbox|monzo|arup|salesforce|cloudscale|independent|freelance)\b/i;

const PROJECT_CLIENT_RE = /\b([\w][\w\s&.'-]{0,40}?\s+projects?|client\s+projects?|brand\s+campaigns?)\b/i;

/** Full V2 parse during segmentation caused browser stack overflow — use lightweight sig only. */
let experienceSegmentationActive = false;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function normKey(s) {
  return normSpace(s).toLowerCase();
}

function isHardBoundaryLine(line) {
  const l = String(line || '').trim();
  if (!l) return true;
  if (detectSectionHeaderId(l)) return true;
  if (isSectionHeaderLine(l)) return true;
  return false;
}

/**
 * Company-only header (e.g. "Agency Paris", "Client projects").
 * @param {string} line
 */
export function isCompanyHeaderLine(line) {
  const l = normSpace(line);
  if (!l || l.length > 96) return false;
  if (BULLET_RE.test(l)) return false;
  if (DATE_RANGE_RE.test(l)) return false;
  if (PROJECT_CLIENT_RE.test(l)) return true;
  if (KNOWN_COMPANY_RE.test(l) && l.split(/\s+/).length <= 5) return true;
  if (
    /^[A-ZÀ-Ö][\w&.'-]+(?:\s+[A-ZÀ-Ö][\w&.'-]+){0,3}$/.test(l) &&
    !/\b(designer|illustrator|developer|engineer|manager|director|freelance)\b/i.test(l)
  ) {
    return true;
  }
  return false;
}

/**
 * @param {string} line
 */
function lightweightExperienceSignature(text) {
  const dates = extractExperienceDateRange(text);
  const parts = text.split(/\s*[-–—|·]\s*/).map((p) => normSpace(p)).filter(Boolean);
  let title = '';
  let company = '';

  if (PROJECT_CLIENT_RE.test(text)) {
    const projectMatch = text.match(/\b([\w][\w\s&.'-]{0,40}?)\s+projects?\b/i);
    company =
      parts.find((p) => PROJECT_CLIENT_RE.test(p)) ||
      (projectMatch ? normSpace(projectMatch[0]) : 'Client projects');
    title = parts.find((p) => !PROJECT_CLIENT_RE.test(p) && !DATE_RANGE_RE.test(p)) || 'Illustrator';
  } else if (parts.length >= 2) {
    title = parts[0] || '';
    company = parts.find((p) => KNOWN_COMPANY_RE.test(p) && !DATE_RANGE_RE.test(p)) || parts[1] || '';
  } else if (isCompanyHeaderLine(text)) {
    company = text;
  }

  return {
    title,
    company,
    startDate: dates.startDate || '',
    endDate: dates.endDate || '',
  };
}

export function extractExperienceSignature(line) {
  const text = normSpace(line);
  if (!text) {
    return { title: '', company: '', startDate: '', endDate: '' };
  }

  if (!experienceSegmentationActive) {
    const entry = parseExperienceEntryV2([text]);
    if (entry?.title || entry?.company || entry?.startDate) {
      return {
        title: entry.title || entry.role || '',
        company: entry.company || '',
        startDate: entry.startDate || '',
        endDate: entry.endDate || '',
      };
    }
  }

  return lightweightExperienceSignature(text);
}

/**
 * Lightweight group parse — no buildExperienceEntryFromLineGroup (browser stack safe).
 * @param {string[]} group
 */
export function parseExperienceGroupLight(group) {
  const lines = (group || []).map((l) => String(l || '').trim()).filter(Boolean);
  if (!lines.length) return null;

  const blob = lines.join(' ');
  const dates = extractExperienceDateRange(blob);
  const sig = lightweightExperienceSignature(blob);
  const title = normSpace(sig.title || '');
  const company = normSpace(sig.company || '');
  const startDate = dates.startDate || sig.startDate || '';
  const endDate = dates.endDate || sig.endDate || '';

  if (!startDate || (!title && !company)) return null;

  return {
    title,
    role: title,
    company,
    startDate,
    endDate,
    dates: startDate ? `${startDate}–${endDate || 'Present'}` : '',
    description: '',
    bullets: [],
    location: '',
    confidence: 72,
  };
}

/**
 * @param {{title:string,company:string,startDate:string,endDate:string}} prev
 * @param {{title:string,company:string,startDate:string,endDate:string}} next
 * @param {string} nextLine
 */
export function shouldSplitExperienceSegment(prev, next, nextLine = '') {
  if (!prev || (!prev.title && !prev.company && !prev.startDate)) return false;
  if (isExperienceEntryStartLine(nextLine)) return true;
  if (isCompanyHeaderLine(nextLine)) return true;

  const prevCo = normKey(prev.company);
  const nextCo = normKey(next.company);
  if (prevCo && nextCo && prevCo !== nextCo) return true;

  if (prev.startDate && next.startDate && prev.startDate !== next.startDate) return true;
  if (prev.endDate && next.endDate && prev.endDate !== next.endDate) return true;

  const prevTitle = normKey(prev.title);
  const nextTitle = normKey(next.title);
  if (prevTitle && nextTitle && prevTitle !== nextTitle && (next.startDate || DATE_RANGE_RE.test(nextLine))) {
    return true;
  }

  return false;
}

function mergeGroupSignature(sig, line) {
  const next = extractExperienceSignature(line);
  return {
    title: sig?.title || next.title,
    company: sig?.company || next.company,
    startDate: sig?.startDate || next.startDate,
    endDate: sig?.endDate || next.endDate,
  };
}

/**
 * @param {string[]|string} input
 */
export function segmentExperienceInput(input) {
  experienceSegmentationActive = true;
  try {
  return segmentExperienceInputInner(input);
  } finally {
    experienceSegmentationActive = false;
  }
}

function segmentExperienceInputInner(input) {
  const rawLines = Array.isArray(input)
    ? input.flatMap((item) => {
        const text = String(item || '').trim();
        if (!text) return [];
        return text.includes('\n') ? text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [text];
      })
    : String(input || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

  const expanded = [];
  for (const line of rawLines) {
    for (const part of splitMergedExperienceByDates(line)) {
      if (part.length >= 4) expanded.push(part);
    }
  }

  const groups = [];
  let current = [];
  let currentSig = null;

  const pushCurrent = () => {
    if (current.length) groups.push([...current]);
    current = [];
    currentSig = null;
  };

  for (const line of expanded) {
    if (isHardBoundaryLine(line)) {
      pushCurrent();
      continue;
    }

    const lineSig = extractExperienceSignature(line);
    if (
      current.length &&
      (shouldSplitExperienceSegment(currentSig, lineSig, line) || isExperienceEntryStartLine(line))
    ) {
      pushCurrent();
    }

    if (!current.length) current = [line];
    else current.push(line);
    currentSig = mergeGroupSignature(currentSig, line);
  }

  pushCurrent();
  return groups.filter((g) => g.length);
}

/**
 * @param {object} entry
 */
export function experienceEntryComplete(entry) {
  if (!entry) return false;
  const title = normSpace(entry.title || entry.role);
  const company = normSpace(entry.company);
  const hasDate = !!(entry.startDate || entry.dates || entry.endDate);
  return !!(title && company && hasDate);
}

/**
 * @param {string[]|string|Array<string|object>} input
 */
export function parseSegmentedExperiences(input) {
  const rawLines = [];
  for (const raw of Array.isArray(input) ? input : [input]) {
    if (raw && typeof raw === 'object') {
      const text = [raw.role, raw.company, raw.dates || raw.startDate, ...(raw.bullets || [])]
        .filter(Boolean)
        .join(' — ');
      if (text) rawLines.push(text);
      continue;
    }
    const text = String(raw || '').trim();
    if (!text) continue;
    if (text.includes('\n')) rawLines.push(...text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
    else rawLines.push(text);
  }

  const groups = segmentExperienceInput(rawLines);
  const entries = [];
  const seen = new Set();

  for (const group of groups) {
    const entry = parseExperienceGroupLight(group);
    if (!entry) continue;

    if (/\bfreelanc/i.test(entry.title || entry.role) && !entry.company) {
      entry.company = 'Independent / Freelance';
    }
    if (PROJECT_CLIENT_RE.test(group.join(' ')) && !entry.company) {
      const projectMatch = group.join(' ').match(/\b([\w][\w\s&.'-]{0,40}?)\s+projects?\b/i);
      entry.company = projectMatch ? normSpace(projectMatch[0]) : 'Client projects';
    }

    let title = entry.title || entry.role || '';
    if (PROJECT_CLIENT_RE.test(title)) {
      title = title
        .replace(PROJECT_CLIENT_RE, '')
        .replace(/\s*[-–—|·]\s*/g, ' ')
        .trim();
    }
    if (!title && PROJECT_CLIENT_RE.test(group.join(' '))) {
      title = 'Illustrator';
    }

    const normalized = {
      title,
      company: entry.company || '',
      startDate: entry.startDate || '',
      endDate: entry.endDate || '',
      description: entry.description || '',
      role: entry.title || entry.role || '',
      location: entry.location || '',
      dates: entry.dates || '',
      bullets: entry.bullets || [],
      confidence: entry.confidence ?? 0,
      parser: EXPERIENCE_SEGMENTATION_ENGINE,
    };

    if (!experienceEntryComplete(normalized)) continue;

    const key = `${normKey(normalized.title)}|${normKey(normalized.company)}|${normalized.startDate}`;
    if (!key.replace(/\|/g, '').length || seen.has(key)) continue;
    seen.add(key);
    entries.push(normalized);
  }

  return {
    engine: EXPERIENCE_SEGMENTATION_ENGINE,
    entries,
    count: entries.length,
  };
}

/**
 * @param {object} cvData
 */
export function applyExperienceSegmentation(cvData) {
  if (!cvData || typeof cvData !== 'object') return cvData;
  const d = { ...cvData };
  const result = parseSegmentedExperiences(d.experience || []);
  if (!result.count) return d;

  d.experience = result.entries.map((e) => {
    const dates = e.dates || [e.startDate, e.endDate].filter(Boolean).join('–');
    return [e.title, e.company, dates].filter(Boolean).join(' — ');
  });
  d._experienceSegmentation = EXPERIENCE_SEGMENTATION_ENGINE;
  d._experienceMeta = result.entries.map((e) => ({
    role: e.title,
    company: e.company,
    dates: e.dates,
    startDate: e.startDate,
    endDate: e.endDate,
    confidence: e.confidence,
  }));
  return d;
}

export { YEAR_RANGE_RE };
