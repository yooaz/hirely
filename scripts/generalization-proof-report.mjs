#!/usr/bin/env node
/**
 * P0 — Generate GENERALIZATION_PROOF_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'GENERALIZATION_PROOF_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/generalization-proof/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-generalization-proof.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = process.env.HIRELY_SKIP_QA === '1' ? { pass: null, out: '' } : runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const reportPass = report?.pass === true && (qa.pass === true || qa.pass === null);

const lines = [
  '# GENERALIZATION_PROOF_REPORT',
  '',
  `**Status:** ${reportPass ? 'PASS' : 'FAIL'}`,
  `**Engine:** \`${report?.version || 'GENERALIZATION_PROOF_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Goal',
  '',
  'Prove the parser is generic — no production rules depend on Yoaz-specific identity, schools, agencies, or brand anchors.',
  '',
  '## Production cleanup',
  '',
  'Removed or generalized:',
  '',
  '- McCann hero injection and `McCann G. Agency` display rewrite',
  '- LISAA / Créapole hardcoded education years and formatting',
  '- `PROJECT_ANCHOR_TARGETS` acceptance anchors',
  '- Hardcoded `Nike projects` segmentation default',
  '- Brand-specific suggestion-confidence shortcuts (now entity-catalog driven)',
  '- `CREATIVE_RECOVERY_CLIENT_ANCHORS` now sourced from `CLIENT_TERMS`',
  '',
  '## Corpus',
  '',
  '10 non-Yoaz text CVs from `tests/cv-corpus/` (developer, designer, consultant, executive, marketing, teacher, student, engineer, nurse, freelancer).',
  '',
  '## Acceptance per CV',
  '',
  '- Import succeeds through production pipeline',
  '- Identity name matches corpus',
  '- Contact (email or phone) present',
  '- At least one experience and one education entry',
  '- Template render produces non-empty HTML',
  '',
  '## Summary',
  '',
  `| Metric | Value |`,
  `|--------|-------|`,
  `| CVs tested | ${report?.summary?.count ?? '—'} |`,
  `| Pass | ${report?.summary?.passCount ?? '—'} |`,
  `| Fail | ${report?.summary?.failCount ?? '—'} |`,
  `| Pass rate | ${report?.summary?.passRate ?? '—'}% |`,
  '',
  '## Per-CV results',
  '',
  '| CV | Pass | Identity | Experience | Education | Render | Notes |',
  '|----|------|----------|------------|-----------|--------|-------|',
];

if (report?.results) {
  for (const r of report.results) {
    const m = r.metrics || {};
    lines.push(
      `| ${r.id} | ${r.pass ? '✓' : '✗'} | ${m.name || '—'} | ${m.experienceCount ?? 0} | ${m.educationCount ?? 0} | ${m.renderLen ?? 0} | ${(r.failures || []).join(', ') || '—'} |`
    );
  }
} else {
  lines.push('| — | — | — | — | — | — | No results |');
}

lines.push('', '## Production marker audit', '');

if (report?.productionAudit?.length) {
  lines.push('**FAIL** — forbidden markers still in `src/core`:', '');
  for (const hit of report.productionAudit) {
    lines.push(`- \`${hit.marker}\`: ${hit.files.map((f) => `\`${f}\``).join(', ')}`);
  }
} else {
  lines.push('**PASS** — no forbidden Yoaz-specific production markers detected in audit scan.');
}

lines.push('', '## Run', '', '```bash', 'npm run qa:generalization-proof', 'npm run generalization-proof-report', '```', '');

if (qa.out) {
  lines.push('', '## QA log (tail)', '', '```', qa.out.split('\n').slice(-25).join('\n'), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(reportPass ? 0 : 1);
