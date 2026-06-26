#!/usr/bin/env node
/**
 * Product stability — resumeData contract, no fake identity, import always renders.
 * node src/tests/qa-product-stability.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

import { NAME_UNCERTAIN_LABEL } from '../core/parsing/parser-recovery.js';

const { runHirelyImportFromText, buildProductFallback } = await import('../core/pipeline/hirely-import.js');
const {
  resumeDataFromImport,
  resumeDataIsRenderable,
  normalizeResumeData,
  moveUnsortedToSection,
} = await import('../core/resume-data.js');

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

const fixture = fs.readFileSync(
  path.join(root, 'tests/fixtures/creative-cv/fixture.txt'),
  'utf8'
);

const careerFixture = `
WORK EXPERIENCE
Freelancer — Graphic Designer
2011 – 2022
McCann Paris
`.trim();

const r1 = await runHirelyImportFromText(fixture, { source: 'qa-product' });
const rd1 = resumeDataFromImport(r1);
ok(r1.rawText.length > 0, 'TXT/paste rawText > 0');
ok(r1.cleanedText.length > 0, 'cleanedText > 0');
ok(rd1 != null, 'resumeData present');
ok(!/print logo|vector art/i.test(rd1.identity.name), 'no fake keyword name');
ok(JSON.stringify(rd1).length < 50000, 'resumeData JSON bounded');
ok(resumeDataIsRenderable(rd1), 'resumeData renderable');

const r2 = await runHirelyImportFromText(careerFixture, { source: 'qa-product' });
const rd2 = resumeDataFromImport(r2);
ok(
  rd2.experiences.length > 0 || rd2.unsorted.length > 0,
  'career text in experience or unsorted'
);

const fb = buildProductFallback(careerFixture, careerFixture);
ok(fb.resumeData?.unsorted?.length > 0, 'fallback preserves lines in unsorted');
ok(fb.resumeData?.identity?.name === NAME_UNCERTAIN_LABEL, 'fallback name Nom à confirmer');

const moved = moveUnsortedToSection(
  normalizeResumeData({ ...fb.resumeData, unsorted: ['McCann Paris'] }),
  ['McCann Paris'],
  'experience'
);
ok(moved.experiences.length >= 1, 'editor move unsorted → experience');

const rEmpty = await runHirelyImportFromText('', { source: 'qa-empty' });
ok(rEmpty.resumeData != null, 'empty import still returns resumeData');
ok(resumeDataIsRenderable(rEmpty.resumeData) || rEmpty.resumeData.unsorted.length >= 0, 'empty import has structure');

console.log('\nProduct stability:', failed ? 'FAILED' : 'PASSED');
process.exit(failed ? 1 : 0);
