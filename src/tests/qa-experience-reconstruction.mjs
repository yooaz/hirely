#!/usr/bin/env node
/**
 * Experience reconstruction — recall ≥ 85% on acceptance CVs.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { EXPERIENCE_RECONSTRUCTION_RECALL_GOAL } from '../core/parsing/experience-reconstruction.js';
import { groundTruthForFixture } from '../../tests/lib/section-ground-truth.mjs';
import {
  computeSectionMetrics,
  extractDetectedSections,
} from '../../tests/lib/section-accuracy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

const ACCEPTANCE_FIXTURES = [
  { id: 'developer-cv', label: 'Developer CV' },
  { id: 'creative-cv', label: 'Creative CV' },
  { id: 'marketing-cv', label: 'Marketing CV' },
  { id: 'consultant-cv', label: 'Consultant CV' },
];

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

async function evaluateFixture(entry) {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures', entry.id, 'fixture.txt'), 'utf8');
  const imp = await runHirelyImportFromText(raw, {
    source: entry.id,
    extractionMethod: 'paste',
  });
  const sanitized = sanitizeResumeForDisplay(imp.resumeData);
  const detected = extractDetectedSections(sanitized);
  const gt = groundTruthForFixture(entry.id, raw);
  const metrics = computeSectionMetrics(gt.experience, detected.experience, 'experience');
  return { ...entry, metrics, detected: detected.experience, expected: gt.experience };
}

async function main() {
  const rows = [];
  let totalExpected = 0;
  let totalTp = 0;

  for (const entry of ACCEPTANCE_FIXTURES) {
    const result = await evaluateFixture(entry);
    rows.push(result);
    totalExpected += result.metrics.expected;
    totalTp += result.metrics.tp;

    const recallPct = result.metrics.recall;
    ok(
      recallPct >= EXPERIENCE_RECONSTRUCTION_RECALL_GOAL * 100,
      `${entry.label} experience recall ${recallPct}% (goal ≥ ${EXPERIENCE_RECONSTRUCTION_RECALL_GOAL * 100}%)`
    );
    if (result.metrics.falseNegatives.length) {
      console.log('  FN:', result.metrics.falseNegatives.join(' | '));
    }
    if (result.metrics.falsePositives.length) {
      console.log('  FP:', result.metrics.falsePositives.join(' | '));
    }
  }

  const aggregateRecall = totalExpected ? Math.round((totalTp / totalExpected) * 1000) / 10 : 100;
  ok(
    aggregateRecall >= EXPERIENCE_RECONSTRUCTION_RECALL_GOAL * 100,
    `Aggregate experience recall ${aggregateRecall}% across acceptance CVs`
  );

  if (failed) {
    process.exitCode = 1;
    console.error(`\n${failed} acceptance check(s) failed`);
  } else {
    console.log(`\nAll acceptance CVs met ≥ ${EXPERIENCE_RECONSTRUCTION_RECALL_GOAL * 100}% experience recall`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
