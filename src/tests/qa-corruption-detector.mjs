#!/usr/bin/env node
/**
 * Corruption detector — known OCR junk blocked from export.
 */
import {
  analyzeLineCorruption,
  isLineCorrupted,
  sanitizeCvDataForExport,
} from '../core/parsing/corruption-detector.js';
import { applyExtractionConfidenceGate } from '../core/parsing/extraction-line-gate.js';
import { formatCvAsStructuredText } from '../core/export/format-cv.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const EXAMPLES = [
  "A>o N'$ak6.f Îô°",
  '¢ Yoaz.tumblr.com',
  'FF GRAPHIC DESIGNER & ILLUSTRATOR',
  'Ce Frei Re',
];

for (const line of EXAMPLES) {
  const a = analyzeLineCorruption(line);
  ok(a.corrupted, `corrupted: ${line.slice(0, 40)}`);
  ok(a.score >= 40, `score ${a.score} for ${line.slice(0, 30)}`);
}

const clean = 'Yohann Azancot — Graphic Designer & Illustrator';
const cleanA = analyzeLineCorruption(clean);
ok(!cleanA.corrupted, 'clean name/title not corrupted');
ok(cleanA.score < 40, 'clean line low corruption score');

const gated = applyExtractionConfidenceGate(
  { experience: [...EXAMPLES, 'Freelance Illustrator — Studio ABC'] },
  []
);
ok(gated.extractionReview.length >= EXAMPLES.length, 'corrupted lines → review queue');
ok(!gated.blocks.experience.some((l) => EXAMPLES.some((e) => l.includes(e.slice(0, 8)))), 'corrupted not in experience blocks');

const cv = sanitizeCvDataForExport({
  name: "A>o N'$ak6",
  title: 'FF GRAPHIC DESIGNER & ILLUSTRATOR',
  experience: ["Ce Frei Re", 'Freelance Illustrator — ABC 2020–2024'],
  skills: ['Illustration', '¢ Yoaz.tumblr.com'],
});
ok(!cv.name, 'corrupted name stripped');
ok(!cv.title, 'corrupted title stripped');
ok(cv.experience.length === 1, 'only clean experience kept');
ok(!cv.skills.some((s) => s.includes('¢')), 'corrupted skill stripped');

const exported = formatCvAsStructuredText(cv);
for (const bad of EXAMPLES) {
  ok(!exported.includes(bad.slice(0, 8)), `export missing ${bad.slice(0, 20)}`);
}

process.exit(failed ? 1 : 0);
