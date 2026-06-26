#!/usr/bin/env node
/**
 * Generate REWRITE_VALIDATION_REPORT.md
 * node scripts/rewrite-validation-report.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'node:child_process';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import {
  rewriteExperienceDescription,
  rewriteResumeExperiences,
  CV_EXPERIENCE_REWRITE,
} from '../src/core/parsing/cv-experience-rewrite.js';
import {
  SAFE_REWRITE_VALIDATION,
  SAFE_REWRITE_CONFIDENCE_MIN,
  buildSafeRewriteRecord,
} from '../src/core/parsing/safe-rewrite-validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'REWRITE_VALIDATION_REPORT.md');

const FIXTURES = [
  { id: 'developer-cv', label: 'Developer CV' },
  { id: 'creative-cv', label: 'Creative CV' },
  { id: 'marketing-cv', label: 'Marketing CV' },
  { id: 'consultant-cv', label: 'Consultant CV' },
];

const gate = spawnSync('node', ['src/tests/qa-safe-rewrite-validation.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
});
const gateOk = gate.status === 0;

async function evaluateFixture(entry) {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures', entry.id, 'fixture.txt'), 'utf8');
  const imp = await runHirelyImportFromText(raw, { source: entry.id, extractionMethod: 'paste' });
  const rd = rewriteResumeExperiences(imp.resumeData || { experiences: [], unsorted: [] });
  const records = (rd.experiences || []).flatMap((e) => e.rewriteRecords || []);
  const autoApplied = records.filter((r) => r.autoApplied).length;
  const suggestions = records.filter((r) => !r.autoApplied).length;
  const traceable = records.filter((r) => r.traceable).length;
  return {
    ...entry,
    experienceCount: rd.experiences?.length || 0,
    recordCount: records.length,
    autoApplied,
    suggestions,
    traceable,
    allTraceable: records.length > 0 && traceable === records.length,
    sample: records[0] || null,
  };
}

async function main() {
  const rows = [];
  for (const entry of FIXTURES) {
    rows.push(await evaluateFixture(entry));
    process.stderr.write(`[rewrite-validation] ${entry.id}…\n`);
  }

  const allowedExample = rewriteExperienceDescription('Graphic designer. Posters. Packaging.', {
    role: 'Freelance Graphic Designer',
    company: 'Independent',
  });

  const blockedExample = buildSafeRewriteRecord({
    originalText: 'Designed posters for local clients.',
    rewrittenText:
      'Increased revenue by 40% as Senior VP at Acme Corp while leading 200 engineers (2010–2015).',
    sourceSection: 'experience',
    sourceConfidence: 80,
    context: { role: 'Designer', company: 'Studio', dates: '2018–2020' },
  });

  const totalRecords = rows.reduce((s, r) => s + r.recordCount, 0);
  const totalTraceable = rows.reduce((s, r) => s + r.traceable, 0);
  const acceptance = gateOk && rows.every((r) => r.allTraceable) && totalRecords > 0;

  const lines = [];
  lines.push('# REWRITE VALIDATION REPORT');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Engine: \`${SAFE_REWRITE_VALIDATION}\` + \`${CV_EXPERIENCE_REWRITE}\``);
  lines.push(`Gate status: **${gateOk ? 'PASS' : 'FAIL'}**`);
  lines.push(`Confidence threshold: **${SAFE_REWRITE_CONFIDENCE_MIN}%** (below → Suggestions, no auto rewrite)`);
  lines.push('');
  lines.push('## Mission');
  lines.push('');
  lines.push('Rewriting may improve grammar and clarity, but must never invent facts. Every rewritten sentence stores:');
  lines.push('');
  lines.push('- `originalText`');
  lines.push('- `rewrittenText`');
  lines.push('- `sourceSection`');
  lines.push('- `sourceConfidence`');
  lines.push('- `factsUsed`');
  lines.push('');
  lines.push('## Rules');
  lines.push('');
  lines.push('| Allowed | Forbidden |');
  lines.push('|---------|-----------|');
  lines.push('| Improve grammar / clarity | Invent company |');
  lines.push('| Merge repeated lines | Invent dates |');
  lines.push('| Professionalize wording | Invent job title |');
  lines.push('| | Invent metrics |');
  lines.push('| | Invent achievements |');
  lines.push('');
  lines.push('## Fixture results');
  lines.push('');
  lines.push('| Fixture | Experiences | Rewrite records | Auto-applied | Suggestions | Traceable |');
  lines.push('|---------|-------------|-----------------|--------------|-------------|-----------|');
  for (const row of rows) {
    lines.push(
      `| ${row.label} | ${row.experienceCount} | ${row.recordCount} | ${row.autoApplied} | ${row.suggestions} | ${row.traceable}/${row.recordCount} |`
    );
  }
  lines.push('');
  lines.push(`**Aggregate traceability:** ${totalTraceable}/${totalRecords} records traceable to original text`);
  lines.push('');
  lines.push('## Allowed rewrite example');
  lines.push('');
  lines.push('```json');
  lines.push(
    JSON.stringify(
      {
        original: allowedExample.originalDescription,
        rewritten: allowedExample.rewrittenDescription,
        confidence: allowedExample.rewriteConfidence,
        autoApplied: allowedExample.autoApplied,
        records: (allowedExample.rewriteRecords || []).map((r) => ({
          originalText: r.originalText,
          rewrittenText: r.rewrittenText,
          sourceSection: r.sourceSection,
          sourceConfidence: r.sourceConfidence,
          factsUsed: r.factsUsed,
          rewriteConfidence: r.rewriteConfidence,
          autoApplied: r.autoApplied,
        })),
      },
      null,
      2
    )
  );
  lines.push('```');
  lines.push('');
  lines.push('## Blocked rewrite example (invented facts)');
  lines.push('');
  lines.push('```json');
  lines.push(
    JSON.stringify(
      {
        originalText: blockedExample.originalText,
        rewrittenText: blockedExample.rewrittenText,
        violations: blockedExample.violations,
        rewriteConfidence: blockedExample.rewriteConfidence,
        autoApplied: blockedExample.autoApplied,
        blockedReason: blockedExample.blockedReason,
      },
      null,
      2
    )
  );
  lines.push('```');
  lines.push('');
  lines.push('## Acceptance');
  lines.push('');
  lines.push(
    `**${acceptance ? 'PASS' : 'FAIL'}** — Every rewritten line can be traced back to original extracted text.`
  );
  lines.push('');
  lines.push('## Files');
  lines.push('');
  lines.push('- `src/core/parsing/safe-rewrite-validation.js` — validation engine');
  lines.push('- `src/core/parsing/cv-experience-rewrite.js` — gated experience rewrite');
  lines.push('- `src/tests/qa-safe-rewrite-validation.mjs` — automated gate');
  lines.push('- `tests/output/safe-rewrite-validation/report.json` — machine-readable output');

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`Wrote ${OUT}`);
  console.log(`Acceptance: ${acceptance ? 'PASS' : 'FAIL'}`);
  process.exit(acceptance ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
