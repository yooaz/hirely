/**
 * Stage 6 — Conflict resolver: confidence < 70 → review queue (never guess).
 */

import { normalizeReviewItem } from '../review-queue.js';
import { PARSER_ENTERPRISE_THRESHOLD } from '../parser-enterprise.js';

export const CONFLICT_CONFIDENCE_THRESHOLD = PARSER_ENTERPRISE_THRESHOLD;

/**
 * @param {object} opts
 * @param {object[]} opts.blocks
 * @param {object[]} [opts.existingReview]
 */
export function runConflictResolverStage(opts = {}) {
  const reviewQueue = [...(opts.existingReview || [])];
  const conflicts = [];

  for (const block of opts.blocks || []) {
    if (block.kind === 'section_header') continue;
    const conf = block.confidence ?? 0;
    const text = block.text || '';
    if (!text || text.length < 2) continue;

    if (conf < CONFLICT_CONFIDENCE_THRESHOLD || block.valid === false) {
      const item = normalizeReviewItem({
        id: `block-${block.id || conflicts.length}`,
        field: block.bucket || 'unknown',
        detected: text.slice(0, 200),
        sourceText: text,
        sourceLines: (block.lines || []).map((l) => String(l.cleanedText ?? l.text ?? '')),
        confidence: conf,
        reason:
          block.valid === false
            ? `Section validation failed: ${block.validationReason || 'invalid'}`
            : `Block confidence ${conf}% below ${CONFLICT_CONFIDENCE_THRESHOLD}% threshold`,
        suggestion: 'Confirm section assignment in the editor',
        action: 'block_classification',
        status: 'pending',
      });
      if (item) {
        reviewQueue.push(item);
        conflicts.push({
          blockId: block.id,
          bucket: block.bucket,
          confidence: conf,
          reason: item.reason,
        });
      }
    }

    for (const ln of block.lines || []) {
      const lineConf = ln.confidence ?? block.confidence ?? 0;
      const lineText = String(ln.cleanedText ?? ln.text ?? '').trim();
      if (!lineText || lineConf >= CONFLICT_CONFIDENCE_THRESHOLD) continue;
      const item = normalizeReviewItem({
        field: block.bucket || 'unknown',
        detected: lineText.slice(0, 160),
        sourceText: lineText,
        sourceLines: [lineText],
        confidence: lineConf,
        reason: `Line confidence ${lineConf}% — not auto-assigned`,
        action: 'low_confidence_line',
        status: 'pending',
      });
      if (item) reviewQueue.push(item);
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const item of reviewQueue) {
    const key = `${item.field}|${item.detected?.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return {
    stage: 6,
    reviewQueue: deduped,
    conflictCount: conflicts.length,
    conflicts,
    threshold: CONFLICT_CONFIDENCE_THRESHOLD,
    at: new Date().toISOString(),
  };
}
