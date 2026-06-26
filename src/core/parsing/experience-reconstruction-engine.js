/**
 * EXPERIENCE_RECONSTRUCTION_ENGINE — recover distinct professional experiences.
 *
 * Detects role, company, dates, location; splits merged OCR blocks;
 * never merges freelance, internship, agency, and permanent roles.
 */

import { extractDateRangeFromText, titleCaseProfessional } from './parser-recovery.js';
import {
  buildExperienceEntryFromLineGroup,
  normalizeExperienceRole,
  scoreStrictExperienceEntry,
  qualifiesStrictExperience,
} from './experience-parser.js';
import {
  DATE_RANGE_RE,
  FREELANCE_RE,
  INTERNSHIP_RE,
  ORGANIZATION_CONTEXT_RE,
} from './generic-career-signals.js';
import { isValidExperienceLine } from './field-sanitize.js';
import {
  splitMergedExperienceByDates,
  extractExperienceDateRange,
} from './experience-split-parser.js';
import {
  parseSegmentedExperiences,
  parseExperienceGroupLight,
  EXPERIENCE_SEGMENTATION_ENGINE,
  experienceEntryComplete,
} from './experience-segmentation-engine.js';

export const EXPERIENCE_RECONSTRUCTION_ENGINE = 'EXPERIENCE_RECONSTRUCTION_ENGINE';

export const EMPLOYMENT_KIND = {
  FREELANCE: 'freelance',
  INTERNSHIP: 'internship',
  AGENCY: 'agency',
  PERMANENT: 'permanent',
};

const YEAR_RANGE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|actuel|aujourd'?hui)\b/gi;

const AGENCY_RE =
  /\b(agency|agence|mccann|publicis|havas|betc|ddb|akqa|ogilvy|wpp|studio|studios)\b/i;

const LOCATION_RE =
  /\b(paris|london|new york|san francisco|berlin|lyon|remote|montréal|montreal|amsterdam|bruxelles|brussels|milan|tokyo|singapore|zurich|genève|geneva)\b/i;

const SPLIT_BOUNDARY_RE =
  /\s*(?:·{2,}|•|\|{2,}|\/{2,}|(?<=[a-zà-ÿ0-9])\s{2,}(?=[A-ZÀ-Ö]))\s*|\s+—\s+(?=(?:internship|intern\b|stage\b|freelance|illustrator|designer|developer|engineer|consultant|manager)\b)/i;

const BULLET_LINE_RE = /^[-•*]\s+/;
const BULLET_ACTION_RE =
  /^\s*[-•*]?\s*(led|built|facilitated|managed|designed|delivered|created|implemented|supported|coordinated|analyzed|researched)\b/i;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function normKeyPart(s) {
  return normSpace(s).toLowerCase();
}

function isFreelanceEngagement(blob, role = '') {
  const text = normSpace(blob);
  const r = normSpace(role);
  if (/\b(freelance|freelancer|self[- ]?employed|independent\s*\/|contractor)\b/i.test(text)) {
    return true;
  }
  if (/\bconsultant\b/i.test(r) && !/\bfreelance\b/i.test(text)) return false;
  if (/\b(strategy\s+firm|deloitte|mckinsey|bain|bcg|accenture|kpmg|pwc|ey)\b/i.test(text)) {
    return false;
  }
  return FREELANCE_RE.test(text);
}

function isBulletOnlySegment(text) {
  const t = normSpace(text);
  if (!t) return true;
  if (BULLET_LINE_RE.test(t) || BULLET_ACTION_RE.test(t)) return true;
  if (!DATE_RANGE_RE.test(t) && !/\b(19|20)\d{2}\b/.test(t) && /\b(led|built|facilitated|managed)\b/i.test(t)) {
    return true;
  }
  return false;
}

function inferCompanyFromDashParts(text) {
  const parts = String(text || '')
    .split(/\s*—\s*/)
    .map((p) => normSpace(p))
    .filter(Boolean);
  if (parts.length < 3) return { role: '', company: '' };

  const dateIdx = parts.findIndex(
    (p) => DATE_RANGE_RE.test(p) || /^\d{4}\s*[-–—]/.test(p) || /^\d{4}$/.test(p)
  );
  if (dateIdx < 2) return { role: '', company: '' };

  const role = parts[0];
  const beforeDate = parts.slice(1, dateIdx);
  const nonLocation = beforeDate.filter((p) => !LOCATION_RE.test(p));
  const company = nonLocation[0] || beforeDate[beforeDate.length - 1] || '';
  return { role, company };
}

/**
 * @param {object} entry
 */
export function classifyEmploymentKind(entry) {
  const blob = normSpace(
    [entry?.role, entry?.company, entry?.description, entry?.dates, ...(entry?.bullets || [])].join(' ')
  );
  if (INTERNSHIP_RE.test(blob)) return EMPLOYMENT_KIND.INTERNSHIP;
  if (isFreelanceEngagement(blob, entry?.role)) return EMPLOYMENT_KIND.FREELANCE;
  if (AGENCY_RE.test(blob) || ORGANIZATION_CONTEXT_RE.test(blob)) return EMPLOYMENT_KIND.AGENCY;
  return EMPLOYMENT_KIND.PERMANENT;
}

/**
 * @param {object} entry
 */
export function detectExperienceLocation(entry, context = '') {
  const blob = normSpace([entry?.location, entry?.company, entry?.role, context].join(' '));
  const m = blob.match(LOCATION_RE);
  return m ? titleCaseProfessional(m[0]) : normSpace(entry?.location || '');
}

/**
 * @param {object} entry
 * @param {string} [context]
 */
export function scoreExperienceConfidence(entry, context = '') {
  let score = scoreStrictExperienceEntry(entry, context);
  if (entry?.role) score += 8;
  if (entry?.company) score += 10;
  if (entry?.startDate || entry?.dates) score += 12;
  if (entry?.location) score += 6;
  if (entry?.bullets?.length) score += Math.min(entry.bullets.length * 4, 12);
  return Math.min(99, Math.max(0, Math.round(score)));
}

/**
 * @param {object} a
 * @param {object} b
 */
export function mustNeverMergeExperiences(a, b) {
  if (!a || !b) return false;
  if (classifyEmploymentKind(a) !== classifyEmploymentKind(b)) return true;

  const da = extractDateRangeFromText(`${a.startDate} ${a.endDate} ${a.dates}`);
  const db = extractDateRangeFromText(`${b.startDate} ${b.endDate} ${b.dates}`);
  if (da.startDate && db.startDate && da.startDate !== db.startDate) return true;
  if (da.endDate && db.endDate && da.endDate !== db.endDate && !/present/i.test(da.endDate) && !/present/i.test(db.endDate)) {
    return true;
  }

  const ca = normKeyPart(a.company);
  const cb = normKeyPart(b.company);
  if (ca && cb && ca !== cb) return true;

  const ra = normKeyPart(a.role);
  const rb = normKeyPart(b.role);
  if (ra && rb && ra !== rb && !rolesAreCompatible(ra, rb)) return true;

  return false;
}

function rolesAreCompatible(a, b) {
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const tokensA = new Set(a.split(/\s+/).filter((t) => t.length > 3));
  const tokensB = new Set(b.split(/\s+/).filter((t) => t.length > 3));
  let overlap = 0;
  for (const t of tokensA) if (tokensB.has(t)) overlap++;
  return overlap >= 1;
}

function experienceToLines(raw) {
  if (raw && typeof raw === 'object') {
    return [raw.role, raw.company, raw.location, raw.dates || raw.startDate, ...(raw.bullets || [])]
      .map((x) => normSpace(x))
      .filter(Boolean);
  }
  return [normSpace(raw)].filter(Boolean);
}

function experienceToText(raw) {
  return experienceToLines(raw).join(' — ');
}

/**
 * @param {string} text
 */
export function splitMergedExperienceText(text) {
  const l = normSpace(text);
  if (!l) return [];

  const dateSplit = splitMergedExperienceByDates(l);
  if (dateSplit.length > 1) return dateSplit;

  const dateMatches = [...l.matchAll(YEAR_RANGE_RE)];
  if (dateMatches.length > 1) {
    const parts = [];
    dateMatches.forEach((m, idx) => {
      const start = idx === 0 ? 0 : m.index;
      const end = idx < dateMatches.length - 1 ? dateMatches[idx + 1].index : l.length;
      const slice = normSpace(l.slice(start, end));
      if (slice.length >= 10) parts.push(slice);
    });
    if (parts.length > 1) return parts;
  }

  if (INTERNSHIP_RE.test(l) && (FREELANCE_RE.test(l) || AGENCY_RE.test(l))) {
    const internIdx = l.search(INTERNSHIP_RE);
    const otherIdx = Math.min(
      ...[l.search(FREELANCE_RE), l.search(AGENCY_RE)].filter((i) => i >= 0)
    );
    if (internIdx >= 0 && otherIdx >= 0 && Math.abs(internIdx - otherIdx) > 8) {
      const pivot = Math.min(internIdx, otherIdx);
      const parts = [normSpace(l.slice(0, pivot)), normSpace(l.slice(pivot))].filter((p) => p.length >= 10);
      if (parts.length > 1) return parts;
    }
  }

  if (SPLIT_BOUNDARY_RE.test(l)) {
    const parts = l
      .split(SPLIT_BOUNDARY_RE)
      .map((p) => normSpace(p))
      .filter((p) => p.length >= 10);
    if (parts.length > 1) return parts;
  }

  const internParts = l.split(/\b(?=internship\b|intern\b|stage\b)/i).map((p) => normSpace(p));
  if (internParts.length > 1 && internParts.every((p) => p.length >= 8)) return internParts;

  return [l];
}

/**
 * @param {string} segment
 */
function parseExperienceSegment(segment) {
  const text = normSpace(segment);
  if (!text || text.length < 8) return null;

  const lines = text.split(/\s*[-–—]\s*/).map((p) => normSpace(p)).filter(Boolean);
  const group = lines.length > 1 ? lines : [text];
  let entry = parseExperienceGroupLight(group) || parseExperienceGroupLight([text]);
  if (!entry) {
    entry = buildExperienceEntryFromLineGroup(group);
  }
  if (!entry) {
    entry = buildExperienceEntryFromLineGroup([text]);
  }
  if (!entry) return null;

  const dates = extractExperienceDateRange(text);
  if (!entry.startDate && dates.startDate) {
    entry.startDate = dates.startDate;
    entry.endDate = dates.endDate || '';
    entry.dates = `${dates.startDate}–${dates.endDate || 'Present'}`;
  } else if (dates.startDate) {
    entry.startDate = dates.startDate;
    entry.endDate = dates.endDate || entry.endDate || '';
    entry.dates = `${dates.startDate}–${dates.endDate || 'Present'}`;
  }

  const inferred = inferCompanyFromDashParts(text);
  if (inferred.role && (!entry.role || entry.role.length < inferred.role.length)) {
    entry.role = inferred.role;
  }
  if (inferred.company && (!entry.company || entry.company.length < 2)) {
    entry.company = inferred.company;
  }

  if (isFreelanceEngagement(text, entry.role) && (!entry.company || entry.company.length < 2)) {
    entry.company = 'Independent / Freelance';
  }

  entry.location = detectExperienceLocation(entry, text);
  entry.role = entry.role
    ? titleCaseProfessional(normalizeExperienceRole(entry.role, text))
    : entry.role;
  entry.employmentKind = classifyEmploymentKind(entry);
  entry.confidence = scoreExperienceConfidence(entry, text);
  entry.reconstructionSource = EXPERIENCE_RECONSTRUCTION_ENGINE;

  if (!qualifiesStrictExperience(entry, text) && entry.confidence < 55) return null;
  if (!isValidExperienceLine(formatExperienceForCvData(entry)) && entry.confidence < 65) return null;

  return entry;
}

/**
 * Build a reconstruction entry from a complete segmentation result.
 * Segmented rows already passed title/company/date gates — avoid re-filtering
 * project-client employers (e.g. "Client projects") as section headers.
 * @param {object} item
 */
function buildEntryFromSegmentation(item) {
  if (!item) return null;
  const role = normSpace(item.title || item.role);
  const company = normSpace(item.company);
  const startDate = normSpace(item.startDate);
  const endDate = normSpace(item.endDate);
  const dates =
    normSpace(item.dates) ||
    [startDate, endDate || 'Present'].filter(Boolean).join('–');
  if (!role || !company || !startDate) return null;

  const entry = {
    role: titleCaseProfessional(normalizeExperienceRole(role, company)),
    company,
    location: detectExperienceLocation({ company, role }, company),
    startDate,
    endDate: endDate || '',
    dates,
    bullets: item.bullets || [],
    confidence: Math.max(item.confidence || 0, 88),
    employmentKind: classifyEmploymentKind({ role, company, dates }),
    reconstructionSource: EXPERIENCE_SEGMENTATION_ENGINE,
  };
  return entry;
}

/**
 * @param {object} entry
 */
export function formatExperienceForCvData(entry) {
  const dates =
    entry?.dates ||
    [entry?.startDate, entry?.endDate].filter(Boolean).join('–') ||
    '';
  const parts = [entry?.role, entry?.company, entry?.location, dates]
    .map((x) => normSpace(x))
    .filter(Boolean);
  return parts.join(' — ');
}

function entryKey(entry) {
  return [
    normKeyPart(entry.role),
    normKeyPart(entry.company),
    String(entry.startDate || entry.dates || '').replace(/\D/g, '').slice(0, 8),
    entry.employmentKind || '',
  ].join('|');
}

function mergeSparseFragments(entries) {
  if (entries.length < 2) return entries;

  const out = [];
  let bucket = [entries[0]];

  const flush = () => {
    if (bucket.length === 1) {
      out.push(bucket[0]);
    } else if (bucket.every((e) => mustNeverMergeExperiences(bucket[0], e) === false)) {
      const lines = bucket.flatMap((e) => experienceToLines(e));
      const merged = parseExperienceSegment(lines.join(' — ')) || bucket[0];
      merged.confidence = Math.max(...bucket.map((e) => e.confidence || 0), merged.confidence || 0);
      merged.mergedFragments = bucket.length;
      out.push(merged);
    } else {
      out.push(...bucket);
    }
    bucket = [];
  };

  for (let i = 1; i < entries.length; i++) {
    const prev = bucket[bucket.length - 1];
    const cur = entries[i];
    const prevSparse = !(prev.role && prev.company && (prev.startDate || prev.dates));
    const curSparse = !(cur.role && cur.company && (cur.startDate || cur.dates));

    if (prevSparse && curSparse && !mustNeverMergeExperiences(prev, cur)) {
      bucket.push(cur);
    } else {
      flush();
      bucket = [cur];
    }
  }
  flush();
  return out;
}

function preserveCompleteInputExperiences(deduped, input = []) {
  const seen = new Set(deduped.map(entryKey));
  for (const raw of input || []) {
    if (!raw || typeof raw !== 'object') continue;
    const role = normSpace(raw.role || raw.title);
    const company = normSpace(raw.company);
    const startDate = normSpace(raw.startDate || String(raw.dates || '').split(/[-–—]/)[0]);
    if (!experienceEntryComplete({ title: role, role, company, startDate, dates: raw.dates })) continue;
    if (/[—–]/.test(role)) continue;
    if (/^role to confirm$/i.test(role)) continue;
    if (/^(19|20)\d{2}$/.test(role) || /^(19|20)\d{2}$/.test(company)) continue;

    const entry =
      buildEntryFromSegmentation({
        title: role,
        role,
        company,
        startDate,
        endDate: normSpace(raw.endDate),
        dates: normSpace(raw.dates),
        bullets: raw.bullets || [],
        confidence: Math.max(raw.confidence || 0, raw.rewriteConfidence || 0, 90),
      }) || {
        role: titleCaseProfessional(normalizeExperienceRole(role, company)),
        company,
        location: normSpace(raw.location),
        startDate,
        endDate: normSpace(raw.endDate),
        dates: normSpace(raw.dates) || [startDate, normSpace(raw.endDate) || 'Present'].filter(Boolean).join('–'),
        bullets: raw.bullets || [],
        confidence: Math.max(raw.confidence || 0, 90),
        reconstructionSource: EXPERIENCE_RECONSTRUCTION_ENGINE,
      };

    const key = entryKey(entry);
    if (!key.replace(/\|/g, '').length || seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }
  return deduped;
}

/**
 * Recover distinct experience entries from strings or objects.
 * @param {Array<string|object>} input
 */
export function reconstructExperienceEntries(input = []) {
  const segmented = parseSegmentedExperiences(input || []);
  if (segmented.count > 0) {
    const fromSegmentation = [];
    const seenSeg = new Set();
    for (const item of segmented.entries) {
      const entry =
        experienceEntryComplete(item)
          ? buildEntryFromSegmentation(item)
          : parseExperienceSegment(
              [item.title, item.company, item.dates || `${item.startDate}–${item.endDate || 'Present'}`]
                .filter(Boolean)
                .join(' — ')
            );
      if (!entry) continue;
      entry.role = entry.role || item.title;
      entry.company = entry.company || item.company;
      entry.startDate = entry.startDate || item.startDate;
      entry.endDate = entry.endDate || item.endDate;
      entry.dates = entry.dates || item.dates;
      entry.reconstructionSource = segmented.engine;
      const key = entryKey(entry);
      if (!key.replace(/\|/g, '').length || seenSeg.has(key)) continue;
      seenSeg.add(key);
      fromSegmentation.push(entry);
    }
    if (fromSegmentation.length) {
      const merged = mergeSparseFragments(fromSegmentation);
      const deduped = [];
      for (const exp of merged) {
        const idx = deduped.findIndex((e) => entryKey(e) === entryKey(exp));
        if (idx >= 0) {
          if ((exp.confidence || 0) > (deduped[idx].confidence || 0)) deduped[idx] = exp;
          continue;
        }
        const blocker = deduped.findIndex(
          (e) => !mustNeverMergeExperiences(e, exp) && entryKey(e) !== entryKey(exp)
        );
        if (blocker >= 0 && rolesAreCompatible(normKeyPart(deduped[blocker].role), normKeyPart(exp.role))) {
          if ((exp.confidence || 0) > (deduped[blocker].confidence || 0)) deduped[blocker] = exp;
          continue;
        }
        deduped.push(exp);
      }
      preserveCompleteInputExperiences(deduped, input);
      return {
        engine: EXPERIENCE_RECONSTRUCTION_ENGINE,
        entries: deduped.slice(0, 12),
        count: deduped.length,
      };
    }
  }

  const segments = [];

  for (const raw of input || []) {
    const text = experienceToText(raw);
    if (!text || isBulletOnlySegment(text)) continue;
    for (const part of splitMergedExperienceText(text)) {
      if (part.length >= 8 && !isBulletOnlySegment(part)) segments.push(part);
    }
  }

  const parsed = [];
  const seen = new Set();

  for (const segment of segments) {
    const entry = parseExperienceSegment(segment);
    if (!entry) continue;
    const key = entryKey(entry);
    if (!key.replace(/\|/g, '').length || seen.has(key)) continue;
    seen.add(key);
    parsed.push(entry);
  }

  const merged = mergeSparseFragments(parsed);
  const deduped = [];

  for (const exp of merged) {
    const idx = deduped.findIndex((e) => entryKey(e) === entryKey(exp));
    if (idx >= 0) {
      if ((exp.confidence || 0) > (deduped[idx].confidence || 0)) deduped[idx] = exp;
      continue;
    }
    const blocker = deduped.findIndex((e) => !mustNeverMergeExperiences(e, exp) && entryKey(e) !== entryKey(exp));
    if (blocker >= 0 && rolesAreCompatible(normKeyPart(deduped[blocker].role), normKeyPart(exp.role))) {
      if ((exp.confidence || 0) > (deduped[blocker].confidence || 0)) deduped[blocker] = exp;
      continue;
    }
    deduped.push(exp);
  }

  preserveCompleteInputExperiences(deduped, input);

  return {
    engine: EXPERIENCE_RECONSTRUCTION_ENGINE,
    entries: deduped.slice(0, 12),
    count: deduped.length,
  };
}

/**
 * @param {object} cvData
 */
export function applyExperienceReconstruction(cvData) {
  if (!cvData || typeof cvData !== 'object') return cvData;
  const d = { ...cvData };
  const result = reconstructExperienceEntries(d.experience || []);
  d.experience = result.entries.map(formatExperienceForCvData).filter(Boolean);
  d._experienceMeta = result.entries.map((e) => ({
    role: e.role,
    company: e.company,
    location: e.location,
    dates: e.dates,
    startDate: e.startDate,
    endDate: e.endDate,
    confidence: e.confidence,
    employmentKind: e.employmentKind,
  }));
  d._experienceReconstruction = EXPERIENCE_RECONSTRUCTION_ENGINE;
  return d;
}
