#!/usr/bin/env node
/**
 * P0 — Generate OCR_DATA_CLEANUP_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'OCR_DATA_CLEANUP_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/ocr-data-cleanup/report.json');

function runQa(name, script) {
  const res = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  return { name, pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim().slice(-1200) };
}

const suites = [
  runQa('qa-ocr-data-cleanup', 'src/tests/qa-ocr-data-cleanup.mjs'),
  runQa('qa-ocr-micro-garbage-cleanup', 'src/tests/qa-ocr-micro-garbage-cleanup.mjs'),
  runQa('qa-final-preview-sanity-check', 'src/tests/qa-final-preview-sanity-check.mjs'),
];

const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const pass = report?.pass === true && suites.every((s) => s.pass);

const lines = [
  '# OCR Data Cleanup Report (P0)',
  '',
  `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
  `**Policy:** \`${report?.version || 'OCR_DATA_CLEANUP_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Goal',
  '',
  'Clean final CV before rendering. OCR junk, parser labels, i18n keys, and partial languages never reach preview; skills and software are routed without duplication.',
  '',
  '## Acceptance',
  '',
  '| Criterion | Status |',
  '| --- | --- |',
  `| No "Native am" | **${report?.acceptance?.no_native_am ? 'PASS' : 'FAIL'}** |`,
  `| No "extractionQuality_emailOk" | **${report?.acceptance?.no_i18n_keys ? 'PASS' : 'FAIL'}** |`,
  `| No garbage fragments | **${report?.acceptance?.no_garbage_fragments ? 'PASS' : 'FAIL'}** |`,
  `| No duplicated labels | **${report?.acceptance?.no_duplicated_labels ? 'PASS' : 'FAIL'}** |`,
  `| Skills/tools routed | **${report?.acceptance?.skills_tools_routed ? 'PASS' : 'FAIL'}** |`,
  '',
  '## Removed from preview',
  '',
  '| Category | Examples | Enforcement |',
  '| --- | --- | --- |',
  '| Isolated fragments | `am`, `co`, `n`, `20` | `isMicroGarbageOnlyLine` |',
  '| Raw section labels | `Skills`, `Education`, `Experience` | `isSectionLabelLeakage` |',
  '| Duplicated labels | `Skills` twice in list | per-field dedupe |',
  '| Page numbers | `Page 1`, `1 / 2` | `isPageNumberLine` |',
  '| OCR junk | trailing `@`, `:` | `stripMicroGarbageFromText` |',
  '| Partial language lines | `Native am` | `sanitizeLanguageLine` |',
  '| camelCase i18n keys | `extractionQuality_emailOk` | `isCamelCaseI18nKey` |',
  '',
  '## Languages',
  '',
  'Only normalized lines such as `French — native`, `English — fluent`, `Spanish — intermediate`. Polluted or partial lines → reviewQueue.',
  '',
  '## Skills / tools',
  '',
  '| Rule | Behavior |',
  '| --- | --- |',
  '| Creative skills | Stay in `skills` |',
  '| Software / tools | Routed to `tools` via `partitionSkillsAndTools` |',
  '| No duplication | Same token never in both arrays |',
  '',
  '## Pipeline placement',
  '',
  '```mermaid',
  'flowchart LR',
  '  A[resumeData] --> B[applyOcrMicroGarbageCleanup]',
  '  B --> C[finalResumeData shaping]',
  '  C --> D[applyOcrDataCleanup]',
  '  D --> E[applyFinalPreviewSanityCheck]',
  '  E --> F[CV preview / PDF]',
  '```',
  '',
  '## Modules',
  '',
  '| Module | Role |',
  '| --- | --- |',
  '| `ocr-data-cleanup.js` | Unified final cleanup + skills/tools partition |',
  '| `ocr-micro-garbage-cleanup.js` | Language/contact micro-fragments |',
  '| `section-label-leakage-guard.js` | Parser section headers |',
  '| `final-preview-sanity-check.js` | Invokes `applyOcrDataCleanup` before render |',
  '',
  '## QA suites',
  '',
  '| Suite | Result |',
  '| --- | --- |',
  ...suites.map((s) => `| \`${s.name}\` | ${s.pass ? 'PASS' : 'FAIL'} |`),
  '',
  `**Unit checks:** ${report ? `${report.summary.pass}/${report.summary.total}` : 'not run'}`,
  '',
];

if (report?.checks?.length) {
  lines.push('## Unit checks', '', '| Check | Status |', '| --- | --- |');
  for (const c of report.checks) {
    lines.push(`| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} |`);
  }
  lines.push('');
}

if (report?.samples) {
  lines.push(
    '## Samples',
    '',
    `| Field | Value |`,
    `| --- | --- |`,
    `| Languages | ${(report.samples.languages || []).join(', ') || '—'} |`,
    `| Skills | ${(report.samples.skills || []).join(', ') || '—'} |`,
    `| Tools | ${(report.samples.tools || []).join(', ') || '—'} |`,
    `| Review items | ${report.samples.reviewCount ?? '—'} |`,
    ''
  );
}

lines.push(
  '## Verify',
  '',
  '```bash',
  'npm run qa:ocr-data-cleanup',
  'npm run ocr-data-cleanup-report',
  'npm run qa:ocr-micro-garbage-cleanup',
  'npm run qa:final-preview-sanity-check',
  '```',
  ''
);

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(pass ? 0 : 1);
