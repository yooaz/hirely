#!/usr/bin/env node
/**
 * P0 — Generate FORMAT_SUPPORT_AUDIT_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'FORMAT_SUPPORT_AUDIT_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/format-support-audit/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-format-support-audit.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function yn(v) {
  return v ? '✓' : '—';
}

function cellDetections(d = {}) {
  return [
    yn(d.nameDetected),
    yn(d.emailDetected),
    yn(d.phoneDetected),
    yn(d.experienceDetected),
    yn(d.educationDetected),
    yn(d.skillsDetected),
    yn(d.clientsDetected),
  ].join(' | ');
}

const qa = runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;

const lines = [
  '# FORMAT_SUPPORT_AUDIT_REPORT',
  '',
  `**Status:** ${qa.pass && report?.pass ? 'PASS' : 'FAIL'}`,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  '',
  '## Pass criteria',
  '',
  'Each format must either:',
  '',
  '1. **Import correctly** — extract text, parse sections, render CV, export PDF',
  '2. **Paste fallback** — clear non-blocking paste UI (no crash, no infinite loading)',
  '',
  '## Summary',
  '',
  `| Metric | Value |`,
  `|--------|-------|`,
  `| Formats tested | ${report?.summary?.total ?? '—'} |`,
  `| Imported successfully | ${report?.summary?.imported ?? '—'} |`,
  `| Paste fallback (acceptable) | ${report?.summary?.pasteFallback ?? '—'} |`,
  `| Failed | ${report?.summary?.failed ?? '—'} |`,
  '',
  '## Per-format results',
  '',
  '| Format | Import | Raw chars | Quality | Name | Email | Phone | Exp | Edu | Skills | Clients | CV render | PDF export | Outcome |',
  '|--------|--------|-----------|---------|------|-------|-------|-----|-----|--------|---------|-----------|------------|---------|',
];

if (report?.formats?.length) {
  for (const f of report.formats) {
    const d = f.detections || {};
    lines.push(
      `| ${f.label || f.id} | ${yn(f.canImport)} | ${f.rawTextLength ?? 0} | ${f.textQuality ?? 0} | ${yn(d.nameDetected)} | ${yn(d.emailDetected)} | ${yn(d.phoneDetected)} | ${d.experienceCount ?? 0} | ${d.educationCount ?? 0} | ${d.skillsCount ?? 0} | ${d.clientsCount ?? 0} | ${yn(f.cvRendered)} | ${yn(f.pdfExported)} | ${f.outcome || (f.pass ? 'pass' : 'fail')} |`
    );
  }
}

lines.push(
  '',
  '## Format coverage',
  '',
  '| Format | Expected path |',
  '|--------|---------------|',
  '| PDF selectable | Native pdf.js text layer → parser → render |',
  '| PDF scanned | Empty/scan PDF → paste fallback (OCR optional in browser) |',
  '| PDF protected | Corrupt/encrypted PDF → paste fallback |',
  '| DOCX | mammoth + structure recovery → parser |',
  '| DOC | mammoth legacy path (OOXML-as-DOC) → parser |',
  '| RTF | Native RTF strip → parser |',
  '| TXT | Direct read → parser |',
  '| Image PNG/JPG | Browser OCR or paste fallback |',
  '',
  '## Code paths',
  '',
  '- `src/core/extraction/document-extract.js` — per-format extraction router',
  '- `src/core/extraction/extract-file.js` — enrichment + import status',
  '- `src/core/pipeline/hirely-import.js` — file → parse → resumeData',
  '- `index.html` — `#importPasteFallback` non-blocking paste UI',
  '',
  '## QA',
  '',
  '```bash',
  'npm run qa:format-support-audit',
  'npm run format-support-audit-report',
  '```',
  '',
  '---',
  '',
  '### Console output',
  '',
  '```',
  qa.out.slice(-4000),
  '```',
  ''
);

fs.writeFileSync(OUT, lines.join('\n'));
console.log('Wrote', OUT);
process.exit(qa.pass && report?.pass ? 0 : 1);
