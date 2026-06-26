/**
 * Review Queue — low-confidence content never auto-renders until accepted.
 * Actions: Accept · Edit · Reject
 */

import { P0_CONFIDENCE_THRESHOLD } from './p0-threshold.js';
import { CLASSIFICATION_CONFIDENCE_THRESHOLD } from './entity-dictionaries.js';
import {
  analyzeLineCorruption,
  isLineCorruptedForExport,
  sanitizeCvDataForExport,
} from './corruption-detector.js';
import { mergeUnsortedLines } from './no-data-loss.js';
import { recordClassificationCorrection } from './classification-learning.js';
import { enforceCvDataSectionContract } from './cv-section-contract.js';
import { FACT_TYPE_TO_CV_FIELD } from './fact-types.js';
import { normalizeReviewItem, mergeReviewQueues } from './review-queue-merge.js';
import {
  confidenceTier,
  CONFIDENCE_TIER,
  tierRequiresReviewQueue,
  annotateConfidenceTier,
} from '../validation/extraction-confidence-tiers.js';

export { normalizeReviewItem, mergeReviewQueues } from './review-queue-merge.js';
export { confidenceTier, CONFIDENCE_TIER, tierRequiresReviewQueue } from '../validation/extraction-confidence-tiers.js';

export const REVIEW_QUEUE_THRESHOLD = P0_CONFIDENCE_THRESHOLD;

/** @typedef {'pending'|'accepted'|'rejected'|'ignored'|'edited'} ReviewItemStatus */
/**
 * @typedef {object} ReviewQueueItem
 * @property {string} id
 * @property {string} field
 * @property {string} detectedType
 * @property {string} detected
 * @property {string} sourceText
 * @property {string[]} sourceLines
 * @property {number} confidence
 * @property {string} reason
 * @property {string} [suggestion]
 * @property {string} [action]
 * @property {ReviewItemStatus} status
 * @property {string} [editedText]
 * @property {number} [corruptionScore]
 */

export const REVIEW_ACTIONS = {
  ACCEPT: 'accept',
  EDIT: 'edit',
  REJECT: 'reject',
};

function normalizeStatus(status) {
  const s = String(status || 'pending').toLowerCase();
  if (s === 'ignored') return 'rejected';
  return s;
}

function resolveCvFieldFromItem(item) {
  const chosen = String(item.chosenType || '').trim().toLowerCase();
  if (chosen && FACT_TYPE_TO_CV_FIELD[chosen]) return FACT_TYPE_TO_CV_FIELD[chosen];
  const field = String(item.field || item.detectedType || '').trim().toLowerCase();
  if (FACT_TYPE_TO_CV_FIELD[field]) return FACT_TYPE_TO_CV_FIELD[field];
  if (field === 'skills') return 'skills';
  if (field === 'tools') return 'tools';
  if (field === 'languages') return 'languages';
  if (field === 'clients') return 'clients';
  if (field === 'projects') return 'projects';
  if (field === 'interests') return 'interests';
  if (field === 'experiences') return 'experience';
  if (field === 'profile') return 'summary';
  return field || 'unsorted';
}

function mustQueueItem(item) {
  if (item.status !== 'pending') return false;
  if (item.action === 'corruption' || (item.corruptionScore ?? 0) >= 55) return true;
  if (isLineCorruptedForExport(item.detected)) return true;
  if (tierRequiresReviewQueue(item.confidence, { field: item.field })) return true;
  return item.confidence < REVIEW_QUEUE_THRESHOLD;
}

export function shouldQueueForReview(confidence, opts = {}) {
  if (opts.corrupted || opts.corruptionScore >= 55) return true;
  return Number(confidence) < REVIEW_QUEUE_THRESHOLD;
}

/**
 * Build review items from classified blocks below confidence threshold.
 * @param {object[]} blocks
 * @param {number} [threshold]
 */
export function buildBlockReviewItems(blocks = [], threshold = CLASSIFICATION_CONFIDENCE_THRESHOLD) {
  const items = [];
  for (const block of blocks) {
    if (!block?.needsReview && block?.accepted !== false) continue;
    const text = String(block.text || '').trim();
    if (!text) continue;
    const conf = Math.round(Number(block.confidence) || 0);
    const violations = (block.validationViolations || [])
      .map((v) => v.rule)
      .filter(Boolean);
    const reason =
      block.classificationReason ||
      (violations.length
        ? `Validation: ${violations.join(', ')}`
        : `Block confidence ${conf}% — below ${threshold}%`);
    const item = normalizeReviewItem({
      field: block.type || block.bucket || 'unknown',
      detectedType: block.type || block.bucket || 'unknown',
      detected: text.slice(0, 400),
      sourceText: text,
      sourceLines: text.split('\n').filter(Boolean),
      confidence: conf,
      reason,
      suggestion: 'Confirm section assignment',
      action: violations.length ? 'section_validation' : 'block_classification',
      status: 'pending',
    });
    if (item && mustQueueItem(item)) items.push(item);
  }
  return items;
}

/**
 * @param {object} input
 * @returns {ReviewQueueItem[]}
 */
export function buildReviewQueue(input = {}) {
  const items = [];
  const seen = new Set();

  const push = (raw) => {
    const item = annotateConfidenceTier(
      normalizeReviewItem({ ...raw, status: raw.status || 'pending' })
    );
    if (!item || item.status !== 'pending') return;
    if (!mustQueueItem(item)) return;
    if (isLineCorruptedForExport(item.detected) || (item.corruptionScore ?? 0) >= 55) {
      item.reason = item.reason || 'Possible corrupted OCR text';
      item.action = 'corruption';
    }
    const key = `${item.field}|${item.sourceText.toLowerCase().slice(0, 80)}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  const enterprise = input.enterprise;
  for (const bucketItem of enterprise?.needsReviewBucket || []) {
    push({
      field: bucketItem.field || 'unknown',
      detectedType: bucketItem.field || 'unknown',
      detected: bucketItem.text || bucketItem.value,
      sourceText: bucketItem.text || bucketItem.value,
      sourceLines: bucketItem.sourceLines,
      confidence: bucketItem.confidence,
      reason: 'Parser confidence below threshold',
    });
  }

  for (const r of enterprise?.needsReview || input.parserReview || []) {
    push(r);
  }

  for (const r of input.extractionReview || []) {
    push({
      ...r,
      confidence: r.extractionConfidence ?? r.confidence ?? 45,
      reason: r.reason || 'Low OCR extraction confidence',
    });
  }

  for (const block of input.reviewBlocks || []) {
    const fromBlock = buildBlockReviewItems([block]);
    for (const b of fromBlock) push(b);
  }

  if (input.classifiedBlocks?.length) {
    const lowBlocks = input.classifiedBlocks.filter(
      (b) => b.needsReview || b.accepted === false
    );
    for (const b of buildBlockReviewItems(lowBlocks, input.threshold)) push(b);
  }

  for (const r of input.blockReviewItems || input.reviewItems || []) {
    push(r);
  }

  for (const line of input.rejectedLines || []) {
    const t = String(line || '').trim();
    if (!t) continue;
    const corruption = analyzeLineCorruption(t);
    push({
      field: 'raw',
      detectedType: 'raw',
      detected: t.slice(0, 120),
      sourceText: t,
      sourceLines: [t],
      confidence: corruption.corrupted ? Math.max(0, 100 - corruption.score) : 40,
      reason: corruption.reasons.length
        ? corruption.reasons.join('; ')
        : 'Rejected during safe clean',
      action: corruption.corrupted ? 'corruption' : 'review',
      corruptionScore: corruption.score,
    });
  }

  for (const line of input.uncertainLines || []) {
    const t = String(line || '').trim();
    if (!t) continue;
    push({
      field: 'raw',
      detectedType: 'raw',
      detected: t.slice(0, 120),
      sourceText: t,
      sourceLines: [t],
      confidence: 55,
      reason: 'Uncertain line after cleaning',
    });
  }

  for (const r of input.legacyNeedsReview || []) {
    push(r);
  }

  return items.sort((a, b) => a.confidence - b.confidence);
}

export function pendingReviewItems(queue) {
  return (queue || []).filter((i) => i.status === 'pending');
}

export function hasPendingReview(queue) {
  return pendingReviewItems(queue).length > 0;
}

function isBlockLevelReviewItem(item) {
  const blob = String(item?.sourceText || item?.detected || '').trim();
  const lines = item?.sourceLines?.length ?? 0;
  return lines > 1 || blob.includes('\n') || blob.length > 80;
}

function valueMatchesItem(value, item) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return false;
  const d = String(item.detected || item.editedText || '').trim().toLowerCase();
  const s = String(item.sourceText || '').trim().toLowerCase();
  if (v === d || v === s) return true;
  // Block-level review (whole section blob) must not fuzzy-strip each list row.
  if (isBlockLevelReviewItem(item)) return false;
  if (d.length >= 10 && (v.includes(d) || d.includes(v))) return true;
  return false;
}

const HELD_SECTION_FIELDS = new Set([
  'experience',
  'experiences',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'projects',
  'summary',
  'profile',
]);

function heldSectionKey(field) {
  const f = String(field || '').toLowerCase();
  if (f === 'experiences') return 'experience';
  if (f === 'profile') return 'summary';
  return f;
}

function collectHeldSections(pending = []) {
  const held = new Set();
  for (const item of pending) {
    if (!item || item.status !== 'pending') continue;
    const key = heldSectionKey(item.field || item.detectedType);
    if (!HELD_SECTION_FIELDS.has(key) && !HELD_SECTION_FIELDS.has(item.field)) continue;
    if (isBlockLevelReviewItem(item) || item.action === 'block_classification') {
      held.add(key);
    }
  }
  return [...held];
}

function itemBlocksRender(item) {
  if (item.status === 'pending' || item.status === 'rejected') return true;
  if (item.action === 'corruption' || (item.corruptionScore ?? 0) >= 55) return true;
  if (isLineCorruptedForExport(item.detected)) return true;
  return false;
}

/**
 * Remove non-accepted review content from cvData — never show until accepted.
 * @param {object} cvData
 * @param {ReviewQueueItem[]} queue
 */
export function applyReviewQueueToCvData(cvData, queue) {
  try {
  let d = sanitizeCvDataForExport({ ...(cvData || {}) });
  const pending = pendingReviewItems(queue);
  const blocked = [...pending, ...(queue || []).filter((i) => itemBlocksRender(i))];

  const stripList = (arr) => {
    const kept = [];
    const dropped = [];
    for (const x of arr || []) {
      const t = String(x || '').trim();
      if (!t) continue;
      if (isLineCorruptedForExport(t)) {
        dropped.push(t);
        continue;
      }
      const remove = blocked.some((item) => {
        if (item.status === 'accepted' || item.status === 'edited') return false;
        return valueMatchesItem(t, item);
      });
      if (remove) dropped.push(t);
      else kept.push(x);
    }
    if (dropped.length) d.unsorted = mergeUnsortedLines(d.unsorted, dropped);
    return kept;
  };

  const stripScalar = (val) => {
    const t = String(val || '').trim();
    if (!t || isLineCorruptedForExport(t)) return '';
    return blocked.some((item) => {
      if (item.status === 'accepted' || item.status === 'edited') return false;
      return valueMatchesItem(t, item);
    })
      ? ''
      : t;
  };

  d.name = stripScalar(d.name);
  d.title = stripScalar(d.title);
  d.summary = stripScalar(d.summary);
  d.email = stripScalar(d.email);
  d.phone = stripScalar(d.phone);
  d.location = stripScalar(d.location);
  d.linkedin = stripScalar(d.linkedin);
  d.portfolio = stripScalar(d.portfolio);
  d.experience = stripList(d.experience, 'experience');
  d.education = stripList(d.education, 'education');
  d.skills = stripList(d.skills);
  d.tools = stripList(d.tools);
  d.languages = stripList(d.languages);
  d.clients = stripList(d.clients);
  d.interests = stripList(d.interests);
  d.projects = stripList(d.projects);
  d.extra = stripList(d.extra);
  d.unsorted = stripList(d.unsorted);

  const held = collectHeldSections(pending);
  const heldFieldMap = {
    experience: 'experience',
    education: 'education',
    skills: 'skills',
    tools: 'tools',
    languages: 'languages',
    clients: 'clients',
    projects: 'projects',
    summary: 'summary',
  };
  for (const key of held) {
    const prop = heldFieldMap[key];
    if (!prop) continue;
    const val = d[prop];
    if (Array.isArray(val) && val.length) {
      d.unsorted = mergeUnsortedLines(d.unsorted, val);
      d[prop] = [];
    } else if (typeof val === 'string' && val.trim()) {
      d.unsorted = mergeUnsortedLines(d.unsorted, [val]);
      d[prop] = '';
    }
  }

  d.reviewQueue = queue || [];
  d.needsReview = pending;
  d._heldSections = held;

  const exemptValues = (queue || [])
    .filter((i) => i.status === 'accepted' || i.status === 'edited')
    .flatMap((i) => [i.editedText, i.detected, i.sourceText])
    .filter(Boolean);

  return enforceCvDataSectionContract(d, { mergeReview: true, exemptValues });
  } catch {
    return cvData && typeof cvData === 'object' ? { ...cvData } : {};
  }
}

/**
 * Accept or edit — merge confirmed content into CV.
 * @param {object} cvData
 * @param {ReviewQueueItem} item
 */
export function applyAcceptedReviewItem(cvData, item) {
  const d = { ...(cvData || {}) };
  const text = String(item.editedText || item.detected || item.sourceText || '').trim();
  if (!text) return d;

  const cvField = resolveCvFieldFromItem(item);
  const field = String(item.field || item.detectedType || '');
  if (cvField === 'name' || field === 'identity' || field === 'identity.name' || field === 'name') {
    d.name = text;
  } else if (cvField === 'summary' || field === 'identity.title' || field === 'title' || field === 'summary' || field === 'profile') {
    if (field === 'identity.title' || field === 'title') d.title = text;
    else d.summary = text;
  } else if (cvField === 'experience' || field === 'experience' || field === 'experiences') {
    d.experience = [...(d.experience || []), text];
  } else if (cvField === 'education' || field === 'education') {
    d.education = [...(d.education || []), text];
  } else if (cvField === 'skills' || field === 'skills' || field === 'skill') {
    d.skills = [...(d.skills || []), text];
  } else if (cvField === 'tools' || field === 'tools' || field === 'tool') {
    d.tools = [...(d.tools || []), text];
  } else if (cvField === 'languages' || field === 'languages' || field === 'language') {
    d.languages = [...(d.languages || []), text];
  } else if (cvField === 'clients' || field === 'clients' || field === 'client') {
    d.clients = [...(d.clients || []), text];
  } else if (cvField === 'projects' || field === 'portfolio' || field === 'projects' || field === 'project') {
    d.projects = [...(d.projects || []), text];
  } else if (cvField === 'interests' || field === 'interests' || field === 'interest') {
    d.interests = [...(d.interests || []), text];
  } else if (field === 'contact') {
    if (/@/.test(text)) d.email = text;
    else if (/\+?\d[\d\s().-]{7,}\d/.test(text)) d.phone = text;
    else if (/linkedin/i.test(text)) d.linkedin = text;
    else if (/https?:\/\//i.test(text)) d.portfolio = text;
  } else if (/@/.test(text) && !d.email) d.email = text;
  else if (/\+?\d[\d\s().-]{7,}\d/.test(text) && !d.phone) d.phone = text;
  else {
    d.unsorted = [...(d.unsorted || []), text];
  }

  return sanitizeCvDataForExport(d);
}

/**
 * @param {ReviewQueueItem[]} queue
 * @param {number} index
 * @param {'accepted'|'rejected'|'ignored'|'edited'} status
 * @param {object} [cvData]
 * @param {object} [opts]
 * @param {string} [opts.editedText]
 */
export function resolveReviewItem(queue, index, status, cvData = null, opts = {}) {
  const list = [...(queue || [])];
  if (index < 0 || index >= list.length) return { queue: list, cvData };

  const normalized = normalizeStatus(status);
  const item = { ...list[index], status: normalized };

  if (opts.chosenType != null) {
    item.chosenType = String(opts.chosenType).trim().toLowerCase();
    item.field = item.chosenType;
    item.detectedType = item.chosenType;
  }

  if (opts.editedText != null) {
    item.editedText = String(opts.editedText).trim();
    item.detected = item.editedText || item.detected;
    item.status = 'edited';
  }

  list[index] = item;
  let outCv = cvData;

  if ((normalized === 'accepted' || normalized === 'edited') && cvData) {
    if (item.requiresUserChoice && !item.chosenType && normalized === 'accepted') {
      return { queue: list, cvData: outCv, error: 'category_required' };
    }
    outCv = applyAcceptedReviewItem(cvData, item);
    outCv = applyReviewQueueToCvData(outCv, list);
    const value = String(item.editedText || item.detected || item.sourceText || '').trim();
    const chosenType = item.chosenType || item.field || item.detectedType;
    if (value && chosenType && chosenType !== 'unknown' && chosenType !== 'raw') {
      recordClassificationCorrection({
        value,
        chosenType,
        sourceLine: item.sourceText || value,
        possibleTypes: (item.possibleCategories || []).map((c) => c.id || c),
      });
    }
  } else if (cvData) {
    outCv = applyReviewQueueToCvData(cvData, list);
  }

  return { queue: list, cvData: outCv };
}

/**
 * @param {ReviewQueueItem[]} queue
 */
export function reviewQueueSummary(queue) {
  const pending = pendingReviewItems(queue);
  const corrupted = pending.filter((i) => i.action === 'corruption' || (i.corruptionScore ?? 0) >= 55);
  const lowConf = pending.filter((i) => i.confidence < REVIEW_QUEUE_THRESHOLD);
  return {
    total: (queue || []).length,
    pending: pending.length,
    accepted: (queue || []).filter((i) => i.status === 'accepted' || i.status === 'edited').length,
    rejected: (queue || []).filter((i) => i.status === 'rejected' || i.status === 'ignored').length,
    corrupted: corrupted.length,
    lowConfidence: lowConf.length,
    threshold: REVIEW_QUEUE_THRESHOLD,
    canRenderFinalCv: pending.length === 0,
  };
}

/** @deprecated Use buildBlockReviewItems */
export function blocksToReviewItems(blocks) {
  return buildBlockReviewItems(blocks);
}
