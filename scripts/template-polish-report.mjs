#!/usr/bin/env node
/**
 * Generate TEMPLATE_POLISH_REPORT.md from H3 template polish QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import {
  PRODUCTION_TEMPLATE_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
  TEMPLATE_SYSTEM_VERSION,
} from '../src/ui/templates/production-template-ids.mjs';
import { TEMPLATE_V2_REGISTRY, resolveTemplateV2 } from '../src/ui/templates/v2/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'TEMPLATE_POLISH_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/template-h3-polish/report.json');

console.log('Running qa:template-h3-polish…');
const qa = spawnSync('node', ['src/tests/qa-template-h3-polish.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

let reportData = null;
if (fs.existsSync(QA_JSON)) {
  try {
    reportData = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
  } catch {
    reportData = null;
  }
}

const qaPass = qa.status === 0;
const failedChecks = (reportData?.checks || []).filter((c) => !c.pass);

const lines = [];
lines.push('# TEMPLATE_POLISH_REPORT');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`System: HIRELY H3 (${TEMPLATE_SYSTEM_VERSION})`);
lines.push(`QA status: **${qaPass ? 'PASS' : 'FAIL'}**`);
lines.push('');

lines.push('## Scope');
lines.push('');
lines.push('Three stable production templates sharing the same `finalResumeData` view-model. Templates are render-only layers — no parser logic.');
lines.push('');

lines.push('## Templates');
lines.push('');
lines.push('| ID | Display name | Layout family | ATS safety |');
lines.push('|----|--------------|---------------|------------|');
for (const id of PRODUCTION_TEMPLATE_IDS) {
  const t = TEMPLATE_V2_REGISTRY[id] || resolveTemplateV2(id);
  lines.push(
    `| \`${id}\` | ${PRODUCTION_TEMPLATE_DISPLAY_NAMES[id]} | ${t.layoutFamily} | ${t.atsSafety} |`
  );
}
lines.push('');

lines.push('## Acceptance criteria');
lines.push('');
lines.push('| Criterion | Status |');
lines.push('|-----------|--------|');
lines.push(`| Same \`finalResumeData\` across all 3 | ${qaPass ? '✅' : '❌'} |`);
lines.push(`| PDF export works for all 3 | ${qaPass ? '✅' : '❌'} |`);
lines.push(`| A4 safe (794×1123 policy) | ${qaPass ? '✅' : '❌'} |`);
lines.push(`| Readable at 90% preview | ${qaPass ? '✅' : '❌'} |`);
lines.push(`| No horizontal crop | ${qaPass ? '✅' : '❌'} |`);
lines.push(`| No parser logic in template HTML | ${qaPass ? '✅' : '❌'} |`);
lines.push('');

if (reportData?.templates) {
  lines.push('## PDF artifacts');
  lines.push('');
  for (const t of reportData.templates) {
    lines.push(`- \`tests/output/template-h3-polish/h3-${t.id}.pdf\` — ${t.displayName}`);
  }
  lines.push('');
}

if (failedChecks.length) {
  lines.push('## Failed checks');
  lines.push('');
  for (const c of failedChecks) {
    lines.push(`- ${c.check}`);
  }
  lines.push('');
}

lines.push('## Key files');
lines.push('');
lines.push('| File | Role |');
lines.push('|------|------|');
lines.push('| `src/ui/templates/production-template-ids.mjs` | Canonical 3-template IDs |');
lines.push('| `src/ui/templates/v2/registry.js` | H3 registry + aliases |');
lines.push('| `src/ui/templates/cv-templates.js` | Render layers (no parser) |');
lines.push('| `src/ui/templates/cv-templates-professional.css` | Per-template + H3 overflow safety |');
lines.push('| `src/ui/templates/v2/view-model.js` | `resumeDataToTemplateView()` |');
lines.push('');

lines.push('## Verification');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:p7-final-lock   # prerequisite');
lines.push('npm run qa:template-h3-polish');
lines.push('npm run template-polish-report');
lines.push('```');
lines.push('');

if (qa.stdout) {
  lines.push('<details><summary>QA stdout</summary>');
  lines.push('');
  lines.push('```');
  lines.push(qa.stdout.trim());
  lines.push('```');
  lines.push('</details>');
  lines.push('');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(qa.status === 0 ? 0 : 1);
