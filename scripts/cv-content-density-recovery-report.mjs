#!/usr/bin/env node
/**
 * P0 — Generate CV_CONTENT_DENSITY_RECOVERY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CV_CONTENT_DENSITY_RECOVERY_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/cv-content-density-recovery/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-cv-content-density-recovery.mjs'], {
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
  '# CV_CONTENT_DENSITY_RECOVERY_REPORT',
  '',
  `**Status:** ${reportPass ? 'PASS' : 'FAIL'}`,
  `**Engine:** \`${report?.version || 'CV_CONTENT_DENSITY_RECOVERY_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Problem',
  '',
  'Final CV preview looked empty while raw extraction still contained experience, clients, tools, education, and project lines.',
  '',
  '## Rules enforced',
  '',
  '- Compare `rawText` against `finalResumeData` + `reviewQueue`',
  '- Section lines (experience, education, clients, tools, projects, portfolio) must not disappear',
  '- Missing content is recovered into the correct section or queued for review',
  '- Preview density target: **55%** minimum (`previewChars / rawChars`)',
  '- Experience, clients, and education render when detected in source text',
  '',
  '## Code changes',
  '',
  '| Module | Change |',
  '|--------|--------|',
  '| `content-density-recovery.js` | Section parser, density audit, recovery + review queue |',
  '| `final-resume-contract.js` | Run recovery before completeness audit |',
  '| `final-resume-data-cleanup.js` | Raise suggestions cap 4 → 12 for retained orphans |',
  '',
  '## QA summary',
  '',
  `| Checks | Pass | Fail |`,
  `|--------|------|------|`,
  `| Total | ${report?.summary?.total ?? '—'} | ${report?.summary?.fail ?? '—'} |`,
  '',
  '## Recovery case (sparse final → rich raw)',
  '',
];

if (report?.recovery) {
  lines.push(
    `- Preview density: **${report.recovery.previewDensityPct}%**`,
    `- Recovered fields: ${report.recovery.recovered}`,
    `- Queued for review: ${report.recovery.queued}`,
    `- Experiences: ${report.recovery.experiences ?? 0}`,
    `- Clients: ${report.recovery.clients ?? 0}`,
    `- Education: ${report.recovery.education ?? 0}`,
    `- Tools: ${report.recovery.tools ?? 0}`
  );
}

lines.push('', '## Pipeline case', '');

if (report?.pipeline) {
  lines.push(
    `- Preview density: **${report.pipeline.previewDensityPct}%**`,
    `- Experiences: ${report.pipeline.experiences ?? 0}`,
    `- Clients: ${report.pipeline.clients ?? 0}`,
    `- Education: ${report.pipeline.education ?? 0}`,
    `- Review items: ${report.pipeline.reviewCount ?? 0}`
  );
}

lines.push('', '## Checklist', '');

if (report?.checks?.length) {
  for (const c of report.checks) {
    lines.push(`- ${c.pass ? '✓' : '✗'} \`${c.id}\`${c.detail ? ` — ${c.detail}` : ''}`);
  }
}

lines.push('', '## Run', '', '```bash', 'npm run qa:cv-content-density-recovery', 'npm run cv-content-density-recovery-report', '```', '');

if (qa.out) {
  lines.push('', '## QA log (tail)', '', '```', qa.out.split('\n').slice(-22).join('\n'), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(reportPass ? 0 : 1);
