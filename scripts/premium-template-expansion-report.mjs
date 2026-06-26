#!/usr/bin/env node
/**
 * P1 — Generate PREMIUM_TEMPLATE_EXPANSION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  PRODUCTION_TEMPLATE_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
} from '../src/ui/templates/production-template-ids.mjs';
import { CREATIVE_PACK_BRIEFS } from '../src/ui/templates/creative-template-pack.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PREMIUM_TEMPLATE_EXPANSION_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/premium-template-expansion/report.json');

function runQa(script) {
  const res = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P1 — Premium template expansion\n');
  const pack = runQa('src/tests/qa-creative-template-pack.mjs');
  const expansion = runQa('src/tests/qa-premium-template-expansion.mjs');
  console.log(pack.pass ? '  PASS qa-creative-template-pack' : '  FAIL qa-creative-template-pack');
  console.log(expansion.pass ? '  PASS qa-premium-template-expansion' : '  FAIL qa-premium-template-expansion');

  let data = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      data = null;
    }
  }

  const pass = pack.pass && expansion.pass && data?.pass;

  const lines = [
    '# HIRELY P1 — Premium Template Expansion',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'Premium templates felt too similar — same grids, typography, and section order. Creative CVs need distinct visual identities while rendering **all** content (clients, projects, portfolio links, experience, education, skills).',
    '',
    '## Expansion lineup (10 templates)',
    '',
    '| # | Template | ID | Grid | Typography |',
    '|---|----------|-----|------|------------|',
  ];

  PRODUCTION_TEMPLATE_IDS.forEach((id, i) => {
    const b = CREATIVE_PACK_BRIEFS[id] || {};
    lines.push(
      `| ${i + 1} | ${PRODUCTION_TEMPLATE_DISPLAY_NAMES[id]} | \`${id}\` | ${b.grid || '—'} | ${b.typography || '—'} |`
    );
  });

  lines.push(
    '',
    '## Requirements',
    '',
    'Each template must:',
    '- Render **all populated content** (identity, summary, experience, education, skills, tools, languages)',
    '- Render **clients**, **projects**, and **portfolio links** sections',
    '- Support **multiple pages** via `cv-a4-pages.js` pagination on `.cvInner`',
    '- Use a **distinct layout class** and **pack CSS skin** (`cv-templates-pack.css`)',
    '',
    '## Layout differentiation',
    '',
    '| Template | Layout signature | Distinctive trait |',
    '|----------|------------------|-------------------|',
    '| Portfolio Artist | `cvLayout-portfolio` | Hero clients + projects-first |',
    '| Creative Director | `cvLayout-director` | Oversized name + asymmetric grid |',
    '| Luxury Fashion | `cvLayout-luxury-fashion` | Narrow centered serif |',
    '| Behance Showcase | `cvLayout-behance` | Cobalt rail + card sections |',
    '| Magazine Editorial | `cvLayout-magazine-3col` | 3-column masthead |',
    '| Agency Designer | `cvLayout-agency-designer` | Dark header band + skills rail |',
    '| Visual Timeline | `cvLayout-timeline` | Chrono left rail |',
    '| Art Director | `cvLayout-art-director` | Split meta + creative stack |',
    '| Illustrator Portfolio | `cvLayout-illustrator` | Warm paper + links-first |',
    '| Minimal Swiss | `cvLayout-swiss` | Helvetica grid + red accent |',
    '',
    '## Legacy aliases',
    '',
    '| Legacy ID | Resolves to |',
    '|-----------|-------------|',
    '| `behance-creative` | `behance-showcase` |',
    '| `editorial-magazine` | `magazine-editorial` |',
    '| `modern-minimal` | `minimal-swiss` |',
    '| `swiss` | `minimal-swiss` |',
    '| `artdirector` | `art-director` |',
    '',
    '## Multipage',
    '',
    'Templates output a single `.cvInner` document. `HirelyA4Pages.layoutCvA4Pages()` splits content into `.cvA4Sheet` pages (794×1123px) with `page-break` rules from `cv-a4-pages.css` and `cv-pdf-export.css`.',
    '',
    '## Acceptance',
    '',
    pass
      ? '**PASS** — Ten visually distinct premium templates render full creative content including clients, projects, and portfolio links.'
      : '**FAIL** — See QA output below.',
    '',
    '## Run',
    '',
    '```bash',
    'npm run test:premium-template-expansion',
    '```',
    ''
  );

  if (!pass) {
    lines.push('## QA output', '', '```', (expansion.out || pack.out || '').slice(0, 6000), '```', '');
  }

  if (data?.lock) {
    lines.push('## Content lock scores', '', '| Template | Score | Pass |', '|----------|------:|:----:|');
    for (const id of PRODUCTION_TEMPLATE_IDS) {
      const r = data.lock[id];
      if (r) lines.push(`| ${PRODUCTION_TEMPLATE_DISPLAY_NAMES[id]} | ${r.score}% | ${r.pass ? '✓' : '✗'} |`);
    }
    lines.push('');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
