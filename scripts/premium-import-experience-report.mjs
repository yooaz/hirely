#!/usr/bin/env node
/**
 * HIRELY P2 — Generate PREMIUM_IMPORT_EXPERIENCE_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PREMIUM_IMPORT_EXPERIENCE_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/premium-import-experience/report.json');

const STEPS = [
  {
    id: 'file',
    en: 'Reading document',
    fr: 'Lecture du document',
    detailFr: 'Nous ouvrons votre PDF, Word ou fichier texte.',
  },
  {
    id: 'extract',
    en: 'Extracting content',
    fr: 'Extraction du contenu',
    detailFr: 'Nous récupérons le contenu de votre CV.',
  },
  {
    id: 'sections',
    en: 'Organizing sections',
    fr: 'Organisation des sections',
    detailFr: 'Expérience, formation, compétences et coordonnées.',
  },
  {
    id: 'prepare',
    en: 'Preparing your CV',
    fr: 'Préparation de votre CV',
    detailFr: 'Nous structurons votre profil pour l\'aperçu.',
  },
];

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P2 — Premium import experience\n');
  const qa = run('node', ['src/tests/qa-premium-import-experience.mjs']);
  console.log(qa.pass ? '  PASS qa-premium-import-experience' : '  FAIL qa-premium-import-experience');

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
    '# HIRELY P2 — Premium Import Experience',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'The import flow felt technical — opaque loading, pipeline jargon, and errors that did not help users continue.',
    '',
    '## Solution',
    '',
    'A four-step premium import experience with human copy, a visible progress bar, and stage detail that follows real pipeline events.',
    '',
    '### Four steps',
    '',
    '| # | Stage | English | Français |',
    '|---|-------|---------|----------|',
    ...STEPS.map((s, i) => `| ${i + 1} | \`${s.id}\` | ${s.en} | ${s.fr} |`),
    '',
    '### What users see',
    '',
    '- **Step label** — active stage name in `#importLiveStatus` / `#cvLoadingLabel`',
    '- **Real message** — short explanation in `#importLoadingDetail`',
    '- **Progress bar** — tied to stage (`12% → 35% → 62% → 92%`)',
    '- **Estimated wait** — `#importLoadingWait`',
    '- **After 8s** — paste hint: *Vous pouvez aussi coller le texte du CV.*',
    '- **On timeout** — paste fallback: *Lecture automatique incomplète. Collez le texte pour continuer.*',
    '',
    '### Real progress (not fake spinners)',
    '',
    'Pipeline log steps advance the UI when loading is active:',
    '',
    '| Event | Stage |',
    '|-------|-------|',
    '| `IMPORT_STARTED`, `FILE_SELECTED` | Reading document |',
    '| `EXTRACTION_STARTED`, `PDF_NATIVE_FIRST` | Extracting content |',
    '| `EXTRACTION_DONE`, `PARSER_STARTED`, `IMPORT_PARSING` | Organizing sections |',
    '| `PARSER_DONE`, `RENDER_STARTED`, `FINAL_RESUME_READY` | Preparing your CV |',
    '',
    'Timer-based fallbacks still run if OCR is slow, but **forward-only** progress prevents stages from jumping backward.',
    '',
    '### Never loading forever',
    '',
    '| Guard | Value | Behavior |',
    '|-------|-------|----------|',
    '| `importRaceTimeout` | 20s (text/docx), 180s (PDF/OCR) | Always resolves to paste fallback or review |',
    '| `IMPORT_LOADING_PASTE_MS` | 8s | Paste hint during loading |',
    '| `OCR_UX_FULL_FALLBACK_MS` | 20s | Full paste panel for slow OCR |',
    '',
    '### Never technical errors',
    '',
    '- `userFacingImportError()` maps `PDF_EXTRACTION_TIMEOUT`, `OCR_TIMEOUT`, `IMPORT_STUCK`, stack traces → friendly paste message',
    '- `importPipelineFail` toast removed from consumer import paths',
    '- Users always get a next action (paste text), not error codes',
    '',
    '## Implementation',
    '',
    '| Piece | Location |',
    '|-------|----------|',
    '| Stage stepper | `src/ui/product/import-analysis-stages.js` |',
    '| Stage styles | `src/ui/product/import-analysis-stages.css` |',
    '| Loading orchestration | `index.html` — `startImportLoadingUx`, `setImportLoadingUx`, `IMPORT_LOG_TO_UX` |',
    '| Pipeline phase hook | `index.html` — `setImportPhaseUi`, `IMPORT_PHASE_TO_UX` |',
    '',
    '## QA',
    '',
    '```',
    qa.out || '(no output)',
    '```',
    '',
    '```bash',
    'npm run test:premium-import-experience',
    '```',
    '',
  ];

  if (!pass) {
    lines.push('## Blockers');
    lines.push('');
    if (!qa.pass) lines.push('- `qa-premium-import-experience` failed');
  }

  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
  console.log(`\nWrote ${OUT}`);
  console.log(pass ? '\nPREMIUM IMPORT EXPERIENCE PASS' : '\nPREMIUM IMPORT EXPERIENCE FAIL');
  process.exit(pass ? 0 : 1);
}

main();
