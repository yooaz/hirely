#!/usr/bin/env node
/**
 * P1 — Production cleanup gate (finalResumeData + cvData contract).
 */
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { applyFinalCvReadabilityPass } from '../core/validation/final-cv-readability.js';
import { normalizeResumeData } from '../core/resume-data.js';
import { FORBIDDEN_TEMPLATE_CV_KEYS } from '../core/pipeline/hirely-flow-lock.js';
import { resolveChecklistProfile } from '../core/validation/recruiter-checklist-source.js';
import { computeRecruiterScoreV2 } from '../core/validation/recruiter-score-v2.js';
import { validateConsumerDataSource } from '../core/validation/resume-data-contract.js';
import { dedupeEducationStrings } from '../core/parsing/dedupe-engine.js';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const yoaz = normalizeResumeData({
  identity: {
    name: 'Yohann Azancot',
    title: 'Graphic Designer / Illustrator',
    email: 'yoaz@hotmail.fr',
    phone: '+33 6 49 43 48 39',
    location: 'Paris',
  },
  summary: 'Illustrator and graphic designer.',
  experiences: [
    {
      role: 'Freelance - Independent / Freelance - Independent / Freelance',
      company: '',
      dates: '2011–2022',
      bullets: ['Posters, packaging, logos'],
    },
    {
      role: 'Freelance',
      company: 'Independent / Freelance',
      dates: '2011–2022',
      bullets: [],
    },
    { role: 'Designer', company: 'McCann G. Agency', dates: '2011–2014', bullets: ['Campaigns'] },
  ],
  education: [
    'Créapole - Creative School Management',
    'Creative School Management',
    'Créapole — Visual Communication — 2008–2011',
    'LISAA — Web & Motion Design — 2011–2012',
  ],
  skills: ['Illustration', 'Graphic Design', 'Packaging', 'Logo Design', 'Visual Identity', 'Editorial Design'],
  tools: ['Adobe Illustrator', 'Photoshop', 'InDesign'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Nike'],
  projects: [],
  unsorted: ['orphan'],
  unknownExperience: ['Freelance ghost'],
  toClassify: [{ text: 'review me' }],
  _enterprise: { x: 1 },
  meta: {},
});

const built = buildFinalResumeData(yoaz);
const fr = built.finalResumeData;
const cv = built.cvData;

ok(!!fr, 'finalResumeData built');
ok(!!cv, 'cvData built');

const freelance = (fr.experiences || []).find((e) => /freelance/i.test(e.role));
ok(!!freelance, 'single freelance experience');
ok(freelance?.role === 'Freelance Illustrator / Graphic Designer', 'freelance role canonical');
ok(freelance?.company === 'Independent / Freelance', 'freelance company canonical');
ok(freelance?.dates === '2011–2022', 'freelance dates canonical');
ok(
  (fr.experiences || []).filter((e) => /freelance|independent/i.test(`${e.role} ${e.company}`)).length === 1,
  'no duplicate freelance rows'
);

ok(!fr.education.some((l) => /creative school management/i.test(l)), 'no Creative School Management');
ok(
  fr.education.filter((l) => /créapole/i.test(l) && /visual communication/i.test(l)).length === 1,
  'single Créapole entry'
);

const forbiddenOnCv = FORBIDDEN_TEMPLATE_CV_KEYS.filter((k) => k in (cv || {}));
ok(!forbiddenOnCv.length, `cvData forbidden keys (${forbiddenOnCv.join(', ') || 'none'})`);

const consumer = validateConsumerDataSource(cv, 'TEMPLATE_TEST', { silent: true });
const forbiddenWarnings = consumer.violations.filter((v) => /FORBIDDEN_CV_KEY/.test(v));
ok(!forbiddenWarnings.length, `no TEMPLATE_FORBIDDEN_CV_KEY (${forbiddenWarnings.join(', ')})`);

const profile = resolveChecklistProfile({ finalResumeData: fr, cvData: cv });
const forbiddenOnProfile = FORBIDDEN_TEMPLATE_CV_KEYS.filter((k) => k in (profile || {}));
ok(!forbiddenOnProfile.length, `checklist profile forbidden keys (${forbiddenOnProfile.join(', ')})`);

const score = computeRecruiterScoreV2(profile);
ok(!!score, 'ATS score computed');
ok(score.total >= 74 && score.total <= 95, `ATS score in pipeline real CV band (${score.total})`);

const messy = applyFinalCvReadabilityPass({
  identity: { name: 'Test' },
  education: dedupeEducationStrings(['Créapole - Creative School Management', 'Creative School Management']),
  experiences: [
    { role: 'Freelance - Independent / Freelance - Freelance', company: '', dates: '2011–2022', bullets: [] },
    { role: 'Freelance', company: 'Independent / Freelance', dates: '2011–2022', bullets: [] },
  ],
  skills: [],
  tools: [],
  languages: [],
});
ok(messy.education.length <= 1, 'education collapsed');
ok(messy.experiences.length === 1, 'experience collapsed');

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll production cleanup checks passed.');
