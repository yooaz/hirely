#!/usr/bin/env node
/**
 * HIRELY P0 — Generate TEMPLATE_CONTENT_VISIBILITY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  PRODUCTION_TEMPLATE_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
} from '../src/ui/templates/production-template-ids.mjs';
import { LOCK_SECTIONS } from '../src/ui/templates/template-completeness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'TEMPLATE_CONTENT_VISIBILITY_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/template-content-visibility/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Template content visibility\n');
  const qa = run('node', ['src/tests/qa-template-content-visibility.mjs']);
  console.log(qa.pass ? '  PASS qa-template-content-visibility' : '  FAIL qa-template-content-visibility');

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
    '# HIRELY P0 — Template Content Visibility',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'Switching templates (e.g. Modern Editorial) hid populated sections — experience, clients, and education disappeared while only tools/languages remained in the sidebar.',
    '',
    '## Rules',
    '',
    'Every production template must render all available data:',
    '',
    ...LOCK_SECTIONS.map((s) => `- ${s}`),
    '',
    '- If a section has data → it must appear in the DOM',
    '- If the page is too long → A4 pagination creates page 2+ (never clip or hide)',
    '- Switching template must never remove CV content',
    '',
    '## Root cause',
    '',
    '1. `normalizeCvDataForTemplate()` stripped `_fromFinalResumeData`, so templates treated canonical CV data like low-confidence parser preview.',
    '2. Production `fieldRenderable()` and `filterSectionByConfidence()` aggressively dropped lines when the final-resume flag was missing.',
    '',
    '## Fix',
    '',
    '- Preserve `_fromFinalResumeData` / `_fromResumeData` through template normalization',
    '- In production template mode: never filter sections by confidence; show all populated fields',
    '- Recognize `_fromResumeData` as canonical render input in templates',
    '',
    '## Production path verification',
    '',
    `| Flag | Preserved |`,
    `|------|-----------|`,
    `| \`_fromFinalResumeData\` | ${data?.productionFlags?._fromFinalResumeData ? 'yes' : 'no'} |`,
    `| \`_fromResumeData\` | ${data?.productionFlags?._fromResumeData ? 'yes' : 'no'} |`,
    '',
    '## Template switch results (production normalize → render)',
    '',
    '| Template | Visibility score | Status |',
    '|----------|------------------|--------|',
  ];

  for (const id of PRODUCTION_TEMPLATE_IDS) {
    const label = PRODUCTION_TEMPLATE_DISPLAY_NAMES[id] || id;
    const score = data?.templateSwitchScores?.[id] ?? data?.templates?.[id]?.score ?? '—';
    const tplPass = data?.templates?.[id]?.pass;
    lines.push(`| ${label} (\`${id}\`) | ${score}% | ${tplPass ? 'PASS' : 'FAIL'} |`);
  }

  lines.push(
    '',
    '## Modern Editorial checks',
    '',
    '| Check | Result |',
    '|-------|--------|',
    `| Experience section | ${data?.editorialChecks?.experienceSection ? 'PASS' : 'FAIL'} |`,
    `| Clients section | ${data?.editorialChecks?.clientsSection ? 'PASS' : 'FAIL'} |`,
    `| Education section | ${data?.editorialChecks?.educationSection ? 'PASS' : 'FAIL'} |`,
    `| Tools content | ${data?.editorialChecks?.toolsContent ? 'PASS' : 'FAIL'} |`,
    `| Languages content | ${data?.editorialChecks?.languagesContent ? 'PASS' : 'FAIL'} |`,
    '',
    '## Acceptance',
    '',
    pass
      ? '**PASS** — Switching template does not remove CV content; all populated sections render across production templates.'
      : '**FAIL** — See QA output above.',
    '',
    '## Commands',
    '',
    '```bash',
    'npm run test:template-content-visibility',
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
