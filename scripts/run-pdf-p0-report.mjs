#!/usr/bin/env node
/**
 * Run uploaded PDF through P0 document understanding (no templates).
 * Usage: node scripts/run-pdf-p0-report.mjs [path/to/cv.pdf]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const { getDocument, GlobalWorkerOptions } = pdfjs;
import { extractNativePdfLines } from '../src/core/extraction/pdf-lines-native.js';
import { extractPlainTextEnterprise } from '../src/core/extraction/enterprise-engine.js';
import { detectLayout } from '../src/core/layout/detect-layout.js';
import { runP0Pipeline } from '../src/core/pipeline/p0-pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const DEFAULT_PDF = '/Users/yohannazancot/Documents/yohann azancot cv 2024.pdf';

GlobalWorkerOptions.workerSrc = path.join(
  root,
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.js'
);

function loadFixtureLines(fixtureId) {
  const map = {
    yoaz: 'tests/fixtures/yoaz-cv/two-column-lines.json',
    'yoaz-two-column': 'tests/fixtures/yoaz-cv/two-column-lines.json',
  };
  const rel = map[fixtureId];
  if (!rel) throw new Error(`Unknown fixture: ${fixtureId}`);
  const json = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  return {
    sourceLabel: `fixture:${fixtureId}`,
    lines: json.lines.map((l, i) => ({
      ...l,
      cleanedText: l.text,
      rawExtraction: l.text,
      confidence: 92,
      source: 'native',
      line: i,
      pdfIndex: i,
    })),
    layoutType: json.layoutType,
  };
}

function pickPdfPath(argvPath) {
  if (argvPath === '--fixture' || argvPath?.startsWith('--fixture=')) {
    const id = argvPath.includes('=') ? argvPath.split('=')[1] : process.argv[3] || 'yoaz';
    return { fixture: id };
  }
  if (argvPath && fs.existsSync(argvPath)) return path.resolve(argvPath);
  const candidates = [
    process.env.HIRELY_PDF_PATH,
    DEFAULT_PDF,
    path.join(root, 'tests/fixtures/text-pdf/document.pdf'),
    '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return path.resolve(p);
  }
  throw new Error(
    `PDF not found. Pass path: node scripts/run-pdf-p0-report.mjs "/path/to/cv.pdf"`
  );
}

function summarizeBlock(b) {
  return {
    id: b.id,
    page: b.page,
    x: Math.round(b.x ?? b.bbox?.x ?? 0),
    y: Math.round(b.y ?? b.bbox?.y ?? 0),
    width: Math.round(b.width ?? b.bbox?.width ?? 0),
    height: Math.round(b.height ?? b.bbox?.height ?? 0),
    column: b.column || null,
    type: b.type,
    confidence: b.confidence,
    accepted: b.accepted,
    classificationReason: b.classificationReason || (b.signals || []).slice(0, 4).join(', '),
    dictionaryMatch: b.dictionaryMatch || b.entityMatch
      ? {
          entity: (b.dictionaryMatch || b.entityMatch).entity,
          term: (b.dictionaryMatch || b.entityMatch).term,
          boost: (b.dictionaryMatch || b.entityMatch).boost,
        }
      : null,
    textPreview: String(b.text || '').slice(0, 120),
  };
}

async function main() {
  const picked = pickPdfPath(process.argv[2]);
  let pdfPath;
  let enterprise;

  if (picked && typeof picked === 'object' && picked.fixture) {
    const fx = loadFixtureLines(picked.fixture);
    pdfPath = fx.sourceLabel;
    const rawText = fx.lines.map((l) => l.text).join('\n');
    enterprise = extractPlainTextEnterprise(rawText, 'native_pdf');
    enterprise.lines = fx.lines;
    enterprise.method = 'native_pdf';
    enterprise.metadata = {
      ...enterprise.metadata,
      extractionMethod: 'native_pdf',
      fixtureLayout: fx.layoutType,
    };
  } else {
    pdfPath = picked;
    const buffer = fs.readFileSync(pdfPath);
    const pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
    const { pages, firstPageHeaderLines } = await extractNativePdfLines(pdf);
    const lines = pages.flatMap((p) => p.lines);
    if (lines.length < 8) {
      throw new Error(
        `Native PDF text too sparse (${lines.length} lines). OCR requires browser — open Hirely and upload this file.`
      );
    }
    const rawText = lines.map((l) => l.text).join('\n');
    enterprise = extractPlainTextEnterprise(rawText, 'native_pdf');
    enterprise.lines = lines;
    enterprise.method = 'native_pdf';
    enterprise.metadata = {
      ...enterprise.metadata,
      extractionMethod: 'native_pdf',
      pdfNative: true,
      pageCount: pdf.numPages,
      firstPageHeaderLines,
      layoutHint: detectLayout({ lines, rawText }),
      textLayerWarning:
        rawText.length < 200
          ? 'PDF text layer is sparse or visual-only — layout engine cannot reconstruct sections from coordinates.'
          : null,
    };
  }
  const p0 = runP0Pipeline({
    lines: enterprise.lines,
    rawText: enterprise.rawExtraction,
    cleanedText: enterprise.cleanedText,
    source: 'pdf',
    ocrLayout: enterprise.metadata?.ocrLayout,
  });

  const report = {
    pdfFile: pdfPath,
    extractionMethod: enterprise.method,
    charCount: enterprise.rawExtraction?.length,
    lineCount: enterprise.lines?.length,
    textLayerWarning: enterprise.metadata?.textLayerWarning || null,
    '1_layoutDetected': {
      layoutType: p0.layout?.layoutType,
      confidence: p0.layout?.confidence,
      signals: p0.layout?.signals,
      columnSplit: p0.layout?.columnSplit ?? p0.layout?.geometry?.columnSplit,
    },
    '2_columnsDetected': {
      stage: p0.columns?.stage,
      splitX: p0.columns?.splitX,
      leftCount: p0.columns?.leftCount,
      rightCount: p0.columns?.rightCount,
      multiColumn: p0.columns?.multiColumn,
      layoutType: p0.columns?.layoutType,
    },
    '3_blocksExtracted': {
      geometricBlockCount: p0.blocks?.blocks?.length,
      readingBlockCount: p0.reading?.blockCount,
      orderedLineCount: p0.reading?.orderedLineCount,
      usedColumnReconstruction: p0.reading?.usedColumnReconstruction,
      blocks: (p0.reading?.orderedBlocks || []).map((b) => ({
        id: b.id,
        column: b.column,
        sectionHint: b.sectionHint || b.sectionKey,
        x: Math.round(b.x ?? 0),
        y: Math.round(b.y ?? 0),
        width: Math.round(b.width ?? 0),
        height: Math.round(b.height ?? 0),
        lineCount: b.lineCount,
        textPreview: String(b.text || '').slice(0, 100),
      })),
    },
    '4_blockClassifications': {
      total: p0.classifiedBlocks?.length,
      renderCount: p0.confidence?.renderCount,
      reviewCount: p0.confidence?.reviewCount,
      typeCounts: p0.classifiedBlocks?.reduce((acc, b) => {
        acc[b.type] = (acc[b.type] || 0) + 1;
        return acc;
      }, {}),
      blocks: (p0.classifiedBlocks || []).map(summarizeBlock),
    },
    '5_structuredResume': p0.structuredResume,
  };

  const out = process.env.JSON_ONLY === '1' ? JSON.stringify(report, null, 2) : formatHumanReport(report);
  console.log(out);
}

function formatHumanReport(report) {
  const lines = [];
  lines.push(`PDF: ${report.pdfFile}`);
  lines.push(`Extraction: ${report.extractionMethod} · ${report.lineCount} lines · ${report.charCount} chars`);
  if (report.textLayerWarning) {
    lines.push(`⚠ ${report.textLayerWarning}`);
  }
  lines.push('');
  lines.push('── 1. LAYOUT DETECTED ──');
  lines.push(JSON.stringify(report['1_layoutDetected'], null, 2));
  lines.push('');
  lines.push('── 2. COLUMNS DETECTED ──');
  lines.push(JSON.stringify(report['2_columnsDetected'], null, 2));
  lines.push('');
  lines.push('── 3. BLOCKS EXTRACTED ──');
  lines.push(`count: ${report['3_blocksExtracted'].readingBlockCount} · column reconstruction: ${report['3_blocksExtracted'].usedColumnReconstruction}`);
  for (const b of report['3_blocksExtracted'].blocks) {
    lines.push(`  [${b.column || 'full'}] ${b.textPreview}`);
  }
  lines.push('');
  lines.push('── 4. BLOCK CLASSIFICATIONS ──');
  lines.push(`types: ${JSON.stringify(report['4_blockClassifications'].typeCounts)} · render ${report['4_blockClassifications'].renderCount} / review ${report['4_blockClassifications'].reviewCount}`);
  for (const b of report['4_blockClassifications'].blocks) {
    const dict = b.dictionaryMatch ? ` · ${b.dictionaryMatch.entity}:${b.dictionaryMatch.term}` : '';
    lines.push(`  ${b.type} ${b.confidence}% ${b.accepted ? 'RENDER' : 'REVIEW'}${dict}`);
    lines.push(`    reason: ${b.classificationReason}`);
    lines.push(`    text: ${b.textPreview}`);
  }
  lines.push('');
  lines.push('── 5. STRUCTURED RESUME JSON ──');
  lines.push(JSON.stringify(report['5_structuredResume'], null, 2));
  return lines.join('\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
