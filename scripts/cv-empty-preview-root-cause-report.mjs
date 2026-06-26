#!/usr/bin/env node
/**
 * HIRELY P0 — Generate CV_EMPTY_PREVIEW_ROOT_CAUSE.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CV_EMPTY_PREVIEW_ROOT_CAUSE.md');
const QA_JSON = path.join(ROOT, 'tests/output/cv-empty-preview-root-cause/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — CV empty preview root cause\n');
  const qa = run('node', ['src/tests/qa-cv-empty-preview-root-cause.mjs']);
  console.log(qa.pass ? '  PASS qa-cv-empty-preview-root-cause' : '  FAIL qa-cv-empty-preview-root-cause');

  let data = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      data = null;
    }
  }

  const pass = qa.pass && data?.pass;
  const lines = [
    '# HIRELY P0 — CV Empty Preview Root Cause',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'Extraction detects data and the review queue holds items, but the template preview can look empty — a release blocker.',
    '',
    '## Pipeline audited',
    '',
    '`reviewQueue` → `finalResumeData` → `template renderer`',
    '',
    'Per section: **DETECTED_DATA_COUNT** · **FINAL_DATA_COUNT** · **RENDERED_DATA_COUNT**',
    '',
  ];

  const rootCauses = [
    {
      id: 'RC1',
      stage: 'finalResumeData',
      file: 'src/core/validation/final-cv-readability.js',
      issue:
        'School-only education lines (e.g. LISAA) were dropped by `polishEducation` when no degree marker was present — even when `EDUCATION_SIGNAL_RE` matched.',
      fix: 'Keep school-only lines when `EDUCATION_SIGNAL_RE` matches known schools/programs.',
    },
    {
      id: 'RC2',
      stage: 'templateRenderer',
      file: 'src/ui/templates/cv-templates.js',
      issue:
        'Production templates hid `classificationPendingSection` / `unsortedSection` — gated review-queue data never appeared in preview.',
      fix: 'Added `pendingReviewSection` (À vérifier) in production stacks; wired from `getPendingReviewQueue()` in `renderCVInner`.',
    },
    {
      id: 'RC3',
      stage: 'templateRenderer',
      file: 'src/ui/templates/cv-templates.js',
      issue: 'Object-shaped `experience` entries were stringified to `[object Object]` and filtered out when `experiences` plural was absent.',
      fix: 'Recover structured experience from `src.experience` objects via `experiencesFromStructured`.',
    },
    {
      id: 'RC4',
      stage: 'finalResumeData',
      file: 'src/core/parsing/simple-cv-mapper.js',
      issue: 'Education objects became `[object Object]` strings in cvData mapping.',
      fix: 'Format education objects as `degree — school — dates` lines.',
    },
  ];

  lines.push('## Root causes found', '');
  for (const rc of rootCauses) {
    lines.push(`### ${rc.id} — ${rc.stage}`, '', `**Issue:** ${rc.issue}`, '', `**Fix:** ${rc.fix}`, '', `**File:** \`${rc.file}\``, '');
  }

  if (data?.fixtures) {
    for (const [fxId, audit] of Object.entries(data.fixtures)) {
      lines.push(`## Fixture: ${fxId}`, '');
      lines.push(
        `Preview density: **${audit.previewDensity}%** (target ≥ 80%) · Template: \`${audit.templateId}\` · HTML: ${audit.htmlLength} chars`
      );
      lines.push('', '| Section | DETECTED | FINAL | RENDERED | Loss (final) | Loss (render) |', '|---------|----------|-------|----------|--------------|---------------|');
      for (const [key, row] of Object.entries(audit.sectionRows || {})) {
        if (!row.DETECTED_DATA_COUNT && !row.FINAL_DATA_COUNT && !row.RENDERED_DATA_COUNT) continue;
        lines.push(
          `| ${key} | ${row.DETECTED_DATA_COUNT} | ${row.FINAL_DATA_COUNT} | ${row.RENDERED_DATA_COUNT} | ${row.dropFinal} | ${row.dropRender} |`
        );
      }
      if (audit.lossPoints?.length) {
        lines.push('', '**Where data disappeared:**', '');
        for (const lp of audit.lossPoints) {
          lines.push(`- \`${lp.section}\` — ${lp.count} item(s) at **${lp.stage}**`);
        }
      }
      lines.push(
        '',
        `Pending review in queue: ${audit.pendingReviewCount} · Rendered pending block: ${audit.pendingReviewRendered}`,
        ''
      );
    }
  }

  lines.push(
    '## Rules enforced',
    '',
    '- Detected data must never silently vanish.',
    '- Review-queue data shows as **À vérifier** pending in production preview.',
    '- `finalResumeData` content renders in templates.',
    '- No empty pages / giant white areas when data exists.',
    '',
    '## Acceptance',
    '',
    pass
      ? '**PASS** — Preview density ≥ 80% of detected CV content on audited fixtures.'
      : '**FAIL** — See QA output below.',
    '',
    '## Run',
    '',
    '```bash',
    'npm run test:cv-empty-preview-root-cause',
    '```',
    ''
  );

  if (!qa.pass && qa.out) {
    lines.push('## QA output', '', '```', qa.out.slice(0, 8000), '```', '');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
