#!/usr/bin/env node
/**
 * P0 — Generate IDENTITY_CONTACT_STRICTNESS_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'IDENTITY_CONTACT_STRICTNESS_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/identity-contact-strictness/report.json');

function runQa(script) {
  const res = spawnSync('node', [script], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
    timeout: 180000,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim().slice(-4000) };
}

const qa =
  process.env.HIRELY_SKIP_QA === '1' ? { pass: null, out: '' } : runQa('src/tests/qa-identity-contact-strictness.mjs');
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const pass = report?.pass === true && (qa.pass === true || qa.pass === null);

const lines = [
  '# IDENTITY_CONTACT_STRICTNESS_REPORT',
  '',
  `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
  `**Policy:** \`${report?.version || 'IDENTITY_CONTACT_STRICTNESS_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  `**Checks:** ${report ? `${report.summary.pass}/${report.summary.total}` : 'not run'}`,
  '',
  '## Problem',
  '',
  'OCR and heuristic parsers sometimes promote employer/client lines to `identity.name`, or fabricate/merge phone numbers with years, page footers, or extra digits. Wrong contact data is worse than empty fields.',
  '',
  '## Rules enforced',
  '',
  '| Rule | Behavior |',
  '|------|----------|',
  '| Never use company name as person name | `looksLikeCompanyOrAgencyName`, employer collision, client dictionary |',
  '| Never invent phone digits | Strict regex + digit equality check in `normalizeContactPhone` |',
  '| Never merge phone with years/page numbers | `phoneHasYearOrDatePollution` (+ Page N of M, N/M footer) |',
  '| Low confidence → reviewQueue | `buildNameReviewItem` / `buildPhoneReviewItem` → semantic gate |',
  '| Missing name better than wrong name | Strip → `Information non détectée` |',
  '| Missing phone better than fake phone | Strip → empty + review item |',
  '',
  '## Thresholds',
  '',
  `| Field | Min confidence |`,
  `|-------|---------------:|`,
  `| Name | ${report?.rules?.nameConfidenceMin ?? 80} |`,
  `| Phone | ${report?.rules?.phoneConfidenceMin ?? 85} |`,
  '',
  '## Code modules',
  '',
  '| Module | Role |',
  '|--------|------|',
  '| `identity-contact-strictness.js` | Central policy: assess + enforce + review items |',
  '| `identity-extraction.js` | Header-only name candidates, company patterns |',
  '| `phone-normalize.js` | Strict extraction, year/page pollution, no digit invention |',
  '| `sanitize-resume-display.js` | Final display gate via `enforceIdentityContactStrictness` |',
  '| `resume-data.js` | Early `sanitizeIdentity` strict pass |',
  '| `no-fake-data-policy.js` | Audit: `isAcceptableDisplayName/Phone` |',
  '',
  '## Pipeline flow',
  '',
  '```mermaid',
  'flowchart TD',
  '  A[Raw identity fields] --> B[sanitizeIdentity strict]',
  '  B --> C[sanitizeResumeForDisplay]',
  '  C --> D[enforceIdentityContactStrictness]',
  '  D --> E{accept?}',
  '  E -->|name/phone ok| F[finalResumeData.identity]',
  '  E -->|rejected| G[reviewQueue identity.name/phone]',
  '  E -->|rejected| H[UNDETECTED label / empty phone]',
  '```',
  '',
  '## QA summary',
  '',
  `| Metric | Value |`,
  `|--------|------:|`,
  `| Total checks | ${report?.summary?.total ?? '—'} |`,
  `| Passed | ${report?.summary?.pass ?? '—'} |`,
  `| Failed | ${report?.summary?.fail ?? '—'} |`,
  '',
  '## Regression samples',
  '',
  `| Case | Name | Phone |`,
  `|------|------|-------|`,
  `| Lontac Impressions CV | ${report?.samples?.lontac?.name ?? '—'} | — |`,
  `| Invented digits (+336434343830) | — | ${report?.samples?.badPhone?.phone ?? '(empty)'} |`,
  `| Page footer merge | — | ${report?.samples?.pagePhone?.phone ?? '(empty)'} |`,
  `| Valid Sophie Martin | ${report?.samples?.good?.name ?? '—'} | ${report?.samples?.good?.phone ?? '—'} |`,
  '',
];

if (report?.checks?.length) {
  lines.push('## Checklist', '', '| Check | Status | Detail |', '|-------|--------|--------|');
  for (const c of report.checks) {
    lines.push(`| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`);
  }
  lines.push('');
}

lines.push(
  '## Verification',
  '',
  '```bash',
  'npm run qa:identity-contact-strictness',
  'npm run identity-contact-strictness-report',
  'npm run qa:no-fake-data-policy',
  'npm run qa:identity-false-name',
  '```',
  '',
  '## Related',
  '',
  '- `IDENTITY_FALSE_NAME_FIX_REPORT.md`',
  '- `NO_FAKE_PASS_IMPORT_GATE_REPORT.md`',
  '- `IDENTITY_SOURCE_PRIORITY_REPORT.md`',
  ''
);

if (qa.out) {
  lines.push('## QA log (tail)', '', '```', qa.out.slice(-2500), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(pass ? 0 : 1);
