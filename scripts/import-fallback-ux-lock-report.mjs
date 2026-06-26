#!/usr/bin/env node
/**
 * P0 — Generate IMPORT_FALLBACK_UX_LOCK_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'IMPORT_FALLBACK_UX_LOCK_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/import-fallback-ux-lock/report.json');
const INDEX = path.join(ROOT, 'index.html');

function runQa(script) {
  const res = spawnSync('node', [script], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const qa = runQa('src/tests/qa-import-fallback-ux-lock.mjs');
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const html = fs.readFileSync(INDEX, 'utf8');

const lines = [
  '# IMPORT_FALLBACK_UX_LOCK_REPORT',
  '',
  `**Status:** ${qa.pass && report?.pass ? 'PASS' : 'FAIL'}`,
  `**Engine:** \`${report?.engineVersion || 'IMPORT_FALLBACK_UX_LOCK_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Problem',
  '',
  'Unsupported or low-quality imports must never leave the user on a loading spinner, a technical error, or an empty CV preview.',
  '',
  '## Required UX state',
  '',
  '| Element | Behavior |',
  '|---------|----------|',
  '| Lead message | `Lecture incomplète. Collez le texte du CV pour continuer.` |',
  '| Filename | Shown in fallback meta + drop zone |',
  '| File type | Detected type label (PDF, Word, Image, …) |',
  '| Reason | Plain-language cause (timeout, scan, insufficient content, …) |',
  '| Paste box | `#importPasteFallbackText` focused |',
  '| Retry | `#importPasteFallbackRetryOcr` — relaunch import |',
  '| Replace file | `#importPasteFallbackDocx` — open file picker |',
  '',
  '## Never rules',
  '',
  '| Rule | Enforcement |',
  '|------|-------------|',
  '| Never stay loading | `_importFallbackUiLock` clears loading UX; progress hidden |',
  '| Never show technical errors | `sanitizeImportErrorForUser()` + friendly status copy |',
  '| Never show empty CV | `#cvStage` hidden; workspace reset on fallback |',
  '',
  '## Module',
  '',
  '- `src/core/import/import-fallback-ux.js` — canonical copy + meta builders',
  '- `index.html` → `showImportPasteFallback()` — product UI lock',
  '',
  '## Browser scenario (scan-timeout.pdf)',
  '',
  report?.snap
    ? [
        `- Title: ${report.snap.title}`,
        `- Lead: ${report.snap.lead?.slice(0, 80)}…`,
        `- File: ${report.snap.fileName}`,
        `- Type: ${report.snap.fileType}`,
        `- Reason: ${report.snap.reason}`,
        `- Loading: ${report.snap.loading}`,
        `- CV live: ${report.snap.cvLive}`,
      ].join('\n')
    : '_No browser snapshot_',
  '',
  '## Verify',
  '',
  '```bash',
  'npm run qa:import-fallback-ux-lock',
  'npm run import-fallback-ux-lock-report',
  '```',
  '',
  '---',
  '',
  '### Console',
  '',
  '```',
  qa.out.split('\n').slice(-40).join('\n'),
  '```',
];

fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
console.log('Wrote', OUT);
