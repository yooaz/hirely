#!/usr/bin/env node
/**
 * Generate TEMPLATE_V1_REPORT.md — H3 template selector acceptance.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  PRODUCTION_TEMPLATE_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
  TEMPLATE_SYSTEM_VERSION,
} from '../src/ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'TEMPLATE_V1_REPORT.md');
const P7_REPORT = path.join(ROOT, 'tests/output/p7-final-lock/report.json');
const V1_JSON = path.join(ROOT, 'tests/output/template-v1-selector/report.json');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

const p7 = readJson(P7_REPORT);
const p7Pass = p7?.failed === 0;

console.log('Prerequisite: P7 final lock…');
if (!p7Pass) {
  const p7Run = spawnSync('npm', ['run', 'qa:p7-final-lock'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (p7Run.status !== 0) {
    console.error('P7 prerequisite failed — aborting template V1 report.');
    process.exit(1);
  }
}

console.log('Running qa:template-v1-selector…');
const qa = spawnSync('node', ['src/tests/qa-template-v1-selector.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const v1 = readJson(V1_JSON);
const qaPass = qa.status === 0 && v1?.pass !== false;
const failedChecks = (v1?.results || []).filter((r) => !r.pass);

const lines = [];
lines.push('# TEMPLATE_V1_REPORT');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`System: HIRELY H3 (${TEMPLATE_SYSTEM_VERSION})`);
lines.push(`P7 prerequisite: **${p7Pass || qa.status === 0 ? 'PASS' : 'required'}**`);
lines.push(`Template selector QA: **${qaPass ? 'PASS' : 'FAIL'}**`);
lines.push('');

lines.push('## Template selector');
lines.push('');
lines.push('Three production templates in `#templateGrid` (Style step). Same `finalResumeData` for all — render layers only.');
lines.push('');
lines.push('| # | ID | Display name |');
lines.push('|---|-----|--------------|');
PRODUCTION_TEMPLATE_IDS.forEach((id, i) => {
  lines.push(`| ${i + 1} | \`${id}\` | ${PRODUCTION_TEMPLATE_DISPLAY_NAMES[id]} |`);
});
lines.push('');

lines.push('## Acceptance');
lines.push('');
lines.push('| Criterion | Status |');
lines.push('|-----------|--------|');
lines.push(`| 3 templates selectable | ${qaPass ? '✅' : '❌'} |`);
lines.push(`| Preview updates on selection | ${qaPass ? '✅' : '❌'} |`);
lines.push(`| PDF exports selected template | ${qaPass ? '✅' : '❌'} |`);
lines.push(`| Same finalResumeData (name preserved) | ${qaPass ? '✅' : '❌'} |`);
lines.push(`| No parser logic in template HTML | ${qaPass ? '✅' : '❌'} |`);
lines.push(`| A4-safe preview width | ${qaPass ? '✅' : '❌'} |`);
lines.push('');

if (v1?.results?.length) {
  lines.push('## QA checks');
  lines.push('');
  lines.push('| Check | Status | Detail |');
  lines.push('|-------|--------|--------|');
  for (const r of v1.results) {
    lines.push(`| \`${r.id}\` | ${r.pass ? 'PASS' : 'FAIL'} | ${String(r.detail || '').replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
}

lines.push('## PDF artifacts');
lines.push('');
for (const id of PRODUCTION_TEMPLATE_IDS) {
  lines.push(`- \`tests/output/template-v1-selector/v1-${id}.pdf\` — ${PRODUCTION_TEMPLATE_DISPLAY_NAMES[id]}`);
}
lines.push('');

if (failedChecks.length) {
  lines.push('## Failed checks');
  lines.push('');
  for (const r of failedChecks) {
    lines.push(`- \`${r.id}\`: ${r.detail || 'failed'}`);
  }
  lines.push('');
}

lines.push('## Key files');
lines.push('');
lines.push('| File | Role |');
lines.push('|------|------|');
lines.push('| `index.html` — `renderTemplates()` / `#templateGrid` | UI selector (3 cards) |');
lines.push('| `src/ui/templates/production-template-ids.mjs` | Canonical template IDs + labels |');
lines.push('| `src/ui/templates/cv-templates.js` | Render layers (no parser) |');
lines.push('| `src/ui/export/hirely-pdf-export.js` | PDF export uses `state.template` |');
lines.push('');

lines.push('## Verification');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:p7-final-lock      # prerequisite');
lines.push('npm run qa:template-v1-selector');
lines.push('npm run template-v1-report');
lines.push('```');
lines.push('');

if (qa.stdout) {
  lines.push('<details><summary>Selector QA stdout</summary>');
  lines.push('');
  lines.push('```');
  lines.push(qa.stdout.trim());
  lines.push('```');
  lines.push('</details>');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(qaPass ? 0 : 1);
