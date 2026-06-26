#!/usr/bin/env node
/**
 * Review queue — low confidence / corruption gated from final CV until accepted.
 */
import {
  REVIEW_QUEUE_THRESHOLD,
  buildReviewQueue,
  buildBlockReviewItems,
  applyReviewQueueToCvData,
  resolveReviewItem,
  pendingReviewItems,
  reviewQueueSummary,
  mergeReviewQueues,
} from '../core/parsing/review-queue.js';
import { formatCvAsStructuredText } from '../core/export/format-cv.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

ok(REVIEW_QUEUE_THRESHOLD === 70, 'threshold is 70%');

const queue = buildReviewQueue({
  parserReview: [
    {
      field: 'skills',
      detectedType: 'skills',
      detected: 'Illustrator CC',
      sourceText: 'Illustrator CC',
      confidence: 55,
      reason: 'Low parser confidence',
    },
  ],
  rejectedLines: ["A>o N'$ak6.f"],
});

ok(queue.length >= 2, 'queues low-confidence and corrupted lines');
ok(queue.every((i) => i.sourceText && i.reason), 'every item has sourceText and reason');
ok(queue.every((i) => Number.isFinite(i.confidence)), 'every item has confidence');
ok(queue.every((i) => i.detectedType), 'every item has detectedType');

const blockItems = buildBlockReviewItems([
  {
    text: 'LISAA Paris',
    type: 'education',
    confidence: 62,
    needsReview: true,
    classificationReason: 'Entity conflict',
  },
]);
ok(blockItems.length === 1, 'block review item for low confidence');
ok(blockItems[0].detectedType === 'education', 'detectedType from block type');

const cv = {
  name: 'Jane Doe',
  skills: ['Illustrator CC', 'Figma'],
  experience: ["A>o N'$ak6.f", 'Designer — Agency 2020–2024'],
};

const gated = applyReviewQueueToCvData(cv, queue);
ok(!gated.skills.includes('Illustrator CC'), 'pending skill not in gated CV');
ok(!gated.experience.some((e) => e.includes("A>o")), 'corrupted experience not in gated CV');
ok(gated.experience.length >= 1, 'clean experience kept');

const exported = formatCvAsStructuredText(gated);
ok(!exported.includes("A>o"), 'export excludes corrupted pending line');
ok(!exported.includes('Illustrator CC'), 'export excludes pending low-confidence skill');

const skillIdx = queue.findIndex((i) => i.field === 'skills');
const accept = resolveReviewItem(queue, skillIdx, 'accepted', cv);
ok(accept.queue[skillIdx].status === 'accepted', 'item marked accepted');
ok(accept.cvData.skills?.includes('Illustrator CC'), 'accepted skill merged into CV');

const corruptIdx = queue.findIndex((i) => i.action === 'corruption');
const reject = resolveReviewItem(accept.queue, corruptIdx, 'rejected', accept.cvData);
ok(reject.queue[corruptIdx].status === 'rejected', 'item marked rejected');

const editQueue = mergeReviewQueues([
  {
    field: 'experience',
    detectedType: 'experience',
    detected: 'Designer — Studio',
    sourceText: 'Designer — Studio',
    confidence: 58,
    reason: 'Low confidence',
    status: 'pending',
  },
]);
const edit = resolveReviewItem(editQueue, 0, 'edited', cv, {
  editedText: 'Senior Designer — Studio XYZ 2021–2024',
});
ok(edit.queue[0].status === 'edited', 'item marked edited');
ok(
  edit.cvData.experience?.some((e) => e.includes('Senior Designer')),
  'edited text merged into CV'
);

ok(pendingReviewItems(reject.queue).length === 0, 'no pending after accept+reject');
const summary = reviewQueueSummary(reject.queue);
ok(summary.canRenderFinalCv, 'can render when no pending');

console.log(failed ? `\n${failed} FAILED` : '\nAll review-queue checks passed');
process.exit(failed ? 1 : 0);
