#!/usr/bin/env node
/**
 * Unit tests — clean.js (headers/footers, special chars, casing).
 */
import {
  strictClean,
  stripHeaderFooterLines,
  stripSpecialCharacters,
  normalizeSectionHeaderCasing,
} from '../core/parsing/clean.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const noisy = 'Page 1 of 3\nCONFIDENTIAL\nMarie Dupont\n●● Experience\nFreelance — 2020|2024';
ok(!stripSpecialCharacters(noisy).includes('●'), 'stripSpecialCharacters removes bullets');
ok(normalizeSectionHeaderCasing('EXPERIENCE') === 'Experience', 'section header casing');

const repeated = [
  'Marie Dupont',
  'Curriculum Vitae',
  'Product Manager',
  'Curriculum Vitae',
  'Experience',
  'Acme — 2019',
  'Curriculum Vitae',
  'Page 2 of 3',
];
const stripped = stripHeaderFooterLines(repeated);
ok(!stripped.some((l) => /page 2 of 3/i.test(l)), 'removes page numbers');
ok(stripped.filter((l) => /curriculum vitae/i.test(l)).length <= 1, 'drops repeated boilerplate');

const cleaned = strictClean(
  `SKILLS\nAgile, SQL\n\nEDUCATION\nHEC Paris\n\nEXPERIENCE\nSenior PM — Acme — 2019 – Present\n\nPage 1 of 2\nPage 1 of 2`
);
ok(/Experience/i.test(cleaned), 'strictClean keeps sections');
ok(!/page 1 of 2/i.test(cleaned), 'strictClean removes footers');

process.exit(failed ? 1 : 0);
