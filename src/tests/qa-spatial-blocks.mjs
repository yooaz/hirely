/**
 * Spatial block pipeline — layout memory → spatial blocks → plain text fallback.
 */

import assert from 'node:assert/strict';
import { buildLayoutMemory } from '../core/layout/layout-memory.js';
import {
  spatialBlocksFromLayoutMemory,
  spatialBlocksToPlainText,
  spatialBlocksToOcrLineInput,
  isSpatialBlockArray,
  SPATIAL_ZONE_ID,
} from '../core/layout/spatial-block.js';
import { normalizeOcrLineInput } from '../core/parsing/block-builder-v1.js';
import { resolveParserLayoutInput } from '../core/parsing/parser-layout-input.js';

function testLayoutMemoryProducesSpatialBlocks() {
  const lines = [
    { text: 'Jane Doe', cleanedText: 'Jane Doe', page: 1, x: 40, y: 700, source: 'native' },
    { text: 'Designer', cleanedText: 'Designer', page: 1, x: 40, y: 680, source: 'native' },
    { text: 'Experience', cleanedText: 'Experience', page: 1, x: 280, y: 700, source: 'native' },
    { text: 'Acme Co', cleanedText: 'Acme Co', page: 1, x: 280, y: 680, source: 'native' },
  ];
  const memory = buildLayoutMemory(lines);
  assert.ok(memory.spatialBlocks?.length === 4, 'expected 4 spatial blocks');
  assert.equal(memory.parserText, spatialBlocksToPlainText(memory.spatialBlocks));
  for (const b of memory.spatialBlocks) {
    assert.ok(b.block_id, 'block_id required');
    assert.ok(b.page_number >= 1, 'page_number required');
    assert.ok(b.bbox && Number.isFinite(b.bbox.x), 'bbox required');
    assert.ok(b.source, 'source required');
    assert.ok(Number.isFinite(b.reading_order), 'reading_order required');
    assert.ok(b.zone_id, 'zone_id required');
    assert.ok(b.column_id, 'column_id required');
    assert.ok(b.text, 'text required');
    assert.ok(b.normalized_text, 'normalized_text required');
  }
}

function testParserLayoutInputPrefersSpatialBlocks() {
  const input = resolveParserLayoutInput('fallback', {
    extractionLines: [
      { text: 'Line A', cleanedText: 'Line A', page: 1, x: 10, y: 100 },
      { text: 'Line B', cleanedText: 'Line B', page: 1, x: 10, y: 80 },
    ],
  });
  assert.equal(input.spatialBlocks.length, 2);
  assert.equal(input.text, 'Line A\nLine B');
}

function testBlockBuilderAcceptsSpatialBlocks() {
  const blocks = [
    {
      block_id: 'sb-1',
      page_number: 1,
      bbox: { x: 0, y: 100, width: 80, height: 14 },
      source: 'test',
      reading_order: 0,
      zone_id: SPATIAL_ZONE_ID.MAIN,
      column_id: 'FULL',
      text: 'Hello',
      normalized_text: 'Hello',
    },
  ];
  assert.ok(isSpatialBlockArray(blocks));
  const lines = normalizeOcrLineInput(blocks);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, 'Hello');
  assert.equal(spatialBlocksToOcrLineInput(blocks)[0].page, 1);
}

let passed = 0;
for (const [name, fn] of [
  ['layout memory → spatial blocks', testLayoutMemoryProducesSpatialBlocks],
  ['parser layout input spatial blocks', testParserLayoutInputPrefersSpatialBlocks],
  ['block builder spatial input', testBlockBuilderAcceptsSpatialBlocks],
]) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
}
console.log(`\nqa-spatial-blocks: ${passed}/${passed} passed`);
