#!/usr/bin/env node
/**
 * HIRELY P0 — Generate TEMPLATE_COMPLETENESS_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { PRODUCTION_TEMPLATE_IDS, PRODUCTION_TEMPLATE_DISPLAY_NAMES } from '../src/ui/templates/production-template-ids.mjs';
import { REQUIRED_CONTENT_SECTIONS } from '../src/ui/templates/template-completeness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'TEMPLATE_COMPLETENESS_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/template-completeness/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Template completeness\n');
  const qa = run('node', ['src/tests/qa-template-completeness.mjs']);
  console.log(qa.pass ? '  PASS qa-template-completeness' : '  FAIL qa-template-completeness');

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
    '# HIRELY P0 — Template System Completeness',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Principle',
    '',
    '**Content first.** Templates adapt to content — never the reverse.',
    '',
    '- Nothing may disappear',
    '- Nothing may be clipped',
    '- Nothing may overflow (preview uses `overflow: visible` + wrap)',
    '',
    '## Required sections (when data exists)',
    '',
    ...REQUIRED_CONTENT_SECTIONS.map((s) => `- ${s}`),
    '',
    '## Template completeness score',
    '',
    'Each production template is rendered with a rich profile (all sections + low confidence flags).',
    'Score = visible data items ÷ expected items × 100. **Gate: 100%.**',
    '',
    '| Template | Score | Status |',
    '|----------|-------|--------|',
  ];

  for (const id of PRODUCTION_TEMPLATE_IDS) {
    const r = data?.templates?.[id];
    const label = PRODUCTION_TEMPLATE_DISPLAY_NAMES[id] || id;
    lines.push(`| ${label} (\`${id}\`) | ${r?.score ?? '—'}% | ${r?.pass ? 'PASS' : 'FAIL'} |`);
  }

  lines.push('');
  lines.push('## Section breakdown');
  lines.push('');

  for (const id of PRODUCTION_TEMPLATE_IDS) {
    const r = data?.templates?.[id];
    if (!r) continue;
    lines.push(`### ${PRODUCTION_TEMPLATE_DISPLAY_NAMES[id] || id}`);
    lines.push('');
    lines.push('| Section | Visible | Expected | % |');
    lines.push('|---------|---------|----------|---|');
    for (const key of REQUIRED_CONTENT_SECTIONS) {
      const sec = r.sections?.[key];
      if (!sec || sec.skipped) {
        lines.push(`| ${key} | — | 0 | skip |`);
        continue;
      }
      lines.push(`| ${key} | ${sec.visible} | ${sec.expected} | ${sec.pct}% |`);
    }
    lines.push('');
  }

  lines.push('## Implementation');
  lines.push('');
  lines.push('| Change | Location |');
  lines.push('|--------|----------|');
  lines.push('| Completeness scorer | `src/ui/templates/template-completeness.js` |');
  lines.push('| Final-resume content never gated by confidence | `cv-templates.js` → `filterSectionByConfidence` |');
  lines.push('| Full summary in header (no 220-char clip) | `cv-templates.js` → `cvLead` |');
  lines.push('| Executive Minimal shows tools | `executive-minimal` render opts |');
  lines.push('| Preview overflow visible | `cv-templates-professional.css` |');
  lines.push('');
  lines.push('## Gate');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run test:template-completeness');
  lines.push('```');
  lines.push('');
  lines.push('## QA output');
  lines.push('');
  lines.push('```');
  lines.push(qa.out?.slice(0, 6000) || '(no output)');
  lines.push('```');
  lines.push('');

  if (!pass) {
    lines.push('## Blockers');
    lines.push('');
    for (const id of PRODUCTION_TEMPLATE_IDS) {
      const r = data?.templates?.[id];
      if (r?.pass) continue;
      lines.push(`- **${id}** — score ${r?.score ?? 0}%`);
      for (const key of REQUIRED_CONTENT_SECTIONS) {
        const sec = r?.sections?.[key];
        if (sec && !sec.skipped && !sec.pass) {
          lines.push(`  - ${key}: ${sec.visible}/${sec.expected}`);
        }
      }
    }
    lines.push('');
  }

  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
  console.log(`\nWrote ${OUT}`);
  console.log(pass ? '\nTEMPLATE COMPLETENESS PASS' : '\nTEMPLATE COMPLETENESS FAIL');
  process.exit(pass ? 0 : 1);
}

main();
