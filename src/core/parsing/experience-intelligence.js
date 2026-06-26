/**
 * EXPERIENCE_INTELLIGENCE — unified experience normalization (H2).
 *
 * Detects role, company, dates; classifies freelance missions and internships;
 * merges fragmented OCR blocks and sparse experience rows.
 *
 * Examples:
 *   Designer / McCann G Agency / 2011-2014 → one experience
 *   Freelance Illustrator / Graphic Designer / Independent / 2011-2022 → one experience
 */

import { extractDateRangeFromText, titleCaseProfessional } from './parser-recovery.js';
import {
  buildExperienceEntryFromLineGroup,
  normalizeExperienceRole,
  qualifiesStrictExperience,
  scoreStrictExperienceEntry,
} from './experience-parser.js';
import { normalizeExperienceFields } from './experience-builder-v2.js';
import { reconstructAllExperienceSemantics } from './experience-semantic-layer.js';
import {
  mergeFragmentedExperienceBlocks,
  applyMergedExperiencesToStructured,
} from './experience-block-merge.js';
import { reconstructExperiencesFromText } from './experience-reconstruction.js';
import {
  reconstructExperienceEntries,
  mustNeverMergeExperiences,
  EXPERIENCE_RECONSTRUCTION_ENGINE,
} from './experience-reconstruction-engine.js';
import { mergeFragmentedOcrLines } from './ocr-experience-merge.js';
import { parseDashSeparatedExperienceLine } from './classification-fixes.js';
import {
  DATE_RANGE_RE,
  FREELANCE_RE,
  INTERNSHIP_RE,
  GENERIC_ROLE_WORDS_RE,
} from './generic-career-signals.js';
import { lineLooksLikeRole } from '../../data/dictionaries/roleKeywords.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';

export const EXPERIENCE_INTELLIGENCE = 'EXPERIENCE_INTELLIGENCE';
export const EXPERIENCE_INTELLIGENCE_RECALL_GOAL = 0.9;

const BULLET_RE = /^[-•*]\s+/;
const YEAR_PAIR_RE =
  /^\s*((?:19|20)\d{2})\s+((?:19|20)\d{2}|present|présent|current|now|actuel)\s*$/i;
const ROLE_ONLY_RE =
  /^(?:(?:lead|senior|art|visual|creative|freelance)\s+)?(?:illustrator|designer|director|manager|engineer|developer|analyst|consultant)(?:\s*\/\s*(?:designer|illustrator))?$/i;
const COMPANY_ONLY_RE =
  /^[A-ZÀ-Ö][\w&.'-]+(?:\s+(?:Paris|London|G\.?\s*Agency|Agency|Conseil|Inc\.?|LLC|[A-ZÀ-Ö][\w&.'-]+)){0,5}$/i;

function normKey(exp) {
  return [
    String(exp?.role || '').toLowerCase().trim(),
    String(exp?.company || '').toLowerCase().trim(),
    String(exp?.startDate || exp?.dates || '').replace(/\D/g, '').slice(0, 8),
  ].join('|');
}

function normSpace(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fieldStrength(exp) {
  const role = normSpace(exp?.role);
  const company = normSpace(exp?.company);
  const dates = normSpace(exp?.dates || exp?.startDate);
  return (role ? 1 : 0) + (company ? 1 : 0) + (dates ? 1 : 0);
}

function isSparseExperience(exp) {
  return fieldStrength(exp) <= 1;
}

/**
 * @param {string|string[]} input
 */
export function detectExperienceRole(input) {
  const lines = Array.isArray(input) ? input : String(input || '').split(/\r?\n/);
  for (const line of lines) {
    const l = normSpace(line);
    if (!l || BULLET_RE.test(l)) continue;
    const dash = parseDashSeparatedExperienceLine(l);
    if (dash?.role) {
      return titleCaseProfessional(normalizeExperienceRole(dash.role, l));
    }
    if (DATE_RANGE_RE.test(l) && !GENERIC_ROLE_WORDS_RE.test(l) && !ROLE_ONLY_RE.test(l)) continue;
    if (YEAR_PAIR_RE.test(l)) continue;
    if (COMPANY_ONLY_RE.test(l) && !ROLE_ONLY_RE.test(l) && !lineLooksLikeRole(l)) continue;
    if (ROLE_ONLY_RE.test(l) || GENERIC_ROLE_WORDS_RE.test(l) || lineLooksLikeRole(l) || FREELANCE_RE.test(l)) {
      return titleCaseProfessional(normalizeExperienceRole(l, l));
    }
  }
  const blob = lines.join(' ');
  const m = blob.match(
    /\b((?:(?:Lead|Senior|Art|Visual|Creative|Freelance)\s+)?(?:Illustrator|Designer|Director|Manager|Engineer|Developer|Consultant|Analyst)(?:\s*\/\s*(?:Designer|Illustrator))?)\b/i
  );
  return m ? titleCaseProfessional(normalizeExperienceRole(m[1], blob)) : '';
}

/**
 * @param {string|string[]} input
 * @param {string} [role]
 */
export function detectExperienceCompany(input, role = '') {
  const lines = Array.isArray(input) ? input : String(input || '').split(/\r?\n/);
  const blob = lines.join(' ');

  for (const line of lines) {
    const dash = parseDashSeparatedExperienceLine(normSpace(line));
    if (dash?.company) return dash.company;
  }

  if (FREELANCE_RE.test(`${role} ${blob}`)) {
    return 'Independent / Freelance';
  }

  for (const line of lines) {
    const l = normSpace(line);
    if (!l || BULLET_RE.test(l)) continue;
    if (YEAR_PAIR_RE.test(l) || DATE_RANGE_RE.test(l)) continue;
    if (COMPANY_ONLY_RE.test(l) && !ROLE_ONLY_RE.test(l)) return l;
    if (/^[A-ZÀ-Ö]/.test(l) && !ROLE_ONLY_RE.test(l) && l.length >= 3 && l.length <= 56) {
      if (!GENERIC_ROLE_WORDS_RE.test(l) || /\b(agency|studio|group|conseil|paris|london)\b/i.test(l)) {
        return l;
      }
    }
  }
  return '';
}

/**
 * @param {string|string[]} input
 */
export function detectExperienceDates(input) {
  const blob = Array.isArray(input) ? input.join(' ') : String(input || '');
  const dr = extractDateRangeFromText(blob);
  if (!dr.startDate) return { dates: '', startDate: '', endDate: '' };
  const end = dr.endDate || 'Present';
  return {
    dates: `${dr.startDate}–${end}`,
    startDate: dr.startDate,
    endDate: end,
  };
}

/**
 * @param {object} exp
 */
export function detectFreelanceMission(exp) {
  const blob = normSpace([exp?.role, exp?.company, exp?.description, ...(exp?.bullets || [])].join(' '));
  return FREELANCE_RE.test(blob);
}

/**
 * @param {object} exp
 */
export function detectInternship(exp) {
  const blob = normSpace([exp?.role, exp?.company, exp?.description, ...(exp?.bullets || [])].join(' '));
  return INTERNSHIP_RE.test(blob);
}

function classifyEngagementType(exp) {
  if (detectInternship(exp)) return 'internship';
  if (detectFreelanceMission(exp)) return 'freelance';
  return 'employment';
}

function buildEntryFromLines(lines) {
  const filtered = lines.map((l) => normSpace(l)).filter(Boolean);
  if (!filtered.length) return null;

  let entry = buildExperienceEntryFromLineGroup(filtered);
  if (!entry) {
    const dates = detectExperienceDates(filtered);
    const role = detectExperienceRole(filtered);
    const company = detectExperienceCompany(filtered, role);
    if (role || company || dates.startDate) {
      entry = {
        role,
        company,
        ...dates,
        bullets: filtered.filter((l) => BULLET_RE.test(l)).map((l) => l.replace(BULLET_RE, '').trim()),
        clients: [],
        location: '',
      };
    }
  }
  if (!entry) return null;

  const ctx = filtered.join('\n');
  entry.confidence = scoreStrictExperienceEntry(entry, ctx);
  if (!qualifiesStrictExperience(entry, ctx) && fieldStrength(entry) < 2) return null;

  return entry;
}

/**
 * Merge consecutive sparse OCR rows (role / company / dates on separate lines).
 * @param {object[]} experiences
 */
export function mergeFragmentedExperienceEntries(experiences = []) {
  const list = (experiences || []).filter(Boolean);
  if (list.length < 2) return list;

  const out = [];
  let bucket = [];

  const flush = () => {
    if (!bucket.length) return;
    if (bucket.length === 1) {
      out.push(bucket[0]);
    } else {
      const lines = bucket.flatMap((e) =>
        [e.role, e.company, e.dates || e.startDate, ...(e.bullets || [])].filter(Boolean)
      );
      const merged = buildEntryFromLines(lines) || {
        role: bucket.map((e) => e.role).find(Boolean) || '',
        company: bucket.map((e) => e.company).find(Boolean) || '',
        ...detectExperienceDates(lines.join(' ')),
        bullets: bucket.flatMap((e) => e.bullets || []),
        clients: [],
        location: '',
      };
      merged.confidence = Math.max(...bucket.map((e) => e.confidence || 0), merged.confidence || 82);
      merged.mergedFromFragments = bucket.length;
      out.push(merged);
    }
    bucket = [];
  };

  for (const exp of list) {
    if (isSparseExperience(exp)) {
      const prev = bucket[bucket.length - 1];
      if (prev && mustNeverMergeExperiences(prev, exp)) {
        flush();
        bucket = [exp];
      } else {
        bucket.push(exp);
      }
      continue;
    }
    flush();
    out.push(exp);
  }
  flush();

  const deduped = [];
  const seen = new Set();
  for (const exp of out) {
    const key = normKey(exp);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(exp);
  }
  return deduped;
}

function isCompleteStructuredExperience(exp) {
  const role = normSpace(exp?.role);
  const company = normSpace(exp?.company);
  const startDate = normSpace(exp?.startDate || String(exp?.dates || '').split(/[-–—]/)[0]);
  return !!(role && company && startDate && !/[—–]/.test(role) && !/^role to confirm$/i.test(role));
}

function enrichExperienceFields(exp) {
  const lines = [exp.role, exp.company, exp.dates, exp.startDate, ...(exp.bullets || [])].filter(Boolean);
  const blob = lines.join('\n');

  let role = normSpace(exp.role) || detectExperienceRole(lines.length ? lines : blob);
  let company = normSpace(exp.company);
  if (!company || (role && company.toLowerCase() === role.toLowerCase())) {
    company = detectExperienceCompany(lines.length ? lines : blob, role) || company;
  }
  if (role && company && role.toLowerCase() === company.toLowerCase() && FREELANCE_RE.test(role)) {
    company = 'Independent';
  }
  const dates = detectExperienceDates(blob);

  if (!exp.dates && dates.dates) {
    exp.dates = dates.dates;
    exp.startDate = exp.startDate || dates.startDate;
    exp.endDate = exp.endDate || dates.endDate;
  }

  if (FREELANCE_RE.test(`${role} ${company} ${blob}`) && (!company || /^independent\b/i.test(company))) {
    company = 'Independent / Freelance';
  }

  if (detectInternship({ role, company, bullets: exp.bullets })) {
    if (/\binternship\b/i.test(company) && !/\bintern\b/i.test(role)) {
      company = company.replace(/\s+internship\s*$/i, '').trim();
      role = role || 'Intern';
    }
    if (
      !/\bintern\b/i.test(role) &&
      INTERNSHIP_RE.test(role) &&
      !/\b(engineer|engineering|developer|designer|analyst|scientist|assistant)\b/i.test(role)
    ) {
      role = role.replace(/\binternship\b/gi, 'Intern').trim();
    }
  }

  const combinedRole = [role, company]
    .filter(Boolean)
    .join(' / ');
  if (
    /\billustrator\b/i.test(combinedRole) &&
    /\bgraphic\s+designer\b/i.test(combinedRole) &&
    FREELANCE_RE.test(combinedRole)
  ) {
    role = 'Freelance Illustrator / Graphic Designer';
    company = 'Independent / Freelance';
  }

  exp.role = role ? titleCaseProfessional(normalizeExperienceRole(role, blob)) : exp.role;
  exp.company = company || exp.company;
  exp.engagementType = classifyEngagementType(exp);
  exp.isFreelance = exp.engagementType === 'freelance';
  exp.isInternship = exp.engagementType === 'internship';

  return normalizeExperienceFields(exp);
}

function dedupeExperiences(experiences) {
  const out = [];
  const seen = new Set();
  for (const exp of experiences) {
    const key = normKey(exp);
    if (!key.replace(/\|/g, '').length) {
      out.push(exp);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(exp);
  }
  return out;
}

/**
 * Unified experience normalizer — H2 entry point.
 *
 * @param {object} input
 * @param {object[]} [input.experiences]
 * @param {object[]} [input.blocks]
 * @param {string} [input.cleanText]
 * @param {object} [opts]
 */
export function experienceNormalizer(input = {}, opts = {}) {
  const stats = {
    engine: EXPERIENCE_INTELLIGENCE,
    inputCount: 0,
    blockMerged: 0,
    textReconstructed: 0,
    fragmentMerged: 0,
    outputCount: 0,
    freelanceCount: 0,
    internshipCount: 0,
  };

  let experiences = [...(input.experiences || [])];
  stats.inputCount = experiences.length;
  const completeInputCount = experiences.filter(isCompleteStructuredExperience).length;
  const minExpected = opts.minExpected ?? Math.max(1, completeInputCount);

  if (input.blocks?.length) {
    const blockMerge = mergeFragmentedExperienceBlocks(input.blocks, {
      cleanedText: input.cleanText,
      minExpected: opts.minExpected ?? 3,
      minConfidence: opts.minConfidence,
    });
    if (blockMerge.experiences?.length) {
      const structured = { experiences };
      applyMergedExperiencesToStructured(structured, blockMerge.experiences);
      experiences = structured.experiences;
      stats.blockMerged = blockMerge.mergedCount;
    }
  }

  const cleanText = String(input.cleanText || '').trim();
  const minExpectedResolved = opts.minExpected ?? Math.max(1, completeInputCount);
  if (cleanText.length >= 40) {
    const reconstructed = reconstructExperiencesFromText(cleanText, experiences);
    if (reconstructed.length) {
      const seen = new Set(experiences.map(normKey));
      let added = 0;
      for (const exp of reconstructed) {
        const key = normKey(exp);
        if (seen.has(key)) continue;
        const dup = experiences.find(
          (e) =>
            String(e.company || '').toLowerCase() === String(exp.company || '').toLowerCase() &&
            String(e.company || '').length >= 2 &&
            String(e.startDate || e.dates || '').slice(0, 4) ===
              String(exp.startDate || exp.dates || '').slice(0, 4)
        );
        if (dup) continue;
        seen.add(key);
        experiences.push(exp);
        added++;
      }
      stats.textReconstructed = added;
    }
  }

  if (cleanText.length >= 20 && experiences.length < minExpectedResolved && completeInputCount < minExpectedResolved) {
    const lines = mergeFragmentedOcrLines(cleanText);
    const groups = [];
    let group = [];
    for (const line of lines) {
      const l = normSpace(line);
      if (!l) continue;
      if (DATE_RANGE_RE.test(l) || YEAR_PAIR_RE.test(l) || ROLE_ONLY_RE.test(l) || COMPANY_ONLY_RE.test(l)) {
        group.push(l);
        if (DATE_RANGE_RE.test(l) || YEAR_PAIR_RE.test(l)) {
          groups.push(group);
          group = [];
        }
      } else if (group.length) {
        group.push(l);
      }
    }
    if (group.length) groups.push(group);

    for (const g of groups) {
      const entry = buildEntryFromLines(g);
      if (!entry) continue;
      const key = normKey(entry);
      if (experiences.some((e) => normKey(e) === key)) continue;
      experiences.push(entry);
    }
  }

  const rebuilt = reconstructExperienceEntries(experiences);
  experiences = rebuilt.entries;
  stats.reconstructionEngine = EXPERIENCE_RECONSTRUCTION_ENGINE;
  stats.reconstructedCount = rebuilt.count;

  const beforeFragment = experiences.length;
  experiences = mergeFragmentedExperienceEntries(experiences);
  stats.fragmentMerged = Math.max(0, beforeFragment - experiences.length);

  experiences = experiences.map(enrichExperienceFields);
  experiences = reconstructAllExperienceSemantics(experiences);
  experiences = experiences.map(enrichExperienceFields);
  experiences = dedupeExperiences(experiences);

  stats.freelanceCount = experiences.filter((e) => e.isFreelance).length;
  stats.internshipCount = experiences.filter((e) => e.isInternship).length;
  stats.outputCount = experiences.length;

  hirelyDebugLog(EXPERIENCE_INTELLIGENCE, stats);

  return {
    experiences,
    stats,
    metadata: {
      engine: EXPERIENCE_INTELLIGENCE,
      ...stats,
    },
  };
}
