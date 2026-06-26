/**
 * ATS pipeline — data-driven score + weighted breakdown.
 */
import { computeAtsScore, ATS_CATEGORIES } from '../core/validation/ats-engine.js';
import { SCORE_V2_CATEGORIES } from '../core/validation/recruiter-score-v2.js';
import { analyzeAts } from '../core/validation/ats-analyzer.js';
import { runRecruiterAudit } from '../core/validation/recruiter-audit.js';
import { computeProductScore } from '../core/validation/product-score.js';
import { buildRecruiterReview } from '../core/validation/recruiter-review.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('  ✓', msg);
};

const fullCv = {
  name: 'Marie Dupont',
  title: 'Product Designer',
  email: 'marie@example.com',
  phone: '+33 6 12 34 56 78',
  summary:
    'Senior product designer with 8 years building B2B SaaS. Led design systems adopted by 40+ engineers.',
  experience: [
    'Lead Designer — Acme Corp · 2020–Present',
    'Designed checkout flow increasing conversion by 24%',
    'Built and maintained design system used by 12 product teams',
    'Managed 3 designers and collaborated with engineering leads',
  ],
  education: ['Master Design — ENSAD Paris · 2014'],
  skills: ['Figma', 'Design systems', 'User research', 'Prototyping', 'Accessibility', 'Workshops'],
  tools: ['Sketch', 'Principle'],
  languages: ['French — native', 'English — fluent'],
};

const emptyCv = { name: '', email: '', phone: '', experience: [], education: [], skills: [] };

function testCategoriesSumTo100() {
  const maxSum = Object.values(SCORE_V2_CATEGORIES).reduce((s, c) => s + c.max, 0);
  ok(maxSum === 100, `category weights sum to 100 (${maxSum})`);
  ok(ATS_CATEGORIES === SCORE_V2_CATEGORIES, 'ATS_CATEGORIES aliases V2');
}

function testFullCvScore() {
  const result = computeAtsScore(fullCv);
  ok(!!result, 'computeAtsScore returns result');
  ok(result.total >= 55 && result.total <= 100, `full CV total in range (${result.total})`);
  ok(result.breakdown.length === 7, 'breakdown has 7 categories');
  ok(Array.isArray(result.strengths), 'strengths array present');
  ok(Array.isArray(result.recommendations), 'recommendations array present');
  const sum = result.breakdown.reduce((s, c) => s + c.points, 0);
  ok(sum === result.total, `breakdown sums to total (${sum} === ${result.total})`);
  ok(result.breakdown.every((c) => c.points <= c.max), 'no category exceeds max');
  ok(['Excellent', 'Good', 'Needs improvement'].includes(result.band.label), `band label valid (${result.band.label})`);
}

function testEmptyCvScore() {
  const result = computeAtsScore(emptyCv);
  ok(result.total < 55, `empty CV scores low (${result.total})`);
  ok(result.band.label === 'Needs improvement', 'empty CV band is Needs improvement');
}

function testNoFakeScore() {
  const r1 = computeAtsScore(fullCv);
  const r2 = computeAtsScore(fullCv);
  ok(r1.total === r2.total, 'same input yields same score (deterministic)');
  const partial = { ...fullCv, email: '', phone: '' };
  const r3 = computeAtsScore(partial);
  ok(r3.total < r1.total, 'removing contact lowers score');
}

function testPipelineModules() {
  const analyzed = analyzeAts(fullCv);
  ok(analyzed.pipeline === 'ats-analyzer', 'ats-analyzer tags pipeline');
  ok(analyzed.total === computeAtsScore(fullCv).total, 'analyzer matches engine');

  const product = computeProductScore(fullCv);
  ok(product.total === analyzed.total, 'product-score delegates to engine');

  const review = buildRecruiterReview(fullCv);
  ok(review.atsScore === product.total, 'recruiter review uses total ATS score');

  const audit = runRecruiterAudit(fullCv);
  ok(audit.atsScore === product.total, 'recruiter-audit exposes total');
  ok(audit.breakdown.length === 7, 'recruiter-audit includes breakdown');
  ok(Array.isArray(audit.strengths), 'recruiter-audit exposes strengths');
}

function main() {
  console.log('qa-ats-pipeline');
  testCategoriesSumTo100();
  testFullCvScore();
  testEmptyCvScore();
  testNoFakeScore();
  testPipelineModules();
  console.log('qa-ats-pipeline: passed');
}

main();
