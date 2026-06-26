#!/usr/bin/env node
/**
 * HIRELY H5 — Recruiter Score V2 QA.
 */
import {
  SCORE_V2_CATEGORIES,
  computeRecruiterScoreV2,
} from '../core/validation/recruiter-score-v2.js';
import { ATS_QUALITY_H8 } from '../core/validation/ats-quality-h8.js';
import { computeProductScore } from '../core/validation/product-score.js';
import { computeAtsScore } from '../core/validation/ats-engine.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const fullCv = {
  name: 'Marie Dupont',
  title: 'Product Designer',
  email: 'marie@example.com',
  phone: '+33 6 12 34 56 78',
  linkedin: 'https://linkedin.com/in/marie',
  location: 'Paris',
  summary: 'Senior product designer with 8 years building B2B SaaS products.',
  experience: [
    'Lead Designer — Acme Corp · 2020–Present',
    'Increased checkout conversion by 24% through UX research',
    'Senior Designer — Beta Inc · 2017–2020',
    'Built design system adopted by 12 product teams',
  ],
  education: ['Master Design — ENSAD Paris · 2014'],
  skills: ['Figma', 'Design systems', 'User research', 'Prototyping', 'Accessibility', 'Workshops'],
  tools: ['Sketch', 'Principle', 'Miro'],
  languages: ['French — native', 'English — fluent'],
};

const emptyCv = {
  name: '',
  email: '',
  phone: '',
  experience: [],
  education: [],
  skills: [],
  tools: [],
  languages: [],
};

const maxSum = Object.values(SCORE_V2_CATEGORIES).reduce((s, c) => s + c.max, 0);
ok(maxSum === 100, `category weights sum to 100 (${maxSum})`);
ok(Object.keys(SCORE_V2_CATEGORIES).length === 9, 'nine V2 categories');

const result = computeRecruiterScoreV2(fullCv);
ok(!!result, 'computeRecruiterScoreV2 returns result');
ok(result.version === ATS_QUALITY_H8, 'version tag');
ok(result.score === result.total, 'score equals total');
ok(result.score >= 70 && result.score <= 100, `full CV score in range (${result.score})`);
ok(result.breakdown.length === 9, 'breakdown has 9 categories');
ok(result.breakdown.every((c) => c.points <= c.max), 'no category exceeds max');
const sum = result.breakdown.reduce((s, c) => s + c.points, 0);
ok(sum >= result.score, `penalties applied (${sum} base >= ${result.score} total)`);
ok(!!result.scores?.content && !!result.scores?.ats, 'composite scores exposed');

ok(Array.isArray(result.strengths) && result.strengths.length >= 1, 'strengths returned');
ok(Array.isArray(result.weaknesses), 'weaknesses returned');
ok(Array.isArray(result.recommendations), 'recommendations returned');

const empty = computeRecruiterScoreV2(emptyCv);
ok(empty.score < 55, `empty CV scores low (${empty.score})`);
ok(empty.recommendations.length >= 3, 'empty CV has recommendations');

const r1 = computeRecruiterScoreV2(fullCv);
const r2 = computeRecruiterScoreV2(fullCv);
ok(r1.score === r2.score, 'deterministic scoring');

const partial = { ...fullCv, email: '', phone: '', languages: [] };
ok(computeRecruiterScoreV2(partial).score < r1.score, 'removing contact/lang lowers score');

const product = computeProductScore(fullCv);
ok(product.score === result.score, 'product-score delegates to V2');
ok(computeAtsScore(fullCv).score === result.score, 'ats-engine delegates to V2');

const identity = result.breakdown.find((c) => c.id === 'identity');
const tools = result.breakdown.find((c) => c.id === 'tools');
const languages = result.breakdown.find((c) => c.id === 'languages');
ok(identity?.max === 15, 'identity max 15');
ok(tools?.max === 8, 'tools max 8');
ok(languages?.max === 8, 'languages max 8');

if (failed) {
  process.exitCode = 1;
  console.error(`\n${failed} check(s) failed`);
} else {
  console.log('\nqa-recruiter-score-v2: PASS');
}
