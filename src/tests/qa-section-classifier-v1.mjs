#!/usr/bin/env node
/**
 * SECTION_CLASSIFIER_V1 — block typing before field extraction.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDocumentBlocksFromOcrLines } from '../core/parsing/block-builder-v1.js';
import {
  classifyDocumentBlocksV1,
  documentBlocksToSectionBlocks,
  SECTION_CLASSIFIER_MIN_CONFIDENCE,
} from '../core/parsing/section-classifier-v1.js';
import { SECTION_IDS } from '../core/parsing/section-types-v2.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const acceptanceSample = `
Education
LISAA — Web & Motion Design
Créapole — Visual Communication / Product Design
Skills
Illustration, Graphic Design, Packaging
Tools
Photoshop, Illustrator, InDesign
Interests
Music, Movies, Nature
2011-2022
Freelancer Illustrator
Independent / Freelance
`;

const lines = acceptanceSample
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

const { documentBlocks } = buildDocumentBlocksFromOcrLines(lines, { source: 'ocr' });
ok(documentBlocks.length >= 4, `blocks built (${documentBlocks.length})`);

const { blocks, lowConfidence } = classifyDocumentBlocksV1(documentBlocks);
ok(blocks.length === documentBlocks.length, 'every block classified');
ok(SECTION_CLASSIFIER_MIN_CONFIDENCE === 80, 'confidence threshold 80');

const findBlock = (re) => blocks.find((b) => re.test(b.text || ''));

const musicBlock = findBlock(/Music, Movies, Nature/i);
ok(Boolean(musicBlock), 'Music block found');
ok(musicBlock.type !== 'experience', 'Music must not become experience');
ok(['skills', 'unknown'].includes(musicBlock.type), `Music is ${musicBlock.type}`);

const creapoleBlock = findBlock(/Créapole/i);
ok(Boolean(creapoleBlock), 'Créapole block found');
ok(creapoleBlock.type !== 'experience', 'Créapole must not become experience');
ok(
  ['education', 'unknown'].includes(creapoleBlock.type),
  `Créapole is ${creapoleBlock.type}`
);

for (const block of blocks.filter((b) => /product design/i.test(b.text || ''))) {
  ok(block.type !== 'experience', `Product design not experience (${block.text.slice(0, 48)})`);
}

const freelanceBlock = findBlock(/2011-2022/i);
ok(Boolean(freelanceBlock), 'date block found');
ok(freelanceBlock.type === 'experience', 'date+role block is experience');

const sectionBlocks = documentBlocksToSectionBlocks(blocks);
ok(
  sectionBlocks.every((b) => b.type !== SECTION_IDS.EXPERIENCE || b.classifyReason),
  'section blocks carry classify reason'
);
ok(
  !sectionBlocks.some((b) => /Music, Movies/i.test((b.lines || []).join('\n')) && b.type === SECTION_IDS.EXPERIENCE),
  'Music not mapped to EXPERIENCE section id'
);

const yoazPath = join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
const yoazLines = readFileSync(yoazPath, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

const yoazBuilt = buildDocumentBlocksFromOcrLines(yoazLines.slice(0, 74), { source: 'ocr' });
const yoazClassified = classifyDocumentBlocksV1(yoazBuilt.documentBlocks);
const yoazExpBlocks = yoazClassified.blocks.filter((b) => b.type === 'experience');
ok(
  !yoazExpBlocks.some((b) => /music|créapole|product design/i.test(b.text)),
  'Yoaz slice: no Music/Créapole/Product design in experience blocks'
);

const engine = runSectionEngineV2(acceptanceSample, { rawText: acceptanceSample });
const exps = engine.structured?.experiences || [];
ok(
  !exps.some((e) => /music|créapole|product design/i.test(`${e.role} ${e.company}`)),
  'engine: no garbage experience from classified blocks'
);
ok(
  engine.structured?.metadata?.sectionClassifier === 'SECTION_CLASSIFIER_V1',
  'engine uses section classifier v1'
);

console.log('\nSECTION_CLASSIFIER_V1 QA OK', {
  blocks: blocks.length,
  lowConfidence: lowConfidence.length,
  experienceBlocks: blocks.filter((b) => b.type === 'experience').length,
});
