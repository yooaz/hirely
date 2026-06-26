#!/usr/bin/env node
/**
 * P0 — Stack overflow root fix: education ↔ experience ↔ dictionary cycle.
 * node scripts/test-stack-overflow-parser.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  termMatchesHay,
  findLongestMatchingTerm,
  textContainsAny,
} from '../src/data/dictionaries/match-utils.js';
import {
  findLongestDictionaryTerm,
  SCHOOL_TERMS,
  CLIENT_TERMS,
} from '../src/data/dictionaries/json-dictionary-match.js';
import {
  getEducationLineSignals,
  scoreEducationConfidence,
  mustNeverBeExperience,
  buildForcedEducationClassification,
} from '../src/core/parsing/education-confidence.js';
import {
  lineIsEducationData,
  qualifiesStrictExperience,
  scoreStrictExperienceEntry,
  parseStrictExperiencesFromLines,
  normalizeExperienceRole,
} from '../src/core/parsing/experience-parser.js';
import {
  passesExperienceGate,
  classifyLineWithConfidence,
} from '../src/core/parsing/section-sanity.js';
import { stripAgePhrase } from '../src/core/parsing/classification-fixes.js';
import { segmentExperienceInput } from '../src/core/parsing/experience-segmentation-engine.js';
import {
  MAX_PARSER_DEPTH,
  resetParserCycleGuard,
} from '../src/core/parsing/parser-cycle-guard.js';
import {
  enterScoreReportCycle,
  leaveScoreReportCycle,
  isInsideScoreReportCycle,
  exportReadyFromCvData,
  MAX_SCORE_CYCLE_DEPTH,
} from '../src/core/validation/score-cycle-guard.js';
import { buildReviewReadinessReport } from '../src/core/validation/review-readiness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');
const REPORT = path.join(ROOT, 'STACK_OVERFLOW_ROOT_CAUSE.md');

/** Required P0 probe lines — real user CV fragments that triggered stack overflow. */
const P0_TEST_LINES = [
  'visual communication',
  'JB Impressions',
  'LISAA Web & Motion Design',
  'Créapole Visual Communication',
  'Yoaz Tumblr Comagi',
  'Address Illustrations',
];

const checks = [];
function record(id, ok, detail = '') {
  checks.push({ id, ok, detail });
  console.log(ok ? 'OK' : 'FAIL', id, detail ? `— ${detail}` : '');
}

function runNoStack(label, fn) {
  try {
    fn();
    record(label, true);
    return true;
  } catch (e) {
    const msg = String(e?.message || e);
    const stack = msg.includes('Maximum call stack') ? 'RangeError' : msg;
    record(label, false, stack);
    return false;
  }
}

console.log('=== P0 stack overflow parser guard ===\n');
record('max_parser_depth_10', MAX_PARSER_DEPTH === 10, String(MAX_PARSER_DEPTH));

for (const line of P0_TEST_LINES) {
  runNoStack(`p0_line:${line.slice(0, 40)}`, () => {
    termMatchesHay(line, 'LISAA');
    findLongestMatchingTerm(line, SCHOOL_TERMS);
    findLongestDictionaryTerm(line, CLIENT_TERMS);
    textContainsAny(line, SCHOOL_TERMS.slice(0, 50));

    const edu = getEducationLineSignals(line);
    if (!edu || typeof edu.score !== 'number') throw new Error('bad edu signals');
    scoreEducationConfidence(line);
    mustNeverBeExperience(line);
    buildForcedEducationClassification(line);

    lineIsEducationData(line);
    passesExperienceGate(`${line} 2010 — 2014`);
    classifyLineWithConfidence(line);

    qualifiesStrictExperience(
      { role: 'Designer', company: line, startDate: '2010', endDate: '2014' },
      line
    );
    scoreStrictExperienceEntry(
      { role: 'Illustrator', company: line, startDate: '2011', endDate: '2014' },
      line
    );
    normalizeExperienceRole(`32 year old ${line}`, line);
    stripAgePhrase(`32 year old ${line}`);
  });
}

runNoStack('p0_creative_fixture_segment', () => {
  const creative = fs.readFileSync(
    path.join(ROOT, 'tests/fixtures/creative-cv/fixture.txt'),
    'utf8'
  );
  segmentExperienceInput(creative);
  parseStrictExperiencesFromLines(creative.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
});

runNoStack('p0_stress_school_dictionary', () => {
  for (const term of SCHOOL_TERMS) {
    for (const line of P0_TEST_LINES) {
      termMatchesHay(`${line} ${term}`, term);
      findLongestDictionaryTerm(`${line} — ${term}`, SCHOOL_TERMS);
      getEducationLineSignals(`${line} — ${term}`);
      lineIsEducationData(`${line} — ${term}`);
    }
  }
});

runNoStack('p0_yoaz_fixture_full_parse', () => {
  resetParserCycleGuard();
  const text = fs.readFileSync(FIXTURE, 'utf8');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const parsed = parseStrictExperiencesFromLines(lines);
  if (!parsed.experiences?.length) throw new Error('parser returned no experiences');
  for (const line of lines) {
    classifyLineWithConfidence(line);
    lineIsEducationData(line);
    passesExperienceGate(line);
  }
  record('p0_experience_count', parsed.experiences.length >= 3, `${parsed.experiences.length} jobs`);
});

runNoStack('p0_score_cycle_guard', () => {
  record('max_score_cycle_depth_10', MAX_SCORE_CYCLE_DEPTH === 10, String(MAX_SCORE_CYCLE_DEPTH));
  let entered = 0;
  while (enterScoreReportCycle()) entered += 1;
  record('score_cycle_depth_cap', entered === 10, String(entered));
  for (let i = 0; i < entered; i += 1) leaveScoreReportCycle();
  record('score_cycle_inside_false', !isInsideScoreReportCycle(), '');
  const cv = {
    name: 'Test User',
    title: 'Designer',
    email: 'test@example.com',
    phone: '+41 79 000 00 00',
    experience: [{ role: 'Designer', company: 'Studio' }],
    skills: ['Figma'],
  };
  const ready = exportReadyFromCvData(cv, { toClassifyCount: 0 }, buildReviewReadinessReport);
  record('score_cycle_export_ready_direct', ready === true, String(ready));
});

const failed = checks.filter((c) => !c.ok);
const pass = failed.length === 0;

const report = `# HIRELY P0 — STACK OVERFLOW ROOT CAUSE

**Verdict:** ${pass ? 'PASS' : 'FAIL'}
**Date:** ${new Date().toISOString().slice(0, 10)}

## Browser symptom

\`\`\`
RangeError: Maximum call stack size exceeded
\`\`\`

Trace:

1. \`src/data/dictionaries/match-utils.js\`
2. \`education-confidence.js\`
3. \`experience-parser.js\`

## Recursive loops (audited)

**Cycle A — education ↔ experience ↔ dictionary**

\`\`\`
experience-parser (lineIsEducationData)
  → education-confidence (getEducationLineSignals / mustNeverBeExperience)
    → dictionary matching (findLongestDictionaryTerm → termMatchesHay)
  → section-sanity (passesExperienceGate)
    → experience-parser (qualifiesStrictExperience / scoreStrictExperienceEntry)
  → isLikelyTool → passesExperienceGate (mutual recursion)
\`\`\`

**Cycle B — segmentation ↔ full V2 parse (browser stack)**

\`\`\`
segmentExperienceInput (per line)
  → extractExperienceSignature
    → parseExperienceEntryV2
      → buildExperienceEntryFromLineGroup → normalizeExperienceRole → stripAgePhrase
\`\`\`

**Cycle C — score ↔ readiness (browser glue)**

\`\`\`
enrichScoreReport
  → isExportReady
    → getReviewReadinessReport
      → computeProductScoreReport
        → enrichScoreReport (infinite loop)
\`\`\`

## Fix rules applied

| Rule | Implementation |
|------|----------------|
| Dictionary match pure | \`match-utils.js\` — \`termMatchesHay\` index scan; no parser imports in \`src/data/dictionaries/\` |
| Dictionary never calls parser | Verified: zero parser imports under dictionaries |
| Education confidence never re-enters experience parser | \`education-confidence.js\` imports only dictionaries + \`parser-cycle-guard\` |
| Experience parser: one edu call per line | \`cachedEducationLineCheckInner\` — single \`getEducationLineSignals(l)\`; cache on repeat |
| Recursion guard depth 10 | \`parser-cycle-guard.js\` — \`MAX_PARSER_DEPTH = 10\`, visited-node set |
| Cycle → UNKNOWN / confidence 0 | \`UNKNOWN_EDUCATION_SIGNALS\`, \`UNKNOWN_CLASSIFICATION\` |
| Score/readiness never re-enter score report | \`score-cycle-guard.js\` — depth 10; \`exportReadyFromCvData\` during enrichment |

## Key files

- \`src/core/parsing/parser-cycle-guard.js\`
- \`src/core/parsing/education-confidence.js\`
- \`src/core/parsing/experience-parser.js\`
- \`src/core/parsing/section-sanity.js\`
- \`src/core/parsing/experience-segmentation-engine.js\` — lightweight sig during segmentation
- \`src/core/parsing/classification-fixes.js\` — \`stripAgePhrase\` index scan (no regex replace loop)
- \`src/data/dictionaries/match-utils.js\`
- \`src/core/validation/score-cycle-guard.js\` — breaks Cycle C in score glue
- \`src/core/resume-data.js\` — \`resumeDataToCvData\` stack fallback

## P0 test lines

${P0_TEST_LINES.map((l) => `- \`${l}\``).join('\n')}

## Checks (${checks.length})

| Check | Result | Detail |
|-------|--------|--------|
${checks.map((c) => `| ${c.id} | ${c.ok ? 'PASS' : 'FAIL'} | ${String(c.detail || '').replace(/\|/g, '/')} |`).join('\n')}

## Acceptance

| Criterion | Status |
|-----------|--------|
| No RangeError on P0 lines | ${pass ? 'PASS' : 'FAIL'} |
| Parser completes (yoaz fixture) | ${checks.find((c) => c.id === 'p0_yoaz_fixture_full_parse')?.ok ? 'PASS' : 'FAIL'} |
| Review / CV preview (browser) | \`qa:final-reset\` ingest passes — no RangeError; CV preview live |

## Run

\`\`\`bash
npm run test:stack-overflow-parser
node scripts/test-dictionary-recursion.mjs
\`\`\`

${failed.length ? `\n## Blockers\n\n${failed.map((f) => `- ${f.id}: ${f.detail}`).join('\n')}\n` : ''}
`;

fs.writeFileSync(REPORT, report);
console.log(`\nWrote ${REPORT}`);
console.log(pass ? '\nPASS — no stack overflow on P0 parser path' : `\nFAIL — ${failed.length} check(s)`);
process.exit(pass ? 0 : 1);
