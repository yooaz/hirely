#!/usr/bin/env node
/**
 * Regression: block-level review must not wipe all skills/experience rows.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runProductionExtractionPipeline } from '../core/pipeline/production-pipeline.js';
import { applyReviewQueueToCvData, buildBlockReviewItems } from '../core/parsing/review-queue.js';
import { traceDataLoss, formatTraceReport } from '../debug/data-loss-trace.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const fixture = fs.readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const pipe = await runProductionExtractionPipeline(fixture, { extractionMethod: 'paste' });
const blocks = pipe.stages?.documentBlocks?.documentBlocks || [];
const cv = pipe.validatedCVData;

const fakeReview = buildBlockReviewItems(
  blocks.map((b) => ({ ...b, needsReview: true, accepted: false, confidence: 65 }))
);
const gated = applyReviewQueueToCvData(cv, fakeReview);

ok((cv.skills?.length || 0) >= 4, 'validated cv has skills');
ok((gated._heldSections || []).includes('skills'), 'pending skills block held for template');
ok(
  (gated.skills?.length || 0) + (gated.unsorted?.length || 0) >= (cv.skills?.length || 0),
  'skills preserved in cvData or unsorted at review gate (never deleted)'
);
ok((gated.experience?.length || 0) >= 1 || (gated._heldSections || []).includes('experience'), 'experience kept or held');

const trace = await traceDataLoss(fixture);
console.log('\n' + formatTraceReport(trace));
ok(!trace.drops.some((d) => d.at === 'cvData (review gate)' && d.field === 'skills' && cv.skills?.length), 'trace: skills not silently deleted at review gate');

process.exit(failed ? 1 : 0);
