#!/usr/bin/env node
/**
 * P1 — Generate REAL_PREMIUM_TEMPLATES_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { PRODUCTION_TEMPLATE_IDS } from '../src/ui/templates/production-template-ids.mjs';
import { PREMIUM_TEMPLATE_BRIEFS } from '../src/ui/templates/template-system-premium.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'REAL_PREMIUM_TEMPLATES_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/real-premium-templates/report.json');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P1 — Real premium templates\n');
  const qa = run('node', ['src/tests/qa-real-premium-templates.mjs']);
  console.log(qa.pass ? '  PASS qa-real-premium-templates' : '  FAIL qa-real-premium-templates');

  let data = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      data = null;
    }
  }

  const pass = qa.pass && data?.pass;
  const templateRows = PRODUCTION_TEMPLATE_IDS.map((id) => {
    const b = PREMIUM_TEMPLATE_BRIEFS[id] || {};
    const t = data?.templates?.find((x) => x.id === id);
    return `| ${b.name || id} | \`${id}\` | ${b.tagline || '—'} | ${b.feel || '—'} | ${t?.visibilityScore ?? '—'}% | ${t?.visibilityPass ? 'PASS' : 'FAIL'} |`;
  }).join('\n');

  const checkRows = (data?.checks || [])
    .map((c) => `| ${c.name} | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`)
    .join('\n');

  const lines = [
    '# HIRELY P1 — Real Premium Templates',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Goal',
    '',
    'Five production templates that feel **clearly different** — same `finalResumeData`, render-only, A4-safe, PDF-safe, no hidden sections.',
    '',
    '## Premium lineup',
    '',
    '| Template | ID | Positioning | Visual feel | Visibility | QA |',
    '|----------|-----|-------------|-------------|------------|-----|',
    templateRows,
    '',
    '## Rules (enforced)',
    '',
    '| Rule | Implementation |',
    '|------|----------------|',
    '| No parser logic | Templates render `finalResumeData` only; review/pending UI gated off in production |',
    '| Same data | All skins use `mapFinalResumeToCvData` → `HirelyTemplates.render` |',
    '| A4 safe | `cv-a4-pages.js` paginates overflow (page 2+) |',
    '| PDF safe | `cv-pdf-export.css` — visible overflow, per-template print grids |',
    '| No hidden sections | P0 content visibility lock — 100% section parity |',
    '| No cropped content | No `overflow: hidden` on CV surfaces; multi-page export |',
    '',
    '## Differentiation axes',
    '',
    '| Template | Grid | Typography | Section priority |',
    '|----------|------|------------|------------------|',
    '| ATS Clean | Single column | IBM Plex Sans | Linear recruiter scan |',
    '| Creative Portfolio | Magazine split head | Playfair + DM Sans | Clients (chips) → projects → experience |',
    '| Executive Minimal | Centered narrow | Cormorant + Source Serif | Compact single column |',
    '| Tech Resume | 30/70 dark rail | JetBrains Mono + DM Sans | Skills/tools sidebar · experience main |',
    '| Editorial Modern | 34/66 asymmetric | Helvetica Neue + Georgia | Meta rail · experience main |',
    '',
    '## Files',
    '',
    '- `src/ui/templates/cv-templates.js` — layout renderers',
    '- `src/ui/templates/cv-templates-h20.css` — premium typography & spacing',
    '- `src/ui/templates/cv-pdf-export.css` — print/PDF rules',
    '- `src/ui/templates/template-system-premium.mjs` — P1 contract + briefs',
    '- `src/ui/templates/production-template-ids.mjs` — canonical IDs',
    '',
    '## Acceptance checks',
    '',
    '| Check | Result | Detail |',
    '|-------|--------|--------|',
    checkRows || '| — | — | Run qa-real-premium-templates |',
    '',
    '## Run',
    '',
    '```bash',
    'npm run test:real-premium-templates',
    '```',
    '',
    '## Acceptance',
    '',
    pass
      ? '**PASS** — Five distinct premium templates ship with full content visibility and A4/PDF-safe output.'
      : '**FAIL** — See QA output above.',
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
