#!/usr/bin/env node
/**
 * Review queue + lightweight learning — uncertain facts held until human validates.
 */
import {
  buildCvFromFacts,
  factsToReviewItems,
} from '../core/parsing/cv-from-facts.js';
import {
  extractFactsFromLine,
} from '../core/parsing/fact-extraction.js';
import {
  clearClassificationLearning,
  lookupLearnedClassification,
  LEARNED_CONFIDENCE,
  recordClassificationCorrection,
} from '../core/parsing/classification-learning.js';
import { suggestPossibleCategories } from '../core/parsing/review-queue-categories.js';
import {
  applyReviewQueueToCvData,
  resolveReviewItem,
} from '../core/parsing/review-queue.js';
import { FACT_CONFIDENCE_THRESHOLD } from '../core/parsing/fact-types.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

clearClassificationLearning();

// Packaging — uncertain, not auto-inserted
const uncertainFacts = [
  {
    id: 'fact-packaging',
    type: 'unknown',
    value: 'Packaging',
    confidence: 0.42,
    sourceLine: 'Packaging',
    bucket: 'unsorted',
    signals: [],
  },
];

const cv = buildCvFromFacts(uncertainFacts);
ok(!cv.structured.skills.some((s) => /packaging/i.test(s)), 'Packaging not in CV below threshold');
ok(cv.reviewQueue.length >= 1, 'Packaging sent to review queue');

const reviewItem = cv.reviewQueue.find((i) => /packaging/i.test(i.detected));
ok(Boolean(reviewItem), 'review item for Packaging');
ok(reviewItem.requiresUserChoice === true, 'requires user category choice');
ok(reviewItem.action === 'user_category_choice', 'action is user_category_choice');

const categories = suggestPossibleCategories('Packaging', 'unknown');
ok(categories.some((c) => c.id === 'skill'), 'Packaging suggests skill');
ok(categories.some((c) => c.id === 'project'), 'Packaging suggests project');
ok(categories.some((c) => c.id === 'interest'), 'Packaging suggests interest');
ok(
  (reviewItem.possibleCategories || []).some((c) => c.id === 'skill'),
  'review item includes skill option'
);

const gated = applyReviewQueueToCvData(
  { name: 'Test', skills: [], interests: [], projects: [] },
  cv.reviewQueue
);
ok(!gated.skills.some((s) => /packaging/i.test(s)), 'gated CV excludes pending Packaging');

// Human validates → skill
const accept = resolveReviewItem(cv.reviewQueue, 0, 'accepted', gated, {
  chosenType: 'skill',
});
ok(accept.queue[0].status === 'accepted', 'item accepted');
ok(accept.cvData.skills?.some((s) => /packaging/i.test(s)), 'accepted Packaging in skills');

const learned = lookupLearnedClassification('Packaging');
ok(Boolean(learned), 'correction stored');
ok(learned.type === 'skill', 'learned type is skill');
ok(learned.confidence === LEARNED_CONFIDENCE, `learned confidence ${LEARNED_CONFIDENCE}`);

// Future parse benefits
clearClassificationLearning();
recordClassificationCorrection({ value: 'Packaging', chosenType: 'skill' });
const reFacts = extractFactsFromLine('Packaging');
const reHit = reFacts.find((f) => /packaging/i.test(f.value));
ok(Boolean(reHit), 're-parse extracts Packaging');
ok(reHit.type === 'skill', 're-parse classifies Packaging as skill');
ok(reHit.confidence >= FACT_CONFIDENCE_THRESHOLD, 're-parse confidence above threshold');
ok(reHit.learned === true, 're-parse marked learned');

const reCv = buildCvFromFacts(reFacts);
ok(
  reCv.structured.skills.some((s) => /packaging/i.test(s)),
  're-parse auto-includes learned Packaging in skills'
);
ok(
  !reCv.reviewQueue.some((i) => /packaging/i.test(i.detected)),
  'learned Packaging not queued again'
);

// factsToReviewItems shape
const items = factsToReviewItems(uncertainFacts);
ok(items[0].possibleCategories?.length >= 3, 'factsToReviewItems has category options');

console.log(failed ? `\n${failed} FAILED` : '\nAll review-queue learning checks passed');
process.exit(failed ? 1 : 0);
