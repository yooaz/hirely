#!/usr/bin/env node
/**
 * OCR quality scorer unit tests (no browser).
 * node src/tests/qa-ocr-quality-score.mjs
 */
import {
  scoreOcrQuality,
  evaluateOcrParserGate,
  OCR_QUALITY_MIN_PASS,
} from '../core/extraction/ocr-quality-score.js';

const ok = (c, m) => {
  if (!c) {
    console.error('FAIL', m);
    process.exit(1);
  }
  console.log('OK', m);
};

const goodText = `
PROFILE
WORK EXPERIENCE
Graphic Designer & Illustrator
EDUCATION
LISAA Paris — Créapole
SKILLS
Photoshop, Illustrator, InDesign, Procreate
LANGUAGES
English — fluent
French — native
2018 — 2022
contact@example.com
+33 6 12 34 56 78
`.trim();

const badText = `
ION3IIHIAXI HHOM
NOILY3NQ3
YOLVEISNTN
Buipeoy
AydeiBoroug i) anneu .ysuasy
`.trim();

const good = scoreOcrQuality({ text: goodText });
const bad = scoreOcrQuality({ text: badText });

ok(good.qualityScore >= OCR_QUALITY_MIN_PASS, `good CV score ${good.qualityScore} >= ${OCR_QUALITY_MIN_PASS}`);
ok(bad.qualityScore < OCR_QUALITY_MIN_PASS, `bad OCR score ${bad.qualityScore} < ${OCR_QUALITY_MIN_PASS}`);
ok(/profile|experience|photoshop/i.test(good.topWords.join(' ')), 'good top words');
ok(good.reversedWordRatio < 0.2, `good reversed ratio ${good.reversedWordRatio}`);
ok(bad.reversedWordRatio > 0.3 || bad.garbageRatio > 0.3, `bad garbage/reversed ${bad.garbageRatio}/${bad.reversedWordRatio}`);
ok(good.reasons.length > 0, 'good has reasons');
ok(bad.reasons.some((r) => /reversed|garbage|known/i.test(r)), `bad reasons: ${bad.reasons.join('; ')}`);

const badGate = evaluateOcrParserGate(badText);
const goodGate = evaluateOcrParserGate(goodText);
ok(!badGate.pass, 'parser gate blocks bad OCR');
ok(goodGate.pass, 'parser gate allows good OCR');

console.log('\nGood sample score:', good.qualityScore, good.reasons.slice(0, 4).join('; '));
console.log('Bad sample score:', bad.qualityScore, bad.reasons.slice(0, 4).join('; '));
