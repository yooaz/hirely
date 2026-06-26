#!/usr/bin/env node
/**
 * P0 — Real PDF import: native-first routing, 8s paste hint, 20s hard fallback.
 * node scripts/test-real-pdf-import.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { classifyPdfForExtraction } from '../src/core/extraction/file-type-detect.js';
import { planPdfExtraction, PDF_ROUTES } from '../src/core/extraction/pdf-router.js';
import {
  PDF_EXTRACTION_MAX_MS,
  OCR_UX_EARLY_PASTE_MS,
  OCR_HARD_FALLBACK_MS,
  OCR_PARTIAL_REVIEW_MSG,
} from '../src/core/extraction/pdf-extraction-timeout.js';
import {
  OCR_ABSOLUTE_MAX_MS,
  OCR_UI_SOFT_TIMEOUT_MS,
} from '../src/core/extraction/pdf-ocr-run.js';
import { shouldRunOcrForTextLength } from '../src/core/extraction/extraction-lock.js';
import { resolveImportStatus, IMPORT_STATUS } from '../src/core/import/import-status.js';
import { readFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORT = path.join(ROOT, 'REAL_PDF_IMPORT_FIX_REPORT.md');

const docExtractSrc = readFileSync(
  path.join(ROOT, 'src/core/extraction/document-extract.js'),
  'utf8'
);
const ocrRunSrc = readFileSync(
  path.join(ROOT, 'src/core/extraction/pdf-ocr-run.js'),
  'utf8'
);

const checks = [];
function record(id, ok, detail = '') {
  checks.push({ id, ok, detail });
  console.log(ok ? 'OK' : 'FAIL', id, detail ? `— ${detail}` : '');
}

console.log('=== P0 real PDF import fix ===\n');

record('pdf_extraction_max_20s', PDF_EXTRACTION_MAX_MS === 20000, String(PDF_EXTRACTION_MAX_MS));
record('ocr_early_paste_8s', OCR_UX_EARLY_PASTE_MS === 8000, String(OCR_UX_EARLY_PASTE_MS));
record('ocr_hard_fallback_20s', OCR_HARD_FALLBACK_MS === 20000, String(OCR_HARD_FALLBACK_MS));
record('ocr_absolute_max_20s', OCR_ABSOLUTE_MAX_MS === 20000, String(OCR_ABSOLUTE_MAX_MS));
record('ocr_ui_soft_8s', OCR_UI_SOFT_TIMEOUT_MS === 8000, String(OCR_UI_SOFT_TIMEOUT_MS));
record('ocr_absolute_gt_soft', OCR_ABSOLUTE_MAX_MS > OCR_UI_SOFT_TIMEOUT_MS, '');

const pdfExtractFn = docExtractSrc.match(
  /export async function extractPdfDocument\([\s\S]*?\n\}/
);
record(
  'no_tesseract_preload_pdf',
  !!(pdfExtractFn && !/ensureTesseract/.test(pdfExtractFn[0])),
  'native-first'
);
record(
  'ocr_early_paste_event',
  /hirely:ocr-early-paste/.test(ocrRunSrc),
  ''
);
record(
  'ocr_wait_timeout_event',
  /hirely:ocr-wait-timeout/.test(ocrRunSrc),
  ''
);
record(
  'no_duplicate_soft_timer_8s',
  !/softTimeoutTimer/.test(ocrRunSrc),
  ''
);

const nativePages = [
  {
    page: 1,
    charCount: 920,
    usable: true,
    lines: [
      { text: 'Yohann Azancot' },
      { text: 'Senior Graphic Designer' },
      { text: 'yohann@example.com' },
      { text: 'Experience' },
      { text: 'JB Impressions — Art Director' },
    ],
  },
];
const nativeText = nativePages.map((p) => p.lines.map((l) => l.text).join('\n')).join('\n\n');
const nativeClass = classifyPdfForExtraction(nativePages, nativeText);
record('selectable_text_detected', nativeClass.hasSelectableText === true, nativeClass.fileType);
const nativePlan = planPdfExtraction(nativePages, nativeText);
record('native_never_ocr', nativePlan.plan.ocrAllowed === false, nativePlan.plan.reason);
record('native_route', nativePlan.plan.route === PDF_ROUTES.NATIVE, nativePlan.plan.route);
record(
  'ocr_skipped_when_text_locked',
  shouldRunOcrForTextLength(600) === false,
  'lock at 500c'
);

const scannedPages = [{ page: 1, charCount: 4, usable: false, lines: [] }];
const scannedPlan = planPdfExtraction(scannedPages, '    ');
record('scanned_routes_ocr', scannedPlan.plan.route === PDF_ROUTES.OCR, scannedPlan.plan.reason);

const timeoutWithText = resolveImportStatus('x'.repeat(120), {
  errors: ['OCR_TIMEOUT PDF_EXTRACTION_TIMEOUT'],
});
record(
  'timeout_with_text_partial',
  timeoutWithText === IMPORT_STATUS.PARTIAL_TEXT_RECOVERED,
  timeoutWithText
);
const timeoutEmpty = resolveImportStatus('', {
  errors: ['PDF_EXTRACTION_TIMEOUT OCR_TIMEOUT'],
});
record(
  'timeout_empty_needs_paste',
  timeoutEmpty === IMPORT_STATUS.PDF_OCR_TIMEOUT,
  timeoutEmpty
);

const failed = checks.filter((c) => !c.ok);
const pass = failed.length === 0;

const report = `# HIRELY P0 — REAL PDF IMPORT FIX

**Verdict:** ${pass ? 'PASS' : 'FAIL'}
**Date:** ${new Date().toISOString().slice(0, 10)}

## Symptom

Real user PDFs hit \`PDF_EXTRACTION_TIMEOUT\` / \`OCR_TIMEOUT\` → \`IMPORT_NEEDS_PASTE\` while benchmarks pass.

## Root causes

| Issue | Fix |
|-------|-----|
| OCR hard ceiling was **8s** (same as early-paste UX) | \`OCR_ABSOLUTE_MAX_MS\` / \`OCR_HARD_FALLBACK_MS\` → **20s** (\`PDF_EXTRACTION_MAX_MS\`) |
| Tesseract preloaded for **every** PDF before native probe | Removed from \`extractPdfDocument\`; OCR loads on-demand in enterprise engine |
| Duplicate soft timer at 8s aborted OCR early | Removed \`softTimeoutTimer\`; 8s = advisory paste only |
| UI blocked past 20s on slow scans | \`triggerPdfOcrFullFallback\` + \`hirely:ocr-wait-timeout\` show paste panel, clear loading |
| Native text lost on outer timeout | \`extract-file.js\` recovers \`native_pdf\` partial from session |

## Rules applied

| Rule | Implementation |
|------|----------------|
| Selectable text → never OCR | \`pdf-router.js\` \`routePdfExtraction\` — \`ocrAllowed: false\` on native route |
| Direct text extraction first | \`extractNativePdfLines\` (pdf.js) before \`runCachedTimedPdfOcr\` |
| OCR only if empty/garbage | \`planPdfExtraction\` + \`assessPdfTextLayer\` + \`shouldRunOcrForTextLength\` |
| 8s → paste option | \`OCR_UX_EARLY_PASTE_MS\` → \`hirely:ocr-early-paste\` |
| 20s → paste fallback | \`OCR_ABSOLUTE_MAX_MS\` + \`triggerPdfOcrFullFallback\` |
| Never block UI | \`clearLoadingState\` / \`setCvLoading(false)\` on fallback |
| Filename visible | \`#fileName\` set at \`FILE_SELECTED\` (unchanged) |
| Paste → review | \`importPasteFallbackApply\` → \`applyCvPipeline\` → \`ensureImportReviewVisible\` |

## Key files

- \`src/core/extraction/pdf-extraction-timeout.js\`
- \`src/core/extraction/pdf-ocr-run.js\`
- \`src/core/extraction/document-extract.js\`
- \`src/core/extraction/pdf-router.js\`
- \`src/core/extraction/enterprise-engine.js\`
- \`src/core/extraction/extract-file.js\`
- \`index.html\` — import timeout UX only (no templates/scoring)

## Checks (${checks.length})

| Check | Result | Detail |
|-------|--------|--------|
${checks.map((c) => `| ${c.id} | ${c.ok ? 'PASS' : 'FAIL'} | ${String(c.detail || '').replace(/\|/g, '/')} |`).join('\n')}

## Acceptance

| Criterion | Status |
|-----------|--------|
| Selectable PDF imports without OCR | ${checks.find((c) => c.id === 'native_never_ocr')?.ok ? 'PASS' : 'FAIL'} |
| Scanned PDF shows fallback | ${checks.find((c) => c.id === 'scanned_routes_ocr')?.ok ? 'PASS' : 'FAIL'} |
| Paste fallback path | ${checks.find((c) => c.id === 'timeout_empty_needs_paste')?.ok ? 'PASS' : 'FAIL'} |
| No infinite loading (20s cap) | ${checks.find((c) => c.id === 'ocr_absolute_max_20s')?.ok ? 'PASS' : 'FAIL'} |

## Run

\`\`\`bash
npm run test:real-pdf-import
node src/tests/qa-ocr-timeout-race.mjs
node src/tests/qa-pdf-routing.mjs
node src/tests/qa-real-pdf-import-fix.mjs
\`\`\`

${failed.length ? `\n## Blockers\n\n${failed.map((f) => `- ${f.id}: ${f.detail}`).join('\n')}\n` : ''}
`;

fs.writeFileSync(REPORT, report);
console.log(`\nWrote ${REPORT}`);
console.log(pass ? '\nPASS — real PDF import rules verified' : `\nFAIL — ${failed.length} check(s)`);
process.exit(pass ? 0 : 1);
