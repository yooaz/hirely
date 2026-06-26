#!/usr/bin/env node
/**
 * P1 — Generate GRAPHIC_TEMPLATE_PACK_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'GRAPHIC_TEMPLATE_PACK_REPORT.md');
const JSON_PATH = path.join(ROOT, 'tests/output/graphic-template-pack/report.json');

function run(script) {
  const r = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout || ''}\n${r.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P1 — Graphic template pack audit\n');

  const checks = [
    ['qa-graphic-template-pack', 'src/tests/qa-graphic-template-pack.mjs'],
    ['qa-template-completeness-lock', 'src/tests/qa-template-completeness-lock.mjs'],
  ];

  const results = checks.map(([id, script]) => {
    const r = run(script);
    console.log(r.ok ? `  PASS ${id}` : `  FAIL ${id}`);
    return { id, ok: r.ok };
  });

  let data = null;
  try {
    if (fs.existsSync(JSON_PATH)) data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  } catch {
    data = null;
  }

  const pass = results.every((r) => r.ok) && data?.pass;

  const templateRows = (data?.galleryIds || [])
    .map((id) => {
      const lock = data?.lock?.[id];
      const brief = data?.briefs?.[id];
      return `| ${brief?.name || id} | \`${id}\` | ${brief?.grid || '—'} | ${brief?.typography || '—'} | ${lock?.pass ? '✓' : '✗'} ${lock?.score ?? '—'}% |`;
    })
    .join('\n');

  const lines = [
    '# HIRELY P1 — Graphic Template Pack',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'Templates needed stronger visual differentiation without hiding `finalResumeData` sections — especially clients and projects on multi-page PDFs.',
    '',
    '## Rules (locked)',
    '',
    '| Rule | Implementation |',
    '|------|----------------|',
    '| Same `finalResumeData` for all templates | `resumeDataToCvData` → `normalizeProfile` → layout functions |',
    '| No content hidden | `template-completeness.js` content lock per template |',
    '| Multi-page safe | `cv-a4-pages.js` splittable sections include clients/projects |',
    '| Clients + projects visible | Dedicated `clientsSection` / `projectsSection` in every layout |',
    '| No giant empty areas | Compact grid gaps; no min-height filler blocks |',
    '| PDF safe | Same DOM after A4 layout; `cv-pdf-export.css` overrides |',
    '',
    '## Graphic pack (8 templates)',
    '',
    '| Template | ID | Grid | Typography | Content lock |',
    '|----------|-----|------|------------|:------------:|',
    templateRows || '| — | — | — | — | — |',
    '',
    '## Visual differentiation (2-second scan)',
    '',
    '| Template | Visual cue |',
    '|----------|------------|',
    '| ATS Clean | Classic single column, recruiter meta footer |',
    '| Creative Portfolio | Purple hero split, client chips first |',
    '| Editorial Magazine | 3-column masthead, double rule |',
    '| Luxury Minimal | Narrow centered, stone + Cormorant caps |',
    '| Agency Designer | Dark header band, rose accent rail |',
    '| Visual Timeline | Teal chrono rail + mono dates |',
    '| Tech Structured | IBM Plex, blue skills rail |',
    '| Art Director Portfolio | Red split grid, bold uppercase name |',
    '',
    '## Automated checks',
    '',
    '| Suite | Result |',
    '|-------|--------|',
    ...results.map((r) => `| ${r.id} | ${r.ok ? 'PASS' : 'FAIL'} |`),
    '',
    '## Acceptance',
    '',
    pass
      ? [
          '- All 8 templates render clients, projects, and portfolio when data exists',
          '- Content lock passes for every gallery template',
          '- 8 unique layout signatures (visually distinct in 2 seconds)',
          '- Multi-page A4 + PDF export CSS present',
        ].join('\n')
      : '- One or more checks failed — see suite table above.',
    '',
    '## Run',
    '',
    '```bash',
    'npm run qa:graphic-template-pack',
    'npm run test:graphic-template-pack',
    '```',
    '',
  ];

  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
  console.log(`\nReport: ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
