/**
 * SECTION_CLASSIFIER_V1 — classify DocumentBlock[] before field extraction.
 *
 * Input: DocumentBlock[] from BLOCK_BUILDER_V1 (type starts as "unknown").
 * Output: classified blocks with type + confidence + reason (no resume fields).
 */

import { fuzzySectionKey } from './section-fuzzy.js';
import { computeBlockSignals } from './block-builder-v1.js';
import { SECTION_IDS } from './section-types-v2.js';
import {
  lineIsEducationData,
  lineIsSkillOrTagOnly,
} from './experience-parser.js';
import { mustNeverBeExperience, hasEducationSchool } from './education-confidence.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import {
  findLongestDictionaryTerm,
  CLIENT_TERMS,
  TOOL_TERMS,
  SCHOOL_TERMS,
} from '../../data/dictionaries/json-dictionary-match.js';
import {
  classifySpecialtyLineV2,
  CLASSIFICATION_CONFIDENCE_MIN,
} from './classification-engine-v2.js';
import { classifySemanticBlockV2 } from './semantic-classifier-v2.js';

export const SECTION_CLASSIFIER_V1 = 'SECTION_CLASSIFIER_V1';
export const SECTION_CLASSIFIER_MIN_CONFIDENCE = CLASSIFICATION_CONFIDENCE_MIN;

/** @readonly */
export const ALLOWED_BLOCK_TYPES = Object.freeze([
  'identity',
  'summary',
  'experience',
  'education',
  'clients',
  'projects',
  'skills',
  'tools',
  'languages',
  'contact',
  'unknown',
]);

const TYPE_TO_SECTION_ID = Object.freeze({
  identity: SECTION_IDS.PROFILE,
  summary: SECTION_IDS.SUMMARY,
  experience: SECTION_IDS.EXPERIENCE,
  education: SECTION_IDS.EDUCATION,
  clients: SECTION_IDS.CLIENTS,
  projects: SECTION_IDS.PROJECTS,
  skills: SECTION_IDS.SKILLS,
  tools: SECTION_IDS.TOOLS,
  languages: SECTION_IDS.LANGUAGES,
  contact: SECTION_IDS.CONTACT,
  unknown: SECTION_IDS.UNKNOWN,
});

const HINT_TO_TYPE = Object.freeze({
  summary: 'summary',
  profile: 'identity',
  experience: 'experience',
  education: 'education',
  skills: 'skills',
  tools: 'tools',
  languages: 'languages',
  projects: 'projects',
  clients: 'clients',
  contact: 'contact',
  portfolio: 'contact',
  portfolioLinks: 'contact',
  interests: 'unknown',
});

const LANGUAGE_LINE_RE =
  /\b(french|english|german|spanish|italian|portuguese|dutch|arabic|mandarin|japanese|korean)\b.*\b(native|fluent|bilingual|intermediate|basic|c1|c2|b1|b2)\b/i;

const DATE_ONLY_TEXT_RE =
  /^\s*((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2}|present|présent|current|now|actuel)\s*$/i;

function isDateOnlyText(text) {
  return DATE_ONLY_TEXT_RE.test(String(text || '').trim());
}

function hasRealContactSignals(signals, text) {
  if (signals.hasEmail || signals.hasUrl) return true;
  if (signals.hasPhone && !isDateOnlyText(text) && !/\b(19|20)\d{2}\b/.test(text)) return true;
  return false;
}

function hintToType(hint) {
  if (!hint) return null;
  return HINT_TO_TYPE[hint] || null;
}

function isClientList(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 220) return false;
  const parts = t.split(/\s*[,;·|]\s*/).filter((p) => p.length > 1);
  if (parts.length < 2) return false;
  return parts.every(
    (p) =>
      !!findLongestDictionaryTerm(p, CLIENT_TERMS) ||
      (/^[A-Z][A-Za-z0-9&.'\-\s]{1,40}$/.test(p) && p.split(/\s+/).length <= 4)
  );
}

function looksLikeLanguageBlock(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 160) return false;
  const lines = t.split(/\n/).filter(Boolean);
  if (lines.length >= 1 && lines.every((l) => LANGUAGE_LINE_RE.test(l) || /—\s*(native|fluent)/i.test(l))) {
    return true;
  }
  return LANGUAGE_LINE_RE.test(t);
}

function isSkillKeywordCluster(text, signals) {
  const t = String(text || '').trim();
  if (!t || t.length > 200 || signals?.hasDate) return false;
  if (signals?.hasRole || signals?.hasCompanyLikeText) return false;
  if (lineIsSkillOrTagOnly(t)) return true;
  if (t.includes(',') && t.split(/\s+/).length <= 14 && !/\b(19|20)\d{2}\b/.test(t)) {
    return true;
  }
  return signals?.hasSkillKeywords && t.length <= 120;
}

function enforceExperienceGuards(block, hit) {
  const text = String(block.text || '').trim();
  if (hit.type !== 'experience') return hit;

  if (
    lineIsSkillOrTagOnly(text) ||
    mustNeverBeExperience(text) ||
    lineIsEducationData(text) ||
    hasEducationSchool(text) ||
    !!findLongestDictionaryTerm(text, SCHOOL_TERMS)
  ) {
    const type = lineIsEducationData(text) || mustNeverBeExperience(text) ? 'education' : 'unknown';
    return {
      type,
      confidence: Math.max(hit.confidence, 72),
      reason: 'guard_never_experience',
    };
  }

  if (isSkillKeywordCluster(text, block.signals) && !block.signals?.hasRole) {
    return { type: 'skills', confidence: 74, reason: 'guard_skill_cluster_not_experience' };
  }

  return hit;
}

/**
 * @param {object} block
 * @param {{ index: number }} ctx
 */
const SEMANTIC_BUCKET_TO_TYPE = Object.freeze({
  identity: 'identity',
  summary: 'summary',
  experience: 'experience',
  education: 'education',
  skills: 'skills',
  tools: 'tools',
  languages: 'languages',
  clients: 'clients',
  contact: 'contact',
  unsorted: 'unknown',
});

function applySemanticV2Hit(text, ctx) {
  const sem = classifySemanticBlockV2(text, ctx);
  if (!sem || sem.bucket === 'unsorted') return null;
  const mapped = SEMANTIC_BUCKET_TO_TYPE[sem.bucket];
  if (!mapped || mapped === 'unknown') return null;
  return {
    type: mapped,
    confidence: sem.confidence,
    reason: sem.reason || 'semantic_v2',
  };
}

function classifySingleDocumentBlock(block, ctx) {
  const lines = block.lines || [];
  const text = String(block.text || lines.join('\n')).trim();
  const signals = block.signals || computeBlockSignals(text, lines);

  const semHit = applySemanticV2Hit(text, { lineIndex: ctx.index, hasContactNearby: signals.hasEmail || signals.hasPhone });
  if (semHit && semHit.confidence >= SECTION_CLASSIFIER_MIN_CONFIDENCE) {
    return enforceExperienceGuards(block, semHit);
  }

  if (block.anchor === 'header') {
    const hint = fuzzySectionKey(text) || block.sectionHint;
    const mapped = hintToType(hint);
    if (mapped) {
      return { type: mapped, confidence: 75, reason: 'section_header_hint' };
    }
    return { type: 'unknown', confidence: 58, reason: 'section_header_unmapped' };
  }

  if (isDateOnlyText(text) || (signals.hasDate && block.anchor === 'date')) {
    return { type: 'experience', confidence: 84, reason: 'date_anchor' };
  }

  if (
    (hasRealContactSignals(signals, text) || block.anchor === 'contact') &&
    !isDateOnlyText(text)
  ) {
    return { type: 'contact', confidence: 88, reason: 'contact_signals' };
  }

  const v2FromLines = lines
    .map((ln) => classifySpecialtyLineV2(String(ln).trim()))
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence)[0];
  const v2FromText = classifySpecialtyLineV2(text);
  const v2Hit =
    v2FromLines && v2FromText
      ? v2FromLines.confidence >= v2FromText.confidence
        ? v2FromLines
        : v2FromText
      : v2FromLines || v2FromText;

  if (v2Hit && v2Hit.bucket !== 'unsorted') {
    const typeMap = {
      skills: 'skills',
      tools: 'tools',
      languages: 'languages',
      clients: 'clients',
      education: 'education',
      interests: 'unknown',
    };
    const mapped = typeMap[v2Hit.bucket];
    if (mapped) {
      return {
        type: mapped === 'unknown' ? 'unknown' : mapped,
        confidence: v2Hit.confidence,
        reason: v2Hit.parserDebug?.classificationReason || 'v2_specialty',
      };
    }
  }

  if (
    signals.hasSchool ||
    mustNeverBeExperience(text) ||
    lineIsEducationData(text) ||
    block.anchor === 'education_date' ||
    block.sectionHint === 'education' ||
    !!findLongestDictionaryTerm(text, SCHOOL_TERMS)
  ) {
    const v2Edu = classifySpecialtyLineV2(text);
    if (v2Edu?.bucket === 'education') {
      return {
        type: 'education',
        confidence: v2Edu.confidence,
        reason: v2Edu.parserDebug?.classificationReason || 'v2_education',
      };
    }
    return { type: 'unknown', confidence: 65, reason: 'education_hint_rejected_v2' };
  }

  if (lineIsSkillOrTagOnly(text) || lines.every((l) => lineIsSkillOrTagOnly(String(l).trim()))) {
    const v2 = classifySpecialtyLineV2(text);
    if (v2?.bucket === 'tools' || v2?.bucket === 'skills') {
      return {
        type: v2.bucket,
        confidence: v2.confidence,
        reason: v2.parserDebug?.classificationReason || 'v2_tag_cluster',
      };
    }
    return { type: 'unknown', confidence: 65, reason: 'tag_cluster_rejected_v2' };
  }

  if (block.anchor === 'clients' || isClientList(text)) {
    const v2 = classifySpecialtyLineV2(text);
    if (v2?.bucket === 'clients') {
      return {
        type: 'clients',
        confidence: v2.confidence,
        reason: v2.parserDebug?.classificationReason || 'v2_client_list',
      };
    }
    return { type: 'unknown', confidence: 65, reason: 'client_list_rejected_v2' };
  }

  if (block.sectionHint === 'languages' || looksLikeLanguageBlock(text)) {
    const v2 = classifySpecialtyLineV2(text);
    if (v2?.bucket === 'languages') {
      return {
        type: 'languages',
        confidence: v2.confidence,
        reason: v2.parserDebug?.classificationReason || 'v2_language_block',
      };
    }
    return { type: 'unknown', confidence: 65, reason: 'language_hint_rejected_v2' };
  }

  if (block.sectionHint === 'skills' || (isSkillKeywordCluster(text, signals) && !signals.hasDate)) {
    const v2 = classifySpecialtyLineV2(text);
    if (v2?.bucket === 'skills') {
      return {
        type: 'skills',
        confidence: v2.confidence,
        reason: v2.parserDebug?.classificationReason || 'v2_skill_cluster',
      };
    }
    return { type: 'unknown', confidence: 65, reason: 'skill_hint_rejected_v2' };
  }

  if (block.sectionHint === 'tools') {
    const v2 = classifySpecialtyLineV2(text);
    if (v2?.bucket === 'tools') {
      return {
        type: 'tools',
        confidence: v2.confidence,
        reason: v2.parserDebug?.classificationReason || 'v2_tools_hint',
      };
    }
    return { type: 'unknown', confidence: 65, reason: 'tools_hint_rejected_v2' };
  }

  if (signals.hasDate && (signals.hasRole || signals.hasCompanyLikeText)) {
    const hit = {
      type: 'experience',
      confidence: 84,
      reason: signals.hasRole ? 'role_with_date' : 'company_with_date',
    };
    return enforceExperienceGuards(block, hit);
  }

  if (signals.hasRole && (signals.hasCompanyLikeText || /freelanc|intern|designer|director|manager/i.test(text))) {
    const hit = { type: 'experience', confidence: 78, reason: 'role_company_block' };
    return enforceExperienceGuards(block, hit);
  }

  if (ctx.index < 2 && !signals.hasDate && lines.length <= 4 && !signals.hasEmail) {
    const nameHit = applySemanticV2Hit(text, { lineIndex: ctx.index });
    if (nameHit?.type === 'identity' && nameHit.confidence >= SECTION_CLASSIFIER_MIN_CONFIDENCE) {
      return nameHit;
    }
  }

  if (text.length > 80 && !signals.hasDate && !signals.hasRole && !signals.hasCompanyLikeText) {
    const summarySem = classifySemanticBlockV2(text, { lineIndex: ctx.index });
    if (summarySem?.semanticType === 'SUMMARY' && summarySem.confidence >= SECTION_CLASSIFIER_MIN_CONFIDENCE) {
      return { type: 'summary', confidence: summarySem.confidence, reason: 'semantic_v2_summary' };
    }
    return { type: 'unknown', confidence: 58, reason: 'prose_rejected_v2' };
  }

  const hintType = hintToType(block.sectionHint);
  if (hintType) {
    const hit = { type: hintType, confidence: 70, reason: 'section_hint' };
    return enforceExperienceGuards(block, hit);
  }

  return { type: 'unknown', confidence: 55, reason: 'unclassified' };
}

/**
 * @param {object[]} documentBlocks
 * @param {object} [opts]
 */
export function classifyDocumentBlocksV1(documentBlocks, opts = {}) {
  const minConfidence = opts.minConfidence ?? SECTION_CLASSIFIER_MIN_CONFIDENCE;
  /** @type {object[]} */
  const blocks = [];
  /** @type {object[]} */
  const reasons = [];
  /** @type {object[]} */
  const lowConfidence = [];

  for (let i = 0; i < (documentBlocks || []).length; i++) {
    const block = documentBlocks[i];
    let hit = classifySingleDocumentBlock(block, { index: i });
    hit = enforceExperienceGuards(block, hit);

    const rawType = ALLOWED_BLOCK_TYPES.includes(hit.type) ? hit.type : 'unknown';
    const finalType = hit.confidence >= minConfidence ? rawType : 'unknown';

    if (hit.confidence < minConfidence) {
      lowConfidence.push({
        id: block.id,
        text: String(block.text || '').slice(0, 96),
        confidence: hit.confidence,
        reason: hit.reason,
        wouldBe: rawType,
      });
    }

    const classified = {
      ...block,
      type: finalType,
      classifiedType: finalType,
      classifiedConfidence: hit.confidence,
      classifyReason: hit.reason,
      classificationReason: hit.reason,
      classifier: SECTION_CLASSIFIER_V1,
    };

    blocks.push(classified);
    reasons.push({
      id: block.id,
      type: finalType,
      rawType,
      confidence: hit.confidence,
      reason: hit.reason,
    });
  }

  hirelyDebugLog('BLOCKS_CLASSIFIED', {
    engine: SECTION_CLASSIFIER_V1,
    count: blocks.length,
    types: blocks.reduce((acc, b) => {
      acc[b.type] = (acc[b.type] || 0) + 1;
      return acc;
    }, {}),
  });
  hirelyDebugLog('CLASSIFICATION_REASON', reasons.slice(0, 20));
  if (lowConfidence.length) {
    hirelyDebugLog('LOW_CONFIDENCE_BLOCKS', lowConfidence.slice(0, 20));
  }

  return {
    engine: SECTION_CLASSIFIER_V1,
    blocks,
    reasons,
    lowConfidence,
    minConfidence,
  };
}

/**
 * Map classified DocumentBlock[] → SectionBlockV2[] for field extraction.
 * @param {object[]} classifiedBlocks
 */
export function documentBlocksToSectionBlocks(classifiedBlocks) {
  return (classifiedBlocks || [])
    .filter((b) => b.anchor !== 'header')
    .map((b) => ({
      id: b.id,
      type: TYPE_TO_SECTION_ID[b.type] || SECTION_IDS.UNKNOWN,
      lines: [...(b.lines || [])],
      headerLine: null,
      startLine: b.startLine ?? 0,
      endLine: b.endLine ?? 0,
      detectedConfidence: b.classifiedConfidence,
      classifiedConfidence: b.classifiedConfidence,
      classifyReason: b.classifyReason || b.classificationReason,
      signals: b.signals,
      anchor: b.anchor,
      sectionHint: b.sectionHint,
      parseMode: SECTION_CLASSIFIER_V1,
    }));
}
