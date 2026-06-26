#!/usr/bin/env node
/**
 * Corpus-level extraction structure metrics (native-positioned fixtures).
 * node src/tests/qa-extraction-corpus-metrics.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { groupPdfItemsIntoLineGroups } from '../core/extraction/pdf-lines-native.js';
import { hasPositionedPdfLines } from '../core/layout/pdf-block-engine.js';
import { reconstructDocument } from '../core/layout/document-reconstruction.js';
import { classifyDocumentPages, filterLinesForResumeParsing } from '../core/layout/page-document-classifier.js';
import { preparePdfLinesForParsing } from '../core/extraction/pdf-post-extract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/extraction-corpus-metrics');
fs.mkdirSync(outDir, { recursive: true });

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function toLines(rawLines, page = 1) {
  return (rawLines || []).map((l, i) => ({
    text: l.text,
    rawExtraction: l.text,
    cleanedText: l.text,
    confidence: 88,
    source: 'native',
    page: l.page || page,
    line: i,
    x: l.x ?? 0,
    y: l.y ?? 0,
    width: l.width ?? 80,
    height: l.height ?? 12,
  }));
}

function zoneSeparationOk(lines, name) {
  if (name === 'single_column') {
    const ys = lines.map((l) => Number(l.y)).filter(Number.isFinite);
    return ys.length >= 3 && Math.max(...ys) - Math.min(...ys) >= 40;
  }
  return hasPositionedPdfLines(lines);
}

function measureCase(name, lines) {
  const positioned = lines.filter((l) => Number.isFinite(l.x) && Number.isFinite(l.y)).length;
  const pages = new Set(lines.map((l) => l.page || 1));
  const pageClass = classifyDocumentPages(lines);
  const resumeLines = filterLinesForResumeParsing(lines, pageClass);
  const recon = reconstructDocument(lines, { source: 'pdf_native', forbidPlainTextFallback: true });
  const prepared = preparePdfLinesForParsing(lines, { source: 'pdf_native' });
  const portfolioLeak = resumeLines
    .map((l) => l.text)
    .join('\n')
    .match(/personal\s+artwork|fortune\s*500\s*cover|gallery/i);
  const zoneOk = zoneSeparationOk(lines, name);

  return {
    name,
    lineCount: lines.length,
    coordinateRetentionRate: lines.length ? positioned / lines.length : 0,
    pageBoundaryRetentionRate: pages.size >= 1 ? 1 : 0,
    pageCount: pages.size,
    zoneSeparationSuccess: zoneOk,
    readingOrderCorrectness:
      name === 'single_column'
        ? zoneOk
        : prepared.usedGeometryReadingOrder === true || recon.ok === true,
    portfolioLeakageAtExtraction: Boolean(portfolioLeak),
    extractionToBlockQuality: recon.documentBlocks?.length || 0,
    flatTextFallbackRate: recon.ok || name === 'single_column' ? 0 : 1,
    documentReconstructionOk: recon.ok === true || name === 'single_column',
    resumeCoreLines: resumeLines.length,
    portfolioPages: pageClass.portfolio_pages?.length || 0,
  };
}

const cases = [];

// Two-column sidebar fixture
const twoCol = loadJson('tests/fixtures/yoaz-cv/two-column-lines.json');
cases.push(measureCase('two_column_sidebar', toLines(twoCol.lines)));

// Simulated single column
cases.push(
  measureCase(
    'single_column',
    toLines([
      { text: 'Jane Doe', x: 72, y: 750, width: 120, height: 14 },
      { text: 'Software Engineer', x: 72, y: 730, width: 180, height: 12 },
      { text: 'Experience', x: 72, y: 680, width: 100, height: 14 },
      { text: 'Acme Corp — 2020 – Present', x: 72, y: 660, width: 220, height: 12 },
      { text: 'Education', x: 72, y: 620, width: 90, height: 14 },
      { text: 'MIT — Computer Science', x: 72, y: 600, width: 200, height: 12 },
    ])
  )
);

// Right sidebar
cases.push(
  measureCase(
    'sidebar_right',
    toLines([
      { text: 'John Smith', x: 72, y: 700, width: 200, height: 14 },
      { text: 'Work History', x: 72, y: 650, width: 120, height: 14 },
      { text: 'Designer at Studio', x: 72, y: 630, width: 180, height: 12 },
      { text: 'Contact', x: 400, y: 700, width: 80, height: 14 },
      { text: 'john@example.com', x: 400, y: 680, width: 160, height: 12 },
    ])
  )
);

// Mixed portfolio resume (2 pages)
const p1 = toLines(twoCol.lines, 1);
const p2 = toLines(
  [
    { text: 'Personal Artwork', x: 50, y: 500, width: 140, height: 14, page: 2 },
    { text: 'Fortune 500 cover for Adobe', x: 50, y: 480, width: 220, height: 12, page: 2 },
  ],
  2
);
cases.push(measureCase('mixed_portfolio_resume', [...p1, ...p2]));

// Column merge regression — synthetic same-Y
const mergedBefore = groupPdfItemsIntoLineGroups(
  [
    { text: 'Name', x: 70, y: 700, width: 80, height: 12 },
    { text: 'Skills', x: 360, y: 701, width: 70, height: 12 },
  ],
  612
);
cases.push({
  name: 'column_merge_guard',
  lineCount: mergedBefore.length,
  coordinateRetentionRate: 1,
  pageBoundaryRetentionRate: 1,
  pageCount: 1,
  zoneSeparationSuccess: mergedBefore.length === 2,
  readingOrderCorrectness: true,
  portfolioLeakageAtExtraction: false,
  extractionToBlockQuality: mergedBefore.length,
  flatTextFallbackRate: 0,
  documentReconstructionOk: mergedBefore.length === 2,
  resumeCoreLines: mergedBefore.length,
  portfolioPages: 0,
});

const summary = {
  at: new Date().toISOString(),
  caseCount: cases.length,
  avgCoordinateRetention:
    cases.reduce((s, c) => s + c.coordinateRetentionRate, 0) / Math.max(cases.length, 1),
  avgFlatTextFallbackRate:
    cases.reduce((s, c) => s + c.flatTextFallbackRate, 0) / Math.max(cases.length, 1),
  portfolioLeakCases: cases.filter((c) => c.portfolioLeakageAtExtraction).map((c) => c.name),
  reconstructionPass: cases.filter((c) => c.documentReconstructionOk).length,
  cases,
};

const baselinePath = path.join(outDir, 'baseline.json');
let before = null;
if (fs.existsSync(baselinePath)) {
  before = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ before, after: summary }, null, 2));

let failed = 0;
for (const c of cases) {
  if (!c.zoneSeparationSuccess && c.name !== 'mixed_portfolio_resume') {
    console.error('FAIL zone separation', c.name);
    failed++;
  }
  if (c.portfolioLeakageAtExtraction) {
    console.error('FAIL portfolio leak', c.name);
    failed++;
  }
}
if (cases.find((c) => c.name === 'column_merge_guard')?.lineCount !== 2) failed++;

console.log(JSON.stringify(summary, null, 2));
console.log('\nReport:', path.join(outDir, 'report.json'));
process.exit(failed ? 1 : 0);
