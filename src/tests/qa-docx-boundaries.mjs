#!/usr/bin/env node
/**
 * Regression: DOCX run glue (Year2007, 2009Visual) and education harvest.
 */
import { repairCompactWordBoundaries, normalizeRawExtract } from '../core/parsing/clean.js';
import { cleanExtraction } from '../core/parsing/rich-parser.js';
import { mammothHtmlToPlainText } from '../core/extraction/docx-extract.js';
import { splitMergedEducationLine, harvestEducation } from '../core/parsing/parser-recovery.js';
import { loadHirelyParse } from './load-hirely-parse.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const glued =
  'Créapole Creation School Management - Multisectoral Year2007 - 2009Visual Communication';
const repaired = repairCompactWordBoundaries(glued);
assert(/Year\s+2007/.test(repaired), `Year boundary: ${repaired}`);
assert(/2009\s+Visual/.test(repaired), `Visual boundary: ${repaired}`);
console.log('OK repairCompactWordBoundaries');

const html = mammothHtmlToPlainText(
  '<p>Graphic Designer</p><p>FORMATION</p><p>Créapole Year2007 - 2009Visual</p>'
);
assert(html.includes('\n'), 'HTML path preserves paragraph breaks');
assert(/Year\s+2007/.test(html), `HTML repair: ${html}`);
console.log('OK mammothHtmlToPlainText');

const parts = splitMergedEducationLine(glued);
assert(parts.length >= 1, 'education split yields entries');
const harvested = harvestEducation([], parts);
assert(harvested.length >= 1, 'harvestEducation keeps repaired lines');
console.log('OK education split/harvest');

const Parse = await loadHirelyParse();
const pipe = await Parse.runExtractionPipeline(
  `FORMATION\n${glued}\nCOMPÉTENCES\nGraphic Design`,
  { extractionMethod: 'docx' }
);
const edu = pipe.validatedCVData?.education || [];
const eduText = edu.join(' ');
assert(/2007/.test(eduText) && /Visual/i.test(eduText), `pipeline education: ${eduText}`);
assert(!/Year2007/.test(eduText), `pipeline must not keep Year2007: ${eduText}`);
console.log('OK pipeline docx glue');

const cleaned = cleanExtraction(normalizeRawExtract(glued));
assert(!/Year2007/.test(cleaned), `cleanExtraction: ${cleaned}`);
console.log('OK cleanExtraction boundaries');

console.log('OK qa-docx-boundaries');
