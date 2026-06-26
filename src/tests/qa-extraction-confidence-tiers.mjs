#!/usr/bin/env node
/**
 * P0 — Extraction confidence tiers (HIGH / MEDIUM / LOW).
 */
import {
  CONFIDENCE_TIER,
  confidenceTier,
  tierRequiresReviewQueue,
  tierAllowsAutoRender,
  buildLowConfidenceReviewItem,
} from '../core/validation/extraction-confidence-tiers.js';
import { shouldQueueForReview } from '../core/parsing/review-queue.js';
import { buildReviewQueue } from '../core/parsing/review-queue.js';
import { shouldRunOcrForTextLength } from '../core/extraction/extraction-lock.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('PASS', msg);
}

ok(confidenceTier(96) === CONFIDENCE_TIER.HIGH, '96 → HIGH');
ok(confidenceTier(85) === CONFIDENCE_TIER.HIGH, '85 → HIGH');
ok(confidenceTier(72) === CONFIDENCE_TIER.MEDIUM, '72 → MEDIUM');
ok(confidenceTier(69) === CONFIDENCE_TIER.LOW, '69 → LOW');
ok(confidenceTier(40) === CONFIDENCE_TIER.LOW, '40 → LOW');

ok(tierRequiresReviewQueue(65), 'LOW requires review');
ok(!tierRequiresReviewQueue(88), 'HIGH no forced review');
ok(tierAllowsAutoRender(92), 'HIGH allows auto-render');
ok(!tierAllowsAutoRender(68), 'LOW blocks auto-render');

const item = buildLowConfidenceReviewItem({
  field: 'identity.name',
  detected: 'Lontac Impressions',
  confidence: 55,
});
ok(item?.confidenceTier === CONFIDENCE_TIER.LOW, 'low item tier');
ok(item?.requiresReview === true, 'low item requiresReview');

const queue = buildReviewQueue({
  parserReview: [{ field: 'identity.name', detected: 'Maybe Name', confidence: 62, status: 'pending' }],
});
ok(queue.length >= 1, 'buildReviewQueue includes LOW item');
ok(queue[0]?.confidenceTier === CONFIDENCE_TIER.LOW, 'queued item annotated');

ok(shouldQueueForReview(55), 'shouldQueueForReview 55');
ok(!shouldQueueForReview(90), 'shouldQueueForReview 90');

ok(shouldRunOcrForTextLength(120), 'short native always OCR when locked');
ok(!shouldRunOcrForTextLength(600), 'long native skips OCR when locked');
ok(
  shouldRunOcrForTextLength(600, { usable: false, strongTextLayer: false }),
  'weak long native still OCR when locked'
);

console.log(`\n═══ Extraction Confidence Tiers: ${failed ? 'FAIL' : 'PASS'} ═══`);
process.exit(failed ? 1 : 0);
