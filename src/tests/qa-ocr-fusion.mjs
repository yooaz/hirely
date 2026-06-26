#!/usr/bin/env node
/**
 * OCR fusion — winner picks cleaner text over corrupted passes.
 */
import {
  corruptionScore,
  languageScore,
  scoreOcrCandidate,
  pickFusionWinner,
  fuseOcrPageTexts,
  fuseOcrCandidatesToLines,
  lineQuality,
} from '../core/extraction/ocr-fusion.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const clean = `Yohann Azancot
Graphic Designer & Illustrator
Paris · yoaz@hotmail.fr

EXPERIENCE
Freelance Illustrator — Studio ABC 2020–2024
Brand illustration and art direction for campaigns.

EDUCATION
LISAA — BFA Illustration`;

const corrupted = `Ce Frei Re
A>o N'$ak6
RA coe PCL
yoaz@hotmail.fr

EXPÉRlENCE
Photosh0p designer`;

const cleanLines = clean.split('\n').map((text, line) => ({ text, confidence: 88, line }));
const badLines = corrupted.split('\n').map((text, line) => ({ text, confidence: 72, line }));

const scoreClean = scoreOcrCandidate({ text: clean, lines: cleanLines });
const scoreBad = scoreOcrCandidate({ text: corrupted, lines: badLines });

ok(scoreClean.corruption < scoreBad.corruption, 'clean text lower corruption score');
ok(scoreClean.language > scoreBad.language, 'clean text higher language score');
ok(scoreClean.total > scoreBad.total, 'clean text wins total score');

const pick = pickFusionWinner({
  A: { text: corrupted, lines: badLines, scores: scoreBad },
  B: { text: clean, lines: cleanLines, scores: scoreClean },
  C: { text: corrupted, lines: badLines, scores: scoreBad },
  D: { text: corrupted, lines: badLines, scores: scoreBad },
});
ok(pick.winnerId === 'B', 'fusion selects high-quality pass B');
ok(pick.ranked[0] === 'B', 'winner ranked first');

const fused = fuseOcrPageTexts([corrupted, clean]);
ok(fused.includes('Yohann Azancot'), 'line fusion prefers quality lines from clean pass');
ok(!/Ce Frei Re/i.test(fused), 'line fusion drops known corruption');

ok(lineQuality('Yohann Azancot') > lineQuality('Ce Frei Re'), 'line quality ranks real name');

ok(corruptionScore(clean) < 25, 'clean corruption under 25%');
ok(corruptionScore(corrupted) > 40, 'corrupted corruption above 40%');

const fusedLines = fuseOcrCandidatesToLines(
  {
    A: { text: corrupted, lines: badLines },
    B: { text: clean, lines: cleanLines },
    C: { text: corrupted, lines: badLines },
    D: { text: corrupted, lines: badLines },
  },
  pick
);
ok(fusedLines.some((l) => l.text.includes('Yohann')), 'fused lines keep quality name');
ok(fusedLines.every((l) => l.source === 'ocr' && l.candidate), 'each fused line has source + candidate');
ok(fusedLines.every((l) => typeof l.confidence === 'number'), 'each fused line has confidence');
ok(fusedLines.every((l) => l.rawExtraction && l.cleanedText), 'fused lines have raw + cleaned');

process.exit(failed ? 1 : 0);
