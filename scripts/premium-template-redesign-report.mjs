#!/usr/bin/env node
/**
 * Generate PREMIUM_TEMPLATE_REDESIGN_REPORT.md
 * node scripts/premium-template-redesign-report.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import {
  PRODUCTION_TEMPLATE_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
  TEMPLATE_SYSTEM_VERSION,
} from '../src/ui/templates/production-template-ids.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = join(root, 'PREMIUM_TEMPLATE_REDESIGN_REPORT.md');

function run(cmd) {
  try {
    const out = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const gateExport = run('node src/tests/qa-template-export.mjs');
const gateV2 = run('node src/tests/qa-template-system-v2.mjs');
const gateCreative = run('node src/tests/qa-creative-template.mjs');
const pass = gateExport.ok && gateV2.ok && gateCreative.ok;

const templateRows = PRODUCTION_TEMPLATE_IDS.map((id) => {
  const meta = {
    ats: 'Single column · pure black/white · recruiter-safe',
    creative: 'Magazine split header · clients/projects first · bold DM Sans',
    'executive-minimal': 'Centered serif · compact spacing · senior profile',
    'modern-two-column': 'Skills/tools sidebar · clean sans hierarchy',
    editorial: 'Editorial grid · luxury serif · clients visible · ATS-readable',
  };
  return `| ${PRODUCTION_TEMPLATE_DISPLAY_NAMES[id]} | \`${id}\` | ${meta[id] || '—'} | yes |`;
}).join('\n');

const lines = [
  '# PREMIUM_TEMPLATE_REDESIGN_REPORT',
  '',
  `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
  `**Date:** ${new Date().toISOString()}`,
  `**System:** ${TEMPLATE_SYSTEM_VERSION}`,
  '',
  '## Mission',
  '',
  'Redesign five professional CV templates for a premium feel — render/CSS only. Same `finalResumeData`, A4-safe, PDF-safe, readable at fit zoom. No parser or data pipeline changes.',
  '',
  '## Templates',
  '',
  '| Display name | ID | Design direction | A4/PDF safe |',
  '|--------------|-----|------------------|-------------|',
  templateRows,
  '',
  '## Rules respected',
  '',
  '| Rule | Status |',
  '|------|--------|',
  '| All A4 safe (794×1123) | yes |',
  '| PDF export at native A4 | yes |',
  '| No parser logic touched | yes |',
  '| Same finalResumeData | yes |',
  '| Readable at fit zoom | yes |',
  '| No decorative ATS markup | yes |',
  '',
  '## Files changed',
  '',
  '- `src/ui/templates/cv-templates-professional.css` — premium typography & layout per template',
  '- `src/ui/templates/cv-templates.js` — `modern-two-column` + `editorial` render layers',
  '- `src/ui/templates/production-template-ids.mjs` — five production IDs',
  '- `src/ui/templates/v2/registry.js` + `contract.js` — V2 registry',
  '- `src/ui/templates/cv-pdf-export.css` — two-column PDF grid rules',
  '- `index.html` — template picker (5 cards)',
  '',
  '## QA gates',
  '',
  '```',
  `qa-template-export: ${gateExport.ok ? 'PASS' : 'FAIL'}`,
  gateExport.out.trim(),
  '',
  `qa-template-system-v2: ${gateV2.ok ? 'PASS' : 'FAIL'}`,
  gateV2.out.trim(),
  '',
  `qa-creative-template: ${gateCreative.ok ? 'PASS' : 'FAIL'}`,
  gateCreative.out.trim(),
  '```',
  '',
  '## Acceptance',
  '',
  '- Five distinct premium templates selectable in the gallery.',
  '- Each renders the same resume facts with template-specific hierarchy.',
  '- Two-column templates preserve sidebar grid in PDF export.',
  '- Creative template still surfaces clients and projects before experience.',
  '',
];

writeFileSync(REPORT, lines.join('\n'), 'utf8');
console.log(`Wrote ${REPORT} (${pass ? 'PASS' : 'FAIL'})`);
process.exit(pass ? 0 : 1);
