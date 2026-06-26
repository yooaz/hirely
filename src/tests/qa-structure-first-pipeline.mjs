#!/usr/bin/env node
/**
 * Structure-first pipeline — proves main parse path does not flatten before section detection.
 *
 * node src/tests/qa-structure-first-pipeline.mjs
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { buildLayoutMemory } from '../core/layout/layout-memory.js';
import {
  buildStructureFirstDocument,
} from '../core/blocks/block-pipeline.js';
import { blockHasStructure, BLOCK_PIPELINE_VERSION } from '../core/blocks/block-contract.js';
import { resolveParserLayoutInput } from '../core/parsing/parser-layout-input.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK  ', msg);
  }
}

function loadYoazLines() {
  const page1 = JSON.parse(
    readFileSync(join(root, 'tests/fixtures/yoaz-pdf-benchmark/page1-lines.json'), 'utf8')
  );
  const page2 = JSON.parse(
    readFileSync(join(root, 'tests/fixtures/yoaz-pdf-benchmark/page2-lines.json'), 'utf8')
  );
  const lines = [];
  for (const page of [page1, page2]) {
    for (const l of page.lines || []) {
      lines.push({
        ...l,
        page: l.page || page.page,
        cleanedText: l.text,
        rawExtraction: l.text,
        confidence: l.confidence ?? 90,
        source: l.source || 'native',
      });
    }
  }
  return lines;
}

console.log('\n=== STRUCTURE-FIRST PIPELINE ===\n');

const lines = loadYoazLines();
const layoutMemory = buildLayoutMemory(lines, { source: 'native' });
const layoutInput = resolveParserLayoutInput('', {
  extractionLines: lines,
  layoutMemory,
});

ok(layoutInput.primaryInput === 'spatial_blocks', 'parser layout primaryInput is spatial_blocks');
ok(layoutInput.spatialBlocks.length > 20, `spatial blocks present (${layoutInput.spatialBlocks.length})`);

const structureDoc = buildStructureFirstDocument({
  extractionLines: lines,
  spatialBlocks: layoutInput.spatialBlocks,
});

ok(structureDoc.version === BLOCK_PIPELINE_VERSION, 'structure doc version');
ok(structureDoc.raw_blocks.length === structureDoc.normalized_blocks.length, 'raw → normalized 1:1');
ok(structureDoc.pages.length >= 2, `raw pages (${structureDoc.pages.length})`);
ok(structureDoc.structure_preserved === true, 'structure_preserved flag');

const withStructure = structureDoc.normalized_blocks.filter((b) => blockHasStructure(b)).length;
ok(
  withStructure >= Math.floor(structureDoc.normalized_blocks.length * 0.5),
  `blocks retain bbox/zone (${withStructure}/${structureDoc.normalized_blocks.length})`
);

for (const block of structureDoc.normalized_blocks.slice(0, 5)) {
  ok(Boolean(block.block_id), 'block_id present');
  ok(Boolean(block.text), 'text present');
  ok(Boolean(block.normalized_text), 'normalized_text present');
  ok(Number.isFinite(block.page_number), 'page_number present');
  ok(block.bbox && Number.isFinite(block.bbox.x), 'bbox.x present');
  ok(block.signals && typeof block.signals.looks_like_email === 'boolean', 'signals present');
}

const engine = runSectionEngineV2('', {
  extractionLines: lines,
  layoutMemory,
  spatialBlocks: layoutInput.spatialBlocks,
  structureFirst: true,
  extractionMethod: 'native_pdf',
});

ok(engine.structureDoc != null, 'section engine returns structureDoc');
ok(engine.structureFirst?.structurePreserved === true, 'section engine structurePreserved');
ok(
  engine.structureFirst?.flatTextGuard?.ok === true,
  `no early flatten violations (${(engine.structureFirst?.flatTextGuard?.violations || []).join('; ') || 'clean'})`
);
ok(
  engine.structureFirst?.blockCounts?.spatial === layoutInput.spatialBlocks.length,
  'spatial block count preserved through engine'
);
ok(
  (engine.structureDoc?.spatial_blocks?.length || 0) > 0,
  'structureDoc retains spatial blocks'
);
ok(
  layoutInput.primaryInput !== 'plain_text_fallback',
  'Yoaz fixture must not use plain_text_fallback as primary input'
);

console.log('\n--- block stage counts ---');
console.log(
  JSON.stringify(engine.structureFirst?.blockCounts || structureDoc, null, 2)
);

if (failed) {
  console.error(`\nSTRUCTURE_FIRST_PIPELINE_FAIL (${failed})\n`);
  process.exit(1);
}
console.log('\nSTRUCTURE_FIRST_PIPELINE OK\n');
