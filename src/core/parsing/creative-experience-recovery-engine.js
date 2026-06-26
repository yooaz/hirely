/**
 * CREATIVE_EXPERIENCE_RECOVERY_ENGINE — recover creative CV experience without collapsing.
 *
 * Detects company, client, project, role, date as separate fields.
 * Splits merged freelance/agency/illustration/design lines; client brands stay in clients[]
 * (never spawned as per-client experience rows).
 */

import { clientNamesInText } from './field-sanitize.js';
import { findLongestDictionaryTerm, CLIENT_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { termMatchesHay } from '../../data/dictionaries/match-utils.js';
import { SCHOOL_TERMS } from '../../data/dictionaries/entity-catalog.js';
import { extractDateRangeFromText, titleCaseProfessional } from './parser-recovery.js';
import {
  parseSegmentedExperiences,
  parseExperienceGroupLight,
  EXPERIENCE_SEGMENTATION_ENGINE,
} from './experience-segmentation-engine.js';
import {
  classifyEmploymentKind,
  mustNeverMergeExperiences,
  EMPLOYMENT_KIND,
} from './experience-reconstruction-engine.js';
import { detectCreativeParsingMode, CREATIVE_ROLE_RE } from './creative-parsing-mode.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';

export const CREATIVE_EXPERIENCE_RECOVERY_ENGINE = 'CREATIVE_EXPERIENCE_RECOVERY_ENGINE';

export const CREATIVE_ENGAGEMENT_TYPES = Object.freeze([
  'freelance',
  'agency',
  'illustration',
  'design',
  'creative_director',
  'art_director',
]);

/** Client terms from entity catalog (no hardcoded brand list). */
export const CREATIVE_ANCHOR_CLIENTS = CLIENT_TERMS;

const DATE_RANGE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|aujourd'?hui|actuel)\b/i;

const PROJECT_SUFFIX_RE = /\bprojects?\b/i;
const AGENCY_RE = /\b(agency|agence|mccann|publicis|havas|betc|ddb|akqa|ogilvy|wpp)\b/i;
const BULLET_RE = /^[-•*]\s+/;
const EXP_SECTION_RE = /^experience\b/i;
const STOP_SECTION_RE = /^(education|skills|tools|languages|profile|summary|contact|formation)\b/i;

const ROLE_TYPE_RULES = [
  { type: 'creative_director', re: /\bcreative\s+director\b/i },
  { type: 'art_director', re: /\bart\s+director\b/i },
  { type: 'illustration', re: /\billustrator|illustration\b/i },
  { type: 'design', re: /\b(graphic\s+designer|designer|design)\b/i },
  { type: 'freelance', re: /\b(freelance|freelancer|independent|self[- ]?employed)\b/i },
  { type: 'agency', re: AGENCY_RE },
];

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function normKey(exp) {
  return [
    normSpace(exp?.role).toLowerCase(),
    normSpace(exp?.company).toLowerCase(),
    normSpace(exp?.client).toLowerCase(),
    normSpace(exp?.project).toLowerCase(),
    String(exp?.startDate || '').replace(/\D/g, '').slice(0, 8),
  ].join('|');
}

function isSchoolEntity(name) {
  const n = normSpace(name);
  if (!n) return false;
  return Boolean(findLongestDictionaryTerm(n, SCHOOL_TERMS)) || /\b(university|école|ecole|institute|college)\b/i.test(n);
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function extractCreativeClientEntities(text) {
  const hay = String(text || '');
  if (!hay) return [];

  const fromKeywords = clientNamesInText(hay);
  const fromDict = [];
  for (const term of CLIENT_TERMS || []) {
    if (termMatchesHay(hay, term) && !isSchoolEntity(term)) fromDict.push(term);
  }
  const seen = new Set();
  const out = [];
  for (const name of [...fromKeywords, ...fromDict]) {
    const key = normSpace(name).toLowerCase();
    if (!key || seen.has(key) || isSchoolEntity(name)) continue;
    if (/\badobe\s+(photoshop|illustrator|indesign|premiere|creative)\b/i.test(hay) && key === 'adobe') {
      if (!/\b(for|with|client|brand|nike|marvel|work)\b/i.test(hay)) continue;
    }
    seen.add(key);
    out.push(normSpace(name));
  }
  return out;
}

/**
 * @param {string} role
 * @param {string} company
 * @param {string} blob
 */
export function detectCreativeEngagementType(role = '', company = '', blob = '') {
  const text = normSpace(`${role} ${company} ${blob}`);
  for (const rule of ROLE_TYPE_RULES) {
    if (rule.re.test(text)) return rule.type;
  }
  if (CREATIVE_ROLE_RE.test(text)) return 'design';
  return 'freelance';
}

function globalClientHarvest(cleanText, careerLines = []) {
  const blob = [cleanText, ...careerLines].filter(Boolean).join('\n');
  return extractCreativeClientEntities(blob);
}

/**
 * @param {object} exp
 */
export function enrichCreativeExperienceFields(exp) {
  const role = normSpace(exp?.role || exp?.title || '');
  const company = normSpace(exp?.company || '');
  const blob = normSpace([role, company, exp?.description, ...(exp?.bullets || [])].join(' '));
  const dates = extractDateRangeFromText(blob || exp?.dates || '');
  const startDate = exp?.startDate || dates.startDate || '';
  const endDate = exp?.endDate || dates.endDate || '';
  const engagementType = detectCreativeEngagementType(role, company, blob);
  const employmentKind = classifyEmploymentKind({ role, company, description: blob, dates: exp?.dates });

  let client = normSpace(exp?.client || '');
  let project = normSpace(exp?.project || '');

  const companyTerm = findLongestDictionaryTerm(company, CLIENT_TERMS);
  if (companyTerm && !client) client = companyTerm;
  if (PROJECT_SUFFIX_RE.test(company)) {
    project = company;
    const brand = extractCreativeClientEntities(company)[0] || company.replace(PROJECT_SUFFIX_RE, '').trim();
    if (brand) client = brand;
  }

  const bulletClients = [];
  for (const b of exp?.bullets || []) {
    bulletClients.push(...extractCreativeClientEntities(b));
  }
  const clients = [...new Set([...(exp?.clients || []), ...bulletClients, ...(client ? [client] : [])])].filter(Boolean);

  return {
    ...exp,
    role: role ? titleCaseProfessional(role) : '',
    company,
    client: client || (companyTerm && employmentKind === EMPLOYMENT_KIND.FREELANCE ? companyTerm : ''),
    project,
    clients,
    startDate,
    endDate,
    dates: exp?.dates || (startDate ? `${startDate}–${endDate || 'Present'}` : ''),
    engagementType,
    employmentKind,
    recoverySource: exp?.recoverySource || CREATIVE_EXPERIENCE_RECOVERY_ENGINE,
  };
}

/**
 * P0 — attach client brands to parent experience; never create per-client jobs.
 * @param {object} parent
 * @param {string[]} clients
 */
export function mergeClientsIntoParentExperience(parent, clients = []) {
  const base = enrichCreativeExperienceFields(parent);
  const unique = [...new Set(clients.map((c) => normSpace(c)).filter(Boolean))];
  if (!unique.length) return base;
  return {
    ...base,
    clients: [...new Set([...(base.clients || []), ...unique])],
  };
}

/** @deprecated P0 lock — returns [] (clients belong in clients[], not experiences). */
export function expandClientEngagements(parent, clients = []) {
  return [];
}

/**
 * @param {string} cleanText
 */
export function harvestCreativeCareerLines(cleanText) {
  const lines = String(cleanText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out = [];
  let inExperience = false;

  for (const line of lines) {
    if (EXP_SECTION_RE.test(line)) {
      inExperience = true;
      continue;
    }
    if (STOP_SECTION_RE.test(line)) {
      inExperience = false;
      continue;
    }
    if (line.length > 110 && !DATE_RANGE_RE.test(line) && !/^[-•*]/.test(line)) continue;
    if (
      inExperience ||
      DATE_RANGE_RE.test(line) ||
      (CREATIVE_ROLE_RE.test(line) && line.length < 96) ||
      extractCreativeClientEntities(line).length >= 2
    ) {
      out.push(line);
    }
  }
  return out;
}

function experienceToLine(exp) {
  if (typeof exp === 'string') return normSpace(exp);
  const parts = [exp?.role, exp?.company, exp?.dates || exp?.startDate].filter(Boolean);
  return normSpace(parts.join(' — '));
}

function mergeWithoutCollapse(existing = [], incoming = []) {
  const out = [...existing];
  for (const candidate of incoming) {
    if (!candidate?.role && !candidate?.company && !candidate?.startDate) continue;
    const enriched = enrichCreativeExperienceFields(candidate);
    const idx = out.findIndex((e) => normKey(e) === normKey(enriched));
    if (idx >= 0) {
      const cur = out[idx];
      out[idx] = {
        ...cur,
        ...enriched,
        bullets: [...new Set([...(cur.bullets || []), ...(enriched.bullets || [])])],
        clients: [...new Set([...(cur.clients || []), ...(enriched.clients || [])])],
      };
      continue;
    }
    const blocker = out.find((e) => normKey(e) !== normKey(enriched) && !mustNeverMergeExperiences(e, enriched));
    if (blocker) {
      out.push(enriched);
      continue;
    }
    out.push(enriched);
  }
  return out;
}

/**
 * Split collapsed experience objects / lines into distinct entries.
 * @param {object[]} experiences
 * @param {string[]} [extraLines]
 */
export function recoverSegmentedCreativeExperiences(experiences = [], extraLines = []) {
  const lines = [];
  for (const exp of experiences) {
    if (typeof exp === 'string') lines.push(normSpace(exp));
    else {
      const line = experienceToLine(exp);
      if (line) lines.push(line);
      for (const b of exp?.bullets || []) {
        if (DATE_RANGE_RE.test(b) || CREATIVE_ROLE_RE.test(b)) lines.push(normSpace(b));
      }
    }
  }
  for (const line of extraLines) {
    const t = normSpace(line);
    if (t) lines.push(t);
  }

  const segmented = parseSegmentedExperiences(lines);
  if (segmented.count > 0) {
    return segmented.entries.map((e) =>
      enrichCreativeExperienceFields({
        role: e.title || e.role || '',
        company: e.company || '',
        startDate: e.startDate || '',
        endDate: e.endDate || '',
        dates: e.dates || '',
        bullets: e.bullets || [],
        clients: e.clients || [],
        recoverySource: CREATIVE_EXPERIENCE_RECOVERY_ENGINE,
        segmentationEngine: EXPERIENCE_SEGMENTATION_ENGINE,
      })
    );
  }

  return lines
    .map((line) => parseExperienceGroupLight([line]))
    .filter(Boolean)
    .map((e) => enrichCreativeExperienceFields({ ...e, recoverySource: CREATIVE_EXPERIENCE_RECOVERY_ENGINE }));
}

/**
 * @param {object} structured
 * @param {string} cleanedText
 * @param {object} [opts]
 */
export function runCreativeExperienceRecovery(structured, cleanedText, opts = {}) {
  if (!structured || typeof structured !== 'object') {
    return { structured, recovered: false, experiences: [], stats: {} };
  }

  const clean = String(cleanedText || '').trim();
  const creativeMode = opts.creativeMode || detectCreativeParsingMode(clean, { force: opts.forceCreative });
  if (!creativeMode.active && !opts.force) {
    return { structured, recovered: false, experiences: structured.experiences || [], stats: { skipped: true } };
  }

  const existing = [...(structured.experiences || [])];
  const harvested = harvestCreativeCareerLines(clean);
  const careerLines = [
    ...harvested,
    ...(structured.unsorted || []),
    ...(structured.clients || []).filter((l) => DATE_RANGE_RE.test(l) || CREATIVE_ROLE_RE.test(l)),
  ];

  let recovered = recoverSegmentedCreativeExperiences(
    existing.length ? existing : harvested.filter((l) => !BULLET_RE.test(l)),
    careerLines
  );
  recovered = mergeWithoutCollapse([], recovered);

  const harvestedClients = new Set(
    [...(structured.clients || []), ...globalClientHarvest(clean, careerLines)].map((c) => normSpace(c))
  );
  const anchorHits = new Set();
  const bulletBlob = careerLines.filter((l) => BULLET_RE.test(l)).join(' ');

  for (let i = 0; i < recovered.length; i++) {
    const enriched = enrichCreativeExperienceFields(recovered[i]);
    const bulletText = [...(enriched.bullets || []), enriched.description || '', bulletBlob].join(' ');
    const clients = extractCreativeClientEntities(bulletText);
    clients.forEach((c) => {
      anchorHits.add(c.toLowerCase());
      harvestedClients.add(c);
    });

    const isFreelanceParent =
      enriched.employmentKind === EMPLOYMENT_KIND.FREELANCE ||
      enriched.engagementType === 'freelance' ||
      enriched.engagementType === 'illustration' ||
      enriched.engagementType === 'design' ||
      /\b(freelance|independent)\b/i.test(`${enriched.role} ${enriched.company}`);

    if (clients.length >= 1 && isFreelanceParent) {
      recovered[i] = mergeClientsIntoParentExperience(enriched, clients);
    }
  }

  structured.clients = [...harvestedClients].filter(Boolean);

  const before = existing.length;
  const merged = mergeWithoutCollapse(existing, recovered);
  structured.experiences = merged.slice(0, opts.maxEntries || 48);

  const stats = {
    engine: CREATIVE_EXPERIENCE_RECOVERY_ENGINE,
    beforeCount: before,
    afterCount: structured.experiences.length,
    segmented: recovered.length,
    clientsHarvested: structured.clients.length,
    anchorClientsFound: [...anchorHits],
    engagementTypes: [...new Set(structured.experiences.map((e) => e.engagementType).filter(Boolean))],
  };

  structured.metadata = {
    ...(structured.metadata || {}),
    creativeExperienceRecovery: stats,
  };

  hirelyDebugLog('CREATIVE_EXPERIENCE_RECOVERY_ENGINE', stats);

  return {
    structured,
    recovered: structured.experiences.length > before || structured.clients.length > 0,
    experiences: structured.experiences,
    stats,
  };
}

/**
 * Audit matrix for report: source lines → recovered fields.
 * @param {string} rawText
 */
export function auditCreativeExperienceRecovery(rawText) {
  const clean = String(rawText || '').trim();
  const careerLines = harvestCreativeCareerLines(clean);

  const result = runCreativeExperienceRecovery(
    { experiences: [], clients: [], unsorted: [] },
    clean,
    { forceCreative: true }
  );
  const segmented = result.experiences || [];
  const rows = segmented.map((exp) => ({
    role: exp.role || '',
    company: exp.company || '',
    client: exp.client || '',
    project: exp.project || '',
    startDate: exp.startDate || '',
    endDate: exp.endDate || '',
    engagementType: exp.engagementType || '',
    clients: exp.clients || [],
    collapsed: false,
  }));

  const anchorExpected = CREATIVE_ANCHOR_CLIENTS.filter((c) => termMatchesHay(clean, c));
  const anchorRecovered = new Set(extractCreativeClientEntities(clean));
  for (const row of rows) {
    for (const c of [...(row.clients || []), row.client, row.company]) {
      if (c) anchorRecovered.add(c);
    }
  }
  const anchorFound = anchorExpected.filter((c) =>
    [...anchorRecovered].some((r) => r.toLowerCase() === c.toLowerCase())
  );

  const recallPct = anchorExpected.length
    ? Math.round((anchorFound.length / anchorExpected.length) * 100)
    : 100;

  return {
    engine: CREATIVE_EXPERIENCE_RECOVERY_ENGINE,
    sourceLineCount: careerLines.length,
    experienceCount: rows.length,
    rows,
    anchorExpected,
    anchorFound,
    recallPct,
    collapsed: rows.length < Math.max(2, careerLines.filter((l) => DATE_RANGE_RE.test(l)).length),
    expanded: result.stats?.expanded || 0,
  };
}
