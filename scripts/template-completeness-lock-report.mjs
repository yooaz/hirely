#!/usr/bin/env node
/**
 * HIRELY P0 — Generate TEMPLATE_COMPLETENESS_LOCK_REPORT.md
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
const OUT = path.join(ROOT, 'TEMPLATE_COMPLETENESS_LOCK_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/template-completeness-lock/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Template completeness LOCK\n');
  const qa = run('node', ['src/tests/qa-template-completeness-lock.mjs']);
  console.log(qa.pass ? '  PASS qa-template-completeness-lock' : '  FAIL qa-template-completeness-lock');

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
    '# HIRELY P0 — Template Completeness Lock',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Rule',
    '',
    'Templates are **visual skins only**. They must never remove data.',
    '',
    '- If a section has data → render it (100% of items visible in DOM)',
    '- If a section is empty → hide the section cleanly (no empty blocks)',
    '',
    '## Lock sections',
    '',
    ...LOCK_SECTIONS.map((s) => `- ${s}`),
    '',
    '## QA method',
    '',
    'For each production template, compare **finalResumeData section counts** vs **DOM rendered counts**:',
    '',
    '| Metric | Meaning |',
    '|--------|---------|',
    '| `sourceCount` | Items in finalResumeData |',
    '| `domCount` | Items found in rendered HTML |',
    '| `domBlocks` | Section blocks in DOM (0 when empty) |',
    '',
    '**Acceptance gate: 100%** — every populated section must match exactly.',
    '',
    '## Template results',
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
  lines.push('## Source fixture counts');
  lines.push('');
  if (data?.sourceCounts) {
    lines.push('| Section | Count |');
    lines.push('|---------|------:|');
    for (const key of LOCK_SECTIONS) {
      lines.push(`| ${key} | ${data.sourceCounts[key] ?? 0} |`);
    }
    lines.push('');
  }

  lines.push('## Per-template section lock');
  lines.push('');

  for (const id of PRODUCTION_TEMPLATE_IDS) {
    const r = data?.templates?.[id];
    if (!r) continue;
    lines.push(`### ${PRODUCTION_TEMPLATE_DISPLAY_NAMES[id] || id}`);
    lines.push('');
    lines.push('| Section | Source | DOM | Blocks | Status |');
    lines.push('|---------|-------:|----:|-------:|--------|');
    for (const key of LOCK_SECTIONS) {
      const sec = r.sections?.[key];
      if (!sec) continue;
      const status = sec.pass ? 'PASS' : 'FAIL';
      if (sec.skipped) {
        lines.push(`| ${key} | 0 | 0 | ${sec.domBlocks} | skip |`);
      } else {
        lines.push(
          `| ${key} | ${sec.sourceCount} | ${sec.domCount} | ${sec.domBlocks} | ${status} |`
        );
      }
    }
    lines.push('');
  }

  lines.push('## Implementation');
  lines.push('');
  lines.push('| Piece | Path |');
  lines.push('|-------|------|');
  lines.push('| Lock scorer | `src/ui/templates/template-completeness.js` |');
  lines.push('| QA gate | `src/tests/qa-template-completeness-lock.mjs` |');
  lines.push('| Content never gated on final resume | `cv-templates.js` |');
  lines.push('');
  lines.push('## Gate');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run test:template-completeness-lock');
  lines.push('```');
  lines.push('');
  lines.push('## QA output');
  lines.push('');
  lines.push('```');
  lines.push(qa.out?.slice(0, 8000) || '(no output)');
  lines.push('```');
  lines.push('');

  if (!pass) {
    lines.push('## Blockers');
    lines.push('');
    for (const id of PRODUCTION_TEMPLATE_IDS) {
      const r = data?.templates?.[id];
      if (r?.pass) continue;
      lines.push(`- **${id}** — ${r?.score ?? 0}%`);
      for (const key of LOCK_SECTIONS) {
        const sec = r?.sections?.[key];
        if (sec && !sec.pass) {
          lines.push(`  - ${key}: source ${sec.sourceCount} → dom ${sec.domCount} (blocks ${sec.domBlocks})`);
        }
      }
    }
    lines.push('');
  }

  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
  console.log(`\nWrote ${OUT}`);
  console.log(pass ? '\nTEMPLATE COMPLETENESS LOCK PASS' : '\nTEMPLATE COMPLETENESS LOCK FAIL');
  process.exit(pass ? 0 : 1);
}

main();
