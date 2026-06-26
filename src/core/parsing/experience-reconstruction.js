/**
 * EXPERIENCE_RECONSTRUCTION — rebuild complete experiences from fragmented OCR / paste text.
 *
 * Output shape: { role, company, dates, description, confidence, startDate, endDate, bullets }
 *
 * Rules:
 * - Never create experience from education, skills, clients, or languages lines.
 * - Merge nearby lines when dates are fragmented.
 * - Infer company only when confidence > 80%.
 */

import { fuzzySectionKey } from './section-fuzzy.js';
import { isSectionHeaderLine } from './rich-parser.js';
import { extractDateRangeFromText, titleCaseProfessional } from './parser-recovery.js';
import {
  buildExperienceEntryFromLineGroup,
  lineIsEducationData,
  lineIsSkillOrTagOnly,
  normalizeExperienceRole,
  qualifiesStrictExperience,
  scoreStrictExperienceEntry,
  EXPERIENCE_PARSER_CONFIDENCE_MIN,
} from './experience-parser.js';
import { mustNeverBeExperience } from './education-confidence.js';
import { mergeFragmentedOcrLines } from './ocr-experience-merge.js';
import { splitLinesIntoDateAnchoredGroups } from './block-reconstruction.js';
import { findLongestDictionaryTerm, CLIENT_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { DATE_RANGE_RE } from './generic-career-signals.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { mustNeverMergeExperiences } from './experience-reconstruction-engine.js';

export const EXPERIENCE_RECONSTRUCTION = 'EXPERIENCE_RECONSTRUCTION';
export const EXPERIENCE_RECONSTRUCTION_RECALL_GOAL = 0.9;
export const COMPANY_INFERENCE_CONFIDENCE_MIN = 80;
export const NEARBY_LINE_RADIUS = 3;

const YEAR_RANGE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|aujourd'?hui|actuel)\b/gi;

const BULLET_RE = /^[-•*]\s+/;
const GARBLED_ROLE_RE =
  /(independent\s*\/\s*freelance).*\1|—\s*—\s*—|freelance\s*·\s*$/i;
const ROLE_MARKER_RE =
  /\b(senior|lead|principal|staff|junior|associate|digital|freelance|illustrator|graphic\s+designer|art\s+director|software\s+engineer|marketing\s+manager|product\s+manager|business\s+analyst|consultant|manager|engineer|developer|analyst|executive|recruiter|designer|director)\b/i;

const FORBIDDEN_SECTION_KEYS = new Set([
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'contact',
  'summary',
  'profile',
  'interests',
  'projects',
]);

function isGarbledReconstructedRole(role) {
  const r = String(role || '').trim();
  if (!r || r.length > 100) return true;
  if (GARBLED_ROLE_RE.test(r)) return true;
  if ((r.match(/independent/gi) || []).length >= 2) return true;
  return false;
}

function normExpKey(exp) {
  return [
    String(exp?.role || '').toLowerCase().trim(),
    String(exp?.company || '').toLowerCase().trim(),
    String(exp?.startDate || exp?.dates || '').replace(/\D/g, '').slice(0, 8),
  ].join('|');
}

function lineIsForbiddenExperienceSource(line) {
  const l = String(line || '').trim();
  if (!l) return true;
  const section = fuzzySectionKey(l);
  if (section && FORBIDDEN_SECTION_KEYS.has(section)) return true;
  if (isSectionHeaderLine(l) && fuzzySectionKey(l)) return true;
  if (lineIsEducationData(l) || mustNeverBeExperience(l)) return true;
  if (lineIsSkillOrTagOnly(l)) return true;
  if (/^(english|french|spanish|german|mandarin|photoshop|illustrator|figma)\b/i.test(l) && !DATE_RANGE_RE.test(l)) {
    return true;
  }
  const clientHit = findLongestDictionaryTerm(l, CLIENT_TERMS);
  if (clientHit && !ROLE_MARKER_RE.test(l) && !DATE_RANGE_RE.test(l) && (l.match(/,/g) || []).length >= 1) {
    return true;
  }
  return false;
}

function extractExperienceSectionLines(cleanText) {
  const merged = mergeFragmentedOcrLines(cleanText);
  const lines = (Array.isArray(merged) ? merged : String(merged || '').split(/\r?\n/))
    .map((l) => String(l || '').trim())
    .filter(Boolean);

  const out = [];
  let inExperience = false;

  for (const line of lines) {
    const section = fuzzySectionKey(line);
    if (section) {
      inExperience = section === 'experience';
      if (inExperience) continue;
      if (FORBIDDEN_SECTION_KEYS.has(section)) {
        inExperience = false;
        continue;
      }
    }
    if (!inExperience) continue;
    if (lineIsForbiddenExperienceSource(line)) continue;
    out.push(line);
  }

  if (out.length) return out;

  return lines.filter((line) => {
    if (lineIsForbiddenExperienceSource(line)) return false;
    return DATE_RANGE_RE.test(line) && ROLE_MARKER_RE.test(line);
  });
}

function mergeNearbyDateFragments(groups) {
  if (!groups.length) return groups;
  const merged = [];
  let bucket = [...groups[0]];

  const dateKey = (lines) => {
    const blob = lines.join('\n');
    const d = extractDateRangeFromText(blob);
    return `${d.startDate || ''}|${d.endDate || ''}`;
  };

  for (let i = 1; i < groups.length; i++) {
    const prevKey = dateKey(bucket);
    const next = groups[i];
    const nextKey = dateKey(next);
    const prevHasDate = /\b(19|20)\d{2}\b/.test(bucket.join(' '));
    const nextHasDate = /\b(19|20)\d{2}\b/.test(next.join(' '));

    if (
      bucket.length <= NEARBY_LINE_RADIUS &&
      next.length <= NEARBY_LINE_RADIUS &&
      prevHasDate &&
      nextHasDate &&
      prevKey === nextKey
    ) {
      bucket = [...bucket, ...next];
      continue;
    }
    merged.push(bucket);
    bucket = [...next];
  }
  merged.push(bucket);
  return merged;
}

function inferCompanyIfConfident(entry, contextLine) {
  if (entry.company && entry.company.length >= 2) return entry;
  const ctx = String(contextLine || '').trim();
  if (!ctx) return entry;

  const parts = ctx
    .replace(YEAR_RANGE_RE, '')
    .split(/\s*[-–—|@·]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  let candidate = '';
  let confidence = entry.confidence || scoreStrictExperienceEntry(entry, ctx);

  for (const part of parts) {
    if (!part || part.length < 2 || part.length > 56) continue;
    if (ROLE_MARKER_RE.test(part) && part.split(/\s+/).length <= 5) continue;
    if (/^(san francisco|london|paris|new york|remote)$/i.test(part)) continue;
    if (findLongestDictionaryTerm(part, CLIENT_TERMS) || /^[A-ZÀ-Ö]/.test(part)) {
      candidate = part;
      confidence = Math.min(99, confidence + 12);
      break;
    }
  }

  if (!candidate || confidence < COMPANY_INFERENCE_CONFIDENCE_MIN) return entry;
  return { ...entry, company: candidate, confidence };
}

/**
 * @param {string} cleanText
 * @param {object[]} [existing]
 */
export function reconstructExperiencesFromText(cleanText, existing = []) {
  const sectionLines = extractExperienceSectionLines(cleanText);
  let groups = splitLinesIntoDateAnchoredGroups(sectionLines);
  groups = mergeNearbyDateFragments(groups);

  const reconstructed = [];
  const seen = new Set((existing || []).map(normExpKey));

  for (const group of groups) {
    const filtered = group.filter((line) => !lineIsForbiddenExperienceSource(line));
    if (!filtered.length) continue;

    const entry = buildExperienceEntryFromLineGroup(filtered);
    if (!entry) continue;

    let enriched = inferCompanyIfConfident(entry, filtered.join(' — '));
    const description = (enriched.bullets || []).join(' ').trim();

    const experience = {
      role: enriched.role || '',
      company: enriched.company || '',
      dates: enriched.dates || '',
      description,
      confidence: enriched.confidence || scoreStrictExperienceEntry(enriched, filtered.join('\n')),
      startDate: enriched.startDate || '',
      endDate: enriched.endDate || '',
      bullets: enriched.bullets || [],
      clients: [],
      location: enriched.location || '',
      reconstructionSource: EXPERIENCE_RECONSTRUCTION,
    };

    if (experience.confidence < EXPERIENCE_PARSER_CONFIDENCE_MIN) continue;
    if (!qualifiesStrictExperience(experience, filtered.join('\n'))) continue;
    if (isGarbledReconstructedRole(experience.role)) continue;

    const key = normExpKey(experience);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    reconstructed.push(experience);
  }

  return reconstructed.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}

function experienceOverlaps(a, b) {
  const da = extractDateRangeFromText(`${a.startDate} ${a.endDate} ${a.dates}`);
  const db = extractDateRangeFromText(`${b.startDate} ${b.endDate} ${b.dates}`);
  if (!da.startDate || !db.startDate) return false;
  const aEnd = /present/i.test(String(a.endDate || a.dates)) ? 2030 : parseInt(da.endDate || da.startDate, 10);
  const bEnd = /present/i.test(String(b.endDate || b.dates)) ? 2030 : parseInt(db.endDate || db.startDate, 10);
  const aStart = parseInt(da.startDate, 10);
  const bStart = parseInt(db.startDate, 10);
  return aStart <= bEnd && bStart <= aEnd;
}

function roleQualityScore(role) {
  const r = String(role || '').trim();
  if (!r || isGarbledReconstructedRole(r)) return -100;
  let score = Math.min(r.length, 80);
  if (/\b(senior|lead|principal|digital|freelance|illustrator|graphic|marketing|consultant)\b/i.test(r)) {
    score += 12;
  }
  return score;
}

function pickRicherExperience(current, candidate) {
  const curScore =
    roleQualityScore(current.role) +
    (current.company?.length || 0) * 2 +
    (current.bullets?.length || 0) * 3 +
    (current.confidence || 0);
  const candScore =
    roleQualityScore(candidate.role) +
    (candidate.company?.length || 0) * 2 +
    (candidate.bullets?.length || 0) * 3 +
    (candidate.confidence || 0);
  return candScore > curScore ? candidate : current;
}

function mergeExperienceLists(existing, reconstructed) {
  const out = [...(existing || [])];

  for (const candidate of reconstructed) {
    const idx = out.findIndex(
      (e) =>
        normExpKey(e) === normExpKey(candidate) ||
        (String(e.company || '').toLowerCase() === String(candidate.company || '').toLowerCase() &&
          String(e.company || '').length >= 2 &&
          experienceOverlaps(e, candidate))
    );

    if (idx >= 0 && !mustNeverMergeExperiences(out[idx], candidate)) {
      const merged = pickRicherExperience(out[idx], candidate);
      out[idx] = {
        ...merged,
        role: merged.role || candidate.role,
        company: merged.company || candidate.company,
        dates: merged.dates || candidate.dates,
        description: merged.description || candidate.description || (merged.bullets || []).join(' '),
        confidence: Math.max(merged.confidence || 0, candidate.confidence || 0),
        bullets: merged.bullets?.length ? merged.bullets : candidate.bullets,
        reconstructionSource: EXPERIENCE_RECONSTRUCTION,
      };
      continue;
    }
    if (isGarbledReconstructedRole(candidate.role)) continue;
    out.push(candidate);
  }

  const deduped = [];
  for (const exp of out) {
    if (isGarbledReconstructedRole(exp.role)) continue;
    const idx = deduped.findIndex(
      (e) =>
        normExpKey(e) === normExpKey(exp) ||
        (String(e.company || '').toLowerCase() === String(exp.company || '').toLowerCase() &&
          String(e.company || '').length >= 2 &&
          experienceOverlaps(e, exp))
    );
    if (idx >= 0 && !mustNeverMergeExperiences(deduped[idx], exp)) {
      deduped[idx] = pickRicherExperience(deduped[idx], exp);
    } else if (idx < 0) {
      deduped.push(exp);
    }
  }
  return deduped;
}

/**
 * @param {object} structured
 * @param {string} cleanText
 * @param {object} [opts]
 */
export function runExperienceReconstruction(structured, cleanText, opts = {}) {
  const clean = String(cleanText || '').trim();
  const existing = structured?.experiences || [];
  const reconstructed = reconstructExperiencesFromText(clean, existing);
  const merged = mergeExperienceLists(existing, reconstructed);

  structured.experiences = merged;
  structured.metadata = {
    ...(structured.metadata || {}),
    experienceReconstruction: {
      engine: EXPERIENCE_RECONSTRUCTION,
      reconstructedCount: reconstructed.length,
      totalExperiences: merged.length,
      companyInferenceMin: COMPANY_INFERENCE_CONFIDENCE_MIN,
      forced: Boolean(opts.force),
    },
  };

  hirelyDebugLog('EXPERIENCE_RECONSTRUCTION', {
    reconstructed: reconstructed.length,
    total: merged.length,
  });

  return {
    structured,
    reconstructed,
    experienceCount: merged.length,
  };
}

export { normalizeExperienceRole };
