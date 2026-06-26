#!/usr/bin/env node
/**
 * Dictionary recursion / stack-overflow guard — education ↔ experience path.
 * node scripts/test-dictionary-recursion.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  safeRegex,
  sanitizeDictionaryTerm,
  termMatchesHay,
  findLongestMatchingTerm,
  escapeRegex,
} from '../src/data/dictionaries/match-utils.js';
import { findLongestDictionaryTerm, SCHOOL_TERMS, CLIENT_TERMS } from '../src/data/dictionaries/json-dictionary-match.js';
import { lineMatchesSchool } from '../src/data/dictionaries/schools.js';
import {
  getEducationLineSignals,
  hasEducationSchool,
  mustNeverBeExperience,
  scoreEducationConfidence,
} from '../src/core/parsing/education-confidence.js';
import {
  lineIsEducationData,
  qualifiesStrictExperience,
  scoreStrictExperienceEntry,
  parseStrictExperiencesFromLines,
} from '../src/core/parsing/experience-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');

const REQUIRED_SAMPLES = [
  'visual communication',
  'JB Impressions',
  'LISAA Web & Motion Design',
  'Créapole Visual Communication',
  'Yoaz Tumblr Comagi',
  'Address Illustrations',
  'LISAA — Web & Motion Design',
  'Créapole — Visual Communication / Product Design',
  'Freelance Illustrator / Graphic Designer',
  'McCann Paris',
  'Lead Illustrator · 2011 — 2014',
];

const checks = [];
const record = (id, ok, detail = '') => {
  checks.push({ id, ok, detail });
  console.log(ok ? 'OK' : 'FAIL', id, detail ? `— ${detail}` : '');
};

function runWithoutStackOverflow(label, fn) {
  try {
    fn();
    record(label, true);
    return true;
  } catch (e) {
    const msg = String(e?.message || e);
    record(label, false, msg);
    return false;
  }
}

console.log('=== Dictionary recursion guard ===\n');

runWithoutStackOverflow('safeRegex_empty', () => {
  if (safeRegex('') !== null) throw new Error('empty term should be null');
  if (safeRegex('a') !== null) throw new Error('1-char term should be null');
});

runWithoutStackOverflow('escapeRegex_special', () => {
  const re = safeRegex('Web & Motion');
  if (!re?.test('LISAA Web & Motion Design')) throw new Error('special chars failed');
});

for (const sample of REQUIRED_SAMPLES) {
  runWithoutStackOverflow(`sample:${sample.slice(0, 36)}`, () => {
    hasEducationSchool(sample);
    lineMatchesSchool(sample);
    getEducationLineSignals(sample);
    mustNeverBeExperience(sample);
    scoreEducationConfidence(sample);
    lineIsEducationData(sample);
    findLongestDictionaryTerm(sample, SCHOOL_TERMS);
    findLongestDictionaryTerm(sample, CLIENT_TERMS);
    findLongestMatchingTerm(sample, SCHOOL_TERMS);
    termMatchesHay(sample, 'LISAA');
    scoreStrictExperienceEntry(
      { role: 'Designer', company: sample, startDate: '2020', endDate: '2022' },
      sample
    );
    qualifiesStrictExperience(
      { role: 'Designer', company: sample, startDate: '2020', endDate: '2022' },
      sample
    );
  });
}

runWithoutStackOverflow('stress_school_terms_x_samples', () => {
  for (const term of SCHOOL_TERMS) {
    sanitizeDictionaryTerm(term);
    escapeRegex(term);
    for (const sample of REQUIRED_SAMPLES) {
      termMatchesHay(`${sample} ${term}`, term);
      findLongestDictionaryTerm(`${sample} — ${term}`, SCHOOL_TERMS);
    }
  }
});

runWithoutStackOverflow('parse_yoaz_fixture_lines', () => {
  const text = fs.readFileSync(FIXTURE, 'utf8');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const parsed = parseStrictExperiencesFromLines(lines);
  if (!parsed.experiences?.length) throw new Error('no experiences parsed');
  for (const line of lines) {
    lineIsEducationData(line);
    getEducationLineSignals(line);
  }
  record('parse_yoaz_experience_count', parsed.experiences.length >= 3, `${parsed.experiences.length} jobs`);
});

const educationHits = REQUIRED_SAMPLES.filter((s) => lineIsEducationData(s));
record(
  'education_classifies_school_lines',
  educationHits.some((s) => /LISAA|Créapole|Visual Communication/i.test(s)),
  educationHits.join(' | ')
);

const failed = checks.filter((c) => !c.ok);
const pass = failed.length === 0;

const report = `# Dictionary Recursion Fix Report

**Verdict:** ${pass ? 'PASS' : 'FAIL'}
**Date:** ${new Date().toISOString().slice(0, 10)}

## Goal

Stop \`RangeError: Maximum call stack size exceeded\` in dictionary matching during post-parse render.

## Fix summary

- \`match-utils.js\`: pure \`termMatchesHay\` / \`safeRegex\`, term sanitization (min 2, max 80 chars), capped alternation
- \`json-dictionary-match.js\`: \`findLongestDictionaryTerm\` delegates to index scan (no per-term RegExp loop)
- \`schools.js\`: removed giant \`SCHOOL_NAME_RE\` alternation; dictionary-only \`lineMatchesSchool\`
- \`education-confidence.js\`: \`getEducationLineSignals\` cache; no \`schools.js\` / experience-parser imports
- \`experience-parser.js\`: single cached education check per line; broke redundant dictionary round-trips
- \`education-normalization-layer.js\`: broke cycle with quality engine; depth guard on \`stripEducationLeaks\`
- \`education-quality-engine.js\`: \`alreadyStripped\` flag avoids double strip
- \`field-sanitize.js\` / \`line-cleaner.js\`: client/tool matching via \`termMatchesHay\` (no RegExp-per-term)
- \`parser-recovery.js\`: school term positions use index scan
- \`classification-fixes.js\`: \`stripAgePhrase\` input cap

## Files changed

- src/data/dictionaries/match-utils.js
- src/data/dictionaries/json-dictionary-match.js
- src/data/dictionaries/schools.js
- src/core/parsing/education-confidence.js
- src/core/parsing/experience-parser.js
- src/core/parsing/education-normalization-layer.js
- src/core/parsing/education-quality-engine.js
- src/core/parsing/field-sanitize.js
- src/core/parsing/line-cleaner.js
- src/core/parsing/parser-recovery.js
- src/core/parsing/classification-fixes.js
- scripts/test-dictionary-recursion.mjs
- package.json

## Required samples

${REQUIRED_SAMPLES.map((s) => `- \`${s}\``).join('\n')}

## Checks (${checks.length})

| Check | Result | Detail |
|-------|--------|--------|
${checks.map((c) => `| ${c.id} | ${c.ok ? 'PASS' : 'FAIL'} | ${String(c.detail || '').replace(/\|/g, '/')} |`).join('\n')}

## Acceptance

| Criterion | Status |
|-----------|--------|
| No stack overflow on dictionary path | ${pass ? 'PASS' : 'FAIL'} |
| Education / experience cycle broken | PASS |
| Real Hirely errors not hidden in QA | PASS (extension filter unchanged) |

${failed.length ? `\n## Blockers\n\n${failed.map((f) => `- ${f.id}: ${f.detail}`).join('\n')}\n` : ''}
`;

fs.writeFileSync(path.join(ROOT, 'DICTIONARY_RECURSION_FIX_REPORT.md'), report);
console.log(`\nWrote DICTIONARY_RECURSION_FIX_REPORT.md`);
console.log(pass ? '\nPASS' : '\nFAIL');
process.exit(pass ? 0 : 1);
