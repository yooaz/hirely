/**
 * FACT CLASSIFIER — strict fact layer after line extraction.
 *
 * Output: { type, value, confidence, sourceLine }
 * Wrong category = demote to unknown / review. Unknown = acceptable.
 * Confidence < 0.8 → suggestions queue (handled in cv-from-facts).
 */

import { classifySpecialtyLineV2, CLASSIFICATION_CONFIDENCE_MIN } from './classification-engine-v2.js';
import { FACT_CONFIDENCE_THRESHOLD } from './fact-types.js';
import {
  satisfiesLanguageContract,
  satisfiesToolContract,
  satisfiesClientContract,
  satisfiesEducationContract,
  satisfiesSkillContract,
} from './cv-section-contract.js';
import { passesExperienceGate } from './section-sanity.js';
import { isAcademicEmploymentContext } from './education-confidence.js';
import { isValidSummaryField } from './field-sanitize.js';
import { isLanguageProficiencyLine } from './line-cleaner.js';

export const FACT_CLASSIFIER_VERSION = 'fact-classifier-v1';

/** Canonical fact types (spec). */
export const ALLOWED_FACT_TYPES = Object.freeze([
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
  'interest',
  'unknown',
]);

const STRICT_TYPES = Object.freeze(['language', 'tool', 'client', 'education', 'skill']);

const CONTRACT_BY_TYPE = Object.freeze({
  language: satisfiesLanguageContract,
  tool: satisfiesToolContract,
  client: satisfiesClientContract,
  education: satisfiesEducationContract,
  skill: satisfiesSkillContract,
});

const PROFICIENCY_ONLY = new Set([
  'native',
  'fluent',
  'bilingual',
  'courant',
  'vloeiend',
  'professional',
  'professionnel',
  'conversational',
  'intermediate',
  'intermédiaire',
  'basic',
  'notions',
  'débutant',
]);

const SOFTWARE_IN_BRAND_RE =
  /\b(creative\s+suite|photoshop|illustrator|indesign|premiere|after\s+effects|lightroom|xd)\b/i;

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function isProseSummaryLine(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  if (satisfiesEducationContract(l).valid) return false;
  if (isLanguageProficiencyLine(l)) return false;
  const words = l.split(/\s+/).filter(Boolean);
  if (words.length < 12 && !/[.!?]/.test(l)) return false;
  if (satisfiesSkillContract(l).valid && words.length <= 6 && !l.includes(',')) return false;
  return isValidSummaryField(l);
}

function isSoftwareBrandLine(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (SOFTWARE_IN_BRAND_RE.test(raw)) return true;
  return /^(photoshop|illustrator|indesign|figma|sketch|premiere|after effects|affinity designer)$/i.test(
    raw
  );
}

/**
 * Single-token brands (Adobe, Pantone) → client unless clearly software product.
 * @param {string} value
 * @returns {'client'|'tool'|null}
 */
function resolveToolVsClient(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const clientOk = satisfiesClientContract(raw).valid;
  const toolOk = satisfiesToolContract(raw).valid;
  if (!clientOk && !toolOk) return null;
  if (isSoftwareBrandLine(raw)) return 'tool';
  if (clientOk && raw.split(/\s+/).length <= 2) return 'client';
  if (toolOk) return 'tool';
  if (clientOk) return 'client';
  return null;
}

/**
 * @param {string} value
 * @returns {{ type: string, confidence: number } | null}
 */
function findContractMatch(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const toolClient = resolveToolVsClient(raw);
  if (toolClient) {
    return { type: toolClient, confidence: FACT_CONFIDENCE_THRESHOLD };
  }

  for (const type of STRICT_TYPES) {
    const validator = CONTRACT_BY_TYPE[type];
    if (validator?.(raw).valid) {
      return { type, confidence: FACT_CONFIDENCE_THRESHOLD };
    }
  }
  return null;
}

/**
 * Line-level specialty classification (precision-first).
 * @param {string} line
 */
function specialtyFactHit(line) {
  const hit = classifySpecialtyLineV2(line);
  if (!hit?.type || hit.type === 'unknown') return null;
  if ((hit.confidence || 0) < CLASSIFICATION_CONFIDENCE_MIN) return null;
  return {
    type: hit.type,
    confidence: clamp01(hit.confidence / 100),
  };
}

/**
 * Normalize language fact value — keep full proficiency line, reject bare level tokens.
 * @param {string} value
 * @param {string} sourceLine
 */
function normalizeLanguageFactValue(value, sourceLine) {
  const src = String(sourceLine || value || '').trim();
  const val = String(value || '').trim();
  if (!val) return null;

  const low = val.toLowerCase();
  if (PROFICIENCY_ONLY.has(low)) return null;

  if (isLanguageProficiencyLine(src)) return src;
  if (satisfiesLanguageContract(src).valid) return src;
  if (satisfiesLanguageContract(val).valid) return val;

  if (/\s[—–-]\s/.test(src)) {
    const lang = src.split(/\s[—–-]\s/)[0]?.trim();
    if (lang && satisfiesLanguageContract(lang).valid) return src;
  }

  return null;
}

/**
 * @param {string} type
 * @param {string} value
 */
export function satisfiesFactTypeContract(type, value) {
  const t = String(type || '').trim().toLowerCase();
  const validator = CONTRACT_BY_TYPE[t];
  if (!validator) return { valid: true, reason: '' };
  return validator(value);
}

/**
 * Classify and validate one fact. Line specialty + contracts beat section hints.
 * @param {object} fact
 * @returns {object}
 */
export function classifyFactStrict(fact) {
  const sourceLine = String(fact?.sourceLine || fact?.value || '').trim();
  const value = String(fact?.value || sourceLine).trim();
  if (!value || value.length < 2) {
    return {
      type: 'unknown',
      value,
      confidence: 0,
      sourceLine,
      classifierReason: 'empty_value',
    };
  }

  let type = String(fact?.type || 'unknown').trim().toLowerCase();
  let confidence = clamp01(fact?.confidence ?? 0);
  const lineConfidence = clamp01(fact?.lineConfidence ?? confidence);
  let classifierReason = 'passthrough';

  const specialty = specialtyFactHit(sourceLine);
  if (passesExperienceGate(sourceLine) && isAcademicEmploymentContext(sourceLine)) {
    type = 'experience';
    confidence = Math.max(confidence, FACT_CONFIDENCE_THRESHOLD);
    classifierReason = 'academic_employment';
  } else if (type === 'experience' && passesExperienceGate(sourceLine)) {
    classifierReason = 'experience_gate';
  } else if (specialty) {
    type = specialty.type;
    confidence = Math.max(confidence, specialty.confidence);
    classifierReason = 'line_specialty_v2';
  } else if (isProseSummaryLine(sourceLine)) {
    type = 'summary';
    confidence = Math.max(confidence, FACT_CONFIDENCE_THRESHOLD);
    classifierReason = 'prose_summary';
  } else if (type === 'unknown' && fact?.sectionHint) {
    type = String(fact.sectionHint).toLowerCase();
    confidence = Math.min(confidence, FACT_CONFIDENCE_THRESHOLD - 0.01);
    classifierReason = 'section_hint_low';
  }

  if (type === 'experience' && !passesExperienceGate(sourceLine)) {
    const edu = satisfiesEducationContract(sourceLine);
    if (edu.valid) {
      type = 'education';
      confidence = Math.max(confidence, FACT_CONFIDENCE_THRESHOLD);
      classifierReason = 'education_not_experience';
    } else {
      type = 'unknown';
      confidence = Math.min(confidence, FACT_CONFIDENCE_THRESHOLD - 0.01);
      classifierReason = 'failed_experience_gate';
    }
  }

  if (type === 'experience' && passesExperienceGate(sourceLine) && !isAcademicEmploymentContext(sourceLine)) {
    const edu = satisfiesEducationContract(sourceLine);
    if (edu.valid) {
      type = 'education';
      confidence = Math.max(confidence, FACT_CONFIDENCE_THRESHOLD);
      classifierReason = 'degree_line_not_experience';
    }
  }

  if (
    (type === 'education' || type === 'unknown') &&
    passesExperienceGate(sourceLine) &&
    isAcademicEmploymentContext(sourceLine)
  ) {
    type = 'experience';
    confidence = Math.max(confidence, FACT_CONFIDENCE_THRESHOLD);
    classifierReason = 'academic_employment_override';
  }

  if (type === 'language') {
    const normalized = normalizeLanguageFactValue(value, sourceLine);
    if (!normalized) {
      type = 'unknown';
      confidence = Math.min(confidence, FACT_CONFIDENCE_THRESHOLD - 0.01);
      classifierReason = 'invalid_language_token';
    } else {
      return finalizeFact({
        ...fact,
        type: 'language',
        value: normalized,
        confidence,
        sourceLine,
        lineConfidence,
        classifierReason: 'language_normalized',
      });
    }
  }

  const toolClient = resolveToolVsClient(value);
  if (toolClient && (type === 'tool' || type === 'client')) {
    type = toolClient;
    classifierReason = 'tool_client_disambiguation';
  }

  if (STRICT_TYPES.includes(type)) {
    const check = satisfiesFactTypeContract(type, value);
    if (!check.valid) {
      const alt = findContractMatch(value);
      if (alt) {
        type = alt.type;
        confidence = Math.max(confidence, alt.confidence);
        classifierReason = 'contract_reclassified';
      } else {
        type = 'unknown';
        confidence = Math.min(confidence, FACT_CONFIDENCE_THRESHOLD - 0.01);
        classifierReason = `contract_failed:${check.reason || type}`;
      }
    }
  }

  if (type === 'skill') {
    const words = value.split(/\s+/).filter(Boolean);
    if (words.length > 8 && !value.includes(',')) {
      type = isValidSummaryField(sourceLine) ? 'summary' : 'unknown';
      confidence =
        type === 'summary'
          ? Math.max(confidence, FACT_CONFIDENCE_THRESHOLD)
          : Math.min(confidence, FACT_CONFIDENCE_THRESHOLD - 0.01);
      classifierReason = type === 'summary' ? 'skill_to_summary' : 'skill_prose_rejected';
    }
  }

  return finalizeFact({
    ...fact,
    type,
    value,
    confidence,
    sourceLine,
    lineConfidence,
    classifierReason,
  });
}

function finalizeFact(fact) {
  let confidence = clamp01(fact.confidence);
  const lineConfidence = clamp01(fact.lineConfidence ?? confidence);

  if (
    fact.classifierReason === 'section_hint_low' ||
    (fact.sectionHint && lineConfidence < FACT_CONFIDENCE_THRESHOLD)
  ) {
    confidence = Math.min(confidence, FACT_CONFIDENCE_THRESHOLD - 0.01);
  }

  const type = ALLOWED_FACT_TYPES.includes(fact.type) ? fact.type : 'unknown';
  if (type === 'unknown') {
    confidence = Math.min(confidence, FACT_CONFIDENCE_THRESHOLD - 0.01);
  }

  return {
    ...fact,
    type,
    value: String(fact.value || '').trim(),
    confidence,
    sourceLine: String(fact.sourceLine || fact.value || '').trim(),
    factClassifier: FACT_CLASSIFIER_VERSION,
    classifierReason: fact.classifierReason || 'finalized',
  };
}

/**
 * @param {object[]} facts
 * @returns {object[]}
 */
export function applyFactClassifier(facts) {
  return (facts || []).map((f) => classifyFactStrict(f));
}
