#!/usr/bin/env node
/**
 * Regression: scanned-pdf experience + yoaz interests (site-blocking gate failures).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadHirelyParse } from './load-hirely-parse.mjs';
import { evaluateExtraction, evaluateYoazFixture } from '../../tests/lib/quality-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const Parse = await loadHirelyParse();

const scanned = fs.readFileSync(path.join(root, 'tests/fixtures/scanned-pdf/fixture.txt'), 'utf8');
const scannedPipe = await Parse.runExtractionPipeline(scanned, { extractionMethod: 'pdf-ocr' });
const scannedCv = scannedPipe.validatedCVData || {};
const scannedGate = evaluateExtraction({ cv: scannedCv, audit: null });
assert((scannedCv.experience || []).length >= 1, 'scanned-pdf: experience missing');
assert(!scannedGate.failures.includes('no experience'), 'scanned-pdf: gate still reports no experience');
console.log('OK scanned-pdf experience preserved');

const yoaz = fs.readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8');
const yoazPipe = await Parse.runExtractionPipeline(yoaz, { extractionMethod: 'paste' });
const yoazCv = yoazPipe.validatedCVData || {};
const yoazFails = evaluateYoazFixture(yoazCv, yoazPipe.cleanedText);
assert(!yoazFails.includes('yoaz interests not separated'), 'yoaz interests not separated');
assert(
  (yoazCv.interests || []).some((i) => /music|movies|nature/i.test(i)),
  'yoaz interests array empty'
);
console.log('OK yoaz-cv interests separated');

console.log('OK site extraction fixes');
