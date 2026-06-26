#!/usr/bin/env node
import {
  normalizeOcrDocument,
  fixBrokenWordsInLine,
  repairCommonOcrMistakes,
  mergeSplitOcrLines,
  evaluateOcrNormalizationCorpus,
  OCR_NORMALIZATION_CORPUS,
} from '../core/parsing/ocr-normalization.js';
import { postProcessOcrText } from '../core/parsing/ocr-postprocess.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

ok(fixBrokenWordsInLine('Ill ustrator') === 'Illustrator', 'broken word Ill ustrator');
ok(fixBrokenWordsInLine('Gra phic Designer').includes('Graphic'), 'broken word Gra phic');
ok(repairCommonOcrMistakes('Phot0shop') === 'Photoshop', 'char repair Phot0shop');

const merged = mergeSplitOcrLines([
  { rawLine: 'Senior graphic', normalizedLine: 'Senior graphic' },
  { rawLine: 'designer', normalizedLine: 'designer' },
]);
ok(merged[0].normalizedLine === 'Senior graphic designer', 'merge split lines');

const corpus = evaluateOcrNormalizationCorpus();
const pct = Math.round(corpus.score * 100);
ok(corpus.score >= 0.95, `corpus dictionary score ${pct}% (>= 95%)`);
console.log(`Corpus: ${corpus.hits}/${corpus.total} (${pct}%)`);

for (const c of OCR_NORMALIZATION_CORPUS) {
  const out = normalizeOcrDocument(c.corrupted).text;
  if (c.expectGarbage) {
    ok(!out || !/[@|]{2,}|NE\s+TTT/i.test(out), `garbage dropped: ${c.corrupted.slice(0, 40)}`);
  } else if (c.expect) {
    ok(out.toLowerCase().includes(String(c.expect).toLowerCase()), `corpus: ${c.corrupted} → ${c.expect}`);
  }
}

const trace = normalizeOcrDocument('Ill ustrator\nDes igner · Phot0shop');
ok(trace.lines.every((l) => l.rawLine && 'normalizedLine' in l), 'preserves rawLine + normalizedLine');
ok(trace.lines.some((l) => l.rawLine !== l.normalizedLine), 'normalization mutates lines');

const piped = postProcessOcrText('EXPÉRlENCE\nIll ustrator\nPhot0shop', { ocr: true });
ok(/Illustrator/i.test(piped), 'postProcessOcrText uses normalization engine');

process.exit(failed ? 1 : 0);
