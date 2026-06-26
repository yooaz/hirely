/**
 * P1 Two-Column Recovery — detect left/right columns, reconstruct separately, merge.
 *
 * Fixes merged two-column CVs where skills become experience and languages become education
 * by parsing each column with its own section context, then merging in reading order.
 */

import { detectLayout, isMultiColumnLayoutType } from './detect-layout.js';
import { COLUMN_IDS } from './detect-columns.js';
import { applyReadingOrder } from './reading-order.js';
import { buildLayoutMemory } from './layout-memory.js';
import { spatialBlocksFromLayoutEntries, spatialBlocksToPlainText, attachSpatialBlocksToLayoutMemory } from './spatial-block.js';
import { inferSemanticSectionBlocks } from '../parsing/semantic-section-infer.js';
import { SEMANTIC_PARSE_MODE } from '../parsing/semantic-line-types.js';

export { isMultiColumnLayoutType } from './detect-layout.js';

/**
 * @param {import('../extraction/extracted-line.js').ExtractedLine[]} lines
 */
function hasPositionedLines(lines) {
  const usable = (lines || []).filter(
    (l) => Number.isFinite(l.x) && Number.isFinite(l.y) && String(l.cleanedText ?? l.text ?? '').trim()
  );
  return usable.length >= 4;
}

/**
 * @param {import('./layout-memory.js').LayoutMemoryEntry[]} entries
 */
function splitEntriesByColumn(entries) {
  const left = [];
  const right = [];
  const full = [];
  for (const e of entries || []) {
    const col = e.columnId || e.region;
    if (col === COLUMN_IDS.LEFT || col === 'left') left.push(e);
    else if (col === COLUMN_IDS.RIGHT || col === 'right') right.push(e);
    else full.push(e);
  }
  return { left, right, full };
}

/**
 * @param {import('./layout-memory.js').LayoutMemoryEntry[]} entries
 * @param {string} columnId
 * @param {import('./layout-memory.js').LayoutMemory} baseMemory
 */
function buildColumnLayoutMemory(entries, columnId, baseMemory) {
  if (!entries.length) return null;
  const columnEntries = entries.map((e, i) => ({
    ...e,
    lineIndex: i,
    readingOrder: i,
    columnId,
    region: columnId === COLUMN_IDS.LEFT ? 'left' : columnId === COLUMN_IDS.RIGHT ? 'right' : 'full',
  }));
  const spatialBlocks = spatialBlocksFromLayoutEntries(columnEntries, { source: 'two_column_recovery' });
  return {
    ...baseMemory,
    entries: columnEntries,
    lineCount: columnEntries.length,
    spatialBlocks,
    parserText: spatialBlocksToPlainText(spatialBlocks),
    columnId,
  };
}

/**
 * @param {import('../parsing/section-types-v2.js').SectionBlockV2[]} fullBlocks
 * @param {import('../parsing/section-types-v2.js').SectionBlockV2[]} leftBlocks
 * @param {import('../parsing/section-types-v2.js').SectionBlockV2[]} rightBlocks
 */
function mergeColumnSectionBlocks(fullBlocks, leftBlocks, rightBlocks) {
  const blocks = [];
  let idx = 0;
  const tag = (b, columnId) => ({
    ...b,
    id: `tcr-${idx++}`,
    columnRecovery: true,
    columnId,
    classifyReason: b.classifyReason || 'two_column_recovery',
    parseMode: SEMANTIC_PARSE_MODE,
  });
  for (const b of fullBlocks || []) blocks.push(tag(b, COLUMN_IDS.FULL));
  for (const b of leftBlocks || []) blocks.push(tag(b, COLUMN_IDS.LEFT));
  for (const b of rightBlocks || []) blocks.push(tag(b, COLUMN_IDS.RIGHT));
  return blocks;
}

/**
 * @param {import('../parsing/section-types-v2.js').SectionBlockV2[]} blocks
 */
function flattenBlockLines(blocks) {
  const lines = [];
  for (const block of blocks || []) {
    for (const line of block.lines || []) {
      if (String(line || '').trim()) lines.push(String(line).trim());
    }
  }
  return lines;
}

/**
 * Detect left/right columns, run section inference per column, merge with section integrity.
 *
 * @param {string} cleanedText
 * @param {object} [opts]
 * @returns {{
 *   applied: boolean,
 *   reason?: string,
 *   layoutType?: string,
 *   columnSplit?: number|null,
 *   readingStage?: object,
 *   layoutMemory?: import('./layout-memory.js').LayoutMemory,
 *   leftColumn?: object,
 *   rightColumn?: object,
 *   lines?: string[],
 *   blocks?: import('../parsing/section-types-v2.js').SectionBlockV2[],
 *   semanticLines?: object[],
 *   parserText?: string,
 *   stats?: object,
 * }}
 */
export function recoverTwoColumnSections(cleanedText, opts = {}) {
  const incomingLines =
    opts.extractionLines ||
    opts.layoutMemory?.lines ||
    opts.orderedLines ||
    opts.readingStage?.orderedLines ||
    [];

  const hasEntries = (opts.layoutMemory?.entries?.length || 0) > 0;
  if (!hasPositionedLines(incomingLines) && !hasEntries) {
    return { applied: false, reason: 'no_positioned_lines' };
  }

  const layout =
    opts.layout ||
    opts.layoutStage ||
    (opts.layoutMemory?.layoutType
      ? {
          layoutType: opts.layoutMemory.layoutType,
          columnSplit: opts.layoutMemory.columnSplit,
          confidence: 80,
        }
      : detectLayout({
          lines: incomingLines,
          cleanedText,
          rawText: opts.rawText,
        }));

  const reading =
    opts.readingStage ||
    applyReadingOrder({
      lines: opts.orderedLines?.length ? opts.orderedLines : incomingLines,
      layout,
      layoutType: layout.layoutType,
    });

  const orderedLines = reading.orderedLines?.length ? reading.orderedLines : incomingLines;
  const baseMemory =
    opts.layoutMemory?.entries?.length && !opts.forceRebuildMemory
      ? { ...opts.layoutMemory, parserText: opts.layoutMemory.parserText }
      : buildLayoutMemory(orderedLines, {
          layout,
          orderedLines,
          rawText: opts.rawText,
          cleanedText,
        });

  const multiColumn =
    isMultiColumnLayoutType(baseMemory.layoutType) ||
    isMultiColumnLayoutType(layout.layoutType) ||
    reading.usedColumnReconstruction;

  if (!multiColumn) {
    return {
      applied: false,
      reason: 'single_column',
      readingStage: reading,
      layoutMemory: baseMemory,
    };
  }

  const { left, right, full } = splitEntriesByColumn(baseMemory.entries);
  if (!left.length && !right.length) {
    return {
      applied: false,
      reason: 'no_column_split',
      readingStage: reading,
      layoutMemory: baseMemory,
    };
  }

  const columnOpts = {
    ...opts,
    twoColumnRecovery: true,
    layoutType: baseMemory.layoutType,
  };

  const fullMemory = full.length ? buildColumnLayoutMemory(full, COLUMN_IDS.FULL, baseMemory) : null;
  const leftMemory = left.length ? buildColumnLayoutMemory(left, COLUMN_IDS.LEFT, baseMemory) : null;
  const rightMemory = right.length ? buildColumnLayoutMemory(right, COLUMN_IDS.RIGHT, baseMemory) : null;

  const fullParse = fullMemory
    ? inferSemanticSectionBlocks(fullMemory.parserText, { ...columnOpts, layoutMemory: fullMemory })
    : { blocks: [], lines: [], semanticLines: [] };
  const leftParse = leftMemory
    ? inferSemanticSectionBlocks(leftMemory.parserText, {
        ...columnOpts,
        layoutMemory: leftMemory,
        columnId: COLUMN_IDS.LEFT,
      })
    : { blocks: [], lines: [], semanticLines: [] };
  const rightParse = rightMemory
    ? inferSemanticSectionBlocks(rightMemory.parserText, {
        ...columnOpts,
        layoutMemory: rightMemory,
        columnId: COLUMN_IDS.RIGHT,
      })
    : { blocks: [], lines: [], semanticLines: [] };

  const blocks = mergeColumnSectionBlocks(
    fullParse.blocks,
    leftParse.blocks,
    rightParse.blocks
  );
  const lines = flattenBlockLines(blocks);
  const spatialBlocks = baseMemory.spatialBlocks?.length
    ? baseMemory.spatialBlocks
    : spatialBlocksFromLayoutEntries(baseMemory.entries || []);
  const parserText = spatialBlocksToPlainText(spatialBlocks);

  return {
    applied: true,
    reason: 'two_column_recovery',
    layoutType: baseMemory.layoutType,
    columnSplit: baseMemory.columnSplit,
    readingStage: reading,
    layoutMemory: attachSpatialBlocksToLayoutMemory(baseMemory, spatialBlocks),
    leftColumn: {
      lineCount: left.length,
      blockCount: leftParse.blocks.length,
      sections: [...new Set(leftParse.blocks.map((b) => b.type))],
    },
    rightColumn: {
      lineCount: right.length,
      blockCount: rightParse.blocks.length,
      sections: [...new Set(rightParse.blocks.map((b) => b.type))],
    },
    lines,
    blocks,
    semanticLines: [
      ...(fullParse.semanticLines || []),
      ...(leftParse.semanticLines || []),
      ...(rightParse.semanticLines || []),
    ],
    parserText,
    spatialBlocks,
    stats: {
      fullBlocks: fullParse.blocks.length,
      leftBlocks: leftParse.blocks.length,
      rightBlocks: rightParse.blocks.length,
      mergedBlocks: blocks.length,
    },
  };
}
