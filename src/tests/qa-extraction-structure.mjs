#!/usr/bin/env node
/**
 * Extraction structure acceptance — column split, page boundaries, portfolio isolation.
 * node src/tests/qa-extraction-structure.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { groupPdfItemsIntoLineGroups } from '../core/extraction/pdf-lines-native.js';
import {
  splitRowItemsByColumnGap,
  groupItemsIntoLineGroups,
} from '../core/extraction/extraction-column-split.js';
import { buildExtractionDebugBundle } from '../core/extraction/extraction-debug-bundle.js';
import {
  classifyDocumentPages,
  filterLinesForResumeParsing,
} from '../core/layout/page-document-classifier.js';
import { hasPositionedPdfLines } from '../core/layout/pdf-block-engine.js';
import { reconstructDocument } from '../core/layout/document-reconstruction.js';
import { preparePdfLinesForParsing } from '../core/extraction/pdf-post-extract.js';
import { extractPlainTextEnterprise } from '../core/extraction/enterprise-engine.js';
import { resolveYoazPdfPath, bootstrapPdfJs } from '../../tests/lib/yoaz-live-pdf.mjs';
import { extractNativePdfLines } from '../core/extraction/pdf-lines-native.js';
import { persistExtractionDebugBundle } from '../core/extraction/extraction-debug-bundle.persist.node.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/extraction-structure');
fs.mkdirSync(outDir, { recursive: true });

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

// --- Column gap: sidebar + main must not merge on same Y ---
const sameYItems = [
  { text: 'Yohann Azancot', x: 80, y: 700, width: 140, height: 14 },
  { text: 'Experience', x: 380, y: 702, width: 100, height: 14 },
];
const split = splitRowItemsByColumnGap(sameYItems, 612);
ok(split.length === 2, 'column gap splits sidebar and main on same Y band');
const grouped = groupPdfItemsIntoLineGroups(sameYItems, 612);
ok(grouped.length === 2, 'groupPdfItemsIntoLineGroups keeps two columns separate');
ok(
  !grouped.some((g) => /yohann.*experience/i.test(g.text)),
  'no merged sidebar+main line text'
);

// --- Two-column fixture: zones separable, contact in left x band ---
const twoColFixture = JSON.parse(
  fs.readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/two-column-lines.json'), 'utf8')
);
const fixtureLines = twoColFixture.lines.map((l, i) => ({
  text: l.text,
  rawExtraction: l.text,
  cleanedText: l.text,
  confidence: 90,
  source: 'native',
  page: l.page || 1,
  line: i,
  x: l.x,
  y: l.y,
  width: l.width,
  height: l.height,
}));
ok(hasPositionedPdfLines(fixtureLines), 'two-column fixture has positioned lines');
const recon = reconstructDocument(fixtureLines, { source: 'pdf_native', forbidPlainTextFallback: true });
ok(recon.ok === true, 'document reconstruction succeeds on positioned two-column fixture');
const prepared = preparePdfLinesForParsing(fixtureLines, { source: 'pdf_native' });
ok(prepared.documentReconstruction === true, 'preparePdfLinesForParsing marks reconstruction ok');
const leftContact = fixtureLines.filter((l) => l.x < 200 && /yohann|hotmail|\+33/i.test(l.text));
const rightExp = fixtureLines.filter((l) => l.x > 300 && /experience|freelance|lisaa/i.test(l.text));
ok(leftContact.length >= 2, 'contact lines remain in left zone fixture');
ok(rightExp.length >= 2, 'experience/education remain in main zone fixture');

// --- Page boundaries: page 2 portfolio must not appear in resume-core stream ---
const mixedPages = [
  ...fixtureLines,
  {
    text: 'Personal Artwork — Fortune 500 cover illustration for Adobe',
    rawExtraction: 'Personal Artwork — Fortune 500 cover illustration for Adobe',
    cleanedText: 'Personal Artwork — Fortune 500 cover illustration for Adobe',
    confidence: 70,
    source: 'ocr',
    page: 2,
    line: 0,
    x: 40,
    y: 400,
    width: 300,
    height: 14,
  },
  {
    text: 'Metro display campaign for Nike',
    rawExtraction: 'Metro display campaign for Nike',
    cleanedText: 'Metro display campaign for Nike',
    confidence: 70,
    source: 'ocr',
    page: 2,
    line: 1,
    x: 200,
    y: 300,
    width: 260,
    height: 14,
  },
];
const pageClass = classifyDocumentPages(mixedPages);
const resumeLines = filterLinesForResumeParsing(mixedPages, pageClass);
const resumeText = resumeLines.map((l) => l.text).join('\n');
ok(pageClass.pages.length === 2, 'page classifier sees two pages');
ok(
  !/fortune\s*500\s*cover/i.test(resumeText),
  'portfolio page 2 captions excluded from resume-core extraction stream'
);
ok(/yohann azancot/i.test(resumeText), 'page 1 contact survives portfolio filter');

// --- Dates recognizable in fixture ---
ok(/\d{4}|present/i.test(resumeText), 'dates remain recognizable in resume-core stream');

// --- Enterprise paste path still produces debug bundle ---
const enterprisePaste = extractPlainTextEnterprise(
  fs.readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8'),
  'paste'
);
ok(enterprisePaste.metadata?.extractionDebug?.stage === 'extraction_debug_bundle', 'paste path emits extraction debug bundle');

// --- Yoaz PDF native probe + routing (Node) ---
await bootstrapPdfJs();
const yoazPdf = resolveYoazPdfPath(root);
if (yoazPdf) {
  const buf = fs.readFileSync(yoazPdf);
  const pdfjs = globalThis.pdfjsLib;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const { pages } = await extractNativePdfLines(pdf);
  ok(pdf.numPages === 2, 'Yoaz PDF has 2 pages');
  ok((pages[0]?.lines?.length || 0) === 0, 'Yoaz page 1 has no native text layer (image page)');
  ok((pages[1]?.lines?.length || 0) > 0, 'Yoaz page 2 has native text probe lines');

  const syntheticOcrP1 = fixtureLines.map((l) => ({ ...l, source: 'ocr', page: 1 }));
  const yoazClass = classifyDocumentPages([...syntheticOcrP1, ...mixedPages.filter((l) => l.page === 2)]);
  const yoazResume = filterLinesForResumeParsing(
    [...syntheticOcrP1, ...mixedPages.filter((l) => l.page === 2)],
    yoazClass
  );
  const debug = buildExtractionDebugBundle({
    allLines: [...syntheticOcrP1, ...mixedPages.filter((l) => l.page === 2)],
    parsingLines: yoazResume,
    pageDocumentClassification: yoazClass,
    method: 'mixed',
    spatialBlocks: [],
  });
  await persistExtractionDebugBundle(debug, path.join(outDir, 'yoaz'), 'yoaz');
  ok(debug.metrics.pageBoundaryRetentionRate === 1, 'Yoaz debug bundle retains page boundaries');
  ok(debug.metrics.portfolioPagesExcluded >= 1, 'Yoaz portfolio page marked excluded');
  console.log('Yoaz extraction debug:', path.join(outDir, 'yoaz', 'yoaz-extraction-debug.json'));
} else {
  console.warn('SKIP Yoaz PDF native probe — set HIRELY_YOAZ_PDF');
}

const report = {
  failed,
  at: new Date().toISOString(),
  checks: 'extraction-structure-v1',
};
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log('\nReport:', path.join(outDir, 'report.json'));
process.exit(failed ? 1 : 0);
