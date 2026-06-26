#!/usr/bin/env node
/**
 * H6 multi-CV stress gate — seven archetypes.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { resumeDataToCvData } from '../core/resume-data.js';
import { resolveFixtureText } from '../../tests/lib/stress-catalog.mjs';
import {
  H6_CV_FIXTURES,
  H6_RECALL_GOAL_PCT,
} from '../../tests/lib/h6-stress-catalog.mjs';
import { computeH6Metrics } from '../../tests/lib/h6-stress-metrics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

async function runFixture(entry) {
  const { rawText, fileName } = resolveFixtureText(ROOT, entry);
  const importResult = await runHirelyImportFromText(rawText, {
    source: entry.id,
    extractionMethod: 'paste',
    file: { name: fileName, type: 'text/plain', size: rawText.length },
  });
  const rd = sanitizeResumeForDisplay(importResult?.resumeData || {});
  const cv = resumeDataToCvData(rd);
  return computeH6Metrics(entry.id, rawText, rd, cv);
}

for (const entry of H6_CV_FIXTURES) {
  const m = await runFixture(entry);
  ok(m.identity >= H6_RECALL_GOAL_PCT, `${entry.id} identity ${m.identity}%`);
  if (m.ground.experience.length) {
    ok(m.experience >= H6_RECALL_GOAL_PCT, `${entry.id} experience ${m.experience}%`);
  }
  if (m.ground.education.length) {
    ok(m.education >= H6_RECALL_GOAL_PCT, `${entry.id} education ${m.education}%`);
  }
  if (m.ground.skills.length) {
    ok(m.skills >= H6_RECALL_GOAL_PCT, `${entry.id} skills ${m.skills}%`);
  }
  if (m.ground.languages.length) {
    ok(m.languages >= H6_RECALL_GOAL_PCT, `${entry.id} languages ${m.languages}%`);
  }
}

process.exit(failed ? 1 : 0);
