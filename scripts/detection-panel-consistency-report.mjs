#!/usr/bin/env node
/**
 * P0 — Generate DETECTION_PANEL_CONSISTENCY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'DETECTION_PANEL_CONSISTENCY_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/detection-panel-consistency/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-detection-panel-consistency.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;

const lines = [
  '# DETECTION_PANEL_CONSISTENCY_REPORT',
  '',
  `**Status:** ${qa.pass && report?.pass ? 'PASS' : 'FAIL'}`,
  `**Source:** \`finalResumeData\` only (no cvData / merged sectionCounts)`,
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Rule',
  '',
  'The detection panel (`#extractionQualityStep`) must never contradict the CV preview.',
  '',
  '| finalResumeData | Panel label |',
  '|-----------------|-------------|',
  '| `education.length > 0` | Formation détectée |',
  '| `experiences.length > 0` | Expérience détectée |',
  '| `skills.length > 0` or `tools.length > 0` | Compétences détectées |',
  '',
  '## Code changes',
  '',
  '- `src/ui/product/extraction-quality-step.js` — counts sections from `finalResumeData` only; object-aware education entries',
  '- `index.html` — `buildExtractionQualityReport()` passes only `finalResumeData`',
  '- `index.html` — `sectionCountsFromFinalResume()` handles education objects (`school`, `degree`, `display`, …)',
  '',
];

for (const cv of report?.cvs || []) {
  lines.push(`## ${cv.label} (\`${cv.id}\`)`, '');
  lines.push(`**Result:** ${cv.pass ? 'PASS' : 'FAIL'}`, '');
  lines.push('| Section | finalResumeData count | Panel | Preview DOM |');
  lines.push('|---------|----------------------|-------|-------------|');
  const c = cv.counts || {};
  const row = (key, count, previewKey) => {
    const pr = cv.panelRows?.find((r) => r.key === key);
    const prev = cv.preview?.[previewKey];
    lines.push(`| ${key} | ${count ?? 0} | ${pr?.ok ? '✓ ' + pr.label : '✗ ' + (pr?.label || '—')} | ${prev ? '✓' : '—'} |`);
  };
  row('experience', c.experiences, 'hasExperience');
  row('education', c.education, 'hasEducation');
  row('skills', (c.skills || 0) + (c.tools || 0), 'hasSkills');
  lines.push('');

  if (cv.contradictions?.length) {
    lines.push('### Contradictions', '');
    for (const x of cv.contradictions) {
      lines.push(`- ${x.section}: ${x.reason}`);
    }
    lines.push('');
  }
}

lines.push('## Verify', '', '```bash', 'npm run qa:detection-panel-consistency', 'npm run detection-panel-consistency-report', '```', '');

if (!qa.pass) {
  lines.push('## QA output', '', '```', qa.out.slice(0, 12000), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(qa.pass && report?.pass ? 0 : 1);
