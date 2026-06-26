/**
 * No data loss rule — unsorted bucket + 80% cleanedText utilization.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runProductionExtractionPipeline } from '../core/pipeline/production-pipeline.js';
import {
  enforceNoDataLossRule,
  measureCleanedTextUtilization,
  FINAL_CV_UTILIZATION_MIN_PCT,
} from '../core/parsing/no-data-loss.js';
import { applyReviewQueueToCvData } from '../core/parsing/review-queue.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = readFileSync(join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const pipe = await runProductionExtractionPipeline(fixture, { extractionMethod: 'paste' });
const cv = pipe.validatedCVData;
const sr = pipe.structuredResume;

ok(pipe.rawText?.length > 100, 'pipeline keeps rawText');
ok(pipe.cleanedText?.length > 100, 'pipeline keeps cleanedText');
ok(sr?.metadata?.rawExtraction?.length > 50, 'structuredResume.metadata.rawExtraction');
ok(sr?.metadata?.cleanedText?.length > 50, 'structuredResume.metadata.cleanedText');
ok(Array.isArray(sr?.documentBlocks) || pipe.stages?.documentBlocks?.documentBlocks?.length > 0, 'blocks preserved on pipeline');
ok(Array.isArray(cv.unsorted), 'cvData.unsorted array');

const unclassified = `UNCLASSIFIED_MARKER_LINE_${Date.now()}`;
const ndl = enforceNoDataLossRule({
  rawText: pipe.rawText,
  cleanedText: `${pipe.cleanedText}\n${unclassified}`,
  cvData: { ...cv, unsorted: [] },
  structuredResume: sr,
  rejectedLines: ['REJECTED_KEEP_ME'],
  uncertainLines: ['UNCERTAIN_KEEP_ME'],
});
ok(
  (ndl.cvData.unsorted || []).some((l) => l.includes('UNCLASSIFIED_MARKER')),
  'unclassified line → unsorted'
);
ok(
  (ndl.cvData.unsorted || []).some((l) => l.includes('REJECTED_KEEP_ME')),
  'rejected line → unsorted'
);

const queue = [
  {
    field: 'skills',
    detected: 'Figma',
    sourceText: 'Figma · Photoshop',
    confidence: 50,
    status: 'pending',
    action: 'block_classification',
  },
];
const gated = applyReviewQueueToCvData(
  { ...cv, skills: ['Figma', 'Photoshop', 'Illustrator'] },
  queue
);
ok(!(gated.skills || []).length, 'held skills removed from skills array');
ok(
  (gated.unsorted || []).some((l) => /figma|photoshop/i.test(l)),
  'held skills moved to unsorted not deleted'
);

ok(FINAL_CV_UTILIZATION_MIN_PCT === 80, 'threshold is 80%');
const util = measureCleanedTextUtilization(pipe.cleanedText, cv);
ok(typeof util.utilizationPct === 'number', 'utilizationPct computed');
ok(pipe.cleanedTextUtilization?.utilizationPct != null, 'pipeline exposes cleanedTextUtilization');

if (failed) process.exit(1);
console.log('qa-no-data-loss: all passed');
