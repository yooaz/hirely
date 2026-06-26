#!/usr/bin/env node
/**
 * HIRELY UX — Import progress experience report.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'IMPORT_PROGRESS_UX_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/import-loading-ux/report.json');

const STAGES = [
  {
    id: 'file',
    label: 'Lecture du document',
    detail: 'Nous ouvrons votre PDF, Word ou fichier texte.',
  },
  {
    id: 'extract',
    label: 'Extraction du contenu',
    detail: 'Nous récupérons le contenu de votre CV.',
  },
  {
    id: 'sections',
    label: 'Organisation des sections',
    detail: 'Expérience, formation, compétences et coordonnées.',
  },
  {
    id: 'prepare',
    label: 'Préparation de votre CV',
    detail: 'Nous structurons votre profil pour l\'aperçu.',
  },
];

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY UX — Import progress experience\n');
  const qa = run('node', ['src/tests/qa-import-loading-ux.mjs']);
  console.log(qa.pass ? '  PASS qa-import-loading-ux' : '  FAIL qa-import-loading-ux');

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
    '# HIRELY UX — Import Progress Experience',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Goal',
    '',
    'During CV import, the user always sees four clear stages with label, short explanation, progress bar, and estimated wait — never technical error text.',
    '',
    '## Four stages (French product copy)',
    '',
    '| # | Stage | Label | Explanation |',
    '|---|-------|-------|-------------|',
    ...STAGES.map((s, i) => `| ${i + 1} | \`${s.id}\` | ${s.label} | ${s.detail} |`),
    '',
    '## UX elements',
    '',
    '- **Progress bar** — visible while `#wsImport` has `wsImport--loading`',
    '- **Stage stepper** — `#importAnalysisStages` (4 items via `import-analysis-stages.js`)',
    '- **Active stage label** — `#importLiveStatus` / `#cvLoadingLabel`',
    '- **Short explanation** — `#importLoadingDetail` (active stage detail)',
    '- **Estimated wait** — `#importLoadingWait`: *Cela peut prendre quelques secondes selon le fichier.*',
    '- **After 8s** — `#importLoadingPasteHint`: *Vous pouvez aussi coller le texte du CV.*',
    '- **On timeout / incomplete read** — paste fallback panel: *Lecture automatique incomplète. Collez le texte pour continuer.*',
    '',
    '## Timers',
    '',
    '| Timer | Value | Behavior |',
    '|-------|-------|----------|',
    '| `IMPORT_LOADING_PASTE_MS` | 8s | Show paste hint during loading |',
    '| OCR full fallback | 20s | Show paste fallback panel (OCR logic unchanged) |',
    '',
    '## Error handling (UI only)',
    '',
    '- `userFacingImportError()` maps technical codes (`PDF_EXTRACTION_TIMEOUT`, `OCR_TIMEOUT`, stack errors, etc.) to the friendly timeout message.',
    '- `show(t(\'importPipelineFail\')…)` removed from import failure paths — users see paste fallback instead.',
    '',
    '## Scope',
    '',
    '- **Changed:** `index.html` (import loading orchestration + copy), `src/ui/product/import-analysis-stages.js`, `src/ui/product/import-analysis-stages.css`',
    '- **Not changed:** OCR pipeline, parser, templates, scoring, pricing',
    '',
    '## QA checks',
    '',
    '| Check | Status |',
    '|-------|--------|',
  ];

  for (const c of data?.checks || []) {
    lines.push(`| ${c.label || c.id} | ${c.pass ? 'PASS' : 'FAIL'} |`);
  }

  lines.push('');
  lines.push('## Gate');
  lines.push('');
  lines.push('| Command | Status |');
  lines.push('|---------|--------|');
  lines.push(`| \`npm run test:import-progress-ux\` | ${qa.pass ? 'PASS' : 'FAIL'} |`);
  lines.push('');
  lines.push('```bash');
  lines.push('npm run test:import-progress-ux');
  lines.push('```');

  if (!pass) {
    lines.push('');
    lines.push('## Blockers');
    lines.push('');
    if (!qa.pass) lines.push('- `qa-import-loading-ux` failed');
    if (qa.out) {
      lines.push('');
      lines.push('```');
      lines.push(qa.out.slice(0, 4000));
      lines.push('```');
    }
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  console.log(pass ? '\nIMPORT PROGRESS UX PASS' : '\nIMPORT PROGRESS UX FAIL');
  process.exit(pass ? 0 : 1);
}

main();
