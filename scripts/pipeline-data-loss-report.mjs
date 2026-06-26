#!/usr/bin/env node
/**
 * P0 — Generate PIPELINE_DATA_LOSS_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PIPELINE_DATA_LOSS_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/pipeline-data-loss/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Pipeline data-loss audit\n');
  const qa = run('node', ['src/tests/qa-pipeline-data-loss.mjs']);
  console.log(qa.pass ? '  PASS qa-pipeline-data-loss' : '  FAIL qa-pipeline-data-loss');

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
    '# HIRELY P0 — Full Data Pipeline Audit',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'Data is detected and the review queue holds items, but the final CV preview looks 30–40% complete and templates can appear empty.',
    '',
    '## Pipeline audited',
    '',
    '```',
    'RAW_TEXT',
    '  ↓',
    'OCR (cleanedText)',
    '  ↓',
    'PARSER (structuredResume)',
    '  ↓',
    'NORMALIZATION (resumeData)',
    '  ↓',
    'REVIEW_QUEUE',
    '  ↓',
    'FINAL_RESUME_DATA',
    '  ↓',
    'TEMPLATE_RENDERER',
    '  ↓',
    'PDF_EXPORT',
    '```',
    '',
    'Per field: **DETECTED** · **NORMALIZED** · **REVIEWED** · **COMMITTED** · **RENDERED** · **EXPORTED**',
    '',
    'Fields: `name` `title` `summary` `experience` `education` `skills` `tools` `languages` `clients` `projects` `awards` `portfolio` `linkedin`',
    '',
  ];

  if (data?.fixtures) {
    lines.push('## Executive summary', '');
    lines.push(
      '| Fixture | Template lock | Field coverage | Review queue | Loss events |',
      '|---------|---------------|----------------|--------------|-------------|'
    );
    for (const [fxId, audit] of Object.entries(data.fixtures)) {
      lines.push(
        `| ${fxId} | ${audit.templateLockScore ?? audit.completenessPct}% | ${audit.fieldCoveragePct ?? '—'}% | ${audit.reviewQueueSize} | ${audit.losses?.length || 0} |`
      );
    }
    lines.push(
      '',
      '**Primary loss stage:** `NORMALIZED → COMMITTED` via semantic confidence gate — uncertain lines move to review queue instead of `finalResumeData`.',
      '**Recovery path:** Pending items render under **À vérifier** (`cvSection--pendingReview`) so preview is not blank.',
      '',
    );

    for (const [fxId, audit] of Object.entries(data.fixtures)) {
      lines.push(`## Fixture: ${fxId}`, '');
      lines.push(
        `Template lock: **${audit.templateLockScore ?? audit.completenessPct}%** · Field coverage: **${audit.fieldCoveragePct ?? '—'}%** · Template: \`${audit.templateId}\` · Review queue: ${audit.reviewQueueSize}`
      );
      lines.push('', '| Field | DETECTED | NORMALIZED | REVIEWED | COMMITTED | RENDERED | EXPORTED |', '|-------|----------|------------|----------|-----------|----------|----------|');

      for (const field of data.fields || []) {
        const row = audit.matrix?.[field];
        if (!row) continue;
        const any = ['DETECTED', 'NORMALIZED', 'REVIEWED', 'COMMITTED', 'RENDERED', 'EXPORTED'].some((s) => (row[s] || 0) > 0);
        if (!any) continue;
        lines.push(
          `| ${field} | ${row.DETECTED} | ${row.NORMALIZED} | ${row.REVIEWED} | ${row.COMMITTED} | ${row.RENDERED} | ${row.EXPORTED} |`
        );
      }

      if (audit.intermediate) {
        lines.push('', '### Intermediate stages', '', '| Field | OCR (text) | PARSER (structured) |', '|-------|------------|---------------------|');
        for (const field of data.fields || []) {
          const o = audit.intermediate.ocr?.[field] || 0;
          const p = audit.intermediate.parser?.[field] || 0;
          if (!o && !p) continue;
          lines.push(`| ${field} | ${o} | ${p} |`);
        }
      }

      if (audit.losses?.length) {
        lines.push('', '### Where fields were lost', '');
        for (const loss of audit.losses) {
          lines.push(`- **${loss.field}** — ${loss.count} item(s): ${loss.label} (\`${loss.from}\` → \`${loss.to}\`)`);
        }
      } else {
        lines.push('', 'No field loss between audited stages.', '');
      }
    }
  }

  lines.push(
    '## Root loss patterns (code)',
    '',
    '| Stage transition | Typical cause | File |',
    '|------------------|---------------|------|',
    '| PARSER → NORMALIZATION | Section mapping / experience builder | `src/core/resume-data.js` |',
    '| NORMALIZATION → COMMITTED | Semantic confidence gate removes uncertain lines | `src/core/validation/semantic-confidence-gate.js` |',
    '| NORMALIZATION → COMMITTED | School-only education dropped in readability pass | `src/core/validation/final-cv-readability.js` |',
    '| COMMITTED → RENDERED | Production template hid pending / unsorted sections | `src/ui/templates/cv-templates.js` |',
    '| COMMITTED → RENDERED | `_pendingReview` stripped in `normalizeProfile` | `src/ui/templates/cv-templates.js` |',
    '| RENDERED → EXPORTED | PDF uses same `#cvDoc` HTML — loss should be **0** if render is complete | `src/core/export/pdf-export-config.js` |',
    '',
    '## Rules',
    '',
    '- Detected data must never silently vanish.',
    '- Review-queue items surface as **À vérifier** in production preview.',
    '- `finalResumeData` content must render in templates.',
    '- EXPORTED mirrors RENDERED (print/PDF of same DOM).',
    '',
    '## Acceptance',
    '',
    pass
      ? '**PASS** — Pipeline audit complete; field loss documented per stage with render completeness ≥ 70% on fixtures.'
      : '**FAIL** — See QA output below.',
    '',
    '## Run',
    '',
    '```bash',
    'npm run test:pipeline-data-loss',
    '```',
    ''
  );

  if (!qa.pass && qa.out) {
    lines.push('## QA output', '', '```', qa.out.slice(0, 12000), '```', '');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
