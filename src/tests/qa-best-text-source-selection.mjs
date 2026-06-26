#!/usr/bin/env node
/**
 * P0 — Best text source selection: native vs OCR vs DOCX vs paste.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  selectBestTextSource,
  scoreTextSource,
  BEST_TEXT_SOURCE_VERSION,
  mergeTextSourcesConservative,
} from '../core/extraction/best-text-source-selection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/best-text-source-selection/report.json');
const YOAZ = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const yoaz = fs.readFileSync(YOAZ, 'utf8');

const goodNative = yoaz;
const badOcr = 'Y0h@nn @z@nc0t\nC3 Frei R3\nA>o gibberish ocr noise\n!!!@@@###';
const goodOcr = yoaz.slice(0, 800);
const weakNative = 'Yohann Azancot\nGraphic Designer';
const richDocx = yoaz;
const pasted = yoaz;

ok(BEST_TEXT_SOURCE_VERSION === 'BEST_TEXT_SOURCE_SELECTION_V1', 'engine version');

// Good native beats bad OCR
const pickNative = selectBestTextSource({ nativeText: goodNative, ocrText: badOcr });
ok(pickNative.selectedSource === 'native', 'good native beats bad OCR');
ok(pickNative.audit.mergeRejectedReason === 'ocr_quality_too_low', 'bad OCR merge rejected');
ok(!pickNative.text.includes('A>o'), 'bad OCR not in selected text');

// Bad OCR not merged into good native
const mergedConservative = mergeTextSourcesConservative(goodNative, badOcr);
ok(!mergedConservative.includes('A>o'), 'conservative merge skips garbage OCR lines');
const pickNoMerge = selectBestTextSource({ nativeText: goodNative, ocrText: badOcr });
ok(pickNoMerge.selectedSource !== 'merged', 'no merge when OCR is garbage');

// OCR wins when native is weak and OCR is rich
const pickOcr = selectBestTextSource({ nativeText: weakNative, ocrText: goodOcr });
ok(
  pickOcr.selectedSource === 'ocr' || pickOcr.selectedSource === 'native',
  'weak native vs good OCR picks viable source'
);
ok((pickOcr.text || '').length > weakNative.length, 'selected text richer than weak native');

// DOCX beats weak native
const pickDocx = selectBestTextSource({ nativeText: weakNative, docxText: richDocx });
ok(pickDocx.selectedSource === 'docx', 'docx beats weak native');

// Paste can win when richest
const pickPaste = selectBestTextSource({
  nativeText: weakNative,
  ocrText: 'short ocr',
  pastedText: pasted,
});
ok(pickPaste.selectedSource === 'pasted', 'pasted wins when richest');

// Merge only when it improves score
const nativePartial = `${yoaz.split('\n').slice(0, 12).join('\n')}\nExperience`;
const ocrSupplement = 'McCann Paris — Lead Illustrator — 2011–2014\nAKQA Paris — Lead Visual Designer — 2022–2023';
const pickMerge = selectBestTextSource({ nativeText: nativePartial, ocrText: ocrSupplement });
const nativeScore = scoreTextSource(nativePartial, 'native').compositeScore;
const ocrScore = scoreTextSource(ocrSupplement, 'ocr').compositeScore;
ok(pickMerge.audit.mergeConsidered, 'merge considered for native+ocr');
if (pickMerge.selectedSource === 'merged') {
  ok(pickMerge.compositeScore > Math.max(nativeScore, ocrScore), 'merge improves score');
} else {
  ok(
    pickMerge.compositeScore >= Math.max(nativeScore, ocrScore),
    'best single source when merge not beneficial'
  );
}

// Scoring dimensions present
const scored = scoreTextSource(goodNative, 'native');
ok(scored.length > 500, 'length scored');
ok(scored.plausibleWordRatio > 0.5, 'plausible word ratio');
ok(scored.hasEmail, 'email detected');
ok(scored.hasPhone, 'phone detected');
ok(scored.dateCount > 0, 'dates detected');
ok(scored.sectionHeaderCount > 0, 'section headers detected');
ok(scored.garbageRatio < 0.1, 'low garbage on good native');
ok(scored.duplicateRatio < 0.2, 'low duplicate on good native');
ok(scored.compositeScore > 50, 'composite score reasonable');

// Audit trail
ok(pickNative.audit?.version, 'audit version');
ok(Array.isArray(pickNative.audit?.candidates), 'audit candidates');
ok(pickNative.audit.candidates.length >= 2, 'audit lists candidates');

const report = {
  pass: failed === 0,
  generatedAt: new Date().toISOString(),
  engineVersion: BEST_TEXT_SOURCE_VERSION,
  scenarios: {
    nativeBeatsBadOcr: pickNative.selectedSource === 'native',
    docxBeatsWeakNative: pickDocx.selectedSource === 'docx',
    pastedWins: pickPaste.selectedSource === 'pasted',
    mergeRejectedForBadOcr: pickNoMerge.audit.mergeRejectedReason === 'ocr_quality_too_low',
  },
  scoring: {
    nativeComposite: scored.compositeScore,
    garbageRatio: scored.garbageRatio,
    duplicateRatio: scored.duplicateRatio,
  },
  rules: [
    'do_not_merge_bad_ocr_into_good_native',
    'merge_only_if_score_improves',
    'audit_trail_on_every_selection',
  ],
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('Wrote', OUT);
process.exit(failed ? 1 : 0);
