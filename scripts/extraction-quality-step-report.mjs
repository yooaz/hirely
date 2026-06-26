#!/usr/bin/env node
/**
 * HIRELY P0 — Generate EXTRACTION_QUALITY_STEP_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'EXTRACTION_QUALITY_STEP_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/extraction-quality-step/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Extraction quality step\n');
  const qa = run('node', ['src/tests/qa-extraction-quality-step.mjs']);
  console.log(qa.pass ? '  PASS qa-extraction-quality-step' : '  FAIL qa-extraction-quality-step');

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
    '# HIRELY P0 — Extraction Quality Before Template',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'Template selection happened while extraction was still weak — users chose a design without knowing what was detected.',
    '',
    '## Solution',
    '',
    'Before the template picker (steps **Relire** and **Choisir un modèle**), show an extraction quality summary:',
    '',
    '| Signal | Label (detected) | Label (missing) |',
    '|--------|------------------|-----------------|',
    '| Name | Nom détecté | Nom non détecté |',
    '| Contact | Contact détecté | Contact non détecté |',
    '| Experience | Expérience détectée | Expérience non détectée |',
    '| Education | Formation détectée | Formation non détectée |',
    '| Skills | Compétences détectées | Compétences non détectées |',
    '',
    'If **name, contact, or experience** is missing:',
    '',
    '> Certaines informations doivent être vérifiées avant l\'export.',
    '',
    'Non-blocking — user can still choose a template and export.',
    '',
    '## Flow',
    '',
    '```',
    'Import → Relire (quality panel + review) → Choisir un modèle (quality panel + templates) → Export',
    '```',
    '',
    '- Templates remain **hidden** on the Relire step',
    '- Quality panel appears **above** the template grid on the Modèle step',
    '',
    '## Files',
    '',
    '- `src/ui/product/extraction-quality-step.js` — detection logic',
    '- `index.html` — `#extractionQualityStep` UI + `renderExtractionQualityStep()`',
    '',
    '## Browser verification',
    '',
    `| Check | Result |`,
    `|-------|--------|`,
    `| Panel on edit step | ${data?.browser?.editVisible ? 'PASS' : 'FAIL'} |`,
    `| Nom / Expérience / Compétences labels | ${/Expérience détectée/.test(data?.browser?.editLabels || '') ? 'PASS' : 'FAIL'} |`,
    `| Templates hidden on edit | ${data?.browser?.templateHiddenOnEdit ? 'PASS' : 'FAIL'} |`,
    `| Quality + templates on style | ${data?.browser?.styleVisible ? 'PASS' : 'FAIL'} |`,
    `| Quality before template picker | ${data?.browser?.orderOk ? 'PASS' : 'FAIL'} |`,
    `| CTA not blocked | ${data?.browser?.ctaNotBlocked ? 'PASS' : 'FAIL'} |`,
    '',
    '## Acceptance',
    '',
    pass
      ? '**PASS** — User understands what was extracted before choosing a template.'
      : '**FAIL** — See QA output above.',
    '',
    '## Run',
    '',
    '```bash',
    'npm run test:extraction-quality-step',
    '```',
    '',
  ];

  if (!qa.pass && qa.out) {
    lines.push('## QA output', '', '```', qa.out.slice(0, 8000), '```', '');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
