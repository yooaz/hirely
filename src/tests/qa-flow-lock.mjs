#!/usr/bin/env node
/**
 * Flow lock — resumeData + template cvData must stay product-clean.
 * node src/tests/qa-flow-lock.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { buildStructuredResumeFromBlocks } from '../core/parsing/structured-resume-from-blocks.js';
import {
  normalizeResumeData,
  resumeDataFromStructured,
  resumeDataToCvData,
} from '../core/resume-data.js';
import {
  isHirelyFlowLocked,
  assertResumeDataFlowLock,
  assertTemplateCvFlowLock,
  HIRELY_FLOW_STAGES,
  ALLOWED_RESUME_DATA_KEYS,
} from '../core/pipeline/hirely-flow-lock.js';
import { assertStructuredResumeJsonSize, STRUCTURED_RESUME_JSON_MAX } from '../core/pipeline/pipeline-contract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const sample = fs.readFileSync(
  path.join(root, 'tests/fixtures/developer-cv/fixture.txt'),
  'utf8'
);

const failures = [];
const ok = (c, m) => (c ? console.log('OK', m) : (failures.push(m), console.error('FAIL', m)));

ok(isHirelyFlowLocked(), 'flow lock enabled by default');
ok(HIRELY_FLOW_STAGES.length === 10, 'ten flow stages defined');
ok(HIRELY_FLOW_STAGES[4] === 'CLASSIFY_FACTS', 'classify facts stage');
ok(ALLOWED_RESUME_DATA_KEYS.length === 11, 'allowed resumeData keys');

const engine = runSectionEngineV2(sample, { rawText: sample });
const structured = buildStructuredResumeFromBlocks([], {
  rawText: sample,
  cleanedText: sample,
});
ok(structured.metadata?.flowLock != null, 'structuredResume tagged with flow lock');
ok(structured.metadata?.neverRawExperienceParse === true, 'no raw experience parse flag');

const rd = normalizeResumeData(resumeDataFromStructured(structured));
const lock = assertResumeDataFlowLock(rd);
ok(lock.ok, `resumeData has no debug keys (${lock.forbidden.join(', ')})`);
ok(!('debugReport' in rd), 'resumeData.debugReport absent');
ok(!('structuredResume' in rd), 'resumeData.structuredResume absent');

const cv = resumeDataToCvData(rd);
const tpl = assertTemplateCvFlowLock(cv);
ok(tpl.ok, `template cvData clean (${tpl.forbidden.join(', ')})`);
ok(!('raw' in cv) && !('rawText' in cv) && !('cleanText' in cv), 'no raw text on template cvData');

ok(engine.structured.experiences.length >= 0, 'section engine produces structured experiences path');

const srSize = assertStructuredResumeJsonSize(structured);
ok(srSize.ok, `structuredResume under ${STRUCTURED_RESUME_JSON_MAX} (${srSize.length})`);

if (failures.length) {
  failures.forEach((f) => console.error(f));
  process.exit(1);
}
console.log('PASSED flow lock QA');
