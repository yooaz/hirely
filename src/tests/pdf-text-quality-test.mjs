#!/usr/bin/env node
/**
 * PDF text-first decision tests (no browser).
 */
import { assessPdfTextLayer } from '../core/extraction/pdf-text-quality.js';
import { extractTopZoneLines } from '../core/extraction/pdf-first-page.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const GOOD_CV = `Yohann Azancot
Graphic Designer & Illustrator
yoaz@hotmail.fr
+33 6 49 43 48 39

Experience
Graphic Designer — Freelance — 2011–Present
Created illustration and brand assets for global clients.

Education
LISAA — Web & Motion Design
Créapole — Visual Communication

Skills
Illustration, Graphic Design, Visual Identity

Tools
Photoshop, Illustrator, InDesign

Languages
French — native
English — fluent

Interests
Music, Movies, Nature
`;

const SCAN_GARBAGE = '||| @@ ## 12 34 56 @@ |||';

const qGood = assessPdfTextLayer(GOOD_CV);
assert(qGood.usable, 'good text layer should be usable');
assert(qGood.charCount > 80, 'char count');
assert(qGood.wordCount >= 25, 'word count');
assert(qGood.confidence >= 70, `confidence ${qGood.confidence}`);

const qBad = assessPdfTextLayer(SCAN_GARBAGE);
assert(!qBad.usable, 'garbage should not be usable');
assert(qBad.reason.length > 5, 'reason provided');

const TWO_COL = `${GOOD_CV}\n${'•\n'.repeat(40)}Sidebar\nTools\nContact\n`;
const qCol = assessPdfTextLayer(TWO_COL);
assert(qCol.usable, `two-column rich text should stay pdf-text: ${qCol.reason}`);
assert(qCol.strongTextLayer, 'strong text layer flag');

const header = extractTopZoneLines([
  { text: 'Yohann', x: 100, y: 750 },
  { text: 'Azancot', x: 200, y: 750 },
  { text: 'Graphic Designer', x: 100, y: 720 },
  { text: 'Experience', x: 100, y: 400 },
]);
assert(header.some((l) => /yohann/i.test(l)), 'header zone includes name');

console.log('OK pdf-text-quality');
console.log('  good:', qGood.reason);
console.log('  bad:', qBad.reason);
