#!/usr/bin/env node
/**
 * P0 — Generate NO_FAKE_DATA_POLICY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'NO_FAKE_DATA_POLICY_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/no-fake-data-policy/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-no-fake-data-policy.mjs'], {
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
  '# NO_FAKE_DATA_POLICY_REPORT',
  '',
  `**Status:** ${reportPass ? 'PASS' : 'FAIL'}`,
  `**Policy:** \`${report?.version || 'NO_FAKE_DATA_POLICY_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  `**QA:** ${report ? `${report.checks.length - report.failed}/${report.checks.length} checks` : 'not run'}`,
  '',
  '## Principle',
  '',
  '**If Hirely is unsure, it must not invent.**',
  '',
  '- A CV with a **missing name** is acceptable.',
  '- A CV with a **wrong name** is not acceptable.',
  '- Low-confidence data goes to **reviewQueue**, not the preview.',
  '',
  '## Forbidden on CV preview / export',
  '',
  '| Category | Rule |',
  '|----------|------|',
  '| Fake name | Company/agency/OCR garbage never promoted to `identity.name` |',
  '| Fake phone | Corrupted or low-confidence phones hidden (confidence &lt; 85) |',
  '| Fake company | Client brands cannot become employer rows without role/dates |',
  '| Fake dates | Future/impossible years stripped from experience rows |',
  '| Fake experience | Invented bullets (`Delivered creative work…`, `Contributed as…`) blocked |',
  '',
  '## Missing data UX',
  '',
  `When a field is unknown, display shows **${report?.rules?.undetectedLabel || 'Information non détectée'}** — never fabricated placeholders.`,
  '',
  '## Enforcement layers',
  '',
  '| Layer | Module |',
  '|-------|--------|',
  '| Policy audit | `src/core/validation/no-fake-data-policy.js` |',
  '| Identity source priority | `src/core/parsing/identity-extraction.js` |',
  '| Phone strict mode | `src/core/parsing/phone-normalize.js` |',
  '| Invented experience guard | `src/core/parsing/invented-experience-guard.js` |',
  '| Display sanitize | `src/core/validation/sanitize-resume-display.js` |',
  '| Confidence gate | `src/core/validation/confidence-gate.js` |',
  '| Zero invented content (H18) | `src/core/display/undetected-label.js` |',
  '',
  '## Sample pipeline outcomes',
  '',
  report?.samples
    ? [
        `- **Company-as-name CV:** name = \`${report.samples.lontac?.name || '(empty / undetected)'}\` — audit ${report.samples.lontac?.auditPass ? 'PASS' : 'FAIL'}`,
        `- **Corrupted phone CV:** phone = \`${report.samples.badPhone?.phone || '(empty)'}\` — routed to review: ${report.samples.badPhone?.phoneReview ? 'yes' : 'no'}`,
        `- **No-name CV:** name = \`${report.samples.noName?.name || '(empty / undetected)'}\` — acceptable`,
      ].join('\n')
    : '- *(run `npm run no-fake-data-policy-report`)*',
  '',
  '## Verification',
  '',
  '```bash',
  'npm run qa:no-fake-data-policy',
  'npm run qa:identity-false-name',
  'npm run qa:phone-strict-extraction',
  'npm run qa:h18-zero-invented-content',
  'npm run no-fake-data-policy-report',
  '```',
  '',
];

if (qa.out) {
  lines.push('## QA output', '', '```', qa.out.slice(-5000), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(reportPass ? 0 : 1);
