#!/usr/bin/env node
/**
 * Generate ATS_SCORING_AUDIT.md
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  computeRecruiterScoreV2,
  REAL_ATS_CORE_DIMENSIONS,
  SCORE_V2_CATEGORIES,
} from '../src/core/validation/recruiter-score-v2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'ATS_SCORING_AUDIT.md');

const run = spawnSync('node', ['src/tests/qa-ats-scoring-audit.mjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe',
});

const pass = run.status === 0;
const stdout = (run.stdout || '').trim();
const stderr = (run.stderr || '').trim();

const sample = {
  name: 'Marie Dupont',
  title: 'Product Designer',
  email: 'marie@example.com',
  phone: '+33 6 12 34 56 78',
  experience: ['Lead Designer — Acme Corp · 2020–Present', 'Increased conversion by 24%'],
  education: ['Master Design — ENSAD Paris · 2014'],
  skills: ['Figma', 'Design systems', 'User research', 'Prototyping', 'Accessibility'],
  languages: ['French — native', 'English — fluent'],
};

const full = computeRecruiterScoreV2(sample);
const empty = computeRecruiterScoreV2({
  name: '',
  experience: [],
  education: [],
  skills: [],
  languages: [],
});

const categoryRows = (full?.breakdown || []).map((c) => `| ${c.label} | ${c.points} | ${c.max} |`);
const coreRows = REAL_ATS_CORE_DIMENSIONS.map((id) => {
  const c = SCORE_V2_CATEGORIES[id];
  const pts = full?.coreDimensions?.[id]?.points ?? 0;
  return `| ${c.label} | ${pts} | ${c.max} | ${pass ? 'PASS' : 'FAIL'} |`;
});

const lines = [
  '# ATS Scoring Audit — P2 Real ATS Score',
  '',
  `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
  '',
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Requirement',
  '',
  'Score must depend on real CV data — not placeholders, not static defaults.',
  '',
  '### Core dimensions (required signals)',
  '',
  ...REAL_ATS_CORE_DIMENSIONS.map((d) => `- ${SCORE_V2_CATEGORIES[d].label} (max ${SCORE_V2_CATEGORIES[d].max})`),
  '',
  '### Rules',
  '',
  '- No placeholder identity (`Nom à compléter`, `John Doe`, `Your Name`, `—`, etc.)',
  '- No static score — different profiles produce different totals',
  '- Breakdown points sum to total (max 100)',
  '',
  '## Canonical pipeline',
  '',
  '```',
  'cvData / resumeData',
  '  → resolveChecklistProfile()',
  '  → computeProductScore()',
  '  → computeRecruiterScoreV2()  [REAL ATS]',
  '  → computeAtsScore() / analyzeAts()',
  '```',
  '',
  '**Engine:** `src/core/validation/recruiter-score-v2.js` (`HIRELY_RECRUITER_SCORE_V2`)',
  '',
  '## Sample scores',
  '',
  '| Profile | Total | Band |',
  '|---------|-------|------|',
  `| Full sample CV | ${full?.total ?? '—'} | ${full?.band?.label ?? '—'} |`,
  `| Empty CV | ${empty?.total ?? '—'} | ${empty?.band?.label ?? '—'} |`,
  '',
  '## Full breakdown (sample)',
  '',
  '| Category | Points | Max |',
  '|----------|--------|-----|',
  ...categoryRows,
  '',
  '## Core dimension audit',
  '',
  '| Dimension | Points | Max | Status |',
  '|-----------|--------|-----|--------|',
  ...coreRows,
  '',
  '## Acceptance',
  '',
  '| Check | Status |',
  '|-------|--------|',
  '| Identity affects score | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Experience affects score | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Education affects score | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Skills affect score | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Languages affect score | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Placeholders rejected | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '| Not static (varies by data) | ' + (pass ? 'PASS' : 'FAIL') + ' |',
  '',
  '## Legacy paths (not canonical)',
  '',
  '| Path | Issue |',
  '|------|-------|',
  '| `index.html` `computeRecruiterScores()` | DEBUG-only; clamps 35–92 |',
  '| `index.html` `computeProductScoreInline()` | Fallback if module import fails |',
  '',
  'Production UI uses `computeProductScoreReport()` → `computeProductScore()` when module loads.',
  '',
  '## QA command',
  '',
  '```bash',
  'npm run qa:ats-scoring-audit',
  'npm run qa:ats-pipeline',
  '```',
  '',
  '## Console output',
  '',
  '```',
  stdout || '(no stdout)',
  '```',
];

if (!pass && stderr) {
  lines.push('', '## Errors', '', '```', stderr, '```');
}

fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
console.log(`Wrote ${reportPath}`);
process.exit(pass ? 0 : 1);
