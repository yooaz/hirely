/**
 * EXPERIENCE_RECOVERY — draft experiences when parser returns zero but career years exist.
 * Delegates to EXPERIENCE_REBUILDER when career years detected (parser failed).
 */

import {
  detectCareerYears,
  runExperienceRebuilder,
  detectExperienceParserFailed,
} from './experience-rebuilder.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { lineLooksLikeRole, ROLE_TITLE_RE } from '../../data/dictionaries/roleKeywords.js';
import {
  extractDateRangeFromText,
  titleCaseProfessional,
  isBadTitleCandidate,
} from './parser-recovery.js';
import { mustNeverBeExperience } from './education-confidence.js';
import { isSectionHeaderLine } from './rich-parser.js';
import { findLongestDictionaryTerm, CLIENT_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import {
  parseFreelanceCareerLine,
  parseInternshipLine,
  parseUrlMergedExperienceLine,
  parseDashSeparatedExperienceLine,
} from './classification-fixes.js';
import {
  qualifiesStrictExperience,
  scoreStrictExperienceEntry,
  EXPERIENCE_PARSER_CONFIDENCE_MIN,
} from './experience-parser.js';
import {
  isAcademicEmploymentContext,
  getEducationLineSignals,
} from './education-confidence.js';

export const EXPERIENCE_RECOVERY = 'EXPERIENCE_RECOVERY';
export const SAFE_EXPERIENCE_RECOVERY = 'SAFE_EXPERIENCE_RECOVERY';
export const EXPERIENCE_RECOVERY_MIN_CHARS = 800;
export const EXPERIENCE_RECOVERY_CONFIDENCE_MIN = 55;

const YEAR_RANGE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|aujourd'?hui|actuel)\b/gi;

const YEAR_ONLY_LINE_RE = /^\s*((?:19|20)\d{2})\s*[-–—]\s*(.+?)\s*$/i;

const COMPANY_HINT_RE =
  /\b(agency|agence|inc\.?|ltd\.?|gmbh|llc|corp|corporation|studio|studios|group|g\.?\s*agency|freelance|independent|contractor)\b/i;

const ROLE_LINE_RE =
  /\b(freelance|illustrator|graphic\s+designer|designer|art\s+director|creative\s+director|motion\s+designer|photographer|product\s+designer|visual\s+designer|senior\s+designer|lead\s+designer|intern|graphiste|illustrateur|directeur\s+artistique)\b/i;

const BULLET_RE = /^[-•*]\s+/;
const SEP_RE = /\s*(?:[—–·|]|-)\s*/;

/**
 * @param {string} cleanText
 */
export function detectYearSignals(cleanText) {
  const career = detectCareerYears(cleanText);
  return {
    rangeCount: career.rangeCount,
    uniqueYears: career.years,
    hasYearSpan: career.hasYearSpan,
    hasYearLadder: career.hasYearLadder,
    yearCount: career.yearCount,
  };
}

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function expNormKey(exp) {
  return [
    String(exp?.role || '').toLowerCase().trim(),
    String(exp?.company || '').toLowerCase().trim(),
    String(exp?.startDate || '').replace(/\D/g, '').slice(0, 8),
  ].join('|');
}

function pushSafeExperience(experiences, exp, sourceLine) {
  const key = expNormKey(exp);
  if (!key || key === '||') return false;
  if ((experiences || []).some((e) => expNormKey(e) === key)) return false;
  const src = String(sourceLine || '').trim();
  experiences.push({
    ...exp,
    clients: exp.clients || [],
    bullets: exp.bullets || [],
    location: exp.location || '',
    sourceLines: src ? [src] : exp.sourceLines || [],
    recoverySource: SAFE_EXPERIENCE_RECOVERY,
  });
  return true;
}

function collectExperienceRecoveryLines(rd) {
  const lines = [];
  const seen = new Set();
  const push = (line) => {
    const t = String(line || '').trim();
    if (!t || t.length < 8 || seen.has(t)) return;
    seen.add(t);
    lines.push(t);
  };

  for (const blob of [rd?.meta?.sourceText, rd?.meta?.rawText, rd?.meta?.cleanedText]) {
    for (const line of String(blob || '').split(/\r?\n/)) push(line);
  }
  for (const line of rd?.unsorted || []) push(line);
  for (const exp of rd?.experiences || []) {
    if (!exp) continue;
    push([exp.role, exp.company, exp.location, exp.dates || exp.startDate].filter(Boolean).join(' — '));
    if (String(exp.role || '').includes('—')) push(exp.role);
  }
  return lines;
}

/**
 * Re-parse malformed experience rows; harvest dash-separated lines from CV text.
 * @param {{ experiences?: object[], meta?: object, unsorted?: string[] }} rd
 */
export function repairExperienceEntries(rd) {
  if (!rd || typeof rd !== 'object') return rd;
  if (!Array.isArray(rd.experiences)) rd.experiences = [];

  const lines = collectExperienceRecoveryLines(rd);
  recoverSafeParsedExperiences(rd, { lines, nearbyLines: rd.unsorted || [] });

  const repaired = [];
  for (const exp of rd.experiences) {
    const blob = [exp?.role, exp?.company, exp?.location, exp?.dates || exp?.startDate]
      .filter(Boolean)
      .join(' — ');
    const dash =
      parseDashSeparatedExperienceLine(blob) ||
      parseDashSeparatedExperienceLine(String(exp?.role || '').trim()) ||
      parseFreelanceCareerLine(blob) ||
      parseInternshipLine(blob, { nearbyLines: lines });
    let next = dash
      ? {
          ...exp,
          role: dash.role,
          company: dash.company,
          location: dash.location || exp.location || '',
          startDate: dash.startDate || exp.startDate,
          endDate: dash.endDate || exp.endDate,
          dates: dash.dates || exp.dates,
        }
      : { ...exp };

    const role = String(next.role || '').trim();
    let company = String(next.company || '').trim();
    if (role && company && role.toLowerCase() === company.toLowerCase() && /\bfreelanc/i.test(role)) {
      company = 'Independent';
      next = { ...next, company };
    }
    if (role && company && !next.startDate) {
      const dr = extractDateRangeFromText(blob);
      if (dr.startDate) {
        next.startDate = dr.startDate;
        next.endDate = dr.endDate || next.endDate;
        next.dates = next.dates || `${dr.startDate}–${dr.endDate || 'Present'}`;
      }
    }
    repaired.push(next);
  }
  rd.experiences = repaired;
  pruneRecoveredExperiences(rd);
  return rd;
}

/**
 * @param {{ experiences?: object[], unsorted?: string[], clients?: string[] }} container
 * @param {{ lines?: string[], nearbyLines?: string[] }} [opts]
 */
export function recoverSafeParsedExperiences(container, opts = {}) {
  if (!container || typeof container !== 'object') {
    return { recovered: false, count: 0, items: [], container };
  }
  if (!Array.isArray(container.experiences)) container.experiences = [];

  const nearby = opts.nearbyLines?.length ? opts.nearbyLines : opts.lines || [];
  const sources = [];
  const seenSrc = new Set();
  const pushSrc = (line) => {
    const t = String(line || '').trim();
    if (!t || t.length < 6 || seenSrc.has(t)) return;
    if (/\b(seeking|looking for|final[- ]year)\b/i.test(t) && !/\b(19|20)\d{2}\s*[-–—]/.test(t)) return;
    seenSrc.add(t);
    sources.push(t);
  };

  for (const line of opts.lines || []) pushSrc(line);
  for (const line of container.unsorted || []) pushSrc(line);
  for (const line of container.clients || []) {
    if (
      /\b(internship|intern|freelanc|agency|designer|illustrator|art\s+director|motion\s+designer)\b/i.test(
        line
      )
    ) {
      pushSrc(line);
    }
  }

  const items = [];
  let count = 0;
  const consumed = new Set();

  for (const line of sources) {
    const candidates = [
      { parser: 'parseDashSeparatedExperienceLine', exp: parseDashSeparatedExperienceLine(line) },
      { parser: 'parseUrlMergedExperienceLine', exp: parseUrlMergedExperienceLine(line) },
      { parser: 'parseFreelanceCareerLine', exp: parseFreelanceCareerLine(line) },
      {
        parser: 'parseInternshipLine',
        exp: parseInternshipLine(line, { nearbyLines: nearby.length ? nearby : sources }),
      },
    ];
    for (const { parser, exp } of candidates) {
      if (!exp) continue;
      const confidence = exp.confidence ?? scoreStrictExperienceEntry(exp, line);
      if (confidence < EXPERIENCE_PARSER_CONFIDENCE_MIN) continue;
      if (!qualifiesStrictExperience(exp, line)) continue;
      if (pushSafeExperience(container.experiences, exp, line)) {
        count++;
        items.push({
          sourceLine: line,
          parser,
          role: exp.role,
          company: exp.company,
          dates: exp.dates,
          confidence,
        });
        consumed.add(line);
      }
    }
  }

  if (consumed.size && Array.isArray(container.unsorted)) {
    container.unsorted = container.unsorted.filter((l) => !consumed.has(String(l || '').trim()));
  }
  if (consumed.size && Array.isArray(container.clients)) {
    container.clients = container.clients.filter((l) => !consumed.has(String(l || '').trim()));
  }

  return { recovered: count > 0, count, items, container };
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

/**
 * @param {string} line
 * @param {string[]} lines
 * @param {number} idx
 */
function scoreDraftConfidence(draft, line, lines, idx) {
  let score = 40;
  if (draft.startDate) score += 28;
  if (draft.endDate) score += 8;
  if (draft.role && !isBadTitleCandidate(draft.role)) score += 22;
  if (draft.company) score += 14;
  if (draft.bullets?.length) score += 8;
  const ctx = [lines[idx - 1], line, lines[idx + 1]].filter(Boolean).join(' ');
  if (YEAR_RANGE_RE.test(ctx)) score += 6;
  if (ROLE_LINE_RE.test(ctx)) score += 4;
  return Math.min(99, score);
}

/**
 * @param {string} line
 * @param {string[]} lines
 * @param {number} idx
 */
function buildDraftFromLine(line, lines, idx) {
  const dates = extractDateRangeFromText(line);
  let role = '';
  let company = '';
  const bullets = [];

  const inlineRoleCompany = line.split(SEP_RE).map((p) => p.trim()).filter(Boolean);
  if (inlineRoleCompany.length >= 2) {
    const a = inlineRoleCompany[0].replace(YEAR_RANGE_RE, '').trim();
    const b = inlineRoleCompany[1].replace(YEAR_RANGE_RE, '').trim();
    if (lineLooksLikeRoleLine(a)) role = a;
    else if (lineLooksLikeRoleLine(b)) role = b;
    if (!company && lineLooksLikeCompany(b)) company = b;
    if (!company && lineLooksLikeCompany(a)) company = a;
  }

  const prev = lines[idx - 1] || '';
  const next = lines[idx + 1] || '';
  const next2 = lines[idx + 2] || '';

  if (!role) {
    if (lineLooksLikeRoleLine(line)) role = line.replace(YEAR_RANGE_RE, '').trim();
    else if (lineLooksLikeRoleLine(prev)) role = prev;
    else if (lineLooksLikeRoleLine(next)) role = next;
  }

  if (!company) {
    if (lineLooksLikeCompany(next)) company = next;
    else if (lineLooksLikeCompany(prev)) company = prev;
    const m = line.match(/\b(?:at|@|chez)\s+(.+)/i);
    if (m) company = m[1].trim();
    const parts = line.split(/[·|]/);
    if (parts.length >= 2) {
      const tail = parts[parts.length - 1].trim();
      if (lineLooksLikeCompany(tail) || COMPANY_HINT_RE.test(tail)) company = tail;
    }
  }

  if (BULLET_RE.test(next) || (next.length > 24 && !lineLooksLikeRoleLine(next))) {
    bullets.push(next.replace(BULLET_RE, '').trim());
  }
  if (BULLET_RE.test(next2)) bullets.push(next2.replace(BULLET_RE, '').trim());

  role = String(role || '')
    .replace(/\b((?:19|20)\d{2})\s*[-–—].*$/i, '')
    .trim();
  company = String(company || '').trim();

  if (!role && !company && !dates.startDate) return null;

  const draft = {
    role: role ? titleCaseProfessional(role) : '',
    company,
    location: '',
    startDate: dates.startDate || '',
    endDate: dates.endDate || '',
    dates: dates.startDate ? `${dates.startDate}–${dates.endDate || 'Present'}` : '',
    bullets: bullets.filter(Boolean).slice(0, 4),
    clients: [],
    draft: true,
    recoverySource: EXPERIENCE_RECOVERY,
  };

  draft.confidence = scoreDraftConfidence(draft, line, lines, idx);
  return draft.confidence >= EXPERIENCE_RECOVERY_CONFIDENCE_MIN ? draft : null;
}

/**
 * @param {string} cleanText
 */
export function scanDraftExperiences(cleanText) {
  const lines = String(cleanText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const drafts = [];
  const seen = new Set();

  const push = (draft) => {
    if (!draft) return;
    const key = normKey(`${draft.role}|${draft.company}|${draft.startDate}`);
    if (!key || seen.has(key)) return;
    seen.add(key);
    drafts.push(draft);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSectionHeaderLine(line) || line.length < 4) continue;

    if (YEAR_RANGE_RE.test(line) || YEAR_ONLY_LINE_RE.test(line)) {
      push(buildDraftFromLine(line, lines, i));
      continue;
    }

    if (lineLooksLikeRoleLine(line)) {
      const near = `${lines[i - 1] || ''} ${line} ${lines[i + 1] || ''}`;
      if (YEAR_RANGE_RE.test(near)) {
        push(buildDraftFromLine(`${line} ${near}`, lines, i));
      }
    }
  }

  return drafts.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}

/**
 * @param {string} cleanText
 * @param {object} [identity]
 */
function forceDraftFromYearSignals(cleanText, identity = {}) {
  const lines = String(cleanText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const yearLine = lines.find((l) => YEAR_RANGE_RE.test(l));
  if (!yearLine) return null;

  const idx = lines.indexOf(yearLine);
  const draft = buildDraftFromLine(yearLine, lines, idx);
  if (draft) return draft;

  const dates = extractDateRangeFromText(yearLine);
  const role =
    (identity.title && !isBadTitleCandidate(identity.title) ? identity.title : '') ||
    (lines.find((l) => lineLooksLikeRoleLine(l)) || '').trim() ||
    'Professional Experience';

  return {
    role: titleCaseProfessional(role),
    company: /\bfreelance|independent\b/i.test(cleanText) ? 'Independent / Freelance' : '',
    location: '',
    startDate: dates.startDate || '',
    endDate: dates.endDate || '',
    dates: dates.startDate ? `${dates.startDate}–${dates.endDate || 'Present'}` : '',
    bullets: [],
    clients: [],
    draft: true,
    recoverySource: EXPERIENCE_RECOVERY,
    confidence: 58,
    recoveryReason: 'year_signal_fallback',
  };
}

function isInvalidExperienceEntry(exp, contextLine = '') {
  const role = String(exp?.role || '').trim();
  const company = String(exp?.company || '').trim();
  const startDate = String(exp?.startDate || '').trim();
  const ctx = contextLine || [role, company, exp?.dates].filter(Boolean).join(' — ');

  if (!startDate && !role && !company) return true;
  if (/^(19|20)\d{2}$/.test(role) || /^(19|20)\d{2}$/.test(company)) return true;
  if (/^role to confirm$/i.test(role)) return true;
  if (/^final\b/i.test(role) || /\b(seeking|interest in)\b/i.test(role)) return true;
  if (/^internship$/i.test(role) && company.length < 4) return true;
  if (role && company && role.toLowerCase() === company.toLowerCase()) return true;
  if (/\b(seeking|student|interest in)\b/i.test(company)) return true;

  if (!isAcademicEmploymentContext(ctx, exp)) {
    const edu = getEducationLineSignals(ctx);
    if (edu.isEducationLine && /\b(licence|license|bachelor|master|mba|phd|bsc|ba|dnsep)\b/i.test(ctx)) {
      return true;
    }
  }
  return false;
}

/**
 * Dedupe experiences, drop education/year garbage, queue role-without-company for review.
 * @param {{ experiences?: object[], meta?: object, unsorted?: string[] }} rd
 */
export function pruneRecoveredExperiences(rd) {
  if (!rd || !Array.isArray(rd.experiences)) return rd;

  const kept = [];
  const reviewItems = [...(rd.meta?.experienceReviewItems || [])];
  const seen = new Set();

  for (const exp of rd.experiences) {
    const ctx = [exp?.role, exp?.company, exp?.dates, exp?.startDate].filter(Boolean).join(' — ');
    if (isInvalidExperienceEntry(exp, ctx)) continue;

    const role = String(exp?.role || '').trim();
    const company = String(exp?.company || '').trim();
    const startDate = String(exp?.startDate || '').trim();

    if (role && startDate && !company) {
      reviewItems.push({
        field: 'experience',
        detected: ctx.slice(0, 200),
        reason: 'Role and dates detected — confirm employer',
        status: 'pending',
        confidence: 62,
      });
      continue;
    }

    const key = expNormKey(exp);
    if (!key || key === '||' || seen.has(key)) continue;
    seen.add(key);
    kept.push(exp);
  }

  rd.experiences = kept;
  if (reviewItems.length) {
    rd.meta = { ...(rd.meta || {}), experienceReviewItems: reviewItems };
  }
  return rd;
}

/**
 * @param {number} experienceCount
 * @param {string} cleanedText
 */
export function shouldRunExperienceRecovery(experienceCount, cleanedText) {
  const clean = String(cleanedText || '').trim();
  const years = detectYearSignals(clean);
  if (experienceCount > 0) {
    return { run: false, years, reason: 'has_experience' };
  }
  const failed = detectExperienceParserFailed(experienceCount, clean);
  if (failed.parserFailed) {
    return { run: true, years, reason: 'parser_failed_career_years' };
  }
  if (years.hasYearSpan) {
    return { run: true, years, reason: 'years_without_experience' };
  }
  if (clean.length > EXPERIENCE_RECOVERY_MIN_CHARS) {
    return { run: true, years, reason: 'long_text_no_experience' };
  }
  return { run: false, years, reason: 'below_threshold' };
}

/**
 * @param {object} structured
 * @param {string} cleanedText
 * @param {object} [opts]
 */
export function runExperienceRecovery(structured, cleanedText, opts = {}) {
  const clean = String(cleanedText || '').trim();
  const expCount = structured?.experiences?.length ?? 0;
  const gate = shouldRunExperienceRecovery(expCount, clean);

  if (gate.reason === 'parser_failed_career_years' || detectExperienceParserFailed(expCount, clean).parserFailed) {
    const rebuilt = runExperienceRebuilder(structured, clean, opts);
    return { ...rebuilt, recovered: rebuilt.rebuilt };
  }

  if (!gate.run && !opts.force) {
    return {
      structured,
      recovered: false,
      drafts: [],
      experienceCount: expCount,
      yearSignals: gate.years,
    };
  }

  hirelyDebugLog('EXPERIENCE_RECOVERY', {
    reason: gate.reason,
    cleanChars: clean.length,
    yearRanges: gate.years.rangeCount,
  });

  let drafts = scanDraftExperiences(clean);

  if (gate.years.hasYearSpan && !drafts.length) {
    const fallback = forceDraftFromYearSignals(clean, structured?.identity || {});
    if (fallback) drafts = [fallback];
  }

  if (!drafts.length) {
    return {
      structured,
      recovered: false,
      drafts: [],
      experienceCount: expCount,
      yearSignals: gate.years,
    };
  }

  structured.experiences = drafts.map((d) => {
    const { confidence, draft, recoverySource, recoveryReason, ...entry } = d;
    return entry;
  });

  structured.metadata = {
    ...(structured.metadata || {}),
    experienceRecovery: {
      engine: EXPERIENCE_RECOVERY,
      reason: gate.reason,
      draftCount: drafts.length,
      yearSignals: gate.years,
      drafts: drafts.map((d) => ({
        role: d.role,
        company: d.company,
        startDate: d.startDate,
        confidence: d.confidence,
        recoveryReason: d.recoveryReason,
      })),
    },
  };

  hirelyDebugLog('EXPERIENCE_RECOVERY_RESULT', {
    experienceCount: structured.experiences.length,
    topConfidence: drafts[0]?.confidence,
  });

  return {
    structured,
    recovered: true,
    drafts,
    experienceCount: structured.experiences.length,
    yearSignals: gate.years,
  };
}
