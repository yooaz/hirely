#!/usr/bin/env node
/**
 * P0 — RESUME_DATA_FLOW_LOCK must warn on fold keys, never block import when minimum data exists.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { normalizeResumeData } from '../core/resume-data.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import {
  assertResumeDataFlowLock,
  FLOW_LOCK_FOLD_INTO_UNSORTED_KEYS,
  resumeDataMeetsImportMinimum,
} from '../core/pipeline/hirely-flow-lock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const fixture = fs.readFileSync(
  path.join(root, 'tests/fixtures/developer-cv/fixture.txt'),
  'utf8'
);

const failures = [];
const ok = (c, m) => (c ? console.log('OK', m) : (failures.push(m), console.error('FAIL', m)));

ok(FLOW_LOCK_FOLD_INTO_UNSORTED_KEYS.length === 4, 'four fold-into-unsorted keys defined');
ok(
  FLOW_LOCK_FOLD_INTO_UNSORTED_KEYS.join(',') === 'exhibitions,awards,publications,blocks',
  'fold keys match creative parser output'
);

const preShape = {
  identity: { name: 'Creative Dev', email: 'dev@example.com' },
  summary: '',
  experiences: [{ role: 'Designer', company: 'Studio', bullets: ['Led brand'] }],
  education: [],
  skills: [],
  exhibitions: ['Gallery One'],
  awards: ['Design Award'],
  publications: ['Annual Report'],
  portfolioLinks: ['https://portfolio.test'],
  blocks: [{ bullets: ['block line'] }],
  unsorted: [],
  meta: {},
};
const preLock = assertResumeDataFlowLock(preShape);
ok(preLock.fatal.length === 0, 'pre-shape fold keys are not fatal');
ok(preLock.warnings.length === 4, `pre-shape emits four warnings (${preLock.warnings.join(', ')})`);

const normalized = normalizeResumeData(preShape, { skipSanitize: true });
const postLock = assertResumeDataFlowLock(normalized);
ok(postLock.ok, 'normalizeResumeData output passes flow lock');
ok(!('exhibitions' in normalized), 'exhibitions folded after normalize');
ok(!('blocks' in normalized), 'blocks removed after normalize');
ok((normalized.portfolioLinks || []).length >= 1, 'portfolioLinks preserved after normalize');
ok(normalized.unsorted.length >= 3, 'folded creative lines preserved in unsorted');

ok(resumeDataMeetsImportMinimum(normalized), 'minimum met with email + experience');

const imported = await runHirelyImportFromText(fixture, { source: 'qa-resume-data-flow-lock' });
ok(!!imported.resumeData, 'pipeline returns resumeData');
const rd = normalizeResumeData(imported.resumeData, { skipSanitize: true });
ok(assertResumeDataFlowLock(rd).ok, 'fixture import passes flow lock after normalize');
ok(resumeDataMeetsImportMinimum(rd), 'fixture meets import minimum');

const built = buildFinalResumeData(imported.resumeData, { silent: true });
ok(built.contract?.renderable, 'buildFinalResumeData renderable for fixture');
ok(!!built.cvData, 'buildFinalResumeData produces cvData');

const skillsOnly = normalizeResumeData({
  identity: { name: 'Skills Only' },
  skills: ['TypeScript', 'React'],
});
ok(resumeDataMeetsImportMinimum(skillsOnly), 'skills-only partial CV meets minimum');
ok(buildFinalResumeData(skillsOnly).contract?.renderable, 'skills-only is renderable');

const empty = normalizeResumeData({ identity: { name: '' } });
ok(!resumeDataMeetsImportMinimum(empty), 'empty identity does not meet minimum');

if (failures.length) {
  failures.forEach((f) => console.error(f));
  process.exit(1);
}
console.log('RESUME_DATA_FLOW_LOCK_QA_OK');
