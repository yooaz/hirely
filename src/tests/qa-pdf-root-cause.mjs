#!/usr/bin/env node
/**
 * PDF root cause — experience loss audit (text fixture; use ?debug=forensic for live PDF).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runProductionExtractionPipeline } from '../core/pipeline/production-pipeline.js';
import { buildPdfRootCauseReport, formatPdfRootCauseConsole } from '../debug/pdf-root-cause.js';

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
const pipe = await runProductionExtractionPipeline(yoaz, { extractionMethod: 'paste' });
const report = buildPdfRootCauseReport(pipe);

ok(report.rawPdfText.length > 100, 'rawPdfText present');
ok(report.blocksText.includes('[EXPERIENCE]') || report.blocksText.includes('[experience]'), 'blocks section includes experience');
ok(report.classifiedBlocksText.length > 0, 'classified blocks text');
ok(report.finalJsonText.includes('experience'), 'final JSON mentions experience');
ok(Array.isArray(report.lostExperience), 'lostExperience array');

console.log('\n' + formatPdfRootCauseConsole(report));

const unclassifiedFixture = [
  'Alex Martin',
  'Designer',
  'alex@example.com',
  '',
  'EXPERIENCE',
  'Studio Nova — packaging concepts 2019-2022',
  'Collaboration Atelier Rue — visual systems not a standard job block',
].join('\n');
const pipe2 = await runProductionExtractionPipeline(unclassifiedFixture, { extractionMethod: 'paste' });
const r2 = buildPdfRootCauseReport(pipe2);
ok(
  r2.lostExperience.some((row) => /Studio Nova|Atelier Rue/i.test(row.originalText)) ||
    (pipe2.validatedCVData?.experience?.length || 0) +
      (pipe2.validatedCVData?.unknownExperience?.length || 0) >=
      1,
  'fixture lines traced as lost or preserved in final JSON'
);

process.exit(failed ? 1 : 0);
