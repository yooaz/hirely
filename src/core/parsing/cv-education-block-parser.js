/**
 * Dedicated CV education block parser — school/program + date entries with deduplication.
 *
 * See EDUCATION_BLOCK_PARSER_ASSUMPTIONS.md for design constraints.
 */

import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { extractDateRangeFromText } from './parser-recovery.js';
import { repairEducationOcrDates } from './classification-fixes.js';
import { hasEducationSchool, isCorruptEducationLine } from './education-confidence.js';
import { canonicalizeEducationProgram } from './education-normalization-layer.js';
import { findBestEntity, SCHOOL_RECOGNIZER } from '../../data/dictionaries/entity-catalog.js';
import { findLongestDictionaryTerm, SCHOOL_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import {
  normalizeCompareString,
  semanticSimilarityForDedup,
  pickRicherStringLabel,
} from './dedupe-engine.js';
import { fuzzySectionKey } from './section-fuzzy.js';
import { CV_SECTION } from './section-heading-dictionary.js';

export const EDUCATION_BLOCK_PARSER = 'EDUCATION_BLOCK_PARSER_V2';

/** Items below this confidence are rejected (not emitted). */
export const MIN_EDUCATION_EMIT_CONFIDENCE = 0.48;

const DATE_ONLY_LINE_RE =
  /^\s*((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|aujourd'?hui|actuel)?\s*$/i;
const SPACED_YEAR_PAIR_RE = /^\s*((?:19|20)\d{2})\s+((?:19|20)\d{2})\s*$/;
const DATE_LEAD_COMPACT_RE =
  /^\s*((?:19|20)\d{2})\s*[-–—\s]+\s*((?:19|20)\d{2})\s*[:：]\s*(.+)$/i;
const SCHOOL_PROGRAM_COMMA_RE = /^([^,]{2,56}),\s*(.+)$/;
const LOCATION_RE =
  /\b(paris|lyon|london|new york|berlin|remote|hybrid)\b[^,]{0,24}(?:\s*,\s*[A-Za-zÀ-ÿ]{2,})?/i;
const BULLET_RE = /^[-•*]\s+/;
const INSTITUTION_NAME_RE =
  /\b(university|université|college|school|institute|institut|academy|académie|business\s+school|polytechnic|école|ecole)\b/i;
const INLINE_DEGREE_HINT_RE =
  /\b(bachelor|master|mba|phd|ph\.d|b\.?a\.?|b\.?s\.?|b\.?f\.?a\.?|m\.?a\.?|m\.?s\.?|licence|diploma|degree|doctorat|doctoral|baccalaureat)\b/i;

/**
 * Institution vs degree heuristics for dash-separated education lines.
 * @param {string} text
 */
function looksLikeInstitutionLabel(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 4) return false;
  if (hasEducationSchool(t)) return true;
  return INSTITUTION_NAME_RE.test(t);
}

/**
 * @param {string} text
 */
function looksLikeDegreeLabel(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 2) return false;
  if (INLINE_DEGREE_HINT_RE.test(t)) return true;
  if (/^[A-Z]{2,}(\.[A-Z]{0,2}\.?)*(\s+[A-Za-z][A-Za-z\s&/-]{0,40})?$/.test(t)) return true;
  return t.length <= 48 && !looksLikeInstitutionLabel(t);
}

/**
 * Parse "School — Degree — 2008 – 2010" and "Degree — School — dates" (common resume families).
 * @param {string} line
 */
function parseDashSeparatedEducationLine(line) {
  const t = repairEducationOcrDates(String(line || '').trim());
  if (!t || isSectionHeaderLine(t)) return null;

  const parts = t.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;

  const dates = extractDateRangeFromText(t);
  if (!dates.startDate) return null;

  const first = parts[0];
  const second = parts[1];
  const firstInst = looksLikeInstitutionLabel(first);
  const secondInst = looksLikeInstitutionLabel(second);

  let school = '';
  let degree = '';
  if (firstInst && !secondInst) {
    school = first;
    degree = second;
  } else if (secondInst && !firstInst) {
    school = second;
    degree = first;
  } else if (firstInst) {
    school = first;
    degree = second;
  } else {
    return null;
  }

  const resolved = resolveSchoolFromText(school);
  const canonSchool = resolved.school || conservativeSchoolFromLead(school) || school;
  const canonDegree = canonicalizeEducationProgram(degree) || degree;

  return {
    school: canonSchool.trim(),
    degree: String(canonDegree || '').trim(),
    start_date: dates.startDate,
    end_date: dates.endDate || '',
    schoolFromDictionary: resolved.fromDictionary,
  };
}

/**
 * @typedef {object} ParsedEducationItem
 * @property {string} school
 * @property {string} degree
 * @property {string} location
 * @property {string} start_date
 * @property {string} end_date
 * @property {string[]} description
 * @property {string[]} source_block_ids
 * @property {number} confidence
 * @property {string} [parser]
 * @property {boolean} [school_from_dictionary]
 * @property {string[]} [rejection_reasons]
 */

/**
 * @typedef {object} EducationDedupeEvent
 * @property {'merged_exact'|'merged_near'|'rejected_low_confidence'} action
 * @property {string} reason
 * @property {string} canonical_key
 * @property {object} [primary]
 * @property {object} [secondary]
 * @property {object} [result]
 * @property {number} [school_similarity]
 * @property {number} [degree_similarity]
 */

/**
 * @param {string} line
 */
function isSectionHeaderLine(line) {
  const t = String(line || '').trim();
  return !!fuzzySectionKey(t) || /^(education|formation|studies|academic)\b/i.test(t);
}

/**
 * @param {string} text
 */
function isDateOnlyEducationLine(text) {
  const t = repairEducationOcrDates(String(text || '').trim());
  if (!t) return false;
  return DATE_ONLY_LINE_RE.test(t) || SPACED_YEAR_PAIR_RE.test(t);
}

/**
 * @param {string} text
 */
function isCompactEducationLine(text) {
  const t = repairEducationOcrDates(String(text || '').trim());
  return DATE_LEAD_COMPACT_RE.test(t);
}

/**
 * @param {string} text
 */
function isDateAnchorLine(text) {
  return isDateOnlyEducationLine(text) || isCompactEducationLine(text);
}

/**
 * @param {string} text
 */
function isSchoolProgramLine(text) {
  const t = repairEducationOcrDates(String(text || '').trim());
  if (!t || isSectionHeaderLine(t) || isCorruptEducationLine(t)) return false;
  if (isDateAnchorLine(t)) return false;
  if (hasEducationSchool(t)) return true;
  if (SCHOOL_PROGRAM_COMMA_RE.test(t) && t.length <= 120) return true;
  return false;
}

/**
 * @param {string} line
 * @returns {{ school: string, degree: string, fromDictionary: boolean }}
 */
function resolveSchoolFromText(line) {
  const t = repairEducationOcrDates(String(line || '').trim());
  const hit = findBestEntity(t, SCHOOL_RECOGNIZER);
  if (hit?.canonical) {
    return { school: hit.canonical, degree: '', fromDictionary: true };
  }
  const term = findLongestDictionaryTerm(t, SCHOOL_TERMS);
  if (term) {
    return { school: term.trim(), degree: '', fromDictionary: true };
  }
  return { school: '', degree: '', fromDictionary: false };
}

/**
 * @param {string} lead
 */
function conservativeSchoolFromLead(lead) {
  const t = String(lead || '').trim();
  if (!t || t.length < 2 || t.length > 56) return '';
  if (/\b(19|20)\d{2}\b/.test(t)) return '';
  if (/^(and|the|year|program|degree)$/i.test(t)) return '';
  if (!/^[A-Za-zÀ-ÿ]/.test(t)) return '';
  return t;
}

/**
 * @param {string} line
 * @param {string} [knownSchool]
 */
function extractDegreeFromLine(line, knownSchool = '') {
  const t = repairEducationOcrDates(String(line || '').trim());
  if (!t) return '';

  const compact = t.match(DATE_LEAD_COMPACT_RE);
  if (compact?.[3]) {
    return extractDegreeFromLine(compact[3], knownSchool);
  }

  const comma = t.match(SCHOOL_PROGRAM_COMMA_RE);
  if (comma) {
    const program = comma[2].trim();
    return canonicalizeEducationProgram(program) || program;
  }

  let rest = t;
  if (knownSchool) {
    rest = rest.replace(new RegExp(knownSchool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  rest = rest
    .replace(/\b(19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}\b/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/^[\s:,\-–—()]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  const canon = canonicalizeEducationProgram(rest);
  if (canon) return canon;
  if (rest.length >= 4 && rest.length <= 80) {
    return rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return '';
}

/**
 * @typedef {object} EducationSourceBlock
 * @property {string} text
 * @property {string} [block_id]
 * @property {number} [reading_order]
 */

/**
 * @param {EducationSourceBlock[]} blocks
 */
function groupEducationEntries(blocks) {
  const items = (blocks || [])
    .map((b) => ({
      text: String(b.text || '').trim(),
      block_id: b.block_id || null,
      reading_order: b.reading_order,
    }))
    .filter((b) => b.text && !isSectionHeaderLine(b.text));

  /** @type {EducationSourceBlock[][]} */
  const groups = [];
  /** @type {EducationSourceBlock[]} */
  let pendingLead = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (isCompactEducationLine(item.text)) {
      if (pendingLead.length) {
        groups.push([...pendingLead]);
        pendingLead = [];
      }
      groups.push([item]);
      continue;
    }

    if (isDateOnlyEducationLine(item.text)) {
      if (pendingLead.length) {
        groups.push([...pendingLead, item]);
        pendingLead = [];
        continue;
      }

      const group = [item];
      if (i + 1 < items.length && isSchoolProgramLine(items[i + 1].text)) {
        group.push(items[i + 1]);
        i += 1;
      }
      groups.push(group);
      continue;
    }

    if (isSchoolProgramLine(item.text)) {
      if (pendingLead.length) {
        groups.push([...pendingLead]);
      }
      pendingLead = [item];
      continue;
    }

    if (pendingLead.length) {
      pendingLead.push(item);
    }
  }

  if (pendingLead.length) groups.push(pendingLead);
  return groups.filter((g) => g.length);
}

/**
 * @param {ParsedEducationItem} item
 * @param {{ schoolFromDictionary?: boolean }} meta
 */
function scoreEducationBlockConfidence(item, meta = {}) {
  let score = 0.38;
  if (item.start_date) score += 0.22;
  if (item.end_date) score += 0.1;
  if (item.school && item.school.length >= 2) {
    score += meta.schoolFromDictionary ? 0.2 : 0.08;
  }
  if (item.degree && item.degree.length >= 4) score += 0.14;
  if (item.description?.length) score += 0.04;
  if (!item.school) score -= 0.28;
  if (!item.start_date && !item.end_date) score -= 0.22;
  if (item.school && !meta.schoolFromDictionary) score -= 0.1;
  return Math.max(0, Math.min(1, Math.round(score * 1000) / 1000));
}

/**
 * @param {EducationSourceBlock[]} group
 * @returns {ParsedEducationItem|null}
 */
export function parseEducationEntryFromGroup(group) {
  const lines = (group || []).map((g) => repairEducationOcrDates(String(g.text || '').trim())).filter(Boolean);
  if (!lines.length) return null;

  const source_block_ids = group.map((g) => g.block_id).filter(Boolean);

  if (lines.length === 1) {
    const dashParsed = parseDashSeparatedEducationLine(lines[0]);
    if (dashParsed?.school) {
      const item = {
        school: dashParsed.school,
        degree: dashParsed.degree,
        location: '',
        start_date: dashParsed.start_date,
        end_date: dashParsed.end_date || dashParsed.start_date || '',
        description: [],
        source_block_ids,
        confidence: 0,
        parser: EDUCATION_BLOCK_PARSER,
        school_from_dictionary: dashParsed.schoolFromDictionary,
      };
      item.confidence = scoreEducationBlockConfidence(item, {
        schoolFromDictionary: dashParsed.schoolFromDictionary,
      });
      item.rejection_reasons = collectEducationRejectionReasons(item);
      return item;
    }
  }

  const blob = lines.join('\n');

  let school = '';
  let degree = '';
  let location = '';
  let start_date = '';
  let end_date = '';
  let schoolFromDictionary = false;

  /** @type {string[]} */
  const description = [];

  const dates = extractDateRangeFromText(blob);
  if (dates.startDate) {
    start_date = dates.startDate;
    end_date = dates.endDate || '';
  }

  const twin = blob.match(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/);
  if (!start_date && twin) {
    start_date = twin[1];
    end_date = twin[2];
  }

  for (const line of lines) {
    const compact = line.match(DATE_LEAD_COMPACT_RE);
    if (compact) {
      start_date = start_date || compact[1];
      end_date = end_date || compact[2];
      const tail = compact[3].trim();
      const resolved = resolveSchoolFromText(tail);
      if (resolved.school) {
        school = resolved.school;
        schoolFromDictionary = resolved.fromDictionary;
      }
      const deg = extractDegreeFromLine(tail, school);
      if (deg) degree = degree || deg;
      continue;
    }

    if (isDateOnlyEducationLine(line)) {
      const only = line.match(DATE_ONLY_LINE_RE) || line.match(SPACED_YEAR_PAIR_RE);
      if (only) {
        start_date = start_date || only[1];
        end_date = end_date || only[2] || only[1];
      }
      continue;
    }

    if (BULLET_RE.test(line)) {
      description.push(line.replace(BULLET_RE, '').trim());
      continue;
    }

    const resolved = resolveSchoolFromText(line);
    if (resolved.school && !school) {
      school = resolved.school;
      schoolFromDictionary = resolved.fromDictionary;
    }

    const comma = line.match(SCHOOL_PROGRAM_COMMA_RE);
    if (comma) {
      if (!school) {
        const leadSchool = resolveSchoolFromText(comma[1]);
        if (leadSchool.school) {
          school = leadSchool.school;
          schoolFromDictionary = leadSchool.fromDictionary;
        } else {
          const conservative = conservativeSchoolFromLead(comma[1]);
          if (conservative) school = conservative;
        }
      }
      const deg = extractDegreeFromLine(line, school);
      if (deg) degree = degree || deg;
      continue;
    }

    if (!degree && !isDateAnchorLine(line)) {
      const deg = extractDegreeFromLine(line, school);
      if (deg) degree = deg;
    }

    const loc = line.match(LOCATION_RE);
    if (loc && !location) location = loc[0].trim();
  }

  if (!school) {
    const resolved = resolveSchoolFromText(blob);
    if (resolved.school) {
      school = resolved.school;
      schoolFromDictionary = resolved.fromDictionary;
    }
  }

  if (!degree) {
    degree = extractDegreeFromLine(blob, school);
  }

  if (!school) {
    for (const line of lines) {
      const comma = line.match(SCHOOL_PROGRAM_COMMA_RE);
      if (comma) {
        const conservative = conservativeSchoolFromLead(comma[1]);
        if (conservative) {
          school = conservative;
          break;
        }
      }
    }
  }

  if (!start_date && !end_date && !school && !degree) return null;

  const item = {
    school: school.trim(),
    degree: degree.trim(),
    location: location.trim(),
    start_date,
    end_date: end_date || start_date || '',
    description: [...new Set(description.map((d) => d.trim()).filter(Boolean))],
    source_block_ids,
    confidence: 0,
    parser: EDUCATION_BLOCK_PARSER,
    school_from_dictionary: schoolFromDictionary,
  };

  item.confidence = scoreEducationBlockConfidence(item, { schoolFromDictionary });
  item.rejection_reasons = collectEducationRejectionReasons(item);
  return item;
}

/**
 * @param {number|string} start
 * @param {number|string} end
 */
function parseYearSpan(start, end) {
  const s = parseInt(String(start || '').trim(), 10);
  let e = parseInt(String(end || start || '').trim(), 10);
  if (Number.isNaN(s)) return null;
  if (Number.isNaN(e)) e = s;
  return { start: Math.min(s, e), end: Math.max(s, e) };
}

/**
 * @param {{ start: number, end: number }|null} a
 * @param {{ start: number, end: number }|null} b
 */
function yearSpanOverlaps(a, b) {
  if (!a || !b) return false;
  return a.start <= b.end && b.start <= a.end;
}

/**
 * @param {ParsedEducationItem} item
 */
function educationDedupeExactKey(item) {
  return [
    canonicalSchoolKey(item.school),
    item.start_date || '',
    item.end_date || '',
    normalizeCompareString(item.degree),
  ].join('|');
}

/**
 * Canonical school key for dedupe (accent-stripped, lowercased).
 * @param {string} school
 */
export function canonicalSchoolKey(school) {
  const hit = findBestEntity(String(school || ''), SCHOOL_RECOGNIZER)?.canonical;
  const label = hit || String(school || '');
  return normalizeCompareString(label);
}

/**
 * @param {ParsedEducationItem} a
 * @param {ParsedEducationItem} b
 * @returns {string|null}
 */
function nearDuplicateMergeReason(a, b) {
  const schoolSim = semanticSimilarityForDedup(a.school, b.school);
  if (schoolSim < 0.86) return null;

  const sameDates =
    (a.start_date || '') === (b.start_date || '') && (a.end_date || '') === (b.end_date || '');
  const spanA = parseYearSpan(a.start_date, a.end_date);
  const spanB = parseYearSpan(b.start_date, b.end_date);
  const overlap = yearSpanOverlaps(spanA, spanB);
  const degreeSim = semanticSimilarityForDedup(a.degree || '', b.degree || '');
  const oneDegreeEmpty = !a.degree || !b.degree;

  if (sameDates && normalizeCompareString(a.school) === normalizeCompareString(b.school)) {
    if (degreeSim >= 0.75 || oneDegreeEmpty) return 'same_school_dates_degree_variant';
  }
  if (sameDates && (degreeSim >= 0.84 || oneDegreeEmpty)) {
    return 'same_dates_school_ocr_variant';
  }
  if (overlap && degreeSim >= 0.9) return 'overlapping_years_similar_degree';
  return null;
}

function educationItemSnapshot(item) {
  return {
    school: item.school,
    degree: item.degree,
    start_date: item.start_date,
    end_date: item.end_date,
    source_block_ids: item.source_block_ids || [],
    confidence: item.confidence,
  };
}

/**
 * @param {ParsedEducationItem[]} items
 * @param {EducationDedupeEvent[]} dedupe_trace
 * @param {object} stats
 */
export function buildEducationDedupeDebug(items, dedupe_trace = [], stats = {}) {
  return {
    version: EDUCATION_BLOCK_PARSER,
    strategy: 'canonical_exact_then_near_duplicate',
    canonical_key_fields: ['school', 'start_date', 'end_date', 'degree'],
    school_key: 'entity_catalog_canonical_or_normalizeCompareString',
    stats,
    events: dedupe_trace,
    items: (items || []).map((item) => ({
      ...educationItemSnapshot(item),
      canonical_key: educationDedupeExactKey(item),
    })),
    generated_at: new Date().toISOString(),
  };
}

/**
 * @param {ParsedEducationItem} item
 * @returns {string[]}
 */
export function collectEducationRejectionReasons(item) {
  const reasons = [];
  if (!item) return ['empty_item'];
  if ((item.confidence || 0) < MIN_EDUCATION_EMIT_CONFIDENCE) reasons.push('low_confidence');
  if (!item.school) reasons.push('missing_school');
  if (!item.start_date && !item.end_date) reasons.push('missing_dates');
  if (!item.school && !item.degree) reasons.push('missing_school_and_degree');
  return reasons;
}

/**
 * @param {ParsedEducationItem} a
 * @param {ParsedEducationItem} b
 */
function areNearDuplicateEducation(a, b) {
  return nearDuplicateMergeReason(a, b) != null;
}

/**
 * @param {string} label
 */
function schoolDisplayScore(label) {
  const t = String(label || '');
  const marks = (t.normalize('NFD').match(/\p{M}/gu) || []).length;
  return t.length * 10 + marks * 5;
}

/**
 * @param {string} a
 * @param {string} b
 */
function pickPreferredSchoolLabel(a, b) {
  const sa = String(a || '').trim();
  const sb = String(b || '').trim();
  if (!sa) return sb;
  if (!sb) return sa;

  const hitA = findBestEntity(sa, SCHOOL_RECOGNIZER)?.canonical;
  const hitB = findBestEntity(sb, SCHOOL_RECOGNIZER)?.canonical;

  if (hitA && hitB && normalizeCompareString(hitA) === normalizeCompareString(hitB)) {
    return schoolDisplayScore(sa) >= schoolDisplayScore(sb) ? sa : sb;
  }
  if (normalizeCompareString(sa) === normalizeCompareString(sb)) {
    return schoolDisplayScore(sa) >= schoolDisplayScore(sb) ? sa : sb;
  }
  if (hitA && !hitB) return hitA;
  if (hitB && !hitA) return hitB;
  return pickRicherStringLabel(sa, sb) || sa || sb;
}

/**
 * @param {ParsedEducationItem} a
 * @param {ParsedEducationItem} b
 */
function mergeEducationItems(a, b) {
  const school = pickPreferredSchoolLabel(a.school, b.school);
  const degree =
    (a.degree?.length || 0) >= (b.degree?.length || 0) ? a.degree : b.degree;
  const description = [...new Set([...(a.description || []), ...(b.description || [])])];
  const source_block_ids = [
    ...new Set([...(a.source_block_ids || []), ...(b.source_block_ids || [])]),
  ];
  const confidence = Math.max(a.confidence || 0, b.confidence || 0);

  return {
    school,
    degree: degree || '',
    location: a.location || b.location || '',
    start_date: a.start_date || b.start_date || '',
    end_date: a.end_date || b.end_date || '',
    description,
    source_block_ids,
    confidence,
    parser: EDUCATION_BLOCK_PARSER,
  };
}

/**
 * Deduplicate structured education items (OCR repeats, overlapping block groups).
 * @param {ParsedEducationItem[]} items
 * @returns {{ items: ParsedEducationItem[], stats: object }}
 */
export function dedupeEducationBlockItems(items = [], opts = {}) {
  const input = (items || []).filter(Boolean);
  /** @type {ParsedEducationItem[]} */
  const pass = [];
  /** @type {EducationDedupeEvent[]} */
  const dedupe_trace = [];

  for (const item of input) {
    const key = educationDedupeExactKey(item);
    const idx = pass.findIndex((p) => educationDedupeExactKey(p) === key);
    if (idx >= 0) {
      const primary = pass[idx];
      pass[idx] = mergeEducationItems(pass[idx], item);
      dedupe_trace.push({
        action: 'merged_exact',
        reason: 'exact_canonical_key_match',
        canonical_key: key,
        primary: educationItemSnapshot(primary),
        secondary: educationItemSnapshot(item),
        result: educationItemSnapshot(pass[idx]),
      });
      continue;
    }
    pass.push({ ...item });
  }

  /** @type {ParsedEducationItem[]} */
  const merged = [];

  for (const item of pass) {
    let placed = false;
    for (let i = 0; i < merged.length; i++) {
      const reason = nearDuplicateMergeReason(merged[i], item);
      if (!reason) continue;
      const primary = merged[i];
      merged[i] = mergeEducationItems(merged[i], item);
      dedupe_trace.push({
        action: 'merged_near',
        reason,
        canonical_key: educationDedupeExactKey(merged[i]),
        school_similarity: semanticSimilarityForDedup(primary.school, item.school),
        degree_similarity: semanticSimilarityForDedup(primary.degree || '', item.degree || ''),
        primary: educationItemSnapshot(primary),
        secondary: educationItemSnapshot(item),
        result: educationItemSnapshot(merged[i]),
      });
      placed = true;
      break;
    }
    if (!placed) merged.push({ ...item });
  }

  merged.sort((a, b) => {
    const ya = parseInt(b.start_date || '0', 10);
    const yb = parseInt(a.start_date || '0', 10);
    return ya - yb;
  });

  /** @type {ParsedEducationItem[]} */
  const accepted = [];
  /** @type {ParsedEducationItem[]} */
  const rejected = [];

  for (const item of merged) {
    const reasons = collectEducationRejectionReasons(item);
    if (reasons.length && opts.strictEmit !== false) {
      rejected.push({ ...item, rejection_reasons: reasons });
      dedupe_trace.push({
        action: 'rejected_low_confidence',
        reason: reasons.join(','),
        canonical_key: educationDedupeExactKey(item),
        primary: educationItemSnapshot(item),
        result: null,
      });
    } else {
      accepted.push(item);
    }
  }

  const stats = {
    input: input.length,
    afterExact: pass.length,
    output: accepted.length,
    removed: input.length - accepted.length,
    mergedEvents: dedupe_trace.filter((e) => e.action.startsWith('merged')).length,
    rejected: rejected.length,
  };

  const dedupe_debug = buildEducationDedupeDebug(accepted, dedupe_trace, stats);

  if (opts.debug === true || (typeof globalThis !== 'undefined' && globalThis.HIRELY_DEBUG)) {
    hirelyDebugLog('EDUCATION_DEDUPE', dedupe_debug);
  }

  return { items: accepted, rejected, dedupe_trace, dedupe_debug, stats };
}

/**
 * @param {EducationSourceBlock[]|import('./section-segmenter.js').SegmentedBlock[]} blocks
 * @param {object} [opts]
 * @returns {{ items: ParsedEducationItem[], groups: EducationSourceBlock[][], stats: object }}
 */
export function parseEducationSectionBlocks(blocks, opts = {}) {
  const normalized = (blocks || [])
    .map((b, i) => ({
      text: String(b.text || '').trim(),
      block_id: b.block_id || b.id || `edu-b-${i}`,
      reading_order: b.reading_order ?? i,
      section: b.section,
    }))
    .filter((b) => b.text);

  const educationBlocks = opts.section
    ? normalized
    : normalized.filter(
        (b) =>
          !b.section ||
          b.section === CV_SECTION.EDUCATION ||
          b.section === 'education' ||
          b.section === 'EDUCATION'
      );

  const groups = groupEducationEntries(educationBlocks);
  const rawItems = groups.map((g) => parseEducationEntryFromGroup(g)).filter(Boolean);
  const {
    items,
    rejected,
    dedupe_trace,
    dedupe_debug,
    stats: dedupeStats,
  } = dedupeEducationBlockItems(rawItems, { debug: opts.debug });

  const stats = {
    inputBlocks: normalized.length,
    educationBlocks: educationBlocks.length,
    groups: groups.length,
    parsed: rawItems.length,
    deduped: items.length,
    dedupeRemoved: dedupeStats.removed,
    dedupeMergedEvents: dedupeStats.mergedEvents,
    rejected: dedupeStats.rejected,
    avgConfidence:
      items.length > 0
        ? Math.round((items.reduce((s, e) => s + e.confidence, 0) / items.length) * 1000) / 1000
        : 0,
  };

  hirelyDebugLog('EDUCATION_BLOCK_PARSER', { ...stats, engine: EDUCATION_BLOCK_PARSER });

  if (typeof globalThis !== 'undefined') {
    globalThis.__HIRELY_EDUCATION_BLOCK_PARSER = {
      items,
      rejected,
      groups,
      dedupe_trace,
      dedupe_debug,
      stats,
    };
  }

  return { items, rejected, groups, dedupe_trace, dedupe_debug, stats };
}

/**
 * @param {string[]|string} lines
 */
export function parseEducationLines(lines) {
  const list = Array.isArray(lines)
    ? lines
    : String(lines || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
  return parseEducationSectionBlocks(
    list.map((text, i) => ({ text, block_id: `line-${i}`, reading_order: i }))
  );
}

/**
 * @param {import('./section-segmenter.js').SegmentedBlock[]} segments
 */
export function parseEducationFromSegments(segments) {
  const eduBlocks = (segments || []).filter(
    (s) => s.section === CV_SECTION.EDUCATION || s.section === 'education'
  );
  return parseEducationSectionBlocks(eduBlocks);
}
