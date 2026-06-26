#!/usr/bin/env node
/**
 * Hybrid PDF runtime routing — per-page decisions without full browser OCR.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractNativePdfLines } from '../core/extraction/pdf-lines-native.js';
import { planPdfExtraction, PDF_ROUTES } from '../core/extraction/pdf-router.js';
import { isNativePageTrusted } from '../core/extraction/native-text-trust.js';
import { pdfExtractionBudgetMs } from '../core/extraction/pdf-extraction-timeout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/hybrid-pdf-runtime');
fs.mkdirSync(outDir, { recursive: true });

const pdfPath = path.join(root, 'tests/fixtures/yoaz-pdf-benchmark/document.pdf');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)) }).promise;
const { pages } = await extractNativePdfLines(pdf);
const allNative = pages.map((p) => p.lines.map((l) => l.text).join('\n')).join('\n\n');
const { plan } = planPdfExtraction(pages, allNative, {});

ok(plan.route === PDF_ROUTES.HYBRID, `yoaz routes hybrid (got ${plan.route})`);
ok(plan.ocrMode === 'per_page', 'hybrid uses per_page OCR mode');
ok(!isNativePageTrusted(pages[0]), 'page 1 requires OCR');
ok(!isNativePageTrusted(pages[1]), 'page 2 corrupt native rejected');
ok(pdfExtractionBudgetMs(2) >= 30000, `multi-page budget >= 30s (got ${pdfExtractionBudgetMs(2)})`);

const report = {
  timestamp: new Date().toISOString(),
  pdf: pdfPath,
  pageCount: pdf.numPages,
  plan,
  pages: pages.map((p) => ({
    page: p.page,
    charCount: p.charCount,
    usable: p.usable,
    nativeTrusted: isNativePageTrusted(p),
  })),
  extractionBudgetMs: pdfExtractionBudgetMs(pdf.numPages),
};
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log('Report:', path.join(outDir, 'report.json'));

process.exit(failed ? 1 : 0);
