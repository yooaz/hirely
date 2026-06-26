#!/usr/bin/env node
/**
 * P0 — Generate FINAL_CV_LABEL_LEAKAGE_FIX.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'FINAL_CV_LABEL_LEAKAGE_FIX.md');
const JSON_PATH = path.join(ROOT, 'tests/output/final-cv-label-leakage/report.json');

function run(script) {
  const r = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout || ''}\n${r.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Final CV label leakage fix\n');
  const qa = run('src/tests/qa-final-cv-label-leakage.mjs');
  console.log(qa.ok ? '  PASS qa-final-cv-label-leakage' : '  FAIL qa-final-cv-label-leakage');

  let data = null;
  try {
    if (fs.existsSync(JSON_PATH)) data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  } catch {
    data = null;
  }

  const pass = qa.ok && data?.pass;
  const forbidden = data?.forbidden || [
    'clients',
    'client',
    'experiences',
    'experience',
    'education',
    'formation',
    'summary',
    'tools',
    'skills',
    'languages',
    'identity',
    'projects',
  ];

  const rows = (data?.audits || [])
    .map((a) => {
      const htmlIssues = (a.templateHits || [])
        .filter((t) => t.hits?.length)
        .map((t) => `${t.templateId}: ${t.hits.join(', ')}`)
        .join('; ');
      return `| ${a.id} | ${a.contentHits?.length ? a.contentHits.join(', ') : '—'} | ${a.cvHits?.length ? a.cvHits.join(', ') : '—'} | ${htmlIssues || '✓'} | ${(a.rejected || []).length} |`;
    })
    .join('\n');

  const lines = [
    '# HIRELY P0 — Forbid Internal Labels in Final CV',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    `**Guard:** ${data?.guard || 'SECTION_LABEL_LEAKAGE_GUARD_V2'}`,
    '',
    '## Problem',
    '',
    'Parser section headers and internal metadata were leaking into CV body content:',
    '',
    '- `clients`, `experiences`, `education`, `summary`, `tools`, `skills`, `languages`, `identity`, `projects`',
    '- OCR/parser metadata (`Market Reviews`, `à classer`, etc.)',
    '',
    'These words must **only** appear as template-controlled section titles — never as content lines in preview or PDF.',
    '',
    '## Fix',
    '',
    '1. **`sanitizeFinalCvLabelsBeforeCommit()`** — final gate in `buildFinalResumeData()` before contract commit.',
    '2. **`stripSectionLabelLeakage()`** — strips standalone labels from experiences, education, skills, tools, languages, clients, projects, summary, identity.',
    '3. **Rejected labels → `metaSafe.debug.sectionLabelLeakage` only** — never rendered.',
    '4. **Template/PDF path** — `normalizeCvDataForTemplate()` now runs `stripSectionLabelLeakageFromCvData()` on `_fromResumeData` / `_fromFinalResumeData` cvData.',
    '',
    '## Forbidden content lines (acceptance)',
    '',
    forbidden.map((l) => `- \`${l}\``).join('\n'),
    '',
    '## Fixture audit',
    '',
    '| Fixture | finalResumeData hits | cvData hits | template HTML hits | labels rejected to debug |',
    '| --- | --- | --- | --- | --- |',
    rows || '| — | — | — | — | — |',
    '',
    '## Verification',
    '',
    '```bash',
    'npm run qa:final-cv-label-leakage',
    'npm run test:final-cv-label-leakage',
    '```',
    '',
    '## Files',
    '',
    '- `src/core/validation/section-label-leakage-guard.js` — `SECTION_LABEL_LEAKAGE_GUARD_V2`, `sanitizeFinalCvLabelsBeforeCommit`',
    '- `src/core/validation/final-resume-contract.js` — pre-commit sanitizer wired',
    '- `src/core/resume-data.js` — template cvData label strip on final/resume path',
    '- `src/core/display/undetected-label.js` — export guard includes `identity`',
    '- `src/tests/qa-final-cv-label-leakage.mjs` — QA gate + template HTML check',
    '',
  ];

  if (!qa.ok && qa.out) {
    lines.push('## QA output', '', '```', qa.out.slice(0, 4000), '```', '');
  }

  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
  console.log(`\nWrote ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
