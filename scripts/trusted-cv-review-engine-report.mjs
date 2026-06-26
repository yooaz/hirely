#!/usr/bin/env node
/**
 * HIRELY P1 — Generate TRUSTED_CV_REVIEW_ENGINE_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { computeTrustedCvReview } from '../src/core/validation/trusted-cv-review-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'TRUSTED_CV_REVIEW_ENGINE_REPORT.md');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = run('node', ['src/tests/qa-trusted-cv-review.mjs']);
const pass = qa.pass;

const sample = computeTrustedCvReview({
  name: 'Marie Dupont',
  title: 'Lead Illustrator',
  email: 'marie@example.com',
  phone: '+33 6 12 34 56 78',
  summary: 'Senior illustrator with twelve years of experience across luxury clients.',
  experience: [
    'Lead Illustrator — McCann Paris · 2011–2014',
    'Freelance — Nike, Apple · 2015–Present',
  ],
  education: ['MA — ENSAD · 2009'],
  skills: ['Illustration', 'Branding', 'Art direction', 'Vector', 'Print'],
  languages: ['French — native', 'English — fluent'],
});

const fmt = (rows, mark) =>
  rows.length
    ? rows.map((r) => `- ${mark} ${r.label}`).join('\n')
    : '- _(none)_';

const lines = [
  '# HIRELY P1 — Trusted CV Quality Engine',
  '',
  `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Problem',
  '',
  'Generic ATS percentages (44/100, 53/100) felt arbitrary and untrustworthy in the product UI.',
  '',
  '## Solution',
  '',
  'Replace consumer-facing scoring with a **Trusted CV Review** — concrete strengths, weaknesses, and missing information derived from resume data checks.',
  '',
  '### Consumer output (no percentages)',
  '',
  '| Section | Mark | Example |',
  '|---------|------|---------|',
  '| Strengths | ✓ | Contact information complete |',
  '| Strengths | ✓ | 12 years experience |',
  '| Weaknesses | ⚠ | Summary missing |',
  '| Weaknesses | ⚠ | No portfolio link |',
  '| Missing | ○ | Email address |',
  '',
  '### What we avoid',
  '',
  '- Random `/100` percentages in production review UI',
  '- ATS badge widgets in the review panel',
  '- Fake composite dimension bars for end users',
  '',
  'Internal `total` score remains for export gates and `?debug=true` tooling only.',
  '',
  '## Sample review output',
  '',
  `**Headline:** ${sample.headline}`,
  '',
  `**Summary:** ${sample.summary}`,
  '',
  '### Strengths',
  '',
  fmt(sample.strengths, '✓'),
  '',
  '### Weaknesses',
  '',
  fmt(sample.weaknesses, '⚠'),
  '',
  '### Missing information',
  '',
  fmt(sample.missing, '○'),
  '',
  '## Implementation',
  '',
  '| Piece | Location |',
  '|-------|----------|',
  '| Review engine | `src/core/validation/trusted-cv-review-engine.js` |',
  '| Product score hook | `src/core/validation/product-score.js` |',
  '| Review panel UI | `index.html` — `#cvReviewPanel` |',
  '| Production CSS | `index.html` — hides score ring + metric bars |',
  '',
  '## Signals used',
  '',
  '- Contact completeness (email + phone)',
  '- Career span from experience dates',
  '- Section presence (experience, education, skills, summary, languages)',
  '- Portfolio / LinkedIn for creative archetypes',
  '- Measurable impact in experience bullets',
  '',
  '## QA',
  '',
  '```',
  qa.out || '(no output)',
  '```',
  '',
  '```bash',
  'npm run test:trusted-cv-review',
  '```',
  '',
];

fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
console.log(`Wrote ${OUT}`);
console.log(pass ? 'TRUSTED_CV_REVIEW_ENGINE_REPORT: PASS' : 'TRUSTED_CV_REVIEW_ENGINE_REPORT: FAIL');
process.exit(pass ? 0 : 1);
