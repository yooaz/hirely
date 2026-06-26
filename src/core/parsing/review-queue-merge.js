/**
 * Review queue item normalization + merge — acyclic shared helpers.
 * Used by review-queue.js and cv-section-contract.js (no circular import).
 */

import { analyzeLineCorruption } from './corruption-detector.js';

let _idSeq = 0;
function nextId() {
  _idSeq += 1;
  return `rq-${Date.now()}-${_idSeq}`;
}

function normalizeStatus(status) {
  const s = String(status || 'pending').toLowerCase();
  if (s === 'ignored') return 'rejected';
  return s;
}

function queueKey(item) {
  return `${item.field}|${item.sourceText.toLowerCase().slice(0, 80)}`;
}

/**
 * @param {object} raw
 */
export function normalizeReviewItem(raw) {
  if (!raw) return null;
  const sourceLines = [
    ...new Set(
      (raw.sourceLines || (raw.sourceText ? [raw.sourceText] : []))
        .map((l) => String(l || '').trim())
        .filter(Boolean)
    ),
  ];
  const sourceText = String(raw.sourceText || sourceLines[0] || raw.detected || '').trim();
  const detected = String(raw.detected || raw.editedText || sourceText).trim();
  if (!detected && !sourceText) return null;

  let confidence = Number(raw.confidence ?? raw.extractionConfidence);
  if (!Number.isFinite(confidence)) {
    confidence =
      raw.corruptionScore != null ? Math.max(0, 100 - Number(raw.corruptionScore)) : 50;
  }
  confidence = Math.round(Math.max(0, Math.min(100, confidence)));

  const corruption = analyzeLineCorruption(detected);
  const field = String(raw.field || raw.detectedType || 'unknown');
  const status = normalizeStatus(raw.status);

  return {
    id: raw.id || nextId(),
    field,
    detectedType: String(raw.detectedType || field),
    detected,
    sourceText: sourceText || detected,
    sourceLines: sourceLines.length ? sourceLines : [detected],
    confidence,
    reason:
      String(raw.reason || '').trim() ||
      (corruption.corrupted ? corruption.reasons.join('; ') : 'Below confidence threshold'),
    suggestion: String(raw.suggestion || 'Accept to include, edit to fix, or reject to exclude'),
    action: raw.action || (corruption.corrupted ? 'corruption' : 'review'),
    status,
    editedText: raw.editedText ? String(raw.editedText).trim() : undefined,
    corruptionScore: corruption.corrupted ? corruption.score : raw.corruptionScore,
    possibleCategories: Array.isArray(raw.possibleCategories) ? raw.possibleCategories : undefined,
    requiresUserChoice: Boolean(raw.requiresUserChoice),
    chosenType: raw.chosenType ? String(raw.chosenType).trim().toLowerCase() : undefined,
    factId: raw.factId ? String(raw.factId) : undefined,
  };
}

/**
 * @param {...object[]} lists
 */
export function mergeReviewQueues(...lists) {
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    for (const raw of list || []) {
      const item = normalizeReviewItem(raw);
      if (!item) continue;
      const key = queueKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out.sort((a, b) => a.confidence - b.confidence);
}
