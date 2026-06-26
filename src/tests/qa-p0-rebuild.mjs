#!/usr/bin/env node
/**
 * P0 rebuild — same structuredResume shape for TXT, DOCX-style paste, two-column PDF lines.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runP0Pipeline } from '../core/pipeline/p0-pipeline.js';
import { structuredToCvData } from '../core/parsing/structured-resume.js';
import { extractPlainTextEnterprise } from '../core/extraction/enterprise-engine.js';
import { P0_CONFIDENCE_THRESHOLD } from '../core/parsing/confidence-scoring.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const yoazTxt = readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8');
const creativeTxt = readFileSync(path.join(root, 'tests/fixtures/creative-cv/fixture.txt'), 'utf8');
const twoColJson = JSON.parse(
  readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/two-column-lines.json'), 'utf8')
);

function assertStructuredShape(result, label) {
  ok(result.neverRawParseCv === true, `${label}: neverRawParseCv`);
  ok(result.structuredResume?.metadata?.neverRawParseCv === true, `${label}: resume never raw parse`);
  const cv = structuredToCvData(result.structuredResume);
  ok(cv && typeof cv === 'object', `${label}: cvData object`);
  ok('identity' in cv || cv.name, `${label}: identity section`);
  ok(Array.isArray(cv.experience), `${label}: experience array`);
  ok(Array.isArray(cv.education), `${label}: education array`);
  ok(result.pipelineVersion === 'p0-layout', `${label}: p0-layout version`);
  ok(result.layout?.layoutType, `${label}: layout detected`);
  ok(result.columns?.stage === 'columns', `${label}: columns stage`);
  ok(result.blocks?.stage === 'blocks', `${label}: blocks stage`);
  ok(result.reading?.stage === 'reading_order', `${label}: reading order stage`);
  ok(result.confidence?.threshold === P0_CONFIDENCE_THRESHOLD, `${label}: threshold 70`);
}

const txtEnterprise = extractPlainTextEnterprise(yoazTxt, 'txt');
const txtResult = runP0Pipeline({
  lines: txtEnterprise.lines,
  rawText: txtEnterprise.rawExtraction,
  cleanedText: txtEnterprise.cleanedText,
  source: 'txt',
});
assertStructuredShape(txtResult, 'TXT');

const pasteResult = runP0Pipeline({
  rawText: creativeTxt,
  cleanedText: creativeTxt,
  source: 'paste',
});
assertStructuredShape(pasteResult, 'creative paste');

const docxResult = runP0Pipeline({
  lines: extractPlainTextEnterprise(creativeTxt, 'docx').lines,
  rawText: creativeTxt,
  source: 'docx',
});
assertStructuredShape(docxResult, 'DOCX-lines');

const pdfLines = twoColJson.lines.map((l, i) => ({
  ...l,
  cleanedText: l.text,
  rawExtraction: l.text,
  confidence: 90,
  source: 'native',
  line: i,
}));
const pdfResult = runP0Pipeline({ lines: pdfLines, source: 'pdf' });
assertStructuredShape(pdfResult, 'two-column PDF');
ok(pdfResult.reading?.usedColumnReconstruction === true, 'PDF column reconstruction');
const cvPdf = structuredToCvData(pdfResult.structuredResume);
ok(cvPdf.education?.some((e) => /LISAA/i.test(String(e))), 'PDF education LISAA');
ok(
  pdfResult.renderBlocks.length + pdfResult.reviewBlocks.length ===
    pdfResult.classifiedBlocks.length,
  'render + review = all blocks'
);

ok(pasteResult.confidence.renderCount >= 1, 'has renderable blocks');
ok(P0_CONFIDENCE_THRESHOLD === 70, 'P0 threshold is 70');

process.exit(failed ? 1 : 0);
