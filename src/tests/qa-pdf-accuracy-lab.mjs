#!/usr/bin/env node
/**
 * PDF Accuracy Lab report builder (unit-level, no browser).
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runP0Pipeline } from '../core/pipeline/p0-pipeline.js';
import { extractPlainTextEnterprise } from '../core/extraction/enterprise-engine.js';
import {
  buildPdfAccuracyReport,
  findClassificationErrors,
  findDroppedLines,
} from '../debug/pdf-accuracy-lab.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

const json = JSON.parse(
  readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/two-column-lines.json'), 'utf8')
);
const lines = json.lines.map((l, i) => ({
  ...l,
  cleanedText: l.text,
  rawExtraction: l.text,
  confidence: 92,
  source: 'native',
  line: i,
}));
const rawText = lines.map((l) => l.text).join('\n');
const detailed = {
  text: rawText,
  method: 'native_pdf',
  enterprise: extractPlainTextEnterprise(rawText, 'native_pdf'),
};
detailed.enterprise.lines = lines;

const p0 = runP0Pipeline({ lines, rawText, source: 'pdf' });
const report = buildPdfAccuracyReport({
  detailed,
  p0,
  fileName: 'fixture:yoaz',
  pageCount: 1,
});

ok(report.metrics.pages === 1, 'pages');
ok(report.metrics.textBlocks >= 10, 'text blocks');
ok(report.metrics.columns.multiColumn === true, 'multi column');
ok(report.metrics.detectedSections.includes('education'), 'education section');
ok(report.metrics.confidenceOverall > 0, 'confidence');
ok(typeof report.metrics.textLossPct === 'number', 'text loss');
ok(report.stages.layoutBlocks.length > 0, 'layout blocks stage');
ok(report.stages.classifiedBlocks.length > 0, 'classified blocks');
ok(report.comparison.length > 0, 'side-by-side rows');

const dropped = findDroppedLines(rawText, p0.renderBlocks, p0.structuredResume);
ok(dropped.length < rawText.split('\n').length * 0.5, 'not everything dropped');

const errs = findClassificationErrors(p0.classifiedBlocks);
ok(Array.isArray(errs), 'classification errors array');

process.exit(failed ? 1 : 0);
