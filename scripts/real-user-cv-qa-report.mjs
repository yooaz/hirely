#!/usr/bin/env node
/**
 * P0 — Generate REAL_USER_CV_QA_REPORT.md from browser QA.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'REAL_USER_CV_QA_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/real-user-cv/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-real-user-cv.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function mdEsc(s) {
  return String(s || '—').replace(/\|/g, '\\|');
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const cvs = report?.cvs || [];

const lines = [
  '# REAL_USER_CV_QA_REPORT',
  '',
  `**Status:** ${qa.pass && report?.pass ? 'PASS' : 'FAIL'}`,
  `**Generated:** ${new Date().toISOString()}`,
  `**Source:** Browser import (real uploaded PDFs, not text fixtures)`,
  '',
  '## Acceptance',
  '',
  '| Rule | Requirement |',
  '|------|-------------|',
  '| Parser labels | No section/parser labels exposed as CV content |',
  '| Placeholders | No uncertain / placeholder copy in final CV |',
  '| Fake experience | No invented or client-only experience rows |',
  '| Duplicates | No duplicate lines in data or preview |',
  '| Preview | Live CV preview with meaningful content |',
  '',
];

for (const cv of cvs) {
  const m = cv.metrics || {};
  const a = cv.acceptance || {};
  lines.push(`## ${cv.label} (\`${cv.id}\`)`, '');
  lines.push(`**File:** \`${cv.file}\``);
  lines.push(`**Import:** ${cv.importStatus} (${cv.importPath})`);
  lines.push(`**Result:** ${cv.pass ? 'PASS' : 'FAIL'}`, '');

  lines.push('### Extracted metrics', '');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| Raw text length | ${m.rawTextLength ?? '—'} |`);
  lines.push(`| Final name | ${mdEsc(m.finalName)} |`);
  lines.push(`| Final title | ${mdEsc(m.finalTitle)} |`);
  lines.push(`| Email | ${mdEsc(m.email)} |`);
  lines.push(`| Phone | ${mdEsc(m.phone)} |`);
  lines.push(`| Experiences | ${m.experiencesCount ?? 0} |`);
  lines.push(`| Education | ${m.educationCount ?? 0} |`);
  lines.push(`| Clients | ${m.clientsCount ?? 0} |`);
  lines.push(`| Projects | ${m.projectsCount ?? 0} |`);
  lines.push(`| Skills | ${m.skillsCount ?? 0} |`);
  lines.push(`| Tools | ${m.toolsCount ?? 0} |`);
  lines.push(`| Languages | ${m.languagesCount ?? 0} |`);
  lines.push(`| Review queue | ${m.reviewQueueCount ?? 0} |`);
  lines.push(`| Preview text length | ${m.previewTextLength ?? 0} |`);
  lines.push('');

  lines.push('### Leakage audit', '');
  lines.push('| Check | Count | Pass |');
  lines.push('|-------|-------|------|');
  lines.push(`| Placeholder leakage | ${cv.leakage?.placeholder?.count ?? 0} | ${a.noPlaceholders ? '✓' : '✗'} |`);
  lines.push(`| Label leakage | ${cv.leakage?.label?.count ?? 0} | ${a.noParserLabels ? '✓' : '✗'} |`);
  lines.push(`| Duplicate leakage | ${cv.leakage?.duplicate?.count ?? 0} | ${a.noDuplicateLines ? '✓' : '✗'} |`);
  lines.push(`| Fake experience | ${cv.leakage?.fakeExperience?.length ?? 0} | ${a.noFakeExperience ? '✓' : '✗'} |`);
  lines.push(`| Meaningful preview | — | ${a.meaningfulPreview ? '✓' : '✗'} |`);
  lines.push('');

  const samples = [];
  for (const h of cv.leakage?.placeholder?.preview?.slice(0, 3) || []) samples.push(`placeholder preview: ${h}`);
  for (const h of cv.leakage?.label?.preview?.slice(0, 3) || []) samples.push(`label preview: ${h}`);
  for (const h of cv.leakage?.label?.data?.slice(0, 3) || []) samples.push(`label data: ${h.field || ''} ${h.value || h.text || ''}`);
  for (const h of cv.leakage?.duplicate?.preview?.slice(0, 2) || []) samples.push(`dup preview: ${h.a} / ${h.b}`);
  for (const h of cv.leakage?.fakeExperience?.slice(0, 2) || []) samples.push(`fake exp: ${h.text} (${h.reason})`);

  if (samples.length) {
    lines.push('### Sample issues', '');
    for (const s of samples) lines.push(`- ${s}`);
    lines.push('');
  }
}

lines.push('## Verify', '', '```bash', 'node src/tests/qa-real-user-cv.mjs', 'node scripts/real-user-cv-qa-report.mjs', '```', '');

if (!qa.pass) {
  lines.push('## QA output', '', '```', qa.out.slice(0, 12000), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(qa.pass && report?.pass ? 0 : 1);
