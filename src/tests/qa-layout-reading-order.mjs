#!/usr/bin/env node
/**
 * Layout reconstruction — reading order before parsing; ordered blocks output.
 */
import { detectLayout, LAYOUT_TYPES } from '../core/extraction/layout-detector.js';
import {
  orderLinesForReading,
  buildOrderedBlocks,
  compareLinesReadingOrder,
} from '../core/extraction/reading-order.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

function line(text, x, y, page = 1) {
  return { text, cleanedText: text, rawExtraction: text, x, y, page, confidence: 90, source: 'native' };
}

const twoCol = [
  line('RIGHT-TOP', 420, 700),
  line('LEFT-TOP', 40, 700),
  line('LEFT-MID', 40, 500),
  line('RIGHT-MID', 420, 500),
  line('LEFT-BOT', 40, 200),
  line('RIGHT-BOT', 420, 200),
];

const layout = detectLayout({ lines: twoCol });
ok(
  layout.layoutType === LAYOUT_TYPES.TWO_COLUMN ||
    layout.layoutType === LAYOUT_TYPES.LEFT_SIDEBAR,
  `two-column layout detected: ${layout.layoutType}`
);

const columnOrder = buildOrderedBlocks({ lines: twoCol, layoutType: LAYOUT_TYPES.LEFT_SIDEBAR });
const texts = columnOrder.orderedLines.map((l) => l.cleanedText);
ok(texts[0] === 'LEFT-TOP', 'left column read first (top)');
ok(texts.indexOf('LEFT-BOT') < texts.indexOf('RIGHT-TOP'), 'left column before right column');
ok(columnOrder.orderedLines.every((l) => Number.isFinite(l.readingOrder)), 'readingOrder assigned');

const ordered = orderLinesForReading(twoCol, LAYOUT_TYPES.SINGLE_COLUMN);
ok(ordered.length === twoCol.length, 'single-column line order preserves lines');

ok(compareLinesReadingOrder(line('A', 0, 700), line('B', 0, 200)) < 0, 'higher y reads first');

const blocks = buildOrderedBlocks({ lines: twoCol, layoutType: LAYOUT_TYPES.LEFT_SIDEBAR });
ok(blocks.orderedBlocks?.length >= 1, 'outputs ordered blocks');
ok(blocks.usedRawPdfLineOrder === false, 'never raw PDF line order');
ok(blocks.usedGeometryReadingOrder === true, 'geometry reading order used');

const creative = detectLayout({
  lines: [],
  cleanedText: `Portfolio\nBehance\nNike Adobe Illustrator\nExperience at Marvel`,
});
ok(
  creative.layoutType === LAYOUT_TYPES.CREATIVE_PORTFOLIO ||
    creative.signals.some((s) => s.includes('creative')),
  'creative portfolio layout signal'
);

const single = detectLayout({ lines: [line('Name', 100, 800), line('Body', 100, 600)] });
ok(single.layoutType === LAYOUT_TYPES.SINGLE_COLUMN, 'sparse coords → single column');

const paste = buildOrderedBlocks({
  rawText: 'EXPERIENCE\nNike Designer\n\nEDUCATION\nLISAA',
});
ok(
  paste.orderedBlocks.some((b) => b.kind === 'section' || b.kind === 'section_header'),
  'paste → section blocks'
);
ok(paste.orderedBlocks.every((b) => 'section' in b && Number.isFinite(b.startPosition)), 'paste → section ranges');
ok(paste.blocks === paste.orderedBlocks, 'blocks alias orderedBlocks');

process.exit(failed ? 1 : 0);
