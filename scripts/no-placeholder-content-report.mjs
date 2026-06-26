#!/usr/bin/env node
/**
 * P0 — Generate NO_PLACEHOLDER_CONTENT_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'NO_PLACEHOLDER_CONTENT_REPORT.md');
const JSON_PATH = path.join(ROOT, 'tests/output/no-placeholder-content/report.json');

function run(script) {
  const r = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout || ''}\n${r.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — No placeholder content in final CV\n');
  const qa = run('src/tests/qa-no-placeholder-content.mjs');
  console.log(qa.ok ? '  PASS qa-no-placeholder-content' : '  FAIL qa-no-placeholder-content');

  let data = null;
  try {
    if (fs.existsSync(JSON_PATH)) data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  } catch {
    data = null;
  }

  const pass = qa.ok && data?.pass;
  const forbidden = data?.forbidden || FINAL_CV_FORBIDDEN_PLACEHOLDERS_FALLBACK();

  const rows = (data?.audits || [])
    .map((a) => {
      const htmlIssues = (a.templateHits || [])
        .filter((t) => t.hits?.length)
        .map((t) => `${t.templateId}: ${t.hits.join(', ')}`)
        .join('; ');
      return `| ${a.id} | ${a.contentHits?.length ? a.contentHits.join(', ') : '—'} | ${a.cvHits?.length ? a.cvHits.join(', ') : '—'} | ${htmlIssues || '✓'} | ${a.reviewItems} |`;
    })
    .join('\n');

  const lines = [
    '# HIRELY P0 — No Placeholder Content in Final CV',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    `**Guard:** ${data?.guard || 'FINAL_CV_PLACEHOLDER_GUARD_V1'}`,
    '',
    '## Problem',
    '',
    'Final CV preview and PDF were rendering uncertain parser placeholders as real content, e.g.:',
    '',
    '- `Company à confirmer - 2011-2014`',
    '- `Information non détectée`',
    '- `Nom à confirmer`',
    '',
    '## Rules (locked)',
    '',
    'If company (or role/date) is unknown:',
    '',
    '1. **Do not** render the experience in final CV',
    '2. **Move** it to `reviewQueue` / review panel',
    '3. Show `Entreprise à confirmer` **only** in the review panel',
    '4. **Never** in CV preview or PDF',
    '',
    '## Forbidden placeholder strings',
    '',
    forbidden.map((l) => `- \`${l}\``).join('\n'),
    '',
    '## Fix',
    '',
    '1. **`sanitizeFinalCvPlaceholdersBeforeCommit()`** — final gate in `buildFinalResumeData()`',
    '2. Unknown-company experiences → review items with reason `Entreprise à confirmer`',
    '3. **`stripPlaceholderContentFromCvData()`** on template/PDF cvData path',
    '4. Source fix: `experience-reconstruction-engine-v2.js` no longer injects `Company à confirmer`',
    '5. Template defense: block `à confirmer` lines; no identity placeholders on final-resume render',
    '',
    '## Fixture audit',
    '',
    '| Fixture | finalResumeData hits | cvData hits | template HTML hits | review items |',
    '| --- | --- | --- | --- | --- |',
    rows || '| — | — | — | — | — |',
    '',
    '## Verification',
    '',
    '```bash',
    'npm run qa:no-placeholder-content',
    'npm run test:no-placeholder-content',
    '```',
    '',
    '## Files',
    '',
    '- `src/core/validation/final-cv-placeholder-guard.js`',
    '- `src/core/validation/final-resume-contract.js`',
    '- `src/core/resume-data.js`',
    '- `src/core/parsing/experience-reconstruction-engine-v2.js`',
    '- `src/ui/templates/cv-templates.js`',
    '- `src/tests/qa-no-placeholder-content.mjs`',
    '',
  ];

  if (!qa.ok && qa.out) {
    lines.push('## QA output', '', '```', qa.out.slice(0, 4000), '```', '');
  }

  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
  console.log(`\nWrote ${OUT}`);
  process.exit(pass ? 0 : 1);
}

function FINAL_CV_FORBIDDEN_PLACEHOLDERS_FALLBACK() {
  return [
    'Information non détectée',
    'Nom à confirmer',
    'Company à confirmer',
    'Entreprise à confirmer',
    'Role à confirmer',
    'Date à confirmer',
  ];
}

main();
