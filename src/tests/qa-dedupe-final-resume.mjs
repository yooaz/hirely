#!/usr/bin/env node
/**
 * P1 — finalResumeData dedupe gate.
 */
import {
  DEDUPE_FINAL_RESUME,
  dedupeFinalResumeData,
  auditFinalResumeDuplicates,
} from '../core/validation/dedupe-final-resume.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { normalizeResumeData } from '../core/resume-data.js';
import {
  normalizeCompareString,
  normalizeDateCompareKey,
  dedupeExperienceEntries,
} from '../core/parsing/dedupe-engine.js';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

ok(DEDUPE_FINAL_RESUME === 'DEDUPE_FINAL_RESUME_V3', 'engine version');
ok(
  normalizeCompareString('Créapole!!!') === normalizeCompareString('creapole'),
  'normalize punctuation + accents'
);
ok(
  normalizeDateCompareKey('2011–2022') === normalizeDateCompareKey('2011/2022'),
  'normalize date separators'
);

const edu = dedupeFinalResumeData({
  identity: { name: 'Test' },
  education: [
    'Créapole',
    'Créapole',
    'Creative School Management',
    'Creative School Management',
    'Créapole — Visual Communication — 2007–2010',
    'Créapole — Visual Communication — 2007/2010',
  ],
  experiences: [],
  skills: [],
  tools: [],
  languages: [],
});
ok(edu.education.filter((l) => /créapole|creapole/i.test(l)).length === 1, 'Créapole education once');
ok(
  edu.education.filter((l) => /creative school management/i.test(l)).length === 1,
  'Creative School Management once'
);
ok(
  edu.education.filter((l) => /visual communication/i.test(l)).length === 1,
  'merged program date range once'
);

const exp = dedupeFinalResumeData({
  identity: { name: 'Test' },
  education: [],
  experiences: [
    { role: 'Freelance', company: '', dates: '2011–2022', bullets: [] },
    { role: 'Freelance Illustrator', company: 'Independent', dates: '2011/2022', bullets: ['Posters'] },
    { role: 'Designer', company: 'McCann', dates: '2018–2020', bullets: [] },
    { role: 'Designer', company: 'McCann', dates: '2018-2020', bullets: ['Campaigns'] },
  ],
  skills: [],
  tools: [],
  languages: [],
});
ok(
  exp.experiences.filter((e) => /freelance/i.test(e.role) || /independent/i.test(e.company)).length === 1,
  'Freelance / Independent once'
);
ok(exp.experiences.filter((e) => /mccann/i.test(e.company)).length === 1, 'McCann experience once');
ok(
  exp.experiences.find((e) => /freelance/i.test(e.role))?.bullets?.length === 1,
  'freelance merge keeps richer bullets'
);

const lists = dedupeFinalResumeData({
  identity: { name: 'Test' },
  education: [],
  experiences: [],
  skills: ['Figma', 'figma', 'Brand Identity'],
  tools: ['Photoshop', 'photoshop'],
  languages: ['English — Fluent', 'english — fluent'],
  clients: [],
  projects: [],
});
ok(lists.skills.length === 2, `skills deduped (${lists.skills.length})`);
ok(lists.tools.length === 1, 'tools deduped');
ok(lists.languages.length === 1, 'languages deduped');

const built = buildFinalResumeData(
  normalizeResumeData({
    identity: { name: 'Yohann', title: 'Designer', email: 'y@test.com' },
    summary: 'Creative designer.',
    experiences: [
      { role: 'Freelance', company: '', dates: '', bullets: [] },
      { role: 'Freelance', company: 'Independent', dates: '', bullets: ['Illustration'] },
    ],
    education: ['Créapole', 'Créapole', 'Creative School Management', 'Creative School Management'],
    skills: ['Brand Identity', 'brand identity'],
    tools: ['Sketch', 'sketch'],
    languages: ['French', 'french'],
    clients: [],
    projects: [],
    unsorted: [],
    meta: {},
  })
);

const fr = built.finalResumeData;
ok(!!fr, 'buildFinalResumeData produces finalResumeData');
ok((fr.education || []).filter((l) => /créapole/i.test(l)).length <= 1, 'contract: Créapole at most once');
ok(
  (fr.education || []).filter((l) => /creative school management/i.test(l)).length === 0,
  'contract: no Creative School Management without degree'
);
ok(auditFinalResumeDuplicates(fr).ok, 'contract: no duplicate experience rows');
ok(
  (fr.experiences || []).filter((e) => /freelance|independent/i.test(`${e.role} ${e.company}`)).length <= 1,
  'contract: freelance experience once'
);
function noCaseDuplicateLines(list) {
  const keys = new Set();
  for (const item of list || []) {
    const key = normalizeCompareString(item);
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return true;
}
ok(noCaseDuplicateLines(fr.skills), 'contract: no duplicate skills');
ok(noCaseDuplicateLines(fr.tools), 'contract: no duplicate tools');
ok(noCaseDuplicateLines(fr.languages), 'contract: no duplicate languages');
ok(!!built.cvData && !!built.contract?.renderable, 'CV still renders after dedupe');

const freelanceKeys = dedupeExperienceEntries([
  { role: 'Freelance', company: 'Independent', dates: '2011–2022' },
  { role: 'Freelance Illustrator', company: '', dates: '2011/2022' },
]).length;
ok(freelanceKeys === 1, `freelance key collapse (${freelanceKeys})`);

if (failed) {
  console.error(`\nqa-dedupe-final-resume FAILED (${failed})`);
  process.exit(1);
}
console.log('\nqa-dedupe-final-resume PASSED');
