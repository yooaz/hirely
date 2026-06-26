#!/usr/bin/env node
/**
 * P2 — REAL ATS SCORE audit: data-driven, no placeholders, no static score.
 */
import {
  computeAtsScore,
  ATS_CATEGORIES,
} from '../core/validation/ats-engine.js';
import {
  REAL_ATS_CORE_DIMENSIONS,
  SCORE_V2_CATEGORIES,
  computeRecruiterScoreV2,
  getCoreAtsDimensionScores,
} from '../core/validation/recruiter-score-v2.js';
import { computeProductScore } from '../core/validation/product-score.js';
import { NAME_UNCERTAIN_LABEL, TITLE_UNCERTAIN_LABEL } from '../core/parsing/parser-recovery.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const fullCv = {
  name: 'Marie Dupont',
  title: 'Product Designer',
  email: 'marie@example.com',
  phone: '+33 6 12 34 56 78',
  summary: 'Senior product designer with 8 years in B2B SaaS.',
  experience: [
    'Lead Designer — Acme Corp · 2020–Present',
    'Designed checkout flow increasing conversion by 24%',
    'Built design system used by 12 product teams',
  ],
  education: ['Master Design — ENSAD Paris · 2014'],
  skills: ['Figma', 'Design systems', 'User research', 'Prototyping', 'Accessibility'],
  tools: ['Sketch'],
  languages: ['French — native', 'English — fluent'],
};

ok(REAL_ATS_CORE_DIMENSIONS.length === 5, 'five core ATS dimensions defined');
for (const dim of REAL_ATS_CORE_DIMENSIONS) {
  ok(!!SCORE_V2_CATEGORIES[dim], `core dimension in categories (${dim})`);
}

const full = computeAtsScore(fullCv);
ok(!!full, 'full CV produces score');
ok(full.total >= 55 && full.total <= 100, `full CV total in range (${full.total})`);
ok(full.breakdown.reduce((s, c) => s + c.points, 0) >= full.total, 'penalties reduce total from breakdown sum');

const core = getCoreAtsDimensionScores(full);
ok(core.identity.points > 0, `identity contributes (${core.identity.points})`);
ok(core.experience.points > 0, `experience contributes (${core.experience.points})`);
ok(core.education.points > 0, `education contributes (${core.education.points})`);
ok(core.skills.points > 0, `skills contributes (${core.skills.points})`);
ok(core.languages.points > 0, `languages contributes (${core.languages.points})`);

const empty = computeAtsScore({
  name: '',
  title: '',
  email: '',
  experience: [],
  education: [],
  skills: [],
  languages: [],
});
ok(empty.total < full.total, `empty scores lower than full (${empty.total} < ${full.total})`);
ok(empty.total < 55, `empty CV below Good threshold (${empty.total})`);

const placeholder = computeAtsScore({
  ...fullCv,
  name: NAME_UNCERTAIN_LABEL,
  title: TITLE_UNCERTAIN_LABEL,
});
ok(!placeholder.checks.name, 'placeholder name rejected');
ok(!placeholder.checks.title, 'placeholder title rejected');
ok(placeholder.total < full.total, `placeholders lower score (${placeholder.total} < ${full.total})`);

const genericPlaceholder = computeAtsScore({
  ...fullCv,
  name: 'John Doe',
  title: 'Your Name',
  email: 'email@example.com',
});
ok(!genericPlaceholder.checks.name || genericPlaceholder.total <= full.total, 'generic placeholders do not inflate score');

const stripTests = [
  ['experience', { ...fullCv, experience: [] }],
  ['education', { ...fullCv, education: [] }],
  ['skills', { ...fullCv, skills: [], tools: [] }],
  ['languages', { ...fullCv, languages: [] }],
  ['identity', { ...fullCv, name: '', title: '' }],
];

for (const [dim, cv] of stripTests) {
  const stripped = computeAtsScore(cv);
  ok(stripped.total < full.total, `removing ${dim} lowers score (${stripped.total} < ${full.total})`);
  const strippedCore = getCoreAtsDimensionScores(stripped);
  if (dim !== 'identity') {
    ok(strippedCore[dim].points < core[dim].points, `${dim} points drop when section removed`);
  } else {
    ok(strippedCore.identity.points < core.identity.points, 'identity points drop when name/title removed');
  }
}

const partialA = computeAtsScore({ ...fullCv, skills: ['Figma'] });
const partialB = computeAtsScore({ ...fullCv, skills: ['Figma', 'Research', 'Systems', 'Prototyping', 'A11y', 'Workshops'] });
ok(partialB.total >= partialA.total, 'more skills never lowers score');
ok(partialB.coreDimensions.skills.points >= partialA.coreDimensions.skills.points, 'skills points scale with data');

const resumeData = {
  identity: {
    name: 'Marie Dupont',
    title: 'Product Designer',
    email: 'marie@example.com',
    phone: '+33 6 12 34 56 78',
  },
  experiences: [
    { role: 'Lead Designer', company: 'Acme', startDate: '2020', endDate: 'Present', bullets: ['+24% conversion'] },
  ],
  education: ['Master — ENSAD — 2014'],
  skills: ['Figma', 'Design systems'],
  tools: [],
  languages: ['French — native'],
  unsorted: [],
  meta: {},
};

const gatedCv = { name: 'Marie Dupont', title: 'Product Designer', email: 'marie@example.com', experience: [], education: [], skills: [], languages: [] };
const fromResume = computeProductScore(gatedCv, { resumeData });
ok(fromResume.checks.experience, 'product score reads experience from resumeData');
ok(fromResume.checks.education, 'product score reads education from resumeData');
ok(fromResume.checks.skills, 'product score reads skills from resumeData');
ok(fromResume.checks.languages, 'product score reads languages from resumeData');
ok(fromResume.total > empty.total, `resumeData-backed score above empty (${fromResume.total})`);

const r1 = computeRecruiterScoreV2(fullCv);
const r2 = computeRecruiterScoreV2(fullCv);
ok(r1.total === r2.total, 'deterministic for same input');
const different = computeRecruiterScoreV2({ ...fullCv, languages: [] });
ok(different.total !== r1.total, 'different data yields different score (not static)');

const maxSum = Object.values(ATS_CATEGORIES).reduce((s, c) => s + c.max, 0);
ok(maxSum === 100, `category weights sum to 100 (${maxSum})`);

console.log('\nATS_SCORING_AUDIT QA PASS');
