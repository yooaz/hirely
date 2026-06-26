/**
 * P0 confidence gate — blocks below threshold go to review queue, not render.
 */

import { buildBlockReviewItems } from './review-queue.js';
import { P0_CONFIDENCE_THRESHOLD, P0_RENDER_THRESHOLD } from './p0-threshold.js';

export { P0_CONFIDENCE_THRESHOLD, P0_RENDER_THRESHOLD };

/**
 * @param {object[]} blocks — classified blocks with confidence + type
 * @param {number} [threshold]
 */
export function applyConfidenceGate(blocks = [], threshold = P0_CONFIDENCE_THRESHOLD) {
  const renderBlocks = [];
  const reviewBlocks = [];

  for (const block of blocks) {
    const conf = Math.round(Number(block.confidence) || 0);
    const accept = conf >= threshold && block.accepted !== false;
    if (accept) {
      renderBlocks.push({ ...block, accepted: true, needsReview: false });
    } else {
      reviewBlocks.push({
        ...block,
        accepted: false,
        needsReview: true,
        confidence: conf,
      });
    }
  }

  const reviewItems = buildBlockReviewItems(reviewBlocks, threshold);
  const overall =
    blocks.length > 0
      ? Math.round(blocks.reduce((s, b) => s + (b.confidence || 0), 0) / blocks.length)
      : 0;

  return {
    stage: 'confidence',
    threshold,
    renderBlocks,
    reviewBlocks,
    reviewItems,
    renderCount: renderBlocks.length,
    reviewCount: reviewBlocks.length,
    overallConfidence: overall,
    canRender: renderBlocks.length > 0,
    at: new Date().toISOString(),
  };
}
