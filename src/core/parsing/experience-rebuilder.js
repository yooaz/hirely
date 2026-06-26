/**
 * EXPERIENCE_REBUILDER — logs parser failure; does NOT invent experiences (strict parser owns structure).
 */

import { lineLooksLikeRole, ROLE_TITLE_RE } from '../../data/dictionaries/roleKeywords.js';
import {
  extractDateRangeFromText,
  titleCaseProfessional,
  isBadTitleCandidate,
} from './parser-recovery.js';
import { mustNeverBeExperience } from './education-confidence.js';
import { isSectionHeaderLine } from './rich-parser.js';
import { findLongestDictionaryTerm, CLIENT_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { hirelyDebugWarn, hirelyDebugLog } from '../runtime/hirely-debug.js';
import {
  shouldRunOcrExperienceSupplement,
  recoverExperiencesFromOcrMergedText,
  mergeFragmentedOcrLines,
} from './ocr-experience-merge.js';
import { looksLikeOcrText } from './ocr-postprocess.js';

export const EXPERIENCE_REBUILDER = 'EXPERIENCE_REBUILDER';
export const EXPERIENCE_REBUILDER_CONFIDENCE_MIN = 52;
export const CAREER_YEAR_MIN = 1990;
export const CAREER_YEAR_MAX = 2032;

export const YEAR_RANGE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|aujourd'?hui|actuel)\b/gi;

const YEAR_TOKEN_RE = /\b((?:19|20)\d{2})\b/g;

const COMPANY_HINT_RE =
  /\b(agency|agence|inc\.?|ltd\.?|gmbh|llc|corp|corporation|studio|studios|group|freelance|independent|contractor)\b/i;

const ROLE_LINE_RE =
  /\b(freelance|illustrator|graphic\s+designer|designer|art\s+director|creative\s+director|motion\s+designer|photographer|product\s+designer|visual\s+designer|senior\s+designer|lead\s+designer|intern|graphiste|illustrateur|directeur\s+artistique|consultant|manager|engineer|developer)\b/i;

const BULLET_RE = /^[-•*]\s+/;
const SEP_RE = /\s*(?:[—–·|]|-)\s*/;
const NEARBY_LINE_RADIUS = 3;

/**
 * @param {string} cleanText
 */
export function detectCareerYears(cleanText) {
  const hay = String(cleanText || '');
  const years = new Set();
  for (const m of hay.matchAll(YEAR_TOKEN_RE)) {
    const y = parseInt(m[1], 10);
    if (y >= CAREER_YEAR_MIN && y <= CAREER_YEAR_MAX) years.add(String(y));
  }
  const ranges = [...hay.matchAll(YEAR_RANGE_RE)];
  for (const m of ranges) {
    years.add(m[1]);
    const end = String(m[2] || '').trim();
    if (/^\d{4}$/.test(end)) years.add(end);
  }
  const sorted = [...years].sort();
  return {
    years: sorted,
    yearCount: sorted.length,
    rangeCount: ranges.length,
    hasCareerYears: sorted.length >= 1 || ranges.length >= 1,
    hasYearLadder: sorted.length >= 2,
    hasYearSpan: ranges.length > 0,
  };
}

/**
 * @param {number} experienceCount
 * @param {string} cleanedText
 */
export function detectExperienceParserFailed(experienceCount, cleanedText) {
  const years = detectCareerYears(cleanedText);
  const parserFailed =
    experienceCount === 0 &&
    (years.hasYearSpan || years.hasYearLadder || years.yearCount >= 1);
  return {
    parserFailed,
    years,
    reason: parserFailed ? 'experience_zero_with_career_years' : experienceCount > 0 ? 'has_experience' : 'no_years',
  };
}

/**
 * @param {string} cleanText
 */
export function shouldRunExperienceRebuilder(experienceCount, cleanedText) {
  return detectExperienceParserFailed(experienceCount, cleanedText);
}

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function lineLooksLikeCompany(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 100) return false;
  if (COMPANY_HINT_RE.test(l)) return true;
  if (findLongestDictionaryTerm(l, CLIENT_TERMS) && !ROLE_LINE_RE.test(l) && l.length < 64) {
    return true;
  }
  if (/^[A-ZÀ-Ö][\w&.'-]+(?:\s+[A-ZÀ-Ö][\w&.'-]+){0,3}$/.test(l) && !ROLE_LINE_RE.test(l)) {
    return true;
  }
  return false;
}

function lineLooksLikeRoleLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 4) return false;
  if (isSectionHeaderLine(l) || mustNeverBeExperience(l)) return false;
  return ROLE_LINE_RE.test(l) || lineLooksLikeRole(l) || ROLE_TITLE_RE.test(l);
}

function isYearAnchorLine(line) {
  return YEAR_RANGE_RE.test(line) || YEAR_TOKEN_RE.test(line);
}

/**
 * @param {string[]} lines
 */
function findYearAnchorIndices(lines) {
  const anchors = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSectionHeaderLine(line)) continue;
    if (YEAR_RANGE_RE.test(line)) {
      anchors.push({ index: i, kind: 'range', line });
      continue;
    }
    if (/\b(19|20)\d{2}\b/.test(line) && line.length < 120) {
      anchors.push({ index: i, kind: 'year', line });
    }
  }
  if (!anchors.length) {
    for (let i = 0; i < lines.length; i++) {
      if (/\b(20\d{2}|19\d{2})\b/.test(lines[i])) {
        anchors.push({ index: i, kind: 'year', line: lines[i] });
      }
    }
  }
  return anchors;
}

/**
 * @param {string[]} lines
 * @param {number} anchorIdx
 * @param {Set<number>} used
 */
function collectNearbyLineGroup(lines, anchorIdx, used) {
  const group = [];
  const start = Math.max(0, anchorIdx - NEARBY_LINE_RADIUS);
  const end = Math.min(lines.length - 1, anchorIdx + NEARBY_LINE_RADIUS);

  for (let i = start; i <= end; i++) {
    if (used.has(i)) continue;
    const line = lines[i];
    if (!line || isSectionHeaderLine(line)) continue;
    if (i !== anchorIdx && YEAR_RANGE_RE.test(line)) continue;
    group.push({ index: i, line });
    used.add(i);
  }
  return group.sort((a, b) => a.index - b.index);
}

/**
 * @param {object[]} group
 * @param {string[]} lines
 */
function scoreRebuiltConfidence(draft, group, lines) {
  let score = 38;
  if (draft.startDate) score += 26;
  if (draft.endDate) score += 10;
  if (draft.role && !isBadTitleCandidate(draft.role)) score += 20;
  if (draft.company) score += 12;
  if (draft.bullets?.length) score += Math.min(12, draft.bullets.length * 3);
  if (group.length >= 2) score += 6;
  const blob = group.map((g) => g.line).join(' ');
  if (YEAR_RANGE_RE.test(blob)) score += 8;
  if (ROLE_LINE_RE.test(blob)) score += 4;
  return Math.min(99, score);
}

/**
 * @param {object[]} group
 * @param {string[]} lines
 */
function buildDraftFromGroup(group, lines) {
  if (!group.length) return null;

  const blob = group.map((g) => g.line).join('\n');
  const anchor = group.find((g) => YEAR_RANGE_RE.test(g.line)) || group[0];
  const dates = extractDateRangeFromText(blob) || extractDateRangeFromText(anchor.line);

  let role = '';
  let company = '';
  const bullets = [];

  for (const { line } of group) {
    if (lineLooksLikeRoleLine(line) && !role) {
      role = line.replace(YEAR_RANGE_RE, '').trim();
    }
    if (lineLooksLikeCompany(line) && !company) {
      company = line.replace(YEAR_RANGE_RE, '').trim();
    }
    if (BULLET_RE.test(line)) {
      bullets.push(line.replace(BULLET_RE, '').trim());
    }
  }

  const parts = anchor.line.split(SEP_RE).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0].replace(YEAR_RANGE_RE, '').trim();
    const b = parts[1].replace(YEAR_RANGE_RE, '').trim();
    if (!role && lineLooksLikeRoleLine(a)) role = a;
    if (!role && lineLooksLikeRoleLine(b)) role = b;
    if (!company && lineLooksLikeCompany(b)) company = b;
    if (!company && lineLooksLikeCompany(a)) company = a;
  }

  const anchorIdx = anchor.index;
  const prev = lines[anchorIdx - 1] || '';
  const next = lines[anchorIdx + 1] || '';
  if (!role && lineLooksLikeRoleLine(prev)) role = prev;
  if (!role && lineLooksLikeRoleLine(next)) role = next;
  if (!company && lineLooksLikeCompany(next)) company = next;
  if (!company && lineLooksLikeCompany(prev)) company = prev;

  if (!bullets.length) {
    for (const { line } of group) {
      if (line === anchor.line) continue;
      if (line.length > 20 && !lineLooksLikeRoleLine(line) && !lineLooksLikeCompany(line)) {
        bullets.push(line);
      }
    }
  }

  role = String(role || '')
    .replace(/\b((?:19|20)\d{2})\s*[-–—].*$/i, '')
    .trim();
  company = String(company || '').trim();

  if (!role && !company && !dates.startDate) return null;

  const draft = {
    role: role ? titleCaseProfessional(role) : 'Professional Experience',
    company,
    location: '',
    startDate: dates.startDate || '',
    endDate: dates.endDate || '',
    dates: dates.startDate ? `${dates.startDate}–${dates.endDate || 'Present'}` : '',
    bullets: bullets.filter(Boolean).slice(0, 5),
    clients: [],
    draft: true,
    rebuilt: true,
    recoverySource: EXPERIENCE_REBUILDER,
  };

  draft.confidence = scoreRebuiltConfidence(draft, group, lines);
  return draft.confidence >= EXPERIENCE_REBUILDER_CONFIDENCE_MIN ? draft : null;
}

/**
 * @param {string} cleanText
 */
export function rebuildExperiencesFromText(cleanText) {
  const lines = mergeFragmentedOcrLines(cleanText);

  const anchors = findYearAnchorIndices(lines);
  const used = new Set();
  const drafts = [];
  const seen = new Set();

  const push = (draft) => {
    if (!draft) return;
    const key = normKey(`${draft.role}|${draft.company}|${draft.startDate}|${draft.endDate}`);
    if (!key || seen.has(key)) return;
    seen.add(key);
    drafts.push(draft);
  };

  for (const anchor of anchors) {
    const group = collectNearbyLineGroup(lines, anchor.index, used);
    if (!group.some((g) => g.index === anchor.index)) {
      group.push({ index: anchor.index, line: anchor.line });
      used.add(anchor.index);
    }
    push(buildDraftFromGroup(group, lines));
  }

  return drafts.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}

/**
 * @param {string} cleanText
 * @param {object} [identity]
 */
function forceRebuiltExperience(cleanText, identity = {}) {
  const lines = String(cleanText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const yearLine = lines.find((l) => YEAR_RANGE_RE.test(l)) || lines.find((l) => /\b20\d{2}\b/.test(l));
  if (!yearLine) {
    const years = detectCareerYears(cleanText);
    const start = years.years[0] || '';
    const end = years.years[years.years.length - 1] || 'Present';
    const role =
      (identity.title && !isBadTitleCandidate(identity.title) ? identity.title : '') ||
      'Professional Experience';
    return {
      role: titleCaseProfessional(role),
      company: /\bfreelance|independent\b/i.test(cleanText) ? 'Independent / Freelance' : '',
      location: '',
      startDate: start,
      endDate: end === start ? 'Present' : end,
      dates: start ? `${start}–${end || 'Present'}` : '',
      bullets: [],
      clients: [],
      draft: true,
      rebuilt: true,
      recoverySource: EXPERIENCE_REBUILDER,
      confidence: 55,
      rebuildReason: 'year_ladder_fallback',
    };
  }

  const idx = lines.indexOf(yearLine);
  const group = [{ index: idx, line: yearLine }];
  if (lines[idx - 1]) group.unshift({ index: idx - 1, line: lines[idx - 1] });
  if (lines[idx + 1]) group.push({ index: idx + 1, line: lines[idx + 1] });

  const draft = buildDraftFromGroup(group, lines);
  if (draft) return draft;

  const dates = extractDateRangeFromText(yearLine);
  const role =
    (identity.title && !isBadTitleCandidate(identity.title) ? identity.title : '') ||
    (lines.find((l) => lineLooksLikeRoleLine(l)) || '').trim() ||
    'Professional Experience';

  return {
    role: titleCaseProfessional(role),
    company: '',
    location: '',
    startDate: dates.startDate || detectCareerYears(cleanText).years[0] || '',
    endDate: dates.endDate || 'Present',
    dates: dates.startDate ? `${dates.startDate}–${dates.endDate || 'Present'}` : '',
    bullets: [],
    clients: [],
    draft: true,
    rebuilt: true,
    recoverySource: EXPERIENCE_REBUILDER,
    confidence: 54,
    rebuildReason: 'year_line_fallback',
  };
}

/**
 * @param {object} structured
 * @param {string} cleanedText
 * @param {object} [opts]
 */
export function runExperienceRebuilder(structured, cleanedText, opts = {}) {
  const clean = String(cleanedText || '').trim();
  const expCount = structured?.experiences?.length ?? 0;
  const gate = detectExperienceParserFailed(expCount, clean);
  const ocrPath =
    looksLikeOcrText(clean) || /^(pdf|ocr)/i.test(String(opts.extractionMethod || ''));
  const sparse = ocrPath
    ? shouldRunOcrExperienceSupplement(expCount, clean)
    : { run: false, reason: 'not_ocr' };

  if (!ocrPath && !opts.force) {
    return {
      structured,
      rebuilt: false,
      parserFailed: gate.parserFailed,
      drafts: [],
      experienceCount: expCount,
      years: gate.years,
    };
  }

  if (!gate.parserFailed && !sparse.run && !opts.force) {
    return {
      structured,
      rebuilt: false,
      parserFailed: false,
      drafts: [],
      experienceCount: expCount,
      years: gate.years,
    };
  }

  hirelyDebugWarn('EXPERIENCE_PARSER_FAILED', {
    experienceCount: expCount,
    careerYears: gate.years.years,
    yearCount: gate.years.yearCount,
    rangeCount: gate.years.rangeCount,
    sparseReason: sparse.reason,
  });

  const { experiences: recovered, trace } = recoverExperiencesFromOcrMergedText(clean, opts);
  const expNormKey = (exp) =>
    normKey(`${exp?.role}|${exp?.company}|${exp?.startDate}|${exp?.endDate}`);
  const seen = new Set((structured.experiences || []).map(expNormKey));
  const drafts = [];

  for (const exp of recovered) {
    const key = expNormKey(exp);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    structured.experiences = structured.experiences || [];
    structured.experiences.push(exp);
    drafts.push(exp);
  }

  structured.metadata = {
    ...(structured.metadata || {}),
    experienceRebuilder: {
      engine: EXPERIENCE_REBUILDER,
      parserFailed: gate.parserFailed,
      sparseReason: sparse.reason,
      reason: gate.reason,
      draftCount: drafts.length,
      careerYears: gate.years,
      tracePreview: trace.slice(0, 12),
    },
  };

  hirelyDebugLog('EXPERIENCE_REBUILDER_RESULT', {
    added: drafts.length,
    total: structured.experiences?.length ?? 0,
  });

  return {
    structured,
    rebuilt: drafts.length > 0,
    parserFailed: gate.parserFailed,
    drafts,
    experienceCount: structured.experiences?.length ?? 0,
    years: gate.years,
  };
}
