#!/usr/bin/env node
/**
 * HIRELY UX P1 — Import loading UX report.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'IMPORT_LOADING_UX_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/import-loading-ux/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY UX P1 — Import loading experience\n');
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
    '# HIRELY UX P1 — Import Loading Experience',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Goal',
    '',
    'During CV import, the user always sees what Hirely is doing — no blank wait, no technical errors.',
    '',
    '## Loading steps (French product copy)',
    '',
    '| Step | Label | Explanation |',
    '|------|-------|-------------|',
    '| 1 | Lecture du fichier… | Nous ouvrons votre PDF, Word ou fichier texte. |',
    '| 2 | Extraction du texte… | Nous récupérons le contenu de votre CV. |',
    '| 3 | Analyse des sections… | Expérience, formation, compétences et coordonnées. |',
    '| 4 | Création du CV propre… | Nous structurons votre parcours pour l\'aperçu. |',
    '| 5 | Préparation de l\'aperçu… | Dernières vérifications avant affichage. |',
    '',
    '## UX elements',
    '',
    '- Progress bar (visible during `wsImport--loading`)',
    '- Step title (`#importLiveStatus`)',
    '- Short explanation (`#importLoadingDetail`)',
    '- Estimated wait: *Cela peut prendre 10 à 30 secondes selon le fichier.*',
    '- After **8s**: *Vous pouvez aussi coller le texte du CV.* (`#importLoadingPasteHint`)',
    '',
    '## Scope',
    '',
    '- **UI only** — `index.html` + CSS',
    '- No OCR/parser pipeline changes',
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
  lines.push(`| Command | Status |`);
  lines.push(`|---------|--------|`);
  lines.push(`| \`npm run qa:import-loading-ux\` | ${qa.pass ? 'PASS' : 'FAIL'} |`);
  lines.push('');
  lines.push('```bash');
  lines.push('npm run import-loading-ux-report');
  lines.push('```');

  if (!pass) {
    lines.push('');
    lines.push('## Blockers');
    lines.push('');
    if (!qa.pass) lines.push('- `qa-import-loading-ux` failed');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  console.log(pass ? '\nUX P1 PASS' : '\nUX P1 FAIL');
  process.exit(pass ? 0 : 1);
}

main();
