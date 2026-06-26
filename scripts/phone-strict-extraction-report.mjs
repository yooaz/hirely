#!/usr/bin/env node
/**
 * P0 — Generate PHONE_STRICT_EXTRACTION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PHONE_STRICT_EXTRACTION_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/phone-strict-extraction/report.json');

function runQa(script) {
  const res = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const strictQa = process.env.HIRELY_SKIP_QA === '1' ? { pass: null, out: '' } : runQa('src/tests/qa-phone-strict-extraction.mjs');
const contactQa = process.env.HIRELY_SKIP_QA === '1' ? { pass: null, out: '' } : runQa('src/tests/qa-contact-phone-accuracy.mjs');
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const reportPass =
  report?.pass === true &&
  (strictQa.pass === true || strictQa.pass === null) &&
  (contactQa.pass === true || contactQa.pass === null);

const lines = [
  '# PHONE_STRICT_EXTRACTION_REPORT',
  '',
  `**Status:** ${reportPass ? 'PASS' : 'FAIL'}`,
  `**Engine:** \`${report?.version || 'PHONE_STRICT_EXTRACTION_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Problem',
  '',
  'OCR/contact recovery promoted corrupted numbers (e.g. **+336434343830**) by truncating trailing digits instead of rejecting the match.',
  '',
  '## Rules enforced',
  '',
  '- Extract only from strict phone patterns with no trailing digit pollution',
  '- Never rewrite or truncate digits to force a valid length',
  '- Reject year ranges, page numbers, and OCR fragments glued to numbers',
  '- French numbers must be exactly 11 digits international (`33` + 9 national)',
  '- Display confidence below **85** → `reviewQueue` only (phone cleared from CV)',
  '- Corrupted phones never appear in final CV render',
  '',
  '## Code changes',
  '',
  '| Module | Change |',
  '|--------|--------|',
  '| `phone-normalize.js` | Strict patterns with `(?!\\d)`, digit-length validation, `scorePhoneExtraction`, confidence min 85 |',
  '| `sanitize-resume-display.js` | Display phone only when confidence ≥ 85 |',
  '| `confidence-gate.js` | Phone scoring via strict extraction score |',
  '| `semantic-confidence-gate.js` | Strip phone when contact review item exists |',
  '',
  '## QA summary',
  '',
  `| Suite | Result |`,
  `|-------|--------|`,
  `| qa-phone-strict-extraction | ${strictQa.pass === true ? 'PASS' : strictQa.pass === false ? 'FAIL' : 'skipped'} |`,
  `| qa-contact-phone-accuracy | ${contactQa.pass === true ? 'PASS' : contactQa.pass === false ? 'FAIL' : 'skipped'} |`,
  '',
  `| Checks | Pass | Fail |`,
  `|--------|------|------|`,
  `| Total | ${report?.summary?.total ?? '—'} | ${report?.summary?.fail ?? '—'} |`,
  '',
  '## Corrupt number regression',
  '',
];

if (report?.corruptCase) {
  lines.push(
    `- Input: \`${report.corruptCase.corruptInput}\``,
    `- Display phone: \`${report.corruptCase.displayPhone || '(empty)'}\``,
    `- Review items: ${report.corruptCase.reviewCount ?? 0}`
  );
} else {
  lines.push('_No regression case output_');
}

lines.push('', '## Checklist', '');

if (report?.checks?.length) {
  for (const c of report.checks) {
    lines.push(`- ${c.pass ? '✓' : '✗'} \`${c.id}\`${c.detail ? ` — ${c.detail}` : ''}`);
  }
}

lines.push('', '## Run', '', '```bash', 'npm run qa:phone-strict-extraction', 'npm run qa:contact-phone-accuracy', 'npm run phone-strict-extraction-report', '```', '');

if (strictQa.out) {
  lines.push('', '## QA log (tail)', '', '```', strictQa.out.split('\n').slice(-18).join('\n'), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(reportPass ? 0 : 1);
