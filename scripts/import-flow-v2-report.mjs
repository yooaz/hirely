#!/usr/bin/env node
/**
 * Import Flow V2 report — generates IMPORT_FLOW_V2.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'IMPORT_FLOW_V2.md');

const MACRO = [
  { num: 1, id: 'drop', en: 'Drop CV', fr: 'Déposer le CV', hintEn: 'PDF, Word, or text — drop your file here.' },
  { num: 2, id: 'extract', en: 'Reading your CV', fr: 'Lecture en cours', hintEn: 'We are carefully reading your document.' },
  { num: 3, id: 'review', en: 'Review detected info', fr: 'Vérifier les infos', hintEn: 'Check what we found before continuing.' },
  { num: 4, id: 'generate', en: 'Premium CV', fr: 'CV premium', hintEn: 'Pick a template and export your PDF.' },
];

const MICRO = [
  { en: 'Reading file…', fr: 'Lecture du fichier…', progress: 10 },
  { en: 'Analyzing structure…', fr: 'Analyse de la structure…', progress: 28 },
  { en: 'Detecting experience…', fr: 'Détection de l\'expérience…', progress: 48 },
  { en: 'Building CV…', fr: 'Construction du CV…', progress: 72 },
  { en: 'Generating recruiter report…', fr: 'Rapport recruteur…', progress: 92 },
];

function main() {
  const lines = [];
  lines.push('# Import Flow V2');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push('Engine: `IMPORT_FLOW_V2`');
  lines.push('');
  lines.push('## Problem');
  lines.push('');
  lines.push('The previous import experience felt **too technical** — pipeline jargon, opaque stages, and little emotional reassurance during extraction.');
  lines.push('');
  lines.push('## Solution — reassuring 4-step journey');
  lines.push('');
  lines.push('| Step | User sees | When |');
  lines.push('|------|-----------|------|');
  for (const s of MACRO) {
    lines.push(`| ${s.num} | **${s.en}** | ${s.id === 'drop' ? 'Initial upload' : s.id === 'extract' ? 'During import' : s.id === 'review' ? 'Edit / verify doc step' : 'Style / export doc step'} |`);
  }
  lines.push('');
  lines.push('## Extraction progress (Step 2)');
  lines.push('');
  lines.push('While the file is processing, users see an **animated extraction panel** with five reassuring beats:');
  lines.push('');
  for (const m of MICRO) {
    lines.push(`- ${m.en} (${m.progress}%)`);
  }
  lines.push('');
  lines.push('Reassurance line: *"Your information stays on your device. We are organizing it carefully."*');
  lines.push('');
  lines.push('## UX principles');
  lines.push('');
  lines.push('- **Plain language** — no "parser", "pipeline", or "OCR" in user-facing copy');
  lines.push('- **Visible journey** — macro stepper always shows where you are');
  lines.push('- **Forward-only progress** — steps never jump backward during load');
  lines.push('- **Patience cues** — "A few seconds depending on file size — that is normal"');
  lines.push('- **Paste escape hatch** — after 8s, hint to paste CV text');
  lines.push('');
  lines.push('## Production path');
  lines.push('');
  lines.push('```');
  lines.push('User drops file');
  lines.push('  → startImportLoadingUx()');
  lines.push('  → HirelyImportFlowV2.onImportStart()  // macro: extract');
  lines.push('  → setImportLoadingUx(file|extract|sections|recruiter|prepare)');
  lines.push('  → HirelyImportFlowV2.setMicroStep()   // 5 progress beats');
  lines.push('Import completes');
  lines.push('  → endImportLoadingUx()');
  lines.push('  → HirelyImportFlowV2.onImportEnd()    // macro: review');
  lines.push('  → setDocStep("edit")');
  lines.push('User picks template / exports');
  lines.push('  → HirelyImportFlowV2.syncDocStep("style"|"export")  // macro: generate');
  lines.push('```');
  lines.push('');
  lines.push('## Files');
  lines.push('');
  lines.push('| File | Role |');
  lines.push('|------|------|');
  lines.push('| `src/ui/product/import-flow-v2.js` | Macro + micro step orchestration |');
  lines.push('| `src/ui/product/import-flow-v2.css` | Stepper, orb animation, micro list |');
  lines.push('| `index.html` | Host markup, i18n, loading UX wiring |');
  lines.push('');
  lines.push('## Copy reference (EN / FR)');
  lines.push('');
  lines.push('### Macro steps');
  lines.push('');
  lines.push('| # | EN | FR |');
  lines.push('|---|----|----|');
  for (const s of MACRO) {
    lines.push(`| ${s.num} | ${s.en} | ${s.fr} |`);
  }
  lines.push('');
  lines.push('### Micro progress');
  lines.push('');
  lines.push('| EN | FR |');
  lines.push('|----|-----|');
  for (const m of MICRO) {
    lines.push(`| ${m.en} | ${m.fr} |`);
  }
  lines.push('');
  lines.push('## QA');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run qa:import-flow-v2');
  lines.push('npm run import-flow-v2-report');
  lines.push('```');

  fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
  console.log('Wrote', OUT);
}

main();
