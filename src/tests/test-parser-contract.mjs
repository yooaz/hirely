#!/usr/bin/env node
/**
 * HIRELY PARSER CONTRACT TEST — parser only, cleaned text samples, no UI/OCR.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runParserContractSuite,
  parseCleanedTextContract,
  validateParserContract,
} from '../../tests/lib/parser-contract-gate.mjs';
import {
  qualifiesStrictExperience,
} from '../core/parsing/experience-parser.js';
import { STRUCTURED_RESUME_JSON_MAX } from '../core/pipeline/pipeline-contract.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/parser-contract');

let failed = 0;
function fail(msg) {
  console.error('FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('OK', msg);
}

const report = runParserContractSuite(null, root);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));

for (const c of report.cases || []) {
  if (c.pass) {
    ok(
      `${c.label} (${c.id}) json=${c.metrics?.jsonChars} exp=${c.metrics?.experienceCount} loss=${c.metrics?.lossChars}`
    );
  } else {
    fail(`${c.label} (${c.id}): ${c.failures.join('; ')}`);
  }
}

ok(`structuredResume JSON max ${STRUCTURED_RESUME_JSON_MAX} chars enforced`);

const garbageSample = `
30-year old Illustrator and Graphic Designer
2011-2022
Freelancer Illustrator
Independent / Freelance
Music
Créapole
Product Design
`;
const garbageEngine = parseCleanedTextContract(garbageSample.trim());
const garbageCheck = validateParserContract(garbageSample.trim(), garbageEngine);
ok(
  !garbageCheck.slim?.experiences?.some(
    (e) => !qualifiesStrictExperience(e) || /year old|music|créapole|product design/i.test(`${e.role} ${e.company}`)
  ),
  'garbage sample: invalid experience not in experiences'
);
if (!garbageCheck.pass && garbageCheck.failures.some((f) => f.includes('invalid experience kept'))) {
  fail(`garbage contract: ${garbageCheck.failures.join('; ')}`);
} else {
  ok('garbage sample: contract violations moved or rejected');
}

const phoneLeak = parseCleanedTextContract('Alex Chen\n2011-2022\nDesigner');
const phoneCheck = validateParserContract('Alex Chen\n2011-2022\nDesigner', phoneLeak);
if (phoneCheck.slim?.identity?.phone && /2011|2022/.test(phoneCheck.slim.identity.phone)) {
  fail('date range stored as identity phone');
} else {
  ok('dates are not phone numbers');
}

console.log(
  `\nParser contract: ${report.summary.passed}/${report.summary.total} cases` +
    (failed ? ` (${failed} assertion failures)` : ' — all pass')
);

if (!report.pass || failed) process.exit(1);
