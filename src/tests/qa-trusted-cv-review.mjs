#!/usr/bin/env node
/**
 * HIRELY P1 — Trusted CV Quality Engine QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  TRUSTED_CV_REVIEW_V1,
  computeTrustedCvReview,
  enrichReportWithTrustedReview,
} from '../core/validation/trusted-cv-review-engine.js';
import { computeProductScore } from '../core/validation/product-score.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let fail = 0;
function ok(cond, msg) {
  if (cond) console.log(`OK ${msg}`);
  else {
    console.error(`FAIL ${msg}`);
    fail += 1;
  }
}

const fullCv = {
  name: 'Marie Dupont',
  title: 'Lead Illustrator',
  email: 'marie@example.com',
  phone: '+33 6 12 34 56 78',
  linkedin: 'https://linkedin.com/in/marie',
  summary: 'Senior illustrator with twelve years of experience across luxury and editorial clients.',
  experience: [
    'Lead Illustrator — McCann Paris · 2011–2014',
    'Freelance Illustrator — Nike, Apple, LVMH · 2015–Present',
    'Increased campaign engagement by 18% through visual systems',
  ],
  education: ['MA Illustration — ENSAD · 2009'],
  skills: ['Illustration', 'Branding', 'Art direction', 'Vector', 'Print', 'Storyboarding'],
  tools: ['Photoshop', 'Illustrator', 'Procreate'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Nike', 'Apple', 'LVMH'],
  projects: ['Global brand refresh — 2022'],
};

const thinCv = {
  name: 'Alex Martin',
  email: 'alex@example.com',
  experience: ['Designer — Studio · 2020–Present'],
  skills: ['Figma'],
};

ok(TRUSTED_CV_REVIEW_V1 === 'TRUSTED_CV_REVIEW_V1', 'engine version');

{
  const review = computeTrustedCvReview(fullCv);
  ok(!!review, 'review returned');
  ok(review.strengths.length >= 3, `full CV strengths (${review.strengths.length})`);
  ok(review.strengths.some((s) => s.id === 'contact_complete'), 'contact complete strength');
  const yearsStrength = review.strengths.find((s) => s.id === 'experience_years');
  ok(!!yearsStrength, 'experience years strength');
  ok(/\d+\s+years experience/.test(yearsStrength?.label || ''), `years label (${yearsStrength?.label})`);
  ok(!('total' in review) && !('score' in review), 'review has no percentage score');
  ok(review.strengths.every((s) => s.mark === 'ok'), 'strength marks are ok');
  ok(review.weaknesses.every((s) => s.mark === 'warn'), 'weakness marks are warn');
  ok(review.missing.every((s) => s.mark === 'missing'), 'missing marks are missing');
}

{
  const review = computeTrustedCvReview(thinCv);
  ok(review.weaknesses.some((s) => s.id === 'summary_missing'), 'thin CV flags summary missing');
  ok(review.missing.length >= 1, 'thin CV has missing items');
}

{
  const report = computeProductScore(fullCv, { finalResumeData: fullCv, resumeData: fullCv });
  ok(!!report?.cvReview, 'product score attaches cvReview');
  ok(!!report?.trustedReview, 'product score attaches trustedReview alias');
  ok(typeof report.total === 'number', 'internal total kept for gates');
  const enriched = enrichReportWithTrustedReview({ total: 72 }, fullCv);
  ok(!!enriched.cvReview?.strengths?.length, 'enrichReportWithTrustedReview works');
}

ok(/cvReviewPanel/.test(indexHtml), 'index has cvReviewPanel');
ok(/renderCvReviewPanel/.test(indexHtml), 'index renders cvReviewPanel');
ok(/cvReviewStrengths/.test(indexHtml), 'index has strengths list');
ok(!/reviewV2ScoreTpl.*replace/.test(indexHtml.replace(/\s/g, '')) || /!DEBUG_MODE/.test(indexHtml), 'production hides score template');
ok(/cvReviewContactComplete/.test(indexHtml), 'i18n contact complete string');

if (fail) {
  console.error(`\n${fail} check(s) failed`);
  process.exit(1);
}
console.log('\nTRUSTED_CV_REVIEW_QA_OK');
