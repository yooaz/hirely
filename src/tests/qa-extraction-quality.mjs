#!/usr/bin/env node
import { assessImportQuality } from '../core/validation/extraction-quality.js';
import { runExtractionPipeline } from '../core/parsing/pipeline.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const garbageOcr = `[body]
A>o N'$ak6.f Îô°
||| §§ @@
C e   F r e i   R e
2011-2022
???`;

const poor = assessImportQuality({
  rawText: garbageOcr,
  cleanedText: garbageOcr,
  cvData: { name: '', experience: [], unsorted: ['???', '||| §§ @@'], sectionConfidence: { experience: 0 } },
  extractionMethod: 'pdf-ocr',
});

ok(poor.isPoor, 'garbage OCR marked poor');
ok(poor.flags.nameMissing, 'name missing flag');
ok(poor.flags.tooManySuspiciousLines || poor.flags.tooManyCorruptedTokens, 'suspicious or corrupted');

const goodText = `Alex Martin
Freelance Illustrator

yoaz@email.com
+33 6 12 34 56 78

Freelance Illustrator 2011-2022
Nike
Photoshop
Illustration`;

const pipe = await runExtractionPipeline(goodText, { extractionMethod: 'paste-text' });
const good = pipe.importQuality || assessImportQuality({
  rawText: goodText,
  cleanedText: pipe.cleanedText,
  cvData: pipe.validatedCVData,
  structuredResume: pipe.structuredResume,
  audit: pipe.audit,
});

ok(!good.isPoor, 'clean CV not poor');
ok(good.quality !== 'poor', 'clean CV quality not poor');

process.exit(failed ? 1 : 0);
