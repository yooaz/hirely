#!/usr/bin/env node
/**
 * Document Understanding Engine — success criteria (Yoaz two-column + multi-format).
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runP0Pipeline } from '../core/pipeline/p0-pipeline.js';
import { structuredToCvData } from '../core/parsing/structured-resume.js';
import { buildDocumentUnderstandingDebug } from '../debug/document-understanding-debug.js';
import { validateSectionBlocks } from '../core/parsing/section-validation.js';
import { matchEntitiesInLine } from '../core/parsing/entity-dictionaries.js';
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

const twoCol = JSON.parse(
  readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/two-column-lines.json'), 'utf8')
);
const yoazTxt = readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8');
const creativeTxt = readFileSync(path.join(root, 'tests/fixtures/creative-cv/fixture.txt'), 'utf8');

function linesFromJson(json) {
  return json.lines.map((l, i) => ({
    ...l,
    cleanedText: l.text,
    rawExtraction: l.text,
    confidence: 90,
    source: 'native',
    line: i,
  }));
}

const pdfResult = runP0Pipeline({ lines: linesFromJson(twoCol), source: 'pdf' });
const cv = structuredToCvData(pdfResult.structuredResume);

ok(pdfResult.neverRawParseCv, 'never raw parseCV');
ok(pdfResult.layout?.layoutType, 'layout detected');
ok(pdfResult.columns?.multiColumn !== undefined, 'columns stage');
ok(pdfResult.reading?.orderedBlocks?.length > 0 || pdfResult.reading?.blockCount > 0, 'reading order blocks');
ok(pdfResult.reading?.usedRawPdfOrder === false, 'not raw PDF line order');
ok(pdfResult.classifiedBlocks?.length >= 4, 'classified blocks');

const types = new Set(pdfResult.renderBlocks.map((b) => b.type));
ok(types.has('identity') || cv.name, 'identity');
ok(types.has('experience') || cv.experience?.length, 'experience');
ok(types.has('education') || cv.education?.length, 'education');
ok(types.has('clients') || cv.clients?.length, 'clients');
ok(types.has('tools') || cv.tools?.length, 'tools');
ok(types.has('languages') || cv.languages?.length, 'languages');

ok(cv.education?.some((e) => /LISAA/i.test(String(e))), 'LISAA in education');
ok(!cv.education?.some((e) => /Nike/i.test(String(e))), 'Nike not in education');
ok(cv.experience?.some((e) => /freelance|designer/i.test(String(e))), 'experience populated');
ok(cv.clients?.some((c) => /Nike|Marvel/i.test(String(c))), 'clients populated');
ok(cv.tools?.some((t) => /Photoshop|Illustrator/i.test(String(t))), 'tools populated');
ok(cv.languages?.length >= 1, 'languages populated');

const eduBlocks = pdfResult.classifiedBlocks.filter((b) => b.type === 'education');
const expBlocks = pdfResult.classifiedBlocks.filter((b) => b.type === 'experience');
ok(eduBlocks.some((b) => /LISAA/i.test(b.text)), 'LISAA block is education');
ok(!expBlocks.some((b) => /LISAA/i.test(b.text) && !/Créapole/i.test(b.text)), 'LISAA not experience block');

ok(pdfResult.confidence.threshold === P0_CONFIDENCE_THRESHOLD, 'threshold 70');
ok(
  pdfResult.renderBlocks.length + pdfResult.reviewBlocks.length ===
    pdfResult.classifiedBlocks.length,
  'all blocks gated'
);

const debug = buildDocumentUnderstandingDebug(pdfResult);
ok(debug.rawBlocks?.length > 0, 'debug raw blocks');
ok(debug.classifiedBlocks?.length > 0, 'debug classified blocks');
ok(debug.structuredJson != null, 'debug structured JSON');
ok(debug.classifiedBlocks[0].classificationReason != null || debug.classifiedBlocks[0].dictionaryMatch != null, 'debug has reason or dict');

const lisaaHit = matchEntitiesInLine('LISAA — Bachelor Design');
ok(lisaaHit?.entity === 'school', 'dictionary LISAA school');
const roleHit = matchEntitiesInLine('Graphic Designer');
ok(roleHit?.entity === 'role', 'dictionary Graphic Designer role');

const fakeExp = validateSectionBlocks([
  {
    id: 't1',
    type: 'experience',
    text: 'LISAA — Web & Motion Design',
    confidence: 75,
    bbox: { x: 0, y: 0, width: 0, height: 0 },
    page: 1,
    signals: [],
  },
]).blocks[0];
ok(fakeExp.type === 'education', 'validation: school not experience');

for (const [label, input] of [
  ['TXT', { rawText: yoazTxt, source: 'txt' }],
  ['DOCX', { rawText: creativeTxt, source: 'docx' }],
  ['paste', { rawText: creativeTxt, source: 'paste' }],
]) {
  const r = runP0Pipeline(input);
  ok(r.structuredResume?.metadata?.neverRawParseCv, `${label} never raw parse`);
  ok(r.pipelineVersion === 'p0-layout', `${label} p0-layout`);
}

process.exit(failed ? 1 : 0);
