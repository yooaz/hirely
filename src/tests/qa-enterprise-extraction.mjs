#!/usr/bin/env node
/**
 * Enterprise extraction engine — acceptance tests.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadHirelyParse } from './load-hirely-parse.mjs';
import { extractPlainTextEnterprise } from '../core/extraction/enterprise-engine.js';
import {
  EXTRACTION_LINE_REVIEW_THRESHOLD,
  linesToPlainText,
} from '../core/extraction/extracted-line.js';
import { applyExtractionConfidenceGate } from '../core/parsing/extraction-line-gate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const yoaz = fs.readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8');
const enterprise = extractPlainTextEnterprise(yoaz, 'paste');
ok(enterprise.lines.length >= 20, 'plain text produces line archive');
ok(enterprise.metadata.extractionMethod === 'paste', 'paste metadata method');
ok(enterprise.rawExtraction.length > 500, 'rawExtraction preserved');
ok(enterprise.cleanedText?.length > 500, 'cleanedText preserved');
ok(
  enterprise.lines.every(
    (l) =>
      l.rawExtraction &&
      l.cleanedText &&
      typeof l.confidence === 'number' &&
      (l.source === 'native' || l.source === 'ocr')
  ),
  'every line has rawExtraction, cleanedText, confidence, source'
);
ok(linesToPlainText(enterprise.lines).includes('Yohann Azancot'), 'lines round-trip to text');

const lowLine = { text: 'Ce Frei Re', confidence: 42, source: 'ocr', page: 1, line: 0, x: 0, y: 0 };
const highLine = { text: 'Yohann Azancot', confidence: 92, source: 'native', page: 1, line: 1, x: 0, y: 0 };
const gated = applyExtractionConfidenceGate(
  { experience: ['Ce Frei Re', 'Freelance Illustrator'], unsorted: [] },
  [lowLine, highLine]
);
ok(gated.extractionReview.length === 1, 'low confidence line → review');
ok(gated.blocks.experience.includes('Freelance Illustrator'), 'high confidence line kept');
ok(!gated.blocks.experience.includes('Ce Frei Re'), 'low confidence line removed from experience');
ok(EXTRACTION_LINE_REVIEW_THRESHOLD === 60, 'review threshold is 60');

const Parse = await loadHirelyParse();
const pipe = await Parse.runExtractionPipeline(yoaz, { extractionMethod: 'paste-text' });
ok(pipe.structuredResume?.metadata?.rawExtraction, 'structuredResume.metadata.rawExtraction set');
ok(pipe.structuredResume?.metadata?.cleanedText, 'structuredResume.metadata.cleanedText set');
ok(Array.isArray(pipe.structuredResume?.extractionLines), 'structuredResume.extractionLines array');
ok(pipe.structuredResume?.rawExtraction?.length > 100, 'structuredResume.rawExtraction top-level');
ok(['paste', 'paste-text', 'txt', 'native_pdf', 'ocr', 'mixed', 'docx'].includes(pipe.extractionMethod) || pipe.extractionMethod, 'extractionMethod on pipe');

process.exit(failed ? 1 : 0);
