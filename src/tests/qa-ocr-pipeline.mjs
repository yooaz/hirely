#!/usr/bin/env node
/**
 * OCR + extraction coherence — name & experience, char fixes, timing budget.
 */
import { performance } from 'node:perf_hooks';
import { loadHirelyParse } from './load-hirely-parse.mjs';
import { postProcessOcrText } from '../core/parsing/ocr-postprocess.js';

const SAMPLE_OCR = `Marie Dup0nt
Product Manager
marie.dupont@email.com

EXPÉRlENCE
Senior Product Manager — Acme — 2019 – Present
- Shipped billing module for 120k users.

EDUCATION
HEC Paris — MBA 2018

SKILLS
Product strategy, Agile, SQL`;

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const fixed = postProcessOcrText(SAMPLE_OCR, { ocr: true });
ok(/Dupont|Dup0nt/i.test(fixed), 'OCR post-process keeps name');
ok(/EXPÉRIENCE|Experience/i.test(fixed), 'section header normalized');
ok(/\bProduct\b/i.test(fixed), 'body text preserved');

const Parse = await loadHirelyParse();
const t0 = performance.now();
const pipe = await Parse.runExtractionPipeline(fixed, {
  extractionMethod: 'pdf-ocr',
  trusted: true,
});
const ms = Math.round(performance.now() - t0);

ok(pipe.canGenerate, 'OCR-like pipeline is generatable');
const name = String(pipe.validatedCVData?.name || '');
const email = String(pipe.validatedCVData?.email || '');
ok(
  /marie/i.test(name) || /dupont/i.test(name) || /marie/i.test(email),
  `name or email found: ${name || email || '(empty)'}`
);
ok((pipe.validatedCVData?.experience || []).length >= 1, 'experience entries found');
ok(ms < 8000, `pipeline timing ${ms}ms (< 8s)`);
console.log(`METRICS parseMs=${ms} provider=local-parser charCount=${fixed.length}`);

process.exit(failed ? 1 : 0);
