/**
 * OCR forensic CLI — pin corruption stage for spaced/garbled title lines.
 * node tests/ocr-forensic.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runExtractionPipeline } from '../src/core/parsing/pipeline.js';
import { buildOcrForensic, pinpointCorruption } from '../src/debug/ocr-forensic.js';
import { setLastOcrForensic } from '../src/core/extraction/extraction-session.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCENARIOS = [
  {
    name: 'spaced-letters (OCR-like)',
    rawOcr: `Yohann Azancot
F r e e l a n c e   I l l u s t r a t o r   /   G r a p h i c   D e s i g n e r
yoaz@hotmail.fr
Experience
Nike — 2020`,
  },
  {
    name: 'Ce Frei Re root cause (C e F r e i R e)',
    rawOcr: `Yohann Azancot
C e   F r e i   R e
yoaz@hotmail.fr`,
  },
  {
    name: 'already corrupted (in OCR)',
    rawOcr: `Yohann Azancot
Ce Frei Re
yoaz@hotmail.fr`,
  },
  {
    name: 'creative fixture',
    rawOcr: readFileSync(join(__dirname, 'fixtures/creative-cv/fixture.txt'), 'utf8'),
  },
];

function report(forensic) {
  console.log('\n--- stages ---');
  for (const s of forensic.stages) {
    console.log(
      `${s.label}: ${s.chars} chars, ${s.nonEmptyLines} lines, removed=${s.removedLines ?? 0}, modified=${s.modifiedContent?.length ?? 0}`
    );
  }
  console.log('\n--- corruption pin ---');
  console.log(JSON.stringify(forensic.corruption, null, 2));
  if (forensic.summary?.corruptionVerdict) {
    console.log('\nVERDICT:', forensic.summary.corruptionVerdict);
  }
  const t = forensic.transitions?.[0];
  if (t?.modified?.length) {
    console.log('\n--- first-stage modifications (clean) ---');
    t.modified.slice(0, 5).forEach(({ before, after }) => {
      console.log(`  "${before}" → "${after}"`);
    });
  }
}

for (const sc of SCENARIOS) {
  console.log('\n========================================');
  console.log('SCENARIO:', sc.name);
  globalThis.HIRELY_OCR_FORENSIC = false;
  setLastOcrForensic({ rawOcr: sc.rawOcr, method: 'test' });
  const pipe = await runExtractionPipeline(sc.rawOcr, { extractionMethod: 'pdf-ocr' });
  const forensic = buildOcrForensic(sc.rawOcr, pipe, { forensicMeta: { rawOcr: sc.rawOcr } });
  report(forensic);
}

console.log('\nDone.');
