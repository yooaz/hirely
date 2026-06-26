#!/usr/bin/env node
/**
 * Corpus-level extraction runtime report (native probe + hybrid routing).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractNativePdfLines } from '../core/extraction/pdf-lines-native.js';
import { planPdfExtraction } from '../core/extraction/pdf-router.js';
import { isNativePageTrusted, nativeTrustAudit } from '../core/extraction/native-text-trust.js';
import { pdfExtractionBudgetMs } from '../core/extraction/pdf-extraction-timeout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/extraction-runtime-report');
fs.mkdirSync(outDir, { recursive: true });

const fixtures = [
  {
    name: 'yoaz_hybrid',
    path: path.join(root, 'tests/fixtures/yoaz-pdf-benchmark/document.pdf'),
  },
];

const rows = [];
for (const fx of fixtures) {
  if (!fs.existsSync(fx.path)) continue;
  const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync(fx.path)) }).promise;
  const { pages } = await extractNativePdfLines(pdf);
  const allNative = pages.map((p) => p.lines.map((l) => l.text).join('\n')).join('\n\n');
  const { plan, pdfClassification } = planPdfExtraction(pages, allNative, {});
  rows.push({
    name: fx.name,
    pageCount: pdf.numPages,
    route: plan.route,
    ocrMode: plan.ocrMode,
    extractionBudgetMs: pdfExtractionBudgetMs(pdf.numPages),
    nativeTrust: nativeTrustAudit(allNative),
    pages: pages.map((p) => ({
      page: p.page,
      charCount: p.charCount,
      usable: p.usable,
      nativeTrusted: isNativePageTrusted(p),
    })),
    classification: pdfClassification,
  });
}

const report = { timestamp: new Date().toISOString(), fixtures: rows };
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log('Report:', path.join(outDir, 'report.json'));
