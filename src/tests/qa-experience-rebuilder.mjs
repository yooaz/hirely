#!/usr/bin/env node
/**
 * EXPERIENCE_REBUILDER — must not invent experiences when parser fails.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  detectCareerYears,
  detectExperienceParserFailed,
  runExperienceRebuilder,
} from '../core/parsing/experience-rebuilder.js';
import { parseStrictExperiencesFromLines } from '../core/parsing/experience-parser.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const yearLadderText = `Yohann Azancot
Illustrator
WORK EXPERIENCE
2011
2012
2013
2014
2015
2016
2017
2018
2019
2020
2021
2022
2023
2024
2025
2026
Lead Illustrator — McCann — 2011–2014
Freelance Designer — Independent — 2015–Present
EDUCATION
Art School
SKILLS
Illustration`;

const years = detectCareerYears(yearLadderText);
ok(years.yearCount >= 10, `career years detected (${years.yearCount})`);

const failed = detectExperienceParserFailed(0, yearLadderText);
ok(failed.parserFailed, 'parser failed when 0 exp + years');

const strict = parseStrictExperiencesFromLines(yearLadderText.split('\n'));
ok(strict.experiences.length <= 3, `strict parser caps ladder noise (${strict.experiences.length})`);

const stripped = { experiences: [], identity: { title: 'Illustrator' }, metadata: {}, unsorted: [] };
const rebuilt = runExperienceRebuilder(stripped, yearLadderText);
ok(!rebuilt.rebuilt, 'rebuilder does not invent experiences');
ok(rebuilt.experienceCount === 0, 'zero invented experiences on year ladder');

const fixturePath = join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
const yoaz = existsSync(fixturePath) ? readFileSync(fixturePath, 'utf8') : yearLadderText;
const yoazStrict = parseStrictExperiencesFromLines(yoaz.split('\n'));
ok(yoazStrict.experiences.length >= 1, `yoaz strict has real jobs (${yoazStrict.experiences.length})`);

console.log('\nEXPERIENCE_REBUILDER QA OK');
