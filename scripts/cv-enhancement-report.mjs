#!/usr/bin/env node
/**
 * CV Enhancement Engine report — before/after examples, issue breakdown.
 * Output: CV_ENHANCEMENT_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import {
  CV_ENHANCEMENT_ENGINE,
  ISSUE_TYPES,
  runCvEnhancementEngine,
  rewriteExperienceDescription,
} from '../src/core/parsing/cv-enhancement-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CV_ENHANCEMENT_REPORT.md');

const FIXTURES = [
  { id: 'developer-cv', label: 'Developer CV' },
  { id: 'creative-cv', label: 'Creative CV' },
  { id: 'marketing-cv', label: 'Marketing CV' },
  { id: 'consultant-cv', label: 'Consultant CV' },
];

const FRAGMENT = {
  bad: 'Graphic designer. Posters. Packaging.',
  role: 'Freelance Graphic Designer & Illustrator',
  company: 'Independent / Freelance',
};

async function evaluateFixture(entry) {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures', entry.id, 'fixture.txt'), 'utf8');
  const imp = await runHirelyImportFromText(raw, {
    source: entry.id,
    extractionMethod: 'paste',
  });
  const meta = imp.resumeData?.meta?.cvEnhancement || {};
  return {
    ...entry,
    meta,
    goalMet: !!meta.engine && meta.before && meta.after,
  };
}

function formatChange(change) {
  return [
    `**${change.field || change.section}** (${change.type})`,
    '',
    'Before:',
    '```',
    change.before || '(empty)',
    '```',
    '',
    'After:',
    '```',
    change.after || '(empty)',
    '```',
    '',
  ].join('\n');
}

async function main() {
  const rows = [];
  let totalIssues = 0;
  let totalFixed = 0;
  let totalChanges = 0;

  for (const entry of FIXTURES) {
    const row = await evaluateFixture(entry);
    rows.push(row);
    totalIssues += row.meta.issuesDetected || 0;
    totalFixed += row.meta.issuesFixed || 0;
    totalChanges += (row.meta.changes || []).length;
  }

  const fragment = rewriteExperienceDescription(FRAGMENT.bad, {
    role: FRAGMENT.role,
    company: FRAGMENT.company,
  });

  const lines = [];
  lines.push('# CV Enhancement Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`Engine: \`${CV_ENHANCEMENT_ENGINE}\``);
  lines.push('');
  lines.push('## Goal');
  lines.push('');
  lines.push('After extraction, automatically improve CV quality with recruiter-grade wording.');
  lines.push('Detect weak descriptions, repetitions, missing action verbs, bad formatting, and missing achievements.');
  lines.push('Produce **before/after** versions without inventing information — only rewrite existing content.');
  lines.push('');
  lines.push('## Issue types');
  lines.push('');
  for (const [key, value] of Object.entries(ISSUE_TYPES)) {
    lines.push(`- \`${value}\` — ${key.replace(/_/g, ' ').toLowerCase()}`);
  }
  lines.push('');
  lines.push('## Corpus summary');
  lines.push('');
  lines.push('| Fixture | Issues detected | Issues fixed | Changes | Status |');
  lines.push('|---------|-----------------|--------------|---------|--------|');
  for (const row of rows) {
    const m = row.meta;
    lines.push(
      `| ${row.label} | ${m.issuesDetected ?? 0} | ${m.issuesFixed ?? 0} | ${(m.changes || []).length} | ${row.goalMet ? 'PASS' : 'FAIL'} |`
    );
  }
  lines.push('');
  lines.push(`**Totals:** ${totalIssues} issues detected, ${totalFixed} fixed, ${totalChanges} before/after changes.`);
  lines.push('');
  lines.push('## Fragment example (no invention)');
  lines.push('');
  lines.push('Before:');
  lines.push('```');
  lines.push(FRAGMENT.bad);
  lines.push('```');
  lines.push('');
  lines.push('After:');
  lines.push('```');
  lines.push(fragment.rewrittenDescription || '(unchanged)');
  lines.push('```');
  lines.push('');
  lines.push('## Before / After samples');
  lines.push('');

  for (const row of rows) {
    const changes = (row.meta.changes || []).slice(0, 3);
    if (!changes.length) continue;
    lines.push(`### ${row.label}`);
    lines.push('');
    for (const change of changes) {
      lines.push(formatChange(change));
    }
  }

  lines.push('## Pipeline integration');
  lines.push('');
  lines.push('- `src/core/parsing/cv-enhancement-engine.js` — detection + enhancement orchestrator');
  lines.push('- `src/core/parsing/cv-experience-rewrite.js` — experience description rewrite');
  lines.push('- `src/core/parsing/safe-rewrite-validation.js` — blocks invented facts');
  lines.push('- `src/core/parsing/resume-output-quality.js` — runs `runCvEnhancementEngine` post-extraction');
  lines.push('- `resumeData.meta.cvEnhancement` — before/after snapshots + issue counts');
  lines.push('');
  lines.push('## Run QA');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run qa:cv-enhancement');
  lines.push('npm run cv:enhancement-report');
  lines.push('```');

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`Wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
