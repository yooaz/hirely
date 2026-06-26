/**
 * Stability phase — text retention + classify + resumeData contract.
 * Run: node src/tests/qa-stability-phase.mjs
 */
import {
  emptyResumeData,
  buildResumeData,
  reconcileTextRetention,
  moveUnsortedToSection,
  resumeDataToCvData,
  assertResumeDataContract,
} from '../core/resume-data.js';
import { sanitizeCvDataForExport } from '../core/parsing/corruption-detector.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const raw = `Jane Doe\nDesigner\n\nACME Corp 2020-2022\nLed brand projects\n\nPhotoshop Illustrator\nFrench English`;
const rd = buildResumeData({
  structured: {
    identity: { name: 'Jane Doe', title: 'Designer', email: '', phone: '', location: '', website: '', linkedin: '' },
    summary: '',
    experiences: [],
    education: [],
    clients: [],
    projects: [],
    skills: [],
    tools: [],
    languages: [],
    unsorted: [],
  },
  rawText: raw,
  cleanedText: raw,
  rejectedLines: ['Orphan line kept'],
});

ok(rd.unsorted.includes('Orphan line kept'), 'rejected lines land in unsorted');
ok(rd.unsorted.some((l) => /ACME Corp/.test(l)), 'unclassified clean lines land in unsorted');

const moved = moveUnsortedToSection(rd, ['Orphan line kept'], 'skill');
ok(!moved.unsorted.includes('Orphan line kept'), 'moved line removed from unsorted');
ok(moved.skills.includes('Orphan line kept'), 'moved line in skills');

const cv = resumeDataToCvData(moved);
const dirty = { ...cv, experience: ['@@@garbage@@@', 'Real role'], unsorted: [] };
const sanitized = sanitizeCvDataForExport(dirty);
ok(
  sanitized.unsorted?.some((l) => /@@@garbage@@@/.test(l)),
  'corrupted export lines quarantined to unsorted not deleted'
);

const contract = assertResumeDataContract(moved);
ok(contract.ok, 'resumeData contract holds after moves');

if (failed) {
  process.exit(1);
}
console.log('\nqa-stability-phase: all checks passed');
