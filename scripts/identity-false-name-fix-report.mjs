#!/usr/bin/env node
/**
 * P0 — Generate IDENTITY_FALSE_NAME_FIX_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'IDENTITY_FALSE_NAME_FIX_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/identity-false-name/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-identity-false-name.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = process.env.HIRELY_SKIP_QA === '1' ? { pass: null, out: '' } : runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const reportPass = report?.pass === true && (qa.pass === true || qa.pass === null);

const lines = [
  '# IDENTITY_FALSE_NAME_FIX_REPORT',
  '',
  `**Status:** ${reportPass ? 'PASS' : 'FAIL'}`,
  `**Engine:** \`${report?.version || 'IDENTITY_FALSE_NAME_FIX_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Problem',
  '',
  'Company/agency lines (e.g. **Lontac Impressions**) were promoted to `identity.name` via experience recovery and full-document name heuristics.',
  '',
  '## Rules enforced',
  '',
  '- Person names only from identity/header region (before Experience/Education sections)',
  '- Reject company/agency patterns: impressions, agency, studio, company, freelance, client, portfolio',
  '- Reject names that collide with parsed employer companies',
  '- Reject client-dictionary matches as person names',
  '- Name confidence below 80 → empty display name + review label (never substitute company text)',
  '- Experience URL-merge recovery no longer writes `recoveredName` into identity',
  '',
  '## Code changes',
  '',
  '| Module | Change |',
  '|--------|--------|',
  '| `identity-extraction.js` | `COMPANY_LIKE_NAME_RE`, `looksLikeCompanyOrAgencyName`, header-only OCR repair, confidence min 80 |',
  '| `sanitize-resume-display.js` | Header-only name recovery; no experience→name promotion |',
  '| `confidence-gate.js` | Company/employer collision scores 0 |',
  '',
  '## QA summary',
  '',
  `| Checks | Pass | Fail |`,
  `|--------|------|------|`,
  `| Total | ${report?.summary?.total ?? '—'} | ${report?.summary?.fail ?? '—'} |`,
  '',
  '## Lontac Impressions regression case',
  '',
];

if (report?.lontacCase) {
  lines.push(
    `- Display name: \`${report.lontacCase.displayName || '(empty)'}\``,
    `- Import status: \`${report.lontacCase.importStatus || '—'}\``,
    `- Experience count: ${report.lontacCase.experienceCount ?? 0}`,
    `- Education count: ${report.lontacCase.educationCount ?? 0}`
  );
} else {
  lines.push('_No regression case output_');
}

lines.push('', '## Checklist', '');

if (report?.checks?.length) {
  for (const c of report.checks) {
    lines.push(`- ${c.pass ? '✓' : '✗'} \`${c.id}\`${c.detail ? ` — ${c.detail}` : ''}`);
  }
} else {
  lines.push('_No checks recorded_');
}

lines.push('', '## Run', '', '```bash', 'npm run qa:identity-false-name', 'npm run identity-false-name-fix-report', '```', '');

if (qa.out) {
  lines.push('', '## QA log (tail)', '', '```', qa.out.split('\n').slice(-20).join('\n'), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(reportPass ? 0 : 1);
