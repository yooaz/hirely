#!/usr/bin/env node
/**
 * Education recall report — no duplicated education blocks per school+program.
 * Output: EDUCATION_RECALL_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../src/core/validation/sanitize-resume-display.js';
import { dedupeEducationEntries } from '../src/core/parsing/education-dedupe.js';
import { normalizeEducationEntry } from '../src/core/parsing/education-normalization-layer.js';
import { groundTruthForFixture } from '../tests/lib/section-ground-truth.mjs';
import {
  computeSectionMetrics,
  extractDetectedSections,
} from '../tests/lib/section-accuracy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'EDUCATION_RECALL_REPORT.md');

const ACCEPTANCE_FIXTURES = [
  { id: 'developer-cv', label: 'Developer CV' },
  { id: 'creative-cv', label: 'Creative CV' },
  { id: 'marketing-cv', label: 'Marketing CV' },
  { id: 'consultant-cv', label: 'Consultant CV' },
  { id: 'yoaz-cv', label: 'Yoaz CV' },
];

const CREAPOLE_DUPLICATE_FIXTURE = [
  'Créapole — Visual Communication — 2007–2009',
  'Créapole — Visual Communication — 2008–2010',
  'Créapole — Product Design — 2011–2012',
  'LISAA — Web & Motion Design — 2011–2012',
];

const EDUCATION_RECALL_GOAL = 90;

function programKey(line) {
  const norm = normalizeEducationEntry(line, {});
  if (norm?.school) {
    return `${norm.school.toLowerCase()}|${(norm.program || '_').toLowerCase()}`;
  }
  const parts = String(line || '').split(/\s*[—–-]\s*/);
  return `${(parts[0] || '').trim().toLowerCase()}|${(parts[1] || '_').trim().toLowerCase()}`;
}

function countDuplicateBlocks(education = []) {
  const seen = new Set();
  let dupes = 0;
  for (const line of education) {
    const key = programKey(line);
    if (seen.has(key)) dupes += 1;
    else seen.add(key);
  }
  return dupes;
}

async function evaluateFixture(entry) {
  const fixturePath = path.join(ROOT, 'tests/fixtures', entry.id, 'fixture.txt');
  const raw = fs.readFileSync(fixturePath, 'utf8');

  const imp = await runHirelyImportFromText(raw, { source: entry.id });
  const sanitized = sanitizeResumeForDisplay(imp.resumeData);
  const detected = extractDetectedSections(sanitized);
  const gt = groundTruthForFixture(entry.id, raw);
  const metrics = computeSectionMetrics(gt.education, detected.education, 'education');
  const duplicateBlocks = countDuplicateBlocks(sanitized.education);

  return {
    ...entry,
    metrics,
    detected: detected.education,
    expected: gt.education,
    education: sanitized.education || [],
    duplicateBlocks,
  };
}

async function main() {
  const rows = [];
  let totalExpected = 0;
  let totalTp = 0;
  let totalDupes = 0;

  for (const entry of ACCEPTANCE_FIXTURES) {
    const row = await evaluateFixture(entry);
    rows.push(row);
    totalExpected += row.metrics.expected;
    totalTp += row.metrics.tp;
    totalDupes += row.duplicateBlocks;
    process.stderr.write(
      `[education-recall] ${entry.id} recall ${row.metrics.recall}% dupes ${row.duplicateBlocks}…\n`
    );
  }

  const dedupeBefore = CREAPOLE_DUPLICATE_FIXTURE.length;
  const dedupeAfter = dedupeEducationEntries(CREAPOLE_DUPLICATE_FIXTURE).length;
  const creapoleDupesBefore = CREAPOLE_DUPLICATE_FIXTURE.filter((l) =>
    /^créapole/i.test(l)
  ).length;
  const creapoleAfter = dedupeEducationEntries(CREAPOLE_DUPLICATE_FIXTURE).filter((l) =>
    /créapole/i.test(l)
  );

  const aggregateRecall = totalExpected ? Math.round((totalTp / totalExpected) * 1000) / 10 : 100;
  const noDuplicates = totalDupes === 0;
  const creapoleGoalMet = creapoleDupesBefore >= 2 && creapoleAfter.length <= 2;
  const goalMet =
    rows.every((r) => r.metrics.recall >= EDUCATION_RECALL_GOAL) &&
    aggregateRecall >= EDUCATION_RECALL_GOAL &&
    noDuplicates &&
    creapoleGoalMet;

  const lines = [];
  lines.push('# EDUCATION RECALL REPORT');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('Engine: `dedupeEducationEntries`');
  lines.push('Pipeline: production import + education normalization + `sanitizeResumeForDisplay`');
  lines.push('');
  lines.push('## Goal');
  lines.push('');
  lines.push('**No duplicated education blocks** — one object per school + program; merge overlapping years.');
  lines.push('');
  lines.push(`### Goal status: **${goalMet ? 'MET' : 'NOT MET'}**`);
  lines.push('');
  lines.push('## Rules enforced');
  lines.push('');
  lines.push('- Merge rows with same school, same program, and overlapping year spans');
  lines.push('- Keep distinct programs at the same school as separate entries');
  lines.push('- Union merged date ranges (min start → max end)');
  lines.push('');
  lines.push('## Acceptance fixtures');
  lines.push('');
  lines.push('| Fixture | Expected | Detected | TP | Duplicate blocks | Recall | Precision |');
  lines.push('|---------|----------:|---------:|---:|-----------------:|-------:|----------:|');
  for (const row of rows) {
    lines.push(
      `| ${row.label} | ${row.metrics.expected} | ${row.metrics.detected} | ${row.metrics.tp} | ${row.duplicateBlocks} | **${row.metrics.recall}%** | ${row.metrics.precision}% |`
    );
  }
  lines.push('');
  lines.push(`**Aggregate recall:** ${aggregateRecall}% (${totalTp}/${totalExpected} education matched)`);
  lines.push(`**Duplicate blocks (all fixtures):** ${totalDupes}`);
  lines.push('');
  lines.push('## Créapole duplicate recovery');
  lines.push('');
  lines.push('Input (OCR-style duplicates):');
  for (const line of CREAPOLE_DUPLICATE_FIXTURE) {
    lines.push(`- \`${line}\``);
  }
  lines.push('');
  lines.push(`Before dedupe: **${dedupeBefore}** rows (${creapoleDupesBefore} Créapole)`);
  lines.push(`After dedupe: **${dedupeAfter}** rows (${creapoleAfter.length} Créapole)`);
  lines.push('');
  lines.push('Merged output:');
  for (const line of dedupeEducationEntries(CREAPOLE_DUPLICATE_FIXTURE)) {
    lines.push(`- ${line}`);
  }
  lines.push('');
  lines.push('## Run');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run qa:education-dedupe');
  lines.push('npm run qa:education-normalization');
  lines.push('npm run education:recall-report');
  lines.push('```');

  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
  console.log(`Wrote ${OUT}`);
  console.log(
    `Aggregate recall: ${aggregateRecall}% — duplicates: ${totalDupes} — goal ${goalMet ? 'MET' : 'NOT MET'}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
