#!/usr/bin/env node
/**
 * Generate QUALITY_VALIDATION_REPORT.md
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  QUALITY_VALIDATOR_V1,
  QUALITY_CHECKS,
  runQualityValidation,
} from '../src/core/validation/quality-validator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gate = spawnSync('node', ['src/tests/qa-quality-validator.mjs'], { cwd: root, encoding: 'utf8' });
const gateOk = gate.status === 0;

const fixtures = {
  strong: {
    name: 'Yohann Azancot',
    title: 'Graphic Designer',
    email: 'yoaz@hotmail.fr',
    experience: ['Designer — McCann — 2011–2014', 'Freelance Illustrator — 2015–2022'],
    education: ['Créapole — Visual Communication — 2008–2011'],
    skills: ['Illustration', 'Packaging'],
    tools: ['Adobe Illustrator'],
  },
  weak: { name: '', email: '', experience: [], education: [], skills: [] },
  overlap: {
    name: 'Alex Martin',
    email: 'alex@example.com',
    experience: ['Role A — Co — 2018–2022', 'Role B — Co — 2020–2024'],
    education: ['School — 2016'],
    skills: ['Design'],
  },
};

const rows = Object.entries(fixtures).map(([tier, cv]) => ({
  tier,
  result: runQualityValidation({ cvData: cv }),
}));

const lines = [];
lines.push('# Quality Validation Report');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
lines.push(`**Engine:** \`${QUALITY_VALIDATOR_V1}\``);
lines.push(`**QA gate:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Mission');
lines.push('');
lines.push('Run **automated pre-export checks** before PDF download. Export is **blocked** when any critical issue is detected.');
lines.push('');
lines.push('## Checks');
lines.push('');
lines.push('| ID | Critical | Label |');
lines.push('|----|----------|-------|');
for (const [id, def] of Object.entries(QUALITY_CHECKS)) {
  lines.push(`| \`${id}\` | ${def.critical ? 'yes' : 'no'} | ${def.label} |`);
}
lines.push('');
lines.push('## Blocking rules');
lines.push('');
lines.push('- **name_exists** — non-empty, non-placeholder name (2–80 chars)');
lines.push('- **email_exists** — valid email format');
lines.push('- **experience_exists** — ≥1 experience line');
lines.push('- **education_exists** — ≥1 education line');
lines.push('- **dates_valid** — each experience has a year/range; no future years; start ≤ end');
lines.push('- **no_overlap** — parsed experience ranges must not overlap');
lines.push('- **no_missing_sections** — name, email, experience, education, skills');
lines.push('- **photo_valid** — when photo enabled: valid data URL, baked crop (zoom=1), V2 safe wrap');
lines.push('- **pdf_render_valid** — live `#cvDoc` metrics: cv--live, non-empty, A4 width, sections visible');
lines.push('');
lines.push('## Integration');
lines.push('');
lines.push('| Layer | Role |');
lines.push('|-------|------|');
lines.push('| `src/core/validation/quality-validator.js` | Core engine |');
lines.push('| `validateExportLock()` | Merges quality into export lock |');
lines.push('| `downloadPDF()` | Blocks + shows first critical message |');
lines.push('| `isExportReady()` | Disables download when quality fails |');
lines.push('');
lines.push('## Fixture results');
lines.push('');
for (const { tier, result } of rows) {
  lines.push(`### ${tier}`);
  lines.push('');
  lines.push(`- **Export allowed:** ${result.exportAllowed ? 'yes' : '**no**'}`);
  lines.push(`- **Score:** ${result.score}/100`);
  lines.push(`- **Confidence:** ${result.confidence?.label} (${result.confidence?.score})`);
  if (result.criticalIssues.length) {
    lines.push('- **Critical:**');
    for (const c of result.criticalIssues) {
      lines.push(`  - \`${c.id}\`: ${c.message}`);
    }
  } else {
    lines.push('- **Critical:** none');
  }
  lines.push('');
}
lines.push('## QA');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:quality-validator');
lines.push('npm run quality-validation-report');
lines.push('```');
lines.push('');

writeFileSync(join(root, 'QUALITY_VALIDATION_REPORT.md'), lines.join('\n'));
console.log('Wrote QUALITY_VALIDATION_REPORT.md');
console.log(gate.stdout || '');
if (!gateOk) process.exit(1);
