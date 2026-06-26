#!/usr/bin/env node
/**
 * Section-first parser — coverage > 80%, experience > 0, unsorted < 15.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseResumeSectionFirst } from '../core/parsing/section-first-parser.js';
import { buildStructuredResumeFromBlocks } from '../core/parsing/structured-resume-from-blocks.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const fixturePath = join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
const sample = existsSync(fixturePath)
  ? readFileSync(fixturePath, 'utf8')
  : `Yohann Azancot
Graphic Designer
WORK EXPERIENCE
Freelancer Illustrator, Graphic Designer
2011-2022
McCann G. Agency
2011 Internship
EDUCATION
LISAA
SKILLS
Illustration, Graphic design`;

const { report } = parseResumeSectionFirst(sample, { rawText: sample });
console.log('\nExact coverage:', report.coveragePercent, '%');

ok(report.coveragePercent > 80, `coverage > 80% (${report.coveragePercent}%)`);
ok(report.experienceCount > 0, `experienceCount > 0 (${report.experienceCount})`);
ok(report.unsortedCount < 15, `unsortedCount < 15 (${report.unsortedCount})`);
ok(report.structuredChars >= report.cleanChars * 0.8, 'no text loss vs clean');

const fromBlocks = buildStructuredResumeFromBlocks([], {
  rawText: sample,
  cleanedText: sample,
  extractionMethod: 'paste',
});
const blockCov = fromBlocks.metadata?.parserCoverage?.coveragePercent ?? 0;
ok(blockCov > 80, `blocks wrapper coverage > 80% (${blockCov}%)`);
ok((fromBlocks.experiences || []).length > 0, 'blocks wrapper has experience');

console.log('\nSection-first parser QA OK — coverage', report.coveragePercent, '%');
