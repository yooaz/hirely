#!/usr/bin/env node
/**
 * Generates REAL_WORLD_STRESS_TEST_REPORT.md from qa-real-world-stress-test.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'REAL_WORLD_STRESS_TEST_REPORT.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/real-world-stress/report.json');

function runSuite() {
  try {
    execSync('node src/tests/qa-real-world-stress-test.mjs', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
    return { ok: true };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const suiteRun = runSuite();
const report = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));
const s = report.summary;

const resultRows = (report.results || [])
  .map(
    (r) =>
      `| ${r.id} | ${r.role} | ${r.format} | ${r.extractionAccuracy}% | ${r.identityAccuracy}% | ${r.emailAccuracy}% | ${r.phoneAccuracy}% | ${r.experienceAccuracy}% | ${r.educationAccuracy}% | ${r.skillsAccuracy}% | ${r.pass ? 'PASS' : 'FAIL'} |`
  )
  .join('\n');

const roleRows = Object.entries(s.byRole || {})
  .map(([role, v]) => `| ${role} | ${v.count} | ${v.passRate}% | ${v.avgAccuracy}% |`)
  .join('\n');

const formatRows = Object.entries(s.byFormat || {})
  .map(([fmt, v]) => `| ${fmt} | ${v.count} | ${v.passRate}% | ${v.avgAccuracy}% |`)
  .join('\n');

const rootRows = (s.rootCauses || [])
  .map((r) => `| ${r.cause} | ${r.count} |`)
  .join('\n') || '| — | 0 |';

const md = `# Real World Stress Test Report (P0)

**Generated:** ${report.generatedAt}
**Engine:** ${report.engine}
**Goal:** **${report.goalPct}%+** extraction accuracy before further UI work

## Executive summary

| Metric | Value | Goal | Status |
| --- | --- | --- | --- |
| **Overall extraction accuracy** | **${s.extractionAccuracy}%** | ≥ ${report.goalPct}% | ${s.extractionAccuracy >= report.goalPct ? 'PASS' : 'FAIL'} |
| **Success rate** (per-CV pass) | **${s.successRate}%** (${s.passCount}/${report.count}) | — | ${suiteRun.ok ? 'PASS' : 'FAIL'} |
| **Failure rate** | **${s.failureRate}%** (${s.failCount}/${report.count}) | — | — |
| Identity accuracy | ${s.identityAccuracy}% | ≥ ${report.goalPct}% | ${s.identityAccuracy >= report.goalPct ? 'PASS' : 'FAIL'} |
| Email accuracy | ${s.emailAccuracy}% | ≥ ${report.goalPct}% | ${s.emailAccuracy >= report.goalPct ? 'PASS' : 'FAIL'} |
| Phone accuracy | ${s.phoneAccuracy}% | ≥ ${report.goalPct}% | ${s.phoneAccuracy >= report.goalPct ? 'PASS' : 'FAIL'} |
| Experience accuracy | ${s.experienceAccuracy}% | ≥ ${report.goalPct}% | ${s.experienceAccuracy >= report.goalPct ? 'PASS' : 'FAIL'} |
| Education accuracy | ${s.educationAccuracy}% | ≥ ${report.goalPct}% | ${s.educationAccuracy >= report.goalPct ? 'PASS' : 'FAIL'} |
| Skills accuracy | ${s.skillsAccuracy}% | ≥ ${report.goalPct}% | ${s.skillsAccuracy >= report.goalPct ? 'PASS' : 'FAIL'} |

## Catalog

**50 real CVs** across 10 roles × 5 format variants:

| Role | Formats per role |
| --- | --- |
| Designer | TXT, PDF-text, PDF-scan, DOCX, PNG |
| Engineer | TXT, PDF-text, PDF-scan, DOCX, JPG |
| Marketing | TXT, PDF-text, PDF-scan, DOCX, PNG |
| Sales | TXT, PDF-text, PDF-scan, DOCX, JPG |
| Student | TXT, PDF-text, PDF-scan, DOCX, PNG |
| Executive | TXT, PDF-text, PDF-scan, DOCX, JPG |
| Consultant | TXT, PDF-text, PDF-scan, DOCX, PNG |
| Creative Director | TXT, PDF-text, PDF-scan, DOCX, PNG |
| Freelancer | TXT, PDF-text, PDF-scan, DOCX, JPG |
| Artist | TXT, PDF-text, PDF-scan, DOCX, PNG |

Formats: **PDF text**, **PDF scan** (OCR sim), **DOCX**, **TXT**, **PNG/JPG** (image OCR sim).

Catalog: \`tests/lib/real-world-stress-catalog.mjs\`

## Results by role

| Role | Cases | Pass rate | Avg accuracy |
| --- | --- | --- | --- |
${roleRows}

## Results by format

| Format | Cases | Pass rate | Avg accuracy |
| --- | --- | --- | --- |
${formatRows}

## Root causes (failing cases)

| Root cause | Count |
| --- | --- |
${rootRows}

## Per-CV results

| ID | Role | Format | Overall | Identity | Email | Phone | Exp | Edu | Skills | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${resultRows}

## QA output

\`\`\`
${(suiteRun.out || '').split('\n').slice(-30).join('\n')}
\`\`\`

## Re-run

\`\`\`bash
npm run qa:real-world-stress
npm run real-world-stress-report
\`\`\`

Artifacts: \`tests/output/real-world-stress/report.json\`
`;

fs.writeFileSync(OUT_MD, md, 'utf8');
console.log(`Wrote ${OUT_MD}`);
