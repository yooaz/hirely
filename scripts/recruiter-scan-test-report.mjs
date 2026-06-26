#!/usr/bin/env node
/**
 * Generate SCAN_TEST_REPORT.md — recruiter first-scan audit per template.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  RECRUITER_SCAN_TEST_V1,
  SCAN_ZONE_PX,
  SCAN_ZONE_SECONDS_MIN,
  SCAN_ZONE_SECONDS_MAX,
  SCAN_FIELD_WEIGHTS,
  SCAN_FIELDS,
} from '../src/core/validation/recruiter-scan-test.js';
import {
  TEMPLATE_FAMILY_V3_NAMES,
} from '../src/ui/templates/template-families-v3.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const reportJson = join(root, 'tests/output/recruiter-scan-test/report.json');

const gate = spawnSync('node', ['src/tests/qa-recruiter-scan-test.mjs'], { cwd: root, encoding: 'utf8' });
const gateOk = gate.status === 0;

let data = { ranked: [] };
if (existsSync(reportJson)) {
  data = JSON.parse(readFileSync(reportJson, 'utf8'));
}

const ranked = data.ranked || [];

function fieldTable(fields) {
  if (!fields?.length) return '_No data_';
  const header = '| Field | In scan zone | Score | Top (px) | Note |';
  const sep = '|-------|--------------|-------|----------|------|';
  const rows = fields.map((f) => {
    const zone = f.inScanZone ? '✓' : '—';
    return `| ${f.field} | ${zone} | ${f.score} | ${f.topPx ?? '—'} | ${f.note} |`;
  });
  return [header, sep, ...rows].join('\n');
}

const lines = [];
lines.push('# Recruiter Scan Test Report');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
lines.push(`**Engine:** \`${RECRUITER_SCAN_TEST_V1}\``);
lines.push(`**QA gate:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Simulation');
lines.push('');
lines.push(`Recruiters typically spend **${SCAN_ZONE_SECONDS_MIN}–${SCAN_ZONE_SECONDS_MAX} seconds** on the first CV scan.`);
lines.push(`This test measures what is visible in the **top ${SCAN_ZONE_PX}px** (~38% of A4 page 1) without scrolling.`);
lines.push('');
lines.push('### Measured fields');
lines.push('');
lines.push('| Field | Weight | Recruiter priority |');
lines.push('|-------|--------|------------------|');
for (const f of SCAN_FIELDS) {
  const pct = Math.round((SCAN_FIELD_WEIGHTS[f] || 0) * 100);
  const pri =
    f === 'name' || f === 'experience'
      ? 'Critical'
      : f === 'title' || f === 'contact'
        ? 'High'
        : 'Secondary';
  lines.push(`| ${f} | ${pct}% | ${pri} |`);
}
lines.push('');
lines.push('## Template ranking (best → worst)');
lines.push('');
lines.push('| Rank | Template | ID | Scan score | Fields in zone |');
lines.push('|------|----------|-----|------------|----------------|');
ranked.forEach((r, i) => {
  const zone = (r.fields || []).filter((f) => f.inScanZone).map((f) => f.field).join(', ') || '—';
  lines.push(`| ${i + 1} | ${r.displayName || TEMPLATE_FAMILY_V3_NAMES[r.templateId]} | \`${r.templateId}\` | **${r.scanScore}** | ${zone} |`);
});
lines.push('');
lines.push('## Per-template audit');
lines.push('');

for (const r of ranked) {
  const rank = ranked.indexOf(r) + 1;
  lines.push(`### ${rank}. ${r.displayName || TEMPLATE_FAMILY_V3_NAMES[r.templateId]} (\`${r.templateId}\`)`);
  lines.push('');
  lines.push(`**Scan score:** ${r.scanScore} · **Fields in zone:** ${r.inZoneCount ?? (r.fields || []).filter((f) => f.inScanZone).length}/6`);
  lines.push('');
  lines.push(fieldTable(r.fields));
  lines.push('');
}

lines.push('## Methodology');
lines.push('');
lines.push('1. Render each V3 template with a realistic recruiter fixture CV.');
lines.push('2. Load full V2 + V3 CSS in an A4-width Playwright page.');
lines.push('3. Measure DOM anchor positions for name, title, experience, skills, education, contact.');
lines.push('4. Score visibility within the 6–10s scan zone; weight by recruiter priority.');
lines.push('5. Rank templates by composite scan score.');
lines.push('');
lines.push('## Verification');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:recruiter-scan-test');
lines.push('npm run recruiter-scan-test-report');
lines.push('```');

if (!gateOk && gate.stderr) {
  lines.push('');
  lines.push('### QA stderr');
  lines.push('');
  lines.push('```');
  lines.push(gate.stderr.trim().slice(0, 2000));
  lines.push('```');
}

writeFileSync(join(root, 'SCAN_TEST_REPORT.md'), lines.join('\n') + '\n', 'utf8');
console.log('Wrote SCAN_TEST_REPORT.md');
process.exit(gateOk ? 0 : 1);
