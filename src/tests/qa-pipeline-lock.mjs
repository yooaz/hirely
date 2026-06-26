#!/usr/bin/env node
/**
 * Single pipeline lock — resumeData shape, structuredResume size, no fallback when locked.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import {
  ALLOWED_RESUME_DATA_KEYS,
  HIRELY_FLOW_STAGES,
  assertResumeDataFlowLock,
  lockResumeDataShape,
} from '../core/pipeline/hirely-flow-lock.js';
import {
  STRUCTURED_RESUME_JSON_MAX,
  assertStructuredResumeJsonSize,
} from '../core/pipeline/pipeline-contract.js';
import { normalizeResumeData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const fixture = fs.readFileSync(
  path.join(root, 'tests/fixtures/developer-cv/fixture.txt'),
  'utf8'
);

const failures = [];
const ok = (c, m) => (c ? console.log('OK', m) : (failures.push(m), console.error('FAIL', m)));

ok(HIRELY_FLOW_STAGES[1] === 'EXTRACT_TEXT', 'stage: extract text');
ok(HIRELY_FLOW_STAGES[4] === 'CLASSIFY_FACTS', 'stage: classify facts');
ok(HIRELY_FLOW_STAGES[7] === 'REVIEW', 'stage: review');
ok(ALLOWED_RESUME_DATA_KEYS.length === 11, 'eleven allowed resumeData keys');

const imported = await runHirelyImportFromText(fixture, { source: 'qa-pipeline-lock' });
ok(!!imported.resumeData, 'pipeline returns resumeData');
ok(!!imported.structuredResume, 'pipeline returns structuredResume');
ok(imported.debugReport != null || imported.structuredResume, 'debug separate from resumeData');
ok(!('debugReport' in (imported.resumeData || {})), 'debugReport not inside resumeData');

const rd = normalizeResumeData(imported.resumeData);
const lock = assertResumeDataFlowLock(rd);
ok(lock.ok, `resumeData keys locked (${lock.forbidden.join(', ')})`);
for (const k of ALLOWED_RESUME_DATA_KEYS) {
  ok(k in rd, `resumeData has ${k}`);
}
ok(!('exhibitions' in rd), 'exhibitions folded out of resumeData');
ok(!('blocks' in rd), 'blocks not in resumeData');

const sizeCheck = assertStructuredResumeJsonSize(imported.structuredResume);
ok(sizeCheck.ok, `structuredResume <= ${STRUCTURED_RESUME_JSON_MAX} (${sizeCheck.length})`);

const withDebug = lockResumeDataShape({
  ...rd,
  debugReport: { x: 1 },
  resumeGraph: { nodes: [] },
  exhibitions: ['Show A'],
});
const lock2 = assertResumeDataFlowLock(withDebug);
ok(lock2.ok, 'lockResumeDataShape strips debug keys');
ok(withDebug.unsorted.includes('Show A'), 'creative lines folded to unsorted');

if (failures.length) {
  failures.forEach((f) => console.error(f));
  process.exit(1);
}
console.log('PIPELINE_LOCK_OK');
console.log('qa-pipeline-lock: all passed');
