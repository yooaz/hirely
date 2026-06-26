#!/usr/bin/env node
/**
 * CV text normalization — unit tests + Yohann fixture examples.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  normalizeCvLine,
  normalizeCvDocument,
  normalizeCvDatesInLine,
  normalizeCvWordsInLine,
  CORRECTION_RULE,
  YOAZ_NORMALIZATION_EXAMPLES,
} from '../core/parsing/cv-text-normalization.js';
import { normalizeOcrDocument } from '../core/parsing/ocr-normalization.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const yoazOcrFixture = readFileSync(
  join(__dir, '../../tests/fixtures/yoaz-pdf-live/ocr-fragmented.txt'),
  'utf8'
);

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

// --- Date normalization ---
ok(normalizeCvLine('20112023').text === '2011 - 2023', 'merged years 20112023');
ok(normalizeCvLine('2011 2023').text === '2011 - 2023', 'spaced years 2011 2023');
ok(normalizeCvLine('2011–2023').text === '2011 - 2023', 'en-dash years 2011–2023');
ok(normalizeCvLine('20m - 2023').text === '2011 - 2023', 'OCR 20m - 2023');
ok(normalizeCvLine('McCann Paris 2011 2014').text.includes('2011 - 2014'), 'yoaz spaced experience years');
ok(normalizeCvLine('Jan 2022 - Mar 2024').text === 'Jan 2022 - Mar 2024', 'month range preserved');
ok(normalizeCvLine('Depuis 2023').text === '2023 - Present', 'Depuis 2023');
ok(normalizeCvLine('2022 2023 Present').text.includes('Present'), 'Present alias');
ok(normalizeCvLine('2023 Current').text.includes('2023 - Present') || normalizeCvLine('2023 Current').text.includes('Present'), 'Current alias');

// Conservative: do not fix isolated 20m without date context
ok(normalizeCvLine('20m impressions').text === '20m impressions', 'leave 20m without date context');

// Malformed 6-digit year tail (date context required)
ok(normalizeCvLine('Internship 201038').text.includes('2010 - 2018'), 'malformed 201038 in date context');

// --- Word repair ---
ok(/digital\s+art/i.test(normalizeCvLine('digtitalArt').text), 'digtitalArt → digital art');
ok(normalizeCvLine('ilusrations').text === 'illustrations', 'ilusrations');
ok(normalizeCvLine('corporat identity').text === 'corporate identity', 'corporat identity');
ok(normalizeCvLine('Graphic   Designer').text === 'Graphic Designer', 'duplicate spaces');

// --- Confidence scores ---
{
  const { corrections, confidence } = normalizeCvLine('20112023');
  ok(corrections.length >= 1, 'corrections recorded');
  ok(corrections[0].rule === CORRECTION_RULE.DATE_MERGED_YEARS, 'merged years rule id');
  ok(corrections[0].confidence >= 0.9, 'high confidence merged years');
  ok(confidence >= 0.9, 'line confidence aggregate');
}

// --- Document + line merge ---
{
  const doc = normalizeCvDocument('Senior graphic\ndesigner\n2011 2014');
  ok(doc.text.includes('Senior graphic designer'), 'line merge senior graphic designer');
  ok(doc.text.includes('2011 - 2014'), 'document date repair');
  ok(doc.stats.corrections >= 1, 'document correction stats');
}

// --- Yohann fixture corpus ---
for (const ex of YOAZ_NORMALIZATION_EXAMPLES) {
  const out = normalizeCvLine(ex.before).text;
  ok(
    out.toLowerCase().includes(String(ex.after).toLowerCase().split(' ')[0]),
    `yoaz example: ${ex.before} → includes ${ex.after.split(' ')[0]}`
  );
}

// --- Yohann OCR fragmented fixture (realistic noise) ---
{
  const doc = normalizeCvDocument(yoazOcrFixture);
  ok(doc.text.includes('2011 - 2014'), 'yoaz fixture: McCann 2011 2014');
  ok(doc.text.includes('2023 - Present') || /2023\s+Present/i.test(doc.text), 'yoaz fixture: 2023 Present');
  ok(doc.stats.dateRepairs >= 5, 'yoaz fixture: multiple date repairs');
}

// --- Pipeline integration ---
{
  const piped = normalizeOcrDocument('Ill ustrator\n2011 2023\n20m-2023');
  ok(/Illustrator/i.test(piped.text), 'ocr pipeline still repairs words');
  ok(piped.text.includes('2011 - 2023'), 'ocr pipeline cv date repair');
  ok((piped.stats?.cvDateRepairs ?? 0) >= 1, 'ocr pipeline cv stats');
}

// --- No hallucination: unknown tokens unchanged ---
ok(normalizeCvLine('Zyxtq 9999 8888').text === 'Zyxtq 9999 8888', 'unknown garbage unchanged');

process.exit(failed ? 1 : 0);
