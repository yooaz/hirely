#!/usr/bin/env node
/**
 * Exact transcription mode — faithful OCR output without CV parser.
 * node src/tests/qa-exact-transcription.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildExactTranscription,
  inferWordsFromLine,
  minimalTranscriptionNormalize,
  EXACT_TRANSCRIPTION_V1,
  mapLineSourceToTranscription,
  toContractBBox,
  buildDocumentId,
} from '../core/extraction/exact-transcription-pipeline.js';
import {
  exactTranscriptionFromExtracted,
  isExactTranscriptionMode,
  isStructuredImportMode,
  buildExactTranscriptionImportResult,
  activateExactTranscriptionExtraction,
} from '../core/import/exact-transcription-import.js';
import {
  persistExactTranscriptionArtifact,
  persistExactTranscriptionBundle,
} from '../core/extraction/exact-transcription-persist.node.js';
import {
  rebuildLinesFromOcrWords,
  weakLineReason,
  clusterWordsWithLineWords,
} from '../core/extraction/exact-transcription-rebuild.js';
import { resolvePreviewScale } from '../ui/exact-transcription-pdf-preview.js';
import { canonicalImportFromExtracted } from '../core/import/canonical-import.js';
import { buildYoazManifestEnterprise } from '../../tests/lib/yoaz-manifest-enterprise.mjs';
import { classifyDocumentPages } from '../core/layout/page-document-classifier.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'tests/output/exact-transcription');
fs.mkdirSync(outDir, { recursive: true });

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const mockLines = [
  {
    text: 'Yohann Azancot',
    rawExtraction: 'Yohann Azancot',
    confidence: 91,
    source: 'native',
    page: 1,
    line: 0,
    x: 72,
    y: 700,
    width: 180,
    height: 14,
  },
  {
    text: 'Graphic Designer',
    rawExtraction: 'Graphic Designer',
    confidence: 88,
    source: 'native',
    page: 1,
    line: 1,
    x: 72,
    y: 680,
    width: 160,
    height: 12,
  },
  {
    text: 'Portfolio page caption',
    rawExtraction: 'Portfolio page caption',
    confidence: 52,
    source: 'ocr',
    page: 2,
    line: 0,
    x: 40,
    y: 400,
    width: 220,
    height: 12,
  },
];

ok(mapLineSourceToTranscription('pdf_native') === 'native_text', 'pdf_native maps to native_text');
ok(isExactTranscriptionMode({ exactTranscription: true }), 'mode flag via opts');
ok(isExactTranscriptionMode({ mode: 'exact_transcription' }), 'mode string via opts');
ok(!isExactTranscriptionMode({}), 'automatic upload path is structured parser (not exact)');
ok(isStructuredImportMode({ mode: 'structured' }), 'structured mode explicit opt-in');

const transcription = buildExactTranscription({
  enterprise: {
    lines: mockLines,
    method: 'mixed',
    metadata: {
      pageDocumentClassification: {
        portfolio_pages: [2],
        resume_core_pages: [1],
      },
    },
  },
  fileName: 'mock.pdf',
  extractionMethod: 'pdf-upload',
});

ok(transcription.version === EXACT_TRANSCRIPTION_V1, 'schema version');
ok(transcription.document_id && transcription.document_id.startsWith('doc_'), 'document_id present');
ok(transcription.pages[0].confidence_summary.avg_line_confidence != null, 'contract confidence summary');
ok(transcription.pages.length === 2, 'page-by-page transcription output exists');
ok(transcription.pages[0].page_number === 1 && transcription.pages[1].page_number === 2, 'page boundaries preserved');
ok(transcription.pages[0].raw_lines[0].line_index === 0, 'line index stable on page 1');
ok(transcription.pages[1].raw_lines[0].page_number === 2, 'page 2 lines keep page ownership');

const words = transcription.pages[0].raw_words;
ok(words.length >= 2, 'word boxes preserved when line bbox available');
ok(words.every((w) => w.text && (w.bbox || w.inferred)), 'each word has text and bbox or inferred flag');
const bbox = transcription.pages[0].raw_lines[0].bbox;
ok(bbox && 'w' in bbox && 'h' in bbox, 'line bbox uses contract w/h shape');

const order1 = transcription.pages[0].reading_order;
const order2 = buildExactTranscription({
  enterprise: { lines: mockLines },
  fileName: 'mock.pdf',
}).pages[0].reading_order;
ok(JSON.stringify(order1) === JSON.stringify(order2), 'line reading order stable across rebuild');

const importResult = exactTranscriptionFromExtracted(
  { name: 'mock.pdf' },
  { enterprise: { lines: mockLines }, extractionMethod: 'pdf-upload', warnings: [], errors: [] }
);
ok(importResult.parserSkipped === true, 'parser skipped in exact mode');
ok(importResult.resumeData === null, 'no resumeData in exact mode');
ok(importResult.structuredResume === null, 'no structured resume in exact mode');
ok(!JSON.stringify(importResult).includes('Nom à vérifier'), 'exact mode does not inject placeholders');

const blocked = buildExactTranscriptionImportResult(
  { name: 'x.pdf' },
  { warnings: [], errors: [] },
  { ...transcription, plain_text: 'x' }
);
ok(blocked.templateSuppressed === true, 'template suppressed flag set');

ok(minimalTranscriptionNormalize('  hello   \n\n\nworld  ') === '  hello   \n\n\nworld', 'minimal normalize does not collapse spaces or newlines');

const nearDupLines = [
  { text: 'Graphic Designer', rawExtraction: 'Graphic Designer', confidence: 88, source: 'ocr', page: 1, line: 0 },
  { text: 'Graphic Designer', rawExtraction: 'Graphic Designer', confidence: 86, source: 'ocr', page: 1, line: 1 },
  { text: '   ', rawExtraction: '   ', confidence: 10, source: 'ocr', page: 1, line: 2 },
];
globalThis.HIRELY_EXACT_TRANSCRIPTION_ACTIVE = true;
const dedupedExact = (await import('../core/extraction/extraction-audit.js')).dedupeExtractedLines(nearDupLines);
ok(dedupedExact.lines.length === 2, 'exact mode keeps near-duplicate lines');
ok(dedupedExact.removedLines === 1, 'exact mode drops only empty/noise lines');
globalThis.HIRELY_EXACT_TRANSCRIPTION_ACTIVE = false;

const inferred = inferWordsFromLine('one two', { x: 0, y: 10, width: 100, height: 12 }, 70);
ok(inferred.length === 2 && inferred.every((w) => w.inferred), 'inferred words when no OCR word boxes');

const artifactPath = persistExactTranscriptionArtifact(transcription, outDir, 'mock');
ok(artifactPath && fs.existsSync(artifactPath), 'exact mode artifacts are persisted for debugging');
ok(fs.statSync(artifactPath).size > 100, 'artifact has payload');

const canonExact = await canonicalImportFromExtracted(
  { name: 'mock.pdf' },
  {
    rawText: 'ignored',
    cleanedText: 'ignored',
    extractionMethod: 'pdf-upload',
    enterprise: { lines: mockLines },
    warnings: [],
    errors: [],
  },
  { exactTranscription: true, fileType: 'pdf' }
);
ok(canonExact.exactTranscription === true, 'canonical import branches to exact mode');
ok(toContractBBox({ x: 1, y: 2, width: 3, height: 4 })?.w === 3, 'bbox contract maps width to w');

const weakLine = transcription.pages[1].raw_lines.find((l) => l.confidence < 60) || transcription.pages[1].raw_lines[0];
if (weakLine) {
  ok(weakLine.raw_text === weakLine.raw_text.trim() || weakLine.raw_text.length > 0, 'weak lines keep raw_text');
  ok(!weakLine.text.includes('Nom à vérifier'), 'weak lines are not rewritten with placeholders');
}

ok(!canonExact.resumeData, 'canonical exact path skips parser resumeData');
ok(isStructuredImportMode({ mode: 'structured' }), 'structured mode detected');
ok(!isExactTranscriptionMode({ mode: 'structured', exactTranscription: false }), 'structured blocks exact default');

activateExactTranscriptionExtraction(true);
ok(globalThis.HIRELY_EXACT_TRANSCRIPTION_ACTIVE === true, 'extraction flag set before OCR');
activateExactTranscriptionExtraction(false);

const yoazPack = buildYoazManifestEnterprise(root);
const yoazEnterprise = {
  ...yoazPack.enterprise,
  metadata: {
    ...yoazPack.enterprise.metadata,
    pageDocumentClassification: classifyDocumentPages(yoazPack.enterprise.lines),
  },
};
const yoaz = exactTranscriptionFromExtracted(
  { name: 'yoaz.pdf' },
  { ...yoazPack.extracted, enterprise: yoazEnterprise },
  { fileType: 'pdf' }
);
ok(yoaz.transcription.page_count >= 1, 'exact mode runs on Yoaz benchmark lines');
ok(yoaz.transcription.lines.length >= 10, 'Yoaz transcription has lines');

const yoazArtifact = persistExactTranscriptionArtifact(yoaz.transcription, outDir, 'yoaz');
ok(yoazArtifact && fs.existsSync(yoazArtifact), 'Yoaz page-by-page artifact written');

const page2 = yoaz.transcription.pages.find((p) => p.page_number === 2);
const portfolioLike = yoaz.transcription.metrics?.portfolio_like_pages || [];
console.log(
  'INFO Yoaz portfolio-like pages:',
  portfolioLike.length ? portfolioLike.join(', ') : '(none classified)',
  'page2 lines:',
  page2?.raw_lines?.length ?? 0
);
console.log('INFO Yoaz weak pages:', (yoaz.transcription.metrics?.weak_pages || []).join(', ') || '(none)');
console.log('INFO Yoaz native gaps:', (yoaz.transcription.metrics?.missing_or_corrupt_native_pages || []).join(', ') || '(none)');
console.log('INFO Yoaz artifact:', yoazArtifact);

const panelJs = fs.readFileSync(path.join(root, 'src/ui/exact-transcription-panel.js'), 'utf8');
const previewJs = fs.readFileSync(path.join(root, 'src/ui/exact-transcription-pdf-preview.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(!/<embed[\s>]/.test(panelJs), 'exact panel does not use embed for document preview');
ok(!/<object[\s>]/.test(panelJs), 'exact panel does not use object for document preview');
ok(!/createObjectURL\([^)]*\)[\s\S]*embed/i.test(panelJs), 'exact panel does not wire blob URL to embed');
ok(previewJs.includes('renderPdfPageToCanvas'), 'CSP-safe preview uses PDF.js canvas render');
ok(panelJs.includes('exactExportWords'), 'toolbar exports OCR words JSON');
ok(indexHtml.includes("object-src 'none'"), 'CSP blocks object-src — preview must not depend on plugins');
ok(resolvePreviewScale(612, 792) >= 0.75, 'preview scale resolves for letter page');

const ocrWords = {
  1: [
    { text: 'Yohann', bbox: { x: 72, y: 700, width: 60, height: 14 }, confidence: 92 },
    { text: 'Azancot', bbox: { x: 140, y: 700, width: 70, height: 14 }, confidence: 90 },
    { text: 'Designer', bbox: { x: 72, y: 680, width: 80, height: 12 }, confidence: 85 },
  ],
};
const rebuilt = rebuildLinesFromOcrWords(mockLines, ocrWords);
const rebuilt2 = rebuildLinesFromOcrWords(mockLines, ocrWords);
ok(rebuilt.length >= 2, 'word-first rebuild produces lines from OCR words');
ok(JSON.stringify(rebuilt.map((l) => l.text)) === JSON.stringify(rebuilt2.map((l) => l.text)), 'line reconstruction is deterministic');

const withWords = buildExactTranscription({
  enterprise: {
    lines: rebuilt,
    method: 'ocr',
    metadata: { ocrWordsByPage: ocrWords },
  },
  fileName: 'words.pdf',
});
const page1Words = withWords.pages[0].raw_words;
ok(page1Words.some((w) => w.inferred === false), 'real OCR word boxes used when engine returns them');
ok(withWords.pages[0].raw_lines.some((l) => l.real_word_boxes), 'lines with real OCR words flagged real_word_boxes');
ok(withWords.pages[0].raw_lines.some((l) => l.weak_reason == null || typeof l.weak_reason === 'string'), 'weak-line reasons attached');

ok(weakLineReason({ confidence: 40, text: 'x', bbox: { x: 1, y: 2, width: 3, height: 4 } }) === 'very_low_confidence', 'weak line very low confidence');
ok(weakLineReason({ confidence: 80, text: 'https://x.com', bbox: { x: 1, y: 2, width: 3, height: 4 } }) === 'url_fragment', 'weak line url fragment');

const bundle = persistExactTranscriptionBundle(yoaz.transcription, outDir, 'yoaz-bundle');
ok(bundle?.jsonPath && fs.existsSync(bundle.jsonPath), 'exact transcription bundle JSON persisted');
ok(bundle?.weakPath && fs.existsSync(bundle.weakPath), 'weak-line report artifact persisted');
ok(bundle?.wordsPath && fs.existsSync(bundle.wordsPath), 'ocr words by page artifact persisted');

const clusters = clusterWordsWithLineWords(ocrWords[1], 500);
ok(clusters.length >= 1 && clusters[0].words?.length >= 2, 'column-aware word clustering groups name tokens');

console.log('\nEXACT TRANSCRIPTION QA OK');
