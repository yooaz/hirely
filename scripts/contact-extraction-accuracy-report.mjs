#!/usr/bin/env node
/**
 * CONTACT_EXTRACTION_ACCURACY_REPORT.md — phone normalization regression summary.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  normalizeContactPhone,
  validatePhoneStrict,
  phoneHasYearOrDatePollution,
} from '../src/core/parsing/phone-normalize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORT = path.join(ROOT, 'CONTACT_EXTRACTION_ACCURACY_REPORT.md');

const fixtures = [
  { input: '+33649434839 20', expected: '+33649434839', note: 'trailing partial year' },
  { input: '+33 6 49 43 48 39 2011', expected: '+33649434839', note: 'trailing full year' },
  { input: '+33649434839 2011-2020', expected: '+33649434839', note: 'year range merged' },
  { input: '06 49 43 48 39', expected: '+33649434839', note: 'French local format' },
  { input: 'john@test.fr +33649434839 20', expected: '+33649434839', note: 'email on same line' },
  { input: '2011-2020', expected: '', note: 'date only — reject' },
];

const rows = fixtures.map((f) => {
  const norm = normalizeContactPhone(f.input);
  const pass = norm.phone === f.expected;
  return { ...f, actual: norm.phone, uncertain: norm.uncertain, pass };
});

const qa = spawnSync('node', ['src/tests/qa-contact-phone-accuracy.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
});

const qaPass = qa.status === 0;
const allPass = qaPass && rows.every((r) => r.pass);

const lines = [
  '# Contact Extraction Accuracy Report',
  '',
  `**Result:** ${allPass ? 'PASS' : 'FAIL'}`,
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '## Rules enforced',
  '',
  '- Phone normalized only from valid phone patterns',
  '- Trailing years (20, 2011, 2020) stripped — never merged with dates',
  '- Email kept separate from phone',
  '- Uncertain / normalized contacts routed to reviewQueue',
  '',
  '## Fixture matrix',
  '',
  '| Input | Expected | Actual | Uncertain | Note |',
  '|-------|----------|--------|-----------|------|',
  ...rows.map(
    (r) =>
      `| \`${r.input}\` | \`${r.expected}\` | \`${r.actual}\` | ${r.uncertain ? 'yes' : 'no'} | ${r.note} |`
  ),
  '',
  '## QA harness',
  '',
  '```',
  (qa.stdout || '').trim() || '(no output)',
  qa.stderr ? `\n${qa.stderr.trim()}` : '',
  '```',
  '',
  '## Acceptance',
  '',
  `- Example polluted phone \`+33649434839 20\` → \`${normalizeContactPhone('+33649434839 20').phone}\``,
  `- validatePhoneStrict polluted: ${validatePhoneStrict('+33649434839 20') ? 'FAIL' : 'reject OK'}`,
  `- phoneHasYearOrDatePollution: ${phoneHasYearOrDatePollution('+33649434839 20')}`,
  '',
];

fs.writeFileSync(REPORT, lines.join('\n'));
console.log(allPass ? 'PASS' : 'FAIL');
console.log(`Report: ${REPORT}`);
process.exit(allPass ? 0 : 1);
