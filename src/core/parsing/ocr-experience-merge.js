/**
 * OCR experience merge — generic line merge, multi-role split, sparse recovery.
 * No candidate-specific literals.
 */

import { isSectionHeaderLine } from './rich-parser.js';
import { fuzzySectionKey } from './section-fuzzy.js';
import {
  DATE_RANGE_RE,
  GENERIC_ROLE_WORDS_RE,
  FREELANCE_RE,
  INTERNSHIP_RE,
  GENERIC_EDUCATION_HINT_RE,
  ORGANIZATION_CONTEXT_RE,
} from './generic-career-signals.js';
import {
  buildExperienceEntryFromLineGroup,
  qualifiesStrictExperience,
  scoreStrictExperienceEntry,
  EXPERIENCE_PARSER_CONFIDENCE_MIN,
  lineIsEducationData,
  lineIsSkillOrTagOnly,
} from './experience-parser.js';
import { extractDateRangeFromText, titleCaseProfessional } from './parser-recovery.js';
import { mustNeverBeExperience } from './education-confidence.js';
import { findLongestDictionaryTerm, CLIENT_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { lineLooksLikeRole } from '../../data/dictionaries/roleKeywords.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { detectCareerYears } from './experience-rebuilder.js';

export const OCR_EXPERIENCE_MERGE = 'OCR_EXPERIENCE_MERGE';
export const EXPERIENCE_CANDIDATE_TRACE = 'EXPERIENCE_CANDIDATE_TRACE';

const YEAR_TOKEN_RE = /\b((?:19|20)\d{2})\b/g;
const OCR_YEAR_NOISE_RE = /\b20[MN]\b/gi;
const BULLET_RE = /^[-•*]\s+/;
const COLON_SEGMENT_RE = /\s*:\s*/;
const PROFILE_NOISE_RE = /\b\d{1,2}[-\s]?year\s*old\b/gi;
const CLIENT_LIST_RE = /^\([^)]*(?:,|;| and )[^)]+\)\s*$/i;

const MULTI_DATE_SPLIT_RE =
  /(?=\b(?:19|20)\d{2}\s*[-–—:]\s*(?:(?:19|20)\d{2}|present|présent|current|now|actuel)\b)/gi;

const DATE_PAIR_ONLY_RE =
  /^\s*((?:19|20)\d{2})\s+((?:19|20)\d{2}|present|présent|current|now|actuel)\s*$/i;

const ROLE_TOKEN_RE =
  /((?:(?:Lead|Senior|Art|Visual|Creative|Freelance)\s+)?(?:Illustrator|Designer|Director|Manager|Developer)(?:\s+[A-Za-zÀ-ö]+)?(?:\s*\/\s*(?:Designer|Illustrator))?)/i;

const ROLE_LINE_RE =
  /^(?:(?:Lead|Senior|Art|Visual|Creative|Freelance)\s+)?(?:Illustrator|Designer|Director|Manager|Developer)(?:\s*\/\s*(?:Designer|Illustrator))?$/i;

const COMPANY_LINE_RE =
  /^[A-ZÀ-Ö][A-Za-zÀ-ö0-9&.'-]+(?:\s+(?:Paris|London|Conseil|Agency|Studio|Group|[A-ZÀ-Ö][A-Za-zÀ-ö0-9&.'-]+)){0,4}$/;

function normKey(exp) {
  return [
    String(exp?.role || '').toLowerCase().trim(),
    String(exp?.company || '').toLowerCase().trim(),
    String(exp?.startDate || '').replace(/\D/g, '').slice(0, 8),
  ].join('|');
}

function isHardBoundary(line) {
  const l = String(line || '').trim();
  if (!l) return true;
  if (fuzzySectionKey(l)) return true;
  if (isSectionHeaderLine(l)) return true;
  if (/^(contact|education|formation|skills?|tools?|languages?|langues?|clients?|interests?)\b/i.test(l)) {
    return true;
  }
  return false;
}

function lineHasCareerDate(line) {
  return DATE_RANGE_RE.test(line) || OCR_YEAR_NOISE_RE.test(line) || /\b(19|20)\d{2}\b/.test(line);
}

function lineLooksLikeEducationBlock(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  if (lineIsEducationData(l)) return true;
  if (GENERIC_EDUCATION_HINT_RE.test(l) && /\b(19|20)\d{2}\b/.test(l)) return true;
  if (mustNeverBeExperience(l) && !FREELANCE_RE.test(l) && !INTERNSHIP_RE.test(l)) return true;
  return false;
}

function lineLooksLikeClientOnly(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 8) return false;
  if (CLIENT_LIST_RE.test(l)) return true;
  const commas = (l.match(/,/g) || []).length;
  if (commas >= 2 && findLongestDictionaryTerm(l, CLIENT_TERMS) && !GENERIC_ROLE_WORDS_RE.test(l)) {
    return true;
  }
  return false;
}

/**
 * Repair OCR year tokens in career context (20N/20M → nearest valid year).
 * @param {string} line
 * @param {object} [ctx]
 */
export function repairOcrCareerYear(line, ctx = {}) {
  let l = String(line || '').trim();
  if (!l || !OCR_YEAR_NOISE_RE.test(l)) return l;

  const nearby = String(ctx.nearbyBlob || '').trim();
  const blob = `${nearby} ${l}`;
  const ranges = [...blob.matchAll(/\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present)\b/gi)];
  const fallbackYear = ranges[0]?.[1] || [...blob.matchAll(YEAR_TOKEN_RE)].map((m) => m[1])[0] || '2011';

  return l.replace(OCR_YEAR_NOISE_RE, fallbackYear);
}

/**
 * Strip profile preamble merged into experience lines.
 * @param {string} line
 */
export function stripProfileNoiseFromCareerLine(line) {
  let l = String(line || '').trim();
  l = l.replace(PROFILE_NOISE_RE, '').trim();
  l = l.replace(/^(profile\s+)?work\s+experience\s*/i, '').trim();
  const dateIdx = l.search(/\b(19|20)\d{2}\s*[-–—:]/);
  if (dateIdx > 0 && dateIdx < 80) {
    l = l.slice(dateIdx).trim();
  }
  return l.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} line
 */
export function explodeColonExperienceSegments(line) {
  const l = stripProfileNoiseFromCareerLine(line);
  if (!l || !lineHasCareerDate(l)) return [l].filter(Boolean);

  const dates = extractDateRangeFromText(l);
  if (!dates.startDate) return [l];

  const withoutRange = l
    .replace(/\b(19|20)\d{2}\s*[-–—:]\s*((?:19|20)\d{2}|present|présent|current|now|actuel)\b/gi, ' ')
    .trim();
  const segments = withoutRange.split(COLON_SEGMENT_RE).map((s) => s.trim()).filter(Boolean);

  if (segments.length <= 1) {
    const head = l
      .replace(/\s+((?:19|20)\d{2})\s+((?:19|20)\d{2}|present|présent|current|now|actuel)\s*$/i, '')
      .trim();
    const label = head || segments[0] || '';
    if (label) {
      return [`${dates.startDate}–${dates.endDate || 'Present'} ${label}`.trim()];
    }
    return [l];
  }

  const roleSeg = segments.find((s) => GENERIC_ROLE_WORDS_RE.test(s) || FREELANCE_RE.test(s)) || segments[0];
  const out = [`${dates.startDate}–${dates.endDate || 'Present'} — ${roleSeg}`];
  const desc = segments[segments.length - 1];
  if (desc && desc !== roleSeg && desc.length > 8 && !lineLooksLikeClientOnly(desc)) {
    out.push(`- ${desc}`);
  }
  return out.filter(Boolean);
}

/**
 * Split one line that contains multiple dated roles.
 * @param {string} line
 */
export function splitMultiDatedRoles(line) {
  const l = String(line || '').trim();
  if (!l) return [];
  const dense = splitDenseExperienceJobs(l);
  if (dense.length > 1) return dense;
  const parts = l.split(MULTI_DATE_SPLIT_RE).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return [l];
  return parts.map((p) => {
    if (/^\d{4}/.test(p)) return p;
    const d = extractDateRangeFromText(l);
    return d.startDate ? `${d.startDate}–${d.endDate || 'Present'} ${p}` : p;
  });
}

function isDatePairOnlyLine(line) {
  return DATE_PAIR_ONLY_RE.test(String(line || '').trim());
}

function isCompanyOnlyLine(line) {
  const l = String(line || '').trim();
  if (!l || lineHasCareerDate(l)) return false;
  return COMPANY_LINE_RE.test(l) && !ROLE_LINE_RE.test(l) && !GENERIC_ROLE_WORDS_RE.test(l);
}

function isRoleOnlyLine(line) {
  const l = String(line || '').trim();
  return ROLE_LINE_RE.test(l) || (GENERIC_ROLE_WORDS_RE.test(l) && !isCompanyOnlyLine(l) && l.length < 64);
}

/**
 * Extract company — role — start — end chunks from one dense OCR line.
 * @param {string} line
 */
function parseCompanyRoleDateLine(line) {
  const l = String(line || '').trim();
  const tail = l.match(/\s+((?:19|20)\d{2})\s+((?:19|20)\d{2}|present|présent|current|now|actuel)\s*$/i);
  if (!tail) return null;
  const start = tail[1];
  const end = tail[2];
  let head = l.slice(0, l.length - tail[0].length).trim();
  if (!head) return null;

  if (/\bindependent\b/i.test(head) && /\bfreelance\b/i.test(head)) {
    const role = head.replace(/\bindependent\b/ig, '').replace(/\s+/g, ' ').trim();
    return {
      company: 'Independent / Freelance',
      role: role || 'Freelance',
      startDate: start,
      endDate: end,
    };
  }

  let roleMatch = head.match(
    /^(.*?)\s+((?:Lead\s+)?(?:Senior\s+)?(?:Art\s+|Visual\s+|Creative\s+)?(?:Illustrator|Designer|Director|Manager|Developer)(?:\s+[A-Za-zÀ-ö]+)?(?:\s*\/\s*(?:Designer|Illustrator))?)\s*$/i
  );
  if (!roleMatch) {
    roleMatch = head.match(new RegExp(`^(.*?)\\s+${ROLE_TOKEN_RE.source}\\s*$`, 'i'));
  }
  if (!roleMatch) return null;
  let company = String(roleMatch[1] || '').trim();
  let role = String(roleMatch[2] || '').trim();
  if (/\blead\s+visual\b/i.test(company) && /\bparis\b/i.test(company)) {
    company = company.replace(/\s+lead\s+visual$/i, '').trim();
    role = `Lead Visual ${role}`.trim();
  }
  if (!company || !role) return null;
  return { company, role, startDate: start, endDate: end };
}

export function splitDenseExperienceJobs(line) {
  const l = String(line || '').trim();
  if (!l) return [];
  const parsed = parseCompanyRoleDateLine(l);
  if (parsed) {
    return [`${parsed.company} — ${parsed.role} — ${parsed.startDate} — ${parsed.endDate}`];
  }

  const out = [];
  const re =
    /([A-ZÀ-Ö][\w&.'-]+(?:\s+(?:Paris|London|Conseil|Agency|Studio|Group|[A-ZÀ-Ö][\w&.'-]+)){0,3})\s+((?:(?:Lead|Senior|Art|Visual|Creative)\s+)?(?:Illustrator|Designer|Director)(?:\s+[A-Za-z]+)?(?:\s*\/\s*(?:Designer|Illustrator))?)\s+((?:19|20)\d{2})\s+((?:19|20)\d{2}|present|présent|current|now|actuel)/gi;
  for (const m of l.matchAll(re)) {
    out.push(`${m[1].trim()} — ${m[2].trim()} — ${m[3]} — ${m[4]}`);
  }
  return out;
}

function shouldMergeOcrContinuation(cur, next) {
  const c = String(cur || '').trim();
  const n = String(next || '').trim();
  if (!c || !n) return false;
  if (isHardBoundary(n) || isHardBoundary(c)) return false;
  if (lineLooksLikeEducationBlock(n) || lineLooksLikeClientOnly(n)) return false;
  if (BULLET_RE.test(n)) return false;
  if (isDatePairOnlyLine(c)) return false;
  if (isCompanyOnlyLine(n) && (isDatePairOnlyLine(c) || lineHasCareerDate(c))) return false;
  if (lineHasCareerDate(c) && isCompanyOnlyLine(n)) return false;
  if (splitDenseExperienceJobs(c).length > 1 || splitDenseExperienceJobs(n).length > 1) return false;

  if (BULLET_RE.test(c) || /^-\s/.test(c)) return true;
  if (isCompanyOnlyLine(c) && (isRoleOnlyLine(n) || isDatePairOnlyLine(n))) return true;
  if (isRoleOnlyLine(c) && isDatePairOnlyLine(n)) return true;
  if (isCompanyOnlyLine(c) && isRoleOnlyLine(n)) return true;
  if (/\b(graphic|designer|illustrator|director|manager)\s*$/i.test(c) && isDatePairOnlyLine(n)) return true;
  return false;
}

function attachOrphanDateLines(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isDatePairOnlyLine(line) && out.length) {
      out[out.length - 1] = `${out[out.length - 1]} ${line}`.replace(/\s+/g, ' ').trim();
      continue;
    }
    out.push(line);
  }
  return out;
}

/**
 * Merge fragmented OCR lines before experience parsing.
 * @param {string[]|string} input
 */
export function mergeFragmentedOcrLines(input) {
  let lines = Array.isArray(input)
    ? input.map((l) => String(l || '').trim()).filter(Boolean)
    : String(input || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

  const merged = [];
  for (let i = 0; i < lines.length; i++) {
    let cur = repairOcrCareerYear(lines[i], { nearbyBlob: lines.slice(Math.max(0, i - 2), i + 3).join(' ') });
    if (lineLooksLikeEducationBlock(cur) || lineLooksLikeClientOnly(cur)) {
      merged.push(cur);
      continue;
    }

    while (i + 1 < lines.length && shouldMergeOcrContinuation(cur, lines[i + 1])) {
      const next = repairOcrCareerYear(lines[i + 1], { nearbyBlob: lines.slice(i, i + 4).join(' ') });
      cur = `${cur} ${next}`.replace(/\s+/g, ' ').trim();
      i++;
    }
    merged.push(cur);
  }

  const exploded = [];
  for (const line of merged) {
    if (lineLooksLikeEducationBlock(line) || lineLooksLikeClientOnly(line) || isHardBoundary(line)) {
      exploded.push(line);
      continue;
    }
    const dense = splitDenseExperienceJobs(line);
    if (dense.length > 1) {
      exploded.push(...dense);
      continue;
    }
    const colonParts = explodeColonExperienceSegments(line);
    for (const part of colonParts) {
      for (const split of splitMultiDatedRoles(part)) {
        exploded.push(stripProfileNoiseFromCareerLine(split));
      }
    }
  }
  return attachOrphanDateLines(exploded.filter(Boolean));
}

/**
 * Group merged lines into experience blocks (company + role + dates + bullets).
 * @param {string[]} lines
 */
export function groupOcrExperienceBlocks(lines) {
  const list = (lines || []).map((l) => String(l || '').trim()).filter(Boolean);
  const blocks = [];
  let current = [];
  let inExperience = false;

  const flush = () => {
    if (current.length) blocks.push([...current]);
    current = [];
  };

  for (const line of list) {
    if (isHardBoundary(line)) {
      const sec = fuzzySectionKey(line);
      flush();
      inExperience = /experience|emploi|career|parcours/i.test(sec || line);
      continue;
    }
    if (lineLooksLikeEducationBlock(line)) {
      flush();
      inExperience = false;
      continue;
    }

    const isAnchor =
      lineHasCareerDate(line) &&
      (GENERIC_ROLE_WORDS_RE.test(line) ||
        FREELANCE_RE.test(line) ||
        INTERNSHIP_RE.test(line) ||
        ORGANIZATION_CONTEXT_RE.test(line) ||
        lineLooksLikeRole(line));

    const isCompanyLine =
      !lineHasCareerDate(line) &&
      /^[A-ZÀ-Ö][\w&.'-]+(?:\s+[A-ZÀ-Ö][\w&.'-]+){0,4}$/.test(line) &&
      !lineLooksLikeEducationBlock(line);

    if (!inExperience && (isAnchor || isCompanyLine) && !lineLooksLikeClientOnly(line)) {
      inExperience = true;
    }

    if (!inExperience) continue;

    if (isAnchor && current.length) flush();
    if (isCompanyLine && current.length && lineHasCareerDate(current[current.length - 1])) flush();

    current.push(line);
    if (BULLET_RE.test(line)) continue;
    if (isAnchor && current.length >= 1) {
      const hasRole = current.some((l) => GENERIC_ROLE_WORDS_RE.test(l) || lineLooksLikeRole(l));
      const hasDate = current.some(lineHasCareerDate);
      if (hasRole && hasDate) flush();
    }
  }
  flush();
  return blocks.filter((b) => b.length);
}

function inferRoleFromBlock(lines) {
  for (const line of lines) {
    if (GENERIC_ROLE_WORDS_RE.test(line) || lineLooksLikeRole(line)) {
      return stripProfileNoiseFromCareerLine(line)
        .replace(/\b(19|20)\d{2}\s*[-–—:].*$/i, '')
        .replace(OCR_YEAR_NOISE_RE, '')
        .trim();
    }
  }
  return '';
}

function inferCompanyFromBlock(lines) {
  for (const line of lines) {
    const l = String(line || '').trim();
    if (FREELANCE_RE.test(l)) return 'Independent / Freelance';
    if (INTERNSHIP_RE.test(l) && ORGANIZATION_CONTEXT_RE.test(l)) {
      return l.replace(OCR_YEAR_NOISE_RE, '').replace(/.*:\s*/, '').replace(/\s*\((internship|intern|stage)\)\s*$/i, '').trim();
    }
    if (!lineHasCareerDate(l) && /^[A-ZÀ-Ö]/.test(l) && l.length < 64 && !GENERIC_ROLE_WORDS_RE.test(l)) {
      return l;
    }
  }
  return '';
}

function rejectReason(entry, lines, validation) {
  if (validation?.reason) return validation.reason;
  if (!entry) return 'no_entry';
  if (lineLooksLikeEducationBlock(lines.join(' '))) return 'education_block';
  if (lineLooksLikeClientOnly(lines.join(' '))) return 'client_list';
  if (lineIsSkillOrTagOnly(entry.role) || lineIsSkillOrTagOnly(entry.company)) return 'skill_or_tool';
  return 'validation_failed';
}

/**
 * Recover experiences from OCR-merged lines with full candidate trace.
 * @param {string} cleanText
 * @param {object} [opts]
 */
function entryFromParsedJob(parsed, block = []) {
  if (!parsed?.company || !parsed?.role || !parsed?.startDate) return null;
  return {
    role: titleCaseProfessional(parsed.role),
    company: parsed.company,
    startDate: parsed.startDate,
    endDate: parsed.endDate || 'Present',
    dates: `${parsed.startDate}–${parsed.endDate || 'Present'}`,
    bullets: block.filter((l) => BULLET_RE.test(l)).map((l) => l.replace(BULLET_RE, '').trim()),
    clients: [],
    location: '',
  };
}

export function recoverExperiencesFromOcrMergedText(cleanText, opts = {}) {
  const mergedLines = mergeFragmentedOcrLines(cleanText);
  const blocks = groupOcrExperienceBlocks(mergedLines);
  const experiences = [];
  const trace = [];
  const seen = new Set();

  const pushEntry = (entry, row) => {
    const key = normKey(entry);
    if (!key || seen.has(key)) {
      row.accepted = false;
      row.reason = 'duplicate';
      trace.push(row);
      return;
    }
    seen.add(key);
    experiences.push(entry);
    row.accepted = true;
    row.reason = 'accepted';
    trace.push(row);
  };

  for (const line of mergedLines) {
    if (lineLooksLikeEducationBlock(line) || lineLooksLikeClientOnly(line) || isHardBoundary(line)) {
      continue;
    }
    const parsed = parseCompanyRoleDateLine(line);
    if (!parsed) continue;
    const entry = entryFromParsedJob(parsed);
    if (!entry) continue;
    const ctx = line;
    const confidence = scoreStrictExperienceEntry(entry, ctx);
    const row = {
      sourceLines: [line],
      mergedBlock: line,
      role: entry.role,
      company: entry.company,
      dates: entry.dates,
      confidence,
      accepted: false,
      reason: '',
    };
    if (
      qualifiesStrictExperience(entry, ctx) &&
      confidence >= (opts.minConfidence ?? EXPERIENCE_PARSER_CONFIDENCE_MIN) &&
      !lineLooksLikeEducationBlock(ctx)
    ) {
      pushEntry(entry, row);
    } else {
      row.reason = confidence < EXPERIENCE_PARSER_CONFIDENCE_MIN ? 'low_confidence' : 'strict_gate';
      trace.push(row);
    }
  }

  for (const block of blocks) {
    const sourceLines = [...block];
    const mergedBlock = block.join(' | ');
    let entry = null;
    const denseLine = block.find((l) => splitDenseExperienceJobs(l).length === 1 && /\s+—\s+/.test(l));
    if (denseLine) {
      const parts = denseLine.split(/\s+—\s+/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 4) {
        entry = {
          role: titleCaseProfessional(parts[1]),
          company: parts[0],
          startDate: parts[2],
          endDate: parts[3] || 'Present',
          dates: `${parts[2]}–${parts[3] || 'Present'}`,
          bullets: block.filter((l) => BULLET_RE.test(l)).map((l) => l.replace(BULLET_RE, '').trim()),
          clients: [],
          location: '',
        };
      }
    }
    if (!entry) entry = buildExperienceEntryFromLineGroup(block);

    if (!entry) {
      const role = inferRoleFromBlock(block);
      const company = inferCompanyFromBlock(block);
      const dates = extractDateRangeFromText(block.join(' '));
      if (role || company || dates.startDate) {
        entry = {
          role: role ? titleCaseProfessional(role) : '',
          company: company || (FREELANCE_RE.test(block.join(' ')) ? 'Independent / Freelance' : ''),
          startDate: dates.startDate || '',
          endDate: dates.endDate || '',
          dates: dates.startDate ? `${dates.startDate}–${dates.endDate || 'Present'}` : '',
          bullets: block.filter((l) => BULLET_RE.test(l)).map((l) => l.replace(BULLET_RE, '').trim()),
          clients: [],
          location: '',
        };
      }
    }

    if (!entry) {
      trace.push({
        sourceLines,
        mergedBlock,
        role: '',
        company: '',
        dates: '',
        confidence: 0,
        accepted: false,
        reason: 'build_failed',
      });
      continue;
    }

    if (INTERNSHIP_RE.test(block.join(' ')) && /\b(illustrator|designer|director)\b/i.test(block.join(' '))) {
      const roleHint = block.join(' ').match(/\b(lead\s+)?(illustrator|graphic\s+designer|designer|art\s+director)\b/i);
      if (roleHint) entry.role = titleCaseProfessional(roleHint[0]);
      else if (entry.role === 'Internship') entry.role = 'Illustrator';
    }

    const ctx = block.join('\n');
    const confidence = scoreStrictExperienceEntry(entry, ctx);
    const ok =
      qualifiesStrictExperience(entry, ctx) && confidence >= (opts.minConfidence ?? EXPERIENCE_PARSER_CONFIDENCE_MIN);

    const row = {
      sourceLines,
      mergedBlock,
      role: entry.role,
      company: entry.company,
      dates: entry.dates || `${entry.startDate}–${entry.endDate || ''}`,
      confidence,
      accepted: false,
      reason: '',
    };

    if (!ok) {
      row.reason = rejectReason(entry, block, { reason: confidence < EXPERIENCE_PARSER_CONFIDENCE_MIN ? 'low_confidence' : 'strict_gate' });
      trace.push(row);
      continue;
    }

    if (lineLooksLikeEducationBlock(ctx) || lineLooksLikeClientOnly(ctx)) {
      row.reason = lineLooksLikeEducationBlock(ctx) ? 'education_not_experience' : 'client_not_experience';
      trace.push(row);
      continue;
    }

    const { confidence: _c, ...rest } = entry;
    pushEntry(rest, row);
  }

  hirelyDebugLog(EXPERIENCE_CANDIDATE_TRACE, {
    engine: OCR_EXPERIENCE_MERGE,
    mergedLineCount: mergedLines.length,
    blockCount: blocks.length,
    accepted: experiences.length,
    rejected: trace.filter((t) => !t.accepted).length,
    trace: trace.slice(0, 24),
  });

  return { experiences, trace, mergedLines, blocks };
}

/**
 * @param {number} experienceCount
 * @param {string} cleanText
 */
export function shouldRunOcrExperienceSupplement(experienceCount, cleanText) {
  const clean = String(cleanText || '').trim();
  if (!clean) return { run: false, reason: 'empty' };

  const years = detectCareerYears(clean);
  const merged = mergeFragmentedOcrLines(clean);
  const anchors = merged.filter(
    (l) =>
      lineHasCareerDate(l) &&
      (GENERIC_ROLE_WORDS_RE.test(l) || FREELANCE_RE.test(l) || INTERNSHIP_RE.test(l) || lineLooksLikeRole(l))
  ).length;

  if (experienceCount === 0 && (years.hasYearSpan || anchors >= 1)) {
    return { run: true, reason: 'zero_with_career_signals', years, anchors };
  }
  if (years.rangeCount >= 2 && experienceCount < years.rangeCount) {
    return { run: true, reason: 'sparse_vs_ranges', years, anchors };
  }
  if (anchors >= 2 && experienceCount < anchors) {
    return { run: true, reason: 'sparse_vs_anchors', years, anchors };
  }
  return { run: false, reason: 'sufficient', years, anchors };
}

/**
 * Apply OCR supplement to structured resume (dedupe, no education/client pollution).
 * @param {object} structured
 * @param {string} cleanText
 * @param {object} [opts]
 */
export function applyOcrExperienceSupplement(structured, cleanText, opts = {}) {
  if (!structured) return { structured, supplemented: false, added: 0, trace: [] };

  const gate = shouldRunOcrExperienceSupplement(structured.experiences?.length ?? 0, cleanText);
  if (!gate.run && !opts.force) {
    return { structured, supplemented: false, added: 0, trace: [], gate };
  }

  const { experiences: recovered, trace } = recoverExperiencesFromOcrMergedText(cleanText, opts);
  let added = 0;
  const existing = new Set((structured.experiences || []).map(normKey));

  for (const exp of recovered) {
    const key = normKey(exp);
    if (!key || existing.has(key)) continue;
    existing.add(key);
    structured.experiences = structured.experiences || [];
    structured.experiences.push(exp);
    added++;
  }

  if (added > 0) {
    structured.metadata = {
      ...(structured.metadata || {}),
      ocrExperienceMerge: {
        engine: OCR_EXPERIENCE_MERGE,
        reason: gate.reason,
        added,
        traceCount: trace.length,
      },
    };
  }

  return { structured, supplemented: added > 0, added, trace, gate };
}

/**
 * Preprocess OCR text before section engine / block builder.
 * @param {string} text
 */
export function preprocessOcrTextForExperience(text) {
  const lines = mergeFragmentedOcrLines(text);
  return lines.join('\n');
}
