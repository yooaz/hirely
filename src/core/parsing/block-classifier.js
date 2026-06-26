/**
 * Block classifier — typed DocumentBlocks after reading order.
 *
 * Allowed types: identity, contact, summary, experience, education, clients,
 * projects, skills, tools, languages, interests, unknown.
 *
 * Rules:
 * - School names → education
 * - Software names → tools
 * - Brand/client lists → clients
 * - Portfolio links → contact
 * - Project names → projects
 * - Unknown → unsorted (downstream)
 *
 * Never: education→experience, tools→experience, clients→education.
 */

import { classifyLineByDictionary } from '../../data/dictionaries/json-dictionary-match.js';
import { classifyLineType } from './block-line-classifier.js';
import {
  isParserClassificationDebugEnabled,
  recordParserClassification,
  formatDictionaryExplanation,
} from './parser-classification-debug.js';
import {
  detectCreativeParsingMode,
  applyCreativeModeToClassifiedBlocks,
} from './creative-parsing-mode.js';
import { fuzzySectionKey } from './section-fuzzy.js';
import { validateSectionBlocks } from './section-validation.js';
import {
  BLOCK_TYPES,
  CLASSIFICATION_CONFIDENCE_THRESHOLD,
  normalizeBlockType,
  resolveBlocks,
  findLongestEntityTerm,
  ENTITY_CATALOG,
  matchEntitiesInLine,
} from './entity-dictionaries.js';
import {
  findLongestDictionaryTerm,
  CLIENT_TERMS,
  TOOL_TERMS,
  SCHOOL_TERMS,
} from '../../data/dictionaries/json-dictionary-match.js';
import { mustNeverBeExperience, hasEducationSchool, hasEducationDegree } from './education-confidence.js';
import { passesExperienceGate, isLikelyPortfolioProject } from './section-sanity.js';
import { isLikelyFreelanceCareerLine, isStrictSoftwareLine } from './classification-fixes.js';

export {
  BLOCK_TYPES,
  CLASSIFICATION_CONFIDENCE_THRESHOLD,
  normalizeBlockType,
  resolveBlocks,
  resolveBlock,
} from './entity-dictionaries.js';

const PORTFOLIO_URL_RE = /https?:\/\/[^\s]+/i;
const PORTFOLIO_HOST_RE = /\b(behance|dribbble|artstation|cargo|adobe\.com\/portfolio)\b/i;

const DICT_BUCKET_TO_TYPE = {
  education: 'education',
  clients: 'clients',
  tools: 'tools',
  languages: 'languages',
  contact: 'contact',
  identity: 'identity',
};

/**
 * Merge dictionary entity hit when it outranks heuristic line classification.
 * @param {{ type: string, confidence: number, signals?: string[], needsReview?: boolean, parserDebug?: object }} hit
 * @param {string} text
 */
function mergeDictionaryLineHit(hit, text) {
  const dict = classifyLineByDictionary(text);
  if (!dict?.parserDebug) return hit;

  const dictType = DICT_BUCKET_TO_TYPE[dict.bucket] || dict.bucket;
  const preferDict =
    dict.confidence >= (hit.confidence || 0) - 2 ||
    (dict.bucket === 'education' && hit.type === 'experience') ||
    (dict.bucket === 'tools' && hit.type === 'experience') ||
    (dict.bucket === 'clients' && (hit.type === 'experience' || hit.type === 'education'));

  if (!preferDict) return hit;

  return {
    type: dictType,
    confidence: Math.max(hit.confidence || 0, dict.confidence),
    signals: [...new Set([...(hit.signals || []), ...(dict.signals || [])])],
    needsReview: dict.confidence < CLASSIFICATION_CONFIDENCE_THRESHOLD,
    parserDebug: dict.parserDebug,
  };
}

function logLineClassificationDebug(text, hit) {
  if (!isParserClassificationDebugEnabled()) return;
  const dbg = hit.parserDebug || {};
  recordParserClassification({
    line: String(text || '').trim().slice(0, 200),
    bucket: hit.type,
    confidenceScore: hit.confidence,
    classificationReason: dbg.classificationReason || hit.signals?.[0] || 'heuristic',
    matchedDictionary: dbg.matchedDictionary ?? null,
    matchedTerm: dbg.matchedTerm ?? null,
    dictionaryBoost: dbg.dictionaryBoost ?? null,
    signals: hit.signals || [],
    explanation: formatDictionaryExplanation({
      classificationReason: dbg.classificationReason,
      matchedDictionary: dbg.matchedDictionary,
      matchedTerm: dbg.matchedTerm,
      dictionaryBoost: dbg.dictionaryBoost,
      bucket: hit.type,
      confidenceScore: hit.confidence,
    }),
  });
}

const LOCKED_SECTIONS = new Set([
  'identity',
  'contact',
  'summary',
  'experience',
  'education',
  'clients',
  'projects',
  'skills',
  'tools',
  'languages',
  'interests',
]);

function lockedSectionHint(key) {
  if (!key || !LOCKED_SECTIONS.has(key)) return null;
  if (key === 'portfolio' || key === 'portfolioLinks') return 'contact';
  return key;
}

function columnSectionHint(block) {
  const key = block.sectionHint || block.sectionKey;
  if (key === 'portfolio' || key === 'portfolioLinks') return 'contact';
  if (key && key !== 'body' && key !== 'header') return key;
  return null;
}

function textHasSchool(text) {
  const t = String(text || '');
  return (
    !!findLongestEntityTerm(t, ENTITY_CATALOG.schools) ||
    !!findLongestDictionaryTerm(t, SCHOOL_TERMS) ||
    hasEducationSchool(t) ||
    hasEducationDegree(t) ||
    mustNeverBeExperience(t)
  );
}

function textHasSoftware(text) {
  return isStrictSoftwareLine(String(text || ''));
}

function textHasClient(text) {
  const t = String(text || '');
  if (passesExperienceGate(t) && /designer|manager|lead|director|consultant/i.test(t)) {
    return false;
  }
  return (
    !!findLongestEntityTerm(t, ENTITY_CATALOG.clients) ||
    !!findLongestDictionaryTerm(t, CLIENT_TERMS) ||
    matchEntitiesInLine(t)?.entity === 'client'
  );
}

function textHasPortfolioLink(text) {
  const t = String(text || '');
  return PORTFOLIO_URL_RE.test(t) || PORTFOLIO_HOST_RE.test(t) || /@/.test(t) && /linkedin/i.test(t);
}

function textIsClientList(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 200) return false;
  const parts = t.split(/\s*[,;·|]\s*/).filter((p) => p.length > 1);
  return parts.length >= 2 && parts.every((p) => textHasClient(p) || /^[A-Z]/.test(p));
}

/**
 * Hard guards — misclassification fixes before structured resume.
 * @param {object} block
 */
export function enforceClassificationGuards(block) {
  let type = normalizeBlockType(block.type || block.bucket);
  const text = String(block.text || '').trim();
  const signals = [...(block.signals || [])];
  let confidence = Number(block.confidence) || 0;

  const school = textHasSchool(text);
  const software = textHasSoftware(text);
  const client = textHasClient(text) || textIsClientList(text);
  const portfolio = textHasPortfolioLink(text);
  const project = type === 'projects' || isLikelyPortfolioProject(text);

  if (school && type !== 'education') {
    if (type === 'experience' || type === 'clients') {
      signals.push('guard:never_education_as_experience');
    }
    type = 'education';
    confidence = Math.max(confidence, 86);
    signals.push('rule:school→education');
  }

  if (software && type === 'experience' && !passesExperienceGate(text) && !isLikelyFreelanceCareerLine(text)) {
    type = 'tools';
    confidence = Math.max(confidence, 80);
    signals.push('guard:never_tools_as_experience');
  }

  if (software && type === 'skills') {
    type = 'tools';
    signals.push('rule:software→tools');
  }

  if (client && type === 'education') {
    type = 'clients';
    confidence = Math.max(confidence, 78);
    signals.push('guard:never_clients_as_education');
  }

  if (client && type === 'experience' && !passesExperienceGate(text)) {
    type = 'clients';
    confidence = Math.max(confidence, 78);
    signals.push('guard:never_clients_as_experience');
  }

  if (portfolio && type !== 'contact') {
    type = 'contact';
    confidence = Math.max(confidence, 78);
    signals.push('rule:portfolio_link→contact');
  }

  if (project && type === 'experience' && !passesExperienceGate(text)) {
    type = 'projects';
    confidence = Math.max(confidence, 76);
    signals.push('rule:project→projects');
  }

  if (type === 'experience' && school) {
    type = 'education';
    signals.push('guard:never_education_as_experience');
  }
  if (type === 'experience' && software && !passesExperienceGate(text) && !isLikelyFreelanceCareerLine(text)) {
    type = 'tools';
    signals.push('guard:never_tools_as_experience');
  }
  if (type === 'experience' && client && !passesExperienceGate(text)) {
    type = 'clients';
    signals.push('guard:never_clients_as_experience');
  }

  return { type: normalizeBlockType(type), confidence, signals };
}

/**
 * Entity + layout rules applied to each classified block.
 * @param {object} block
 */
export function applyBlockClassificationRules(block) {
  let type = normalizeBlockType(block.type || block.bucket);
  const text = String(block.text || '').trim();
  let confidence = Number(block.confidence) || 0;
  let signals = [...(block.signals || [])];

  if (textHasSchool(text)) {
    type = 'education';
    confidence = Math.max(confidence, 84);
    signals.push('rule:school→education');
  } else if (isLikelyPortfolioProject(text) && !passesExperienceGate(text)) {
    type = 'projects';
    confidence = Math.max(confidence, 76);
    signals.push('rule:project→projects');
  } else if (textHasPortfolioLink(text) && !textHasClient(text) && !textHasSoftware(text)) {
    type = 'contact';
    confidence = Math.max(confidence, 78);
    signals.push('rule:portfolio_link→contact');
  } else if (textHasSoftware(text) && type !== 'experience') {
    type = 'tools';
    confidence = Math.max(confidence, 76);
    signals.push('rule:software→tools');
  } else if ((textHasClient(text) || textIsClientList(text)) && type !== 'experience') {
    if (type === 'education' || type === 'unknown' || type === 'skills') {
      type = 'clients';
      confidence = Math.max(confidence, 74);
      signals.push('rule:client_list→clients');
    }
  }

  const guarded = enforceClassificationGuards({ ...block, type, confidence, signals });
  type = guarded.type;
  confidence = guarded.confidence;
  signals = guarded.signals;

  if ((block.signals || []).includes('unclassified') && type !== 'unknown') {
    const weak =
      !textHasSchool(text) &&
      !textHasSoftware(text) &&
      !textHasClient(text) &&
      !textHasPortfolioLink(text) &&
      !isLikelyPortfolioProject(text);
    if (weak) {
      type = 'unknown';
      confidence = Math.min(confidence, 45);
      signals.push('rule:unclassified→unknown');
    }
  }

  const routeToUnsorted = type === 'unknown';

  return createClassifiedBlock({
    ...block,
    type,
    confidence,
    signals,
    routeToUnsorted,
    bucket: type,
  });
}

/**
 * @param {object} raw
 */
export function createClassifiedBlock(raw) {
  const type = BLOCK_TYPES.includes(raw.type) ? raw.type : 'unknown';
  const confidence = Math.round(Math.max(0, Math.min(100, Number(raw.confidence) || 0)));
  const bbox = raw.bbox || {
    x: raw.x ?? 0,
    y: raw.y ?? 0,
    width: raw.width ?? 0,
    height: raw.height ?? 0,
  };
  const lineSource = (raw.lines || [])[0]?.source;
  const block = {
    id: String(raw.id || `blk-${Date.now()}`),
    text: String(raw.text || '').trim(),
    bbox,
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: bbox.height,
    page: Number(raw.page) || 1,
    confidence,
    source: String(raw.source || lineSource || 'unknown'),
    type,
    bucket: type,
    classificationReason:
      raw.classificationReason ||
      raw.parserDebug?.classificationReason ||
      (raw.signals || []).find((s) => s.startsWith('entity:') || s.startsWith('rule:')) ||
      null,
    dictionaryMatch:
      raw.dictionaryMatch ||
      (raw.parserDebug
        ? {
            entity: raw.parserDebug.entityType,
            entityId: raw.parserDebug.matchedEntityId,
            term: raw.parserDebug.matchedTerm,
            dictionaryId: raw.parserDebug.matchedDictionary,
            boost: raw.parserDebug.dictionaryBoost,
          }
        : null),
    parserDebug: raw.parserDebug || null,
    accepted: raw.accepted ?? confidence >= CLASSIFICATION_CONFIDENCE_THRESHOLD,
    needsReview: raw.needsReview ?? confidence < CLASSIFICATION_CONFIDENCE_THRESHOLD,
    signals: raw.signals || [],
    lines: raw.lines || [],
    sectionHint: raw.sectionHint || null,
    column: raw.column || null,
    routeToUnsorted: raw.routeToUnsorted === true || type === 'unknown',
  };
  return block;
}

function flushGroup(groups, acc, startId) {
  if (!groups.length) return;
  const type = groups[0].type;
  const texts = groups.map((g) => g.text).filter(Boolean);
  const conf = Math.round(
    groups.reduce((s, g) => s + g.confidence, 0) / Math.max(1, groups.length)
  );
  const page = groups[0].page || 1;
  const bbox = mergeBboxes(groups.map((g) => g.bbox));
  const needsReview = groups.some((g) => g.needsReview) || conf < CLASSIFICATION_CONFIDENCE_THRESHOLD;
  acc.push(
    applyBlockClassificationRules(
      createClassifiedBlock({
        id: `${startId}-${acc.length}`,
        text: texts.join('\n'),
        confidence: conf,
        page,
        bbox,
        type,
        accepted: !needsReview,
        needsReview,
        signals: [...new Set(groups.flatMap((g) => g.signals))],
        lines: groups.map((g) => g.line).filter(Boolean),
        sectionHint: groups[0].sectionHint,
        column: groups[0].column,
      })
    )
  );
}

function mergeBboxes(bboxes) {
  const valid = bboxes.filter((b) => b && Number.isFinite(b.x));
  if (!valid.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(...valid.map((b) => b.x));
  const y = Math.max(...valid.map((b) => b.y));
  const x2 = Math.max(...valid.map((b) => b.x + (b.width || 0)));
  const y2 = Math.min(...valid.map((b) => b.y - (b.height || 0)));
  return { x, y, width: x2 - x, height: y - y2 };
}

/**
 * Classify extracted blocks (post reading-order) → typed blocks.
 * @param {object[]} extractedBlocks
 */
export function classifyBlocks(extractedBlocks = [], opts = {}) {
  const lineBlob = (extractedBlocks || [])
    .flatMap((b) =>
      (b.lines?.length ? b.lines : [{ text: b.text }]).map((ln) =>
        String(ln.cleanedText ?? ln.text ?? '').trim()
      )
    )
    .filter(Boolean);
  const creativeMode =
    opts.creativeMode ||
    detectCreativeParsingMode(opts.rawText || lineBlob.join('\n'), { lines: lineBlob });

  const classified = [];
  let activeSection = null;
  let group = [];
  let groupId = 'blk';

  const pushGroup = () => {
    flushGroup(group, classified, groupId);
    group = [];
  };

  for (const block of extractedBlocks) {
    if (block.kind === 'section_header') {
      pushGroup();
      activeSection = fuzzySectionKey(block.text || '') || block.sectionKey || null;
      if (activeSection === 'portfolio' || activeSection === 'portfolioLinks') activeSection = 'contact';
      groupId = `sec-${activeSection || 'hdr'}`;
      continue;
    }

    const lines = block.lines?.length
      ? block.lines
      : String(block.text || '')
          .split('\n')
          .map((t, i) => ({
            text: t,
            cleanedText: t,
            page: block.page || 1,
            line: i,
          }));

    const sectionHint =
      lockedSectionHint(activeSection) ||
      lockedSectionHint(block.sectionHint) ||
      columnSectionHint(block);

    for (const ln of lines) {
      const text = String(ln.cleanedText ?? ln.text ?? '').trim();
      if (!text) continue;
      const page = ln.page || block.page || 1;
      let hit = classifyLineType(text, sectionHint, {
        creativeMode: creativeMode.active === true,
      });
      hit = mergeDictionaryLineHit(hit, text);
      logLineClassificationDebug(text, hit);

      if (group.length && group[group.length - 1].type !== hit.type) {
        pushGroup();
      }
      group.push({
        type: hit.type,
        confidence: hit.confidence,
        text,
        page,
        bbox: block.bbox,
        signals: hit.signals,
        needsReview: hit.needsReview,
        line: ln,
        sectionHint,
        column: block.column,
        parserDebug: hit.parserDebug || null,
      });
    }
    pushGroup();
  }
  pushGroup();

  let resolved = resolveBlocks(classified).map((b) => applyBlockClassificationRules(b));

  if (isParserClassificationDebugEnabled()) {
    for (const b of resolved) {
      recordParserClassification({
        line: String(b.text || '').slice(0, 200),
        bucket: b.type,
        confidenceScore: b.confidence,
        classificationReason: b.classificationReason,
        matchedDictionary: b.dictionaryMatch?.dictionaryId || b.parserDebug?.matchedDictionary,
        matchedTerm: b.dictionaryMatch?.term || b.parserDebug?.matchedTerm,
        dictionaryBoost: b.dictionaryMatch?.boost ?? b.parserDebug?.dictionaryBoost,
        signals: b.signals,
        explanation: formatDictionaryExplanation({
          classificationReason: b.classificationReason,
          matchedDictionary: b.dictionaryMatch?.dictionaryId || b.parserDebug?.matchedDictionary,
          matchedTerm: b.dictionaryMatch?.term || b.parserDebug?.matchedTerm,
          dictionaryBoost: b.dictionaryMatch?.boost ?? b.parserDebug?.dictionaryBoost,
          bucket: b.type,
          confidenceScore: b.confidence,
        }),
      });
    }
  }

  if (creativeMode.active) {
    const creativePass = applyCreativeModeToClassifiedBlocks(resolved, true);
    resolved = creativePass.blocks.map((b) => applyBlockClassificationRules(b));
  }
  const validated = validateSectionBlocks(resolved);
  validated.blocks._creativeMode = creativeMode;
  return validated.blocks;
}

export function classifyBlock(block) {
  const [one] = classifyBlocks([
    {
      kind: block.kind || 'content',
      text: block.text,
      lines: block.lines,
      sectionHint: block.sectionHint || block.sectionKey,
      bbox: block.bbox,
      page: block.page || block.sourcePage,
      column: block.column,
    },
  ]);
  if (!one) {
    return {
      bucket: 'unknown',
      confidence: 0,
      signals: ['empty'],
      needsReview: true,
      accepted: false,
      routeToUnsorted: true,
    };
  }
  return {
    bucket: one.type,
    type: one.type,
    confidence: one.confidence,
    signals: one.signals,
    needsReview: one.needsReview,
    accepted: one.accepted,
    routeToUnsorted: one.routeToUnsorted,
    entityMatch: one.entityMatch,
    lineVotes: one.lineVotes,
  };
}

export function countByType(blocks) {
  const counts = {};
  for (const t of BLOCK_TYPES) counts[t] = 0;
  for (const b of blocks) {
    counts[b.type] = (counts[b.type] || 0) + 1;
  }
  return counts;
}

export { buildBlockReviewItems as blocksToReviewItems } from './review-queue.js';

export function runBlockClassifierStage(opts = {}) {
  const blocks = classifyBlocks(opts.blocks || opts.extractedBlocks || []);
  return {
    stage: 'block_classification',
    blocks,
    bucketCounts: countByType(blocks),
    blockCount: blocks.length,
    acceptedCount: blocks.filter((b) => b.accepted).length,
    reviewCount: blocks.filter((b) => b.needsReview).length,
    threshold: CLASSIFICATION_CONFIDENCE_THRESHOLD,
    at: new Date().toISOString(),
  };
}

export function buildClassifiedBlocks(extractedBlocks = []) {
  const blocks = classifyBlocks(extractedBlocks);
  return {
    stage: 'block_classification',
    blocks,
    documentBlocks: blocks,
    blockCount: blocks.length,
    typeCounts: countByType(blocks),
    acceptedCount: blocks.filter((b) => b.accepted).length,
    reviewCount: blocks.filter((b) => b.needsReview).length,
    threshold: CLASSIFICATION_CONFIDENCE_THRESHOLD,
    at: new Date().toISOString(),
  };
}
