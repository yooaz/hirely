/**
 * STAGE 1 — Fact extraction only. No CV sections built here.
 *
 * Output shape: { type, value, confidence } where confidence is 0–1.
 */

import { classifyLineWithConfidence } from './section-sanity.js';
import { classifySpecialtyLineV2 } from './classification-engine-v2.js';
import { classifySemanticBlockV2 } from './semantic-classifier-v2.js';
import { SECTION_IDS } from './section-types-v2.js';
import { splitListItems } from './rich-parser.js';
import { passesExperienceGate } from './section-sanity.js';
import { lookupLearnedClassification } from './classification-learning.js';
import { isValidIdentityName, isValidIdentityTitle } from './identity-extraction.js';
import { isValidSummaryField, isValidEducationItem } from './field-sanitize.js';
import { normalizeEmail, normalizePhone, isLanguageProficiencyLine } from './line-cleaner.js';
import { applyFactClassifier, classifyFactStrict } from './fact-classifier.js';
import { CLASSIFICATION_CONFIDENCE_MIN } from './classification-engine-v2.js';
import { FACT_CONFIDENCE_THRESHOLD } from './fact-types.js';

export const FACT_EXTRACTION_STAGE = 'FACT_EXTRACTION_V2';

/** Canonical fact types (singular). */
export const FACT_TYPES = Object.freeze([
  'identity',
  'contact',
  'summary',
  'experience',
  'education',
  'skill',
  'tool',
  'language',
  'client',
  'project',
  'award',
  'publication',
  'interest',
  'unknown',
]);

const BUCKET_TO_FACT_TYPE = Object.freeze({
  identity: 'identity',
  contact: 'contact',
  summary: 'summary',
  experience: 'experience',
  education: 'education',
  skills: 'skill',
  tools: 'tool',
  languages: 'language',
  clients: 'client',
  projects: 'project',
  awards: 'award',
  publications: 'publication',
  interests: 'interest',
  portfolioLinks: 'contact',
  exhibitions: 'publication',
  unsorted: 'unknown',
  garbage: 'unknown',
  empty: 'unknown',
  header: 'unknown',
});

const LIST_FACT_TYPES = new Set(['skill', 'tool', 'client', 'interest', 'project']);

const SECTION_ID_TO_FACT_TYPE = Object.freeze({
  [SECTION_IDS.PROFILE]: 'identity',
  [SECTION_IDS.PREAMBLE]: 'identity',
  [SECTION_IDS.CONTACT]: 'contact',
  [SECTION_IDS.SUMMARY]: 'summary',
  [SECTION_IDS.EXPERIENCE]: 'experience',
  [SECTION_IDS.EDUCATION]: 'education',
  [SECTION_IDS.SKILLS]: 'skill',
  [SECTION_IDS.TOOLS]: 'tool',
  [SECTION_IDS.LANGUAGES]: 'language',
  [SECTION_IDS.CLIENTS]: 'client',
  [SECTION_IDS.PROJECTS]: 'project',
  [SECTION_IDS.AWARDS]: 'award',
  [SECTION_IDS.PUBLICATIONS]: 'publication',
  [SECTION_IDS.EXHIBITIONS]: 'publication',
  [SECTION_IDS.PORTFOLIO]: 'contact',
  [SECTION_IDS.UNKNOWN]: 'unknown',
});

let _factSeq = 0;

function nextFactId() {
  _factSeq += 1;
  return `fact-${Date.now()}-${_factSeq}`;
}

/**
 * @typedef {object} ResumeFact
 * @property {string} id
 * @property {string} type
 * @property {string} value
 * @property {number} confidence 0–1
 * @property {string} [sourceLine]
 * @property {string} [bucket]
 * @property {string[]} [signals]
 */

/**
 * @param {string} bucket
 * @returns {string}
 */
export function bucketToFactType(bucket) {
  return BUCKET_TO_FACT_TYPE[bucket] || 'unknown';
}

/**
 * @param {string} line
 * @returns {{ bucket: string, confidence: number, signals?: string[] }}
 */
const MULTI_LANGUAGE_RE =
  /\b(english|french|german|spanish|italian|dutch|portuguese|arabic|français|anglais|allemand|espagnol|italien|nederlands)\s*[—–-]\s*(native|fluent|bilingual|courant|vloeiend|professional|professionnel|conversational|intermediate|intermédiaire|basic|notions|débutant)/gi;

function splitMultipleLanguageLines(line) {
  const l = String(line || '').trim();
  const matches = [...l.matchAll(MULTI_LANGUAGE_RE)];
  if (matches.length < 2) return [];
  return matches.map((m) => {
    const lang = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    const level = m[2].toLowerCase();
    return `${lang} — ${level}`;
  });
}

function classifyLineForFacts(line) {
  const sem = classifySemanticBlockV2(line);
  if (sem?.needsReview || sem?.requiresRecruiterReview || (sem?.alternatives?.length ?? 0) >= 2) {
    return {
      bucket: 'unsorted',
      confidence: sem.confidence,
      signals: sem.signals,
      alternatives: sem.alternatives,
      rawType: sem.rawType,
      needsRecruiterReview: true,
      classifyReason: sem.reason,
    };
  }
  if (sem && sem.bucket !== 'unsorted' && sem.confidence >= CLASSIFICATION_CONFIDENCE_MIN) {
    return {
      bucket: sem.bucket,
      confidence: sem.confidence,
      signals: sem.signals,
    };
  }
  const v2 = classifySpecialtyLineV2(line);
  if (v2 && v2.bucket !== 'unsorted') {
    return {
      bucket: v2.bucket,
      confidence: v2.confidence,
      signals: v2.signals,
    };
  }
  return classifyLineWithConfidence(line);
}

/**
 * Build atomic fact values from a classified line.
 * @param {string} line
 * @param {string} factType
 * @returns {string[]}
 */
function atomicValuesFromLine(line, factType) {
  const l = String(line || '').trim();
  if (!l) return [];

  if (factType === 'language') {
    const multi = splitMultipleLanguageLines(l);
    if (multi.length >= 2) return multi;
    if (isLanguageProficiencyLine(l)) return [l];
    if (/\s[—–-]\s/.test(l)) return [l];
    const parts = splitListItems(l).filter((p) => isLanguageProficiencyLine(p) || p.split(/\s+/).length <= 2);
    if (parts.length) return parts;
    if (l.length > 1 && l.length <= 64) return [l];
    return [];
  }

  if (!LIST_FACT_TYPES.has(factType)) {
    if (factType === 'education' && isValidEducationItem(l)) return [l];
    if (factType === 'identity') {
      if (isValidIdentityName(l)) return [l];
      if (isValidIdentityTitle(l)) return [l];
    }
    return [l];
  }

  const parts = splitListItems(l);
  if (parts.length >= 2) {
    return parts.map((p) => p.trim()).filter((p) => p.length > 1 && p.length <= 80);
  }
  if (l.length > 1 && l.length <= 80) return [l];
  return [];
}

/**
 * Extract facts from a single line. Does not assign to CV sections.
 * @param {string} line
 * @param {object} [opts]
 * @returns {ResumeFact[]}
 */
export function extractFactsFromLine(line, opts = {}) {
  const l = String(line || '').trim();
  if (!l || l.length < 2) return [];

  const hit = classifyLineForFacts(l);
  const lineFactType = bucketToFactType(hit.bucket);
  const lineConfidence = (hit.confidence || 0) / 100;
  const lineConfident =
    !hit.needsRecruiterReview &&
    lineFactType !== 'unknown' &&
    (hit.confidence || 0) >= CLASSIFICATION_CONFIDENCE_MIN &&
    hit.bucket !== 'unsorted';

  let factType = lineConfident ? lineFactType : hit.needsRecruiterReview ? 'unknown' : lineFactType;
  let confidence = hit.needsRecruiterReview
    ? Math.min(lineConfidence, FACT_CONFIDENCE_THRESHOLD - 0.01)
    : lineConfidence;

  if (!lineConfident && opts.hintType && opts.hintType !== 'unknown') {
    factType = opts.hintType;
    confidence = Math.min(confidence, FACT_CONFIDENCE_THRESHOLD - 0.01);
  }

  if (factType === 'experience' && !passesExperienceGate(l) && hit.bucket !== 'experience') {
    factType = 'unknown';
    confidence = Math.min(confidence, 0.79);
  }

  const values = atomicValuesFromLine(l, factType);
  if (!values.length) {
    const learned = lookupLearnedClassification(l);
    return [
      classifyFactStrict({
        id: nextFactId(),
        type: learned?.type || (factType === 'unknown' ? 'unknown' : factType),
        value: l.slice(0, 200),
        confidence: learned ? Math.max(confidence, learned.confidence) : confidence,
        sourceLine: l,
        lineConfidence,
        bucket: hit.bucket,
        signals: learned ? [...(hit.signals || []), 'learned'] : hit.signals || [],
        learned: !!learned,
        sectionHint: opts.hintType,
        alternatives: hit.alternatives,
        rawType: hit.rawType,
        needsRecruiterReview: hit.needsRecruiterReview,
        classifyReason: hit.classifyReason,
      }),
    ];
  }

  return values.map((value) => {
    const learned = lookupLearnedClassification(value);
    const type = learned?.type || factType;
    const conf = learned ? Math.max(confidence, learned.confidence) : confidence;
    return classifyFactStrict({
      id: nextFactId(),
      type,
      value,
      confidence: conf,
      sourceLine: values.length > 1 ? value : l,
      lineConfidence,
      bucket: hit.bucket,
      signals: learned ? [...(hit.signals || []), 'learned'] : hit.signals || [],
      learned: !!learned,
      sectionHint: opts.hintType,
      alternatives: hit.alternatives,
      rawType: hit.rawType,
      needsRecruiterReview: hit.needsRecruiterReview,
      classifyReason: hit.classifyReason,
    });
  });
}

/**
 * @param {string[]} lines
 * @param {object} [opts]
 * @returns {ResumeFact[]}
 */
export function extractFactsFromLines(lines, opts = {}) {
  const facts = [];
  for (const line of lines || []) {
    facts.push(...extractFactsFromLine(line, opts));
  }
  return dedupeFacts(facts);
}

/**
 * Stage 1 — extract facts from classified section blocks (no CV build).
 * @param {import('./section-types-v2.js').SectionBlockV2[]} classifiedBlocks
 * @param {object} [opts]
 * @returns {ResumeFact[]}
 */
export function extractFactsFromSectionBlocks(classifiedBlocks, opts = {}) {
  const facts = [];

  for (const block of classifiedBlocks || []) {
    const hintType = SECTION_ID_TO_FACT_TYPE[block.type] || 'unknown';

    for (const line of block.lines || []) {
      const lineFacts = extractFactsFromLine(line, { hintType });
      for (const fact of lineFacts) {
        const lineConf = fact.lineConfidence ?? fact.confidence;
        facts.push(
          classifyFactStrict({
            ...fact,
            confidence: lineConf,
            lineConfidence: lineConf,
            sectionHint: SECTION_ID_TO_FACT_TYPE[block.type] || undefined,
            classifyReason: block.classifyReason,
          })
        );
      }
    }
  }

  if (opts.rawText) {
    const email = normalizeEmail(opts.rawText);
    const phone = normalizePhone(opts.rawText);
    if (email) {
      facts.push({
        id: nextFactId(),
        type: 'contact',
        value: email,
        confidence: 0.98,
        sourceLine: email,
        bucket: 'contact',
      });
    }
    if (phone) {
      facts.push({
        id: nextFactId(),
        type: 'contact',
        value: phone,
        confidence: 0.96,
        sourceLine: phone,
        bucket: 'contact',
      });
    }
  }

  return dedupeFacts(applyFactClassifier(facts));
}

/**
 * @param {ResumeFact[]} facts
 * @returns {ResumeFact[]}
 */
export function dedupeFacts(facts) {
  const seen = new Set();
  const out = [];
  for (const fact of facts || []) {
    const key = `${fact.type}|${String(fact.value).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fact);
  }
  return out;
}
