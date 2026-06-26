#!/usr/bin/env node
/**
 * P0 — Generate REAL_PDF_IMPORT_RELIABILITY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'REAL_PDF_IMPORT_RELIABILITY_REPORT.md');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout || ''}\n${r.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Real PDF import reliability audit\n');

  const checks = [
    ['qa-real-pdf-import-reliability', 'src/tests/qa-real-pdf-import-reliability.mjs'],
    ['qa-real-pdf-import-fix', 'src/tests/qa-real-pdf-import-fix.mjs'],
    ['qa-ocr-timeout-race', 'src/tests/qa-ocr-timeout-race.mjs'],
    ['qa-pdf-timeout-fallback', 'src/tests/qa-pdf-timeout-fallback.mjs'],
    ['test-real-pdf-import', 'scripts/test-real-pdf-import.mjs'],
  ];

  const results = checks.map(([id, script]) => {
    const r = run('node', [script]);
    console.log(r.ok ? `  PASS ${id}` : `  FAIL ${id}`);
    return { id, ok: r.ok, out: r.out };
  });

  const pass = results.every((r) => r.ok);

  const lines = [
    '# HIRELY P0 — Real PDF Import Reliability',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'Real user PDFs hit `OCR_TIMEOUT`, `PDF_EXTRACTION_TIMEOUT`, and `IMPORT_NEEDS_PASTE` while the UI looked broken (console error spam, long waits, OCR re-runs after timeout).',
    '',
    '## Rules (locked)',
    '',
    '| Rule | Implementation |',
    '|------|----------------|',
    '| Selectable PDF imports without OCR | `pdf-router.js` — `ocrAllowed: false` on native route |',
    '| Direct text extraction first | `extractNativePdfLines` (pdf.js) before any Tesseract work |',
    '| OCR only if text layer empty/weak | `planPdfExtraction` + `shouldRunOcrForTextLength` |',
    '| Paste fallback within 20s | `PDF_EXTRACTION_MAX_MS` / `OCR_ABSOLUTE_MAX_MS` + `triggerPdfOcrFullFallback` |',
    '| User understands what happened | Soft copy: “Certaines sections devront être vérifiées.” / paste lead |',
    '| Never block | Loading cleared; paste panel opens; import continues on paste |',
    '| Never loop OCR after timeout | `markPdfOcrTimedOut` → `OCR_SKIPPED_AFTER_TIMEOUT` until user retry |',
    '',
    '## Fix',
    '',
    '| Layer | Change |',
    '|-------|--------|',
    '| `document-extract.js` | No Tesseract preload — native probe first |',
    '| `enterprise-engine.js` | Stash native probe before OCR; quiet timeout logs |',
    '| `extract-file.js` | Recover native partial on timeout; clean paste fallback (no error array) |',
    '| `pdf-ocr-cache.js` | Block OCR re-run after hard timeout; clear on explicit user retry |',
    '| `pdf-ocr-run.js` | Mark file timed out at absolute ceiling |',
    '| `canonical-import.js` | No `console.error` on OCR timeout path |',
    '| `index.html` | `silentLog:true` paste fallback; 8s hint / 20s panel |',
    '',
    '## Automated checks',
    '',
    '| Suite | Result |',
    '|-------|--------|',
    ...results.map((r) => `| ${r.id} | ${r.ok ? 'PASS' : 'FAIL'} |`),
    '',
    '## Acceptance',
    '',
    pass
      ? [
          '- Selectable PDF: native extraction only (no OCR)',
          '- Scanned PDF: automatic import OR paste fallback within 20s',
          '- Timeout path: user-facing paste panel, no error-looking console spam',
          '- OCR does not re-run after hard timeout until user clicks “Réessayer la lecture PDF”',
        ].join('\n')
      : '- One or more checks failed — see suite table above.',
    '',
    '## Run',
    '',
    '```bash',
    'npm run qa:real-pdf-import-reliability',
    'npm run test:real-pdf-import-reliability',
    'npm run qa:pdf-timeout-fallback',
    '```',
    '',
  ];

  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
  console.log(`\nReport: ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
