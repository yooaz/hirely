#!/usr/bin/env node
/**
 * P1 — Generate CREATIVE_TEMPLATE_PACK_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { PRODUCTION_TEMPLATE_DISPLAY_NAMES } from '../src/ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CREATIVE_TEMPLATE_PACK_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/creative-template-pack/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P1 — Creative template pack\n');
  const qa = run('node', ['src/tests/qa-creative-template-pack.mjs']);
  console.log(qa.pass ? '  PASS qa-creative-template-pack' : '  FAIL qa-creative-template-pack');

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
    '# HIRELY P1 — Creative Template Pack',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Pack lineup (10 templates)',
    '',
    '| # | Template | ID | Layout | Typography |',
    '|---|----------|-----|--------|------------|',
  ];

  const ids = data?.templateIds || Object.keys(PRODUCTION_TEMPLATE_DISPLAY_NAMES).slice(0, 10);
  ids.forEach((id, i) => {
    const brief = data?.briefs?.[id] || {};
    lines.push(
      `| ${i + 1} | ${brief.name || PRODUCTION_TEMPLATE_DISPLAY_NAMES[id] || id} | \`${id}\` | ${brief.grid || '—'} | ${brief.typography || '—'} |`
    );
  });

  lines.push(
    '',
    '## Requirements',
    '',
    '- **Not ATS clones** — each skin has its own grid, hierarchy, typography, and section order.',
    '- **No content loss** — all templates score 100% on `scoreAllTemplatesLock` against the same `finalResumeData`.',
    '- **Same data** — render-only; one canonical `finalResumeData` feeds every template.',
    '',
    '## Content visibility (lock scores)',
    ''
  );

  if (data?.lock) {
    lines.push('| Template | Score | Pass |');
    lines.push('|----------|-------|------|');
    for (const [id, r] of Object.entries(data.lock)) {
      lines.push(`| ${PRODUCTION_TEMPLATE_DISPLAY_NAMES[id] || id} | ${r.score}% | ${r.pass ? 'yes' : 'no'} |`);
    }
  }

  lines.push(
    '',
    '## Layout signatures',
    '',
    'Each template exposes a unique layout class (no duplicate shells):',
    ''
  );

  if (data?.signatures) {
    for (const [id, sig] of Object.entries(data.signatures)) {
      lines.push(`- **${PRODUCTION_TEMPLATE_DISPLAY_NAMES[id] || id}** → \`${sig}\``);
    }
  }

  lines.push(
    '',
    '## Files',
    '',
    '- `src/ui/templates/cv-templates.js` — layout functions + template registry',
    '- `src/ui/templates/cv-templates-pack.css` — pack typography + grid styles',
    '- `src/ui/templates/production-template-ids.mjs` — production IDs + display names',
    '- `src/ui/templates/creative-template-pack.mjs` — pack contract metadata',
    '',
    '## Acceptance',
    '',
    pass
      ? '**PASS** — 10 real premium templates with distinct layouts; no content loss on shared finalResumeData.'
      : '**FAIL** — See QA output below.',
    '',
    '## Run',
    '',
    '```bash',
    'npm run test:creative-template-pack',
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
