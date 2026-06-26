#!/usr/bin/env node
/**
 * HIRELY P0 — Generate CLEAR_FLOW_NAVIGATION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CLEAR_FLOW_NAVIGATION_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/clear-flow-navigation/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Clear flow navigation\n');
  const qa = run('node', ['src/tests/qa-clear-flow-navigation.mjs']);
  console.log(qa.pass ? '  PASS qa-clear-flow-navigation' : '  FAIL qa-clear-flow-navigation');

  let data = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      data = null;
    }
  }

  const pass = qa.pass && data?.pass;
  const snap = data?.snap || {};

  const lines = [
    '# HIRELY P0 — Clear Flow Navigation',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Requirement',
    '',
    'Users must always know the next click after import:',
    '',
    '| Step | Title | Primary action |',
    '|------|-------|----------------|',
    '| 1 | Importer | Upload / paste CV |',
    '| 2 | Relire | **Choisir un modèle** |',
    '| 3 | Choisir un modèle | **Exporter ce CV** |',
    '| 4 | Exporter | A4 preview + **Télécharger PDF** |',
    '',
    '## Implementation',
    '',
    '| Change | Location |',
    '|--------|----------|',
    '| 4-step progress nav (import → relire → modèle → export) | `#docNav` in `index.html` |',
    '| Primary CTA bar per step | `#flowPrimaryCta` in `docFooter` |',
    '| Step headers | `#resumeStudioHead`, `#styleStepHead`, `#exportStepHead` |',
    '| Template picker only on style step | `syncResumeStudioChrome()` |',
    '| PDF bar only on export step | `cvExportBar` + CSS |',
    '',
    '## Browser snapshot',
    '',
    '| Check | Value |',
    '|-------|-------|',
    `| Nav steps | ${snap.nav?.count ?? '—'} |`,
    `| Review CTA | ${snap.review?.label ?? '—'} |`,
    `| Style CTA | ${snap.style?.cta ?? '—'} |`,
    `| Export PDF btn | ${snap.export?.pdfBtn ?? '—'} |`,
    `| A4 preview height | ${snap.export?.a4H ? `${snap.export.a4H}px` : '—'} |`,
    '',
    '## Gate',
    '',
    '```bash',
    'npm run test:clear-flow-navigation',
    '```',
    '',
    '## Acceptance',
    '',
    `- [${pass ? 'x' : ' '}] 4 visible steps in progress nav`,
    `- [${snap.review?.visible ? 'x' : ' '}] After review: primary « Choisir un modèle »`,
    `- [${/exporter/i.test(snap.style?.cta || '') ? 'x' : ' '}] After template: primary « Exporter ce CV »`,
    `- [${snap.export?.previewVisible ? 'x' : ' '}] Export: full A4 preview + Télécharger PDF`,
    '',
  ];

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
