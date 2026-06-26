#!/usr/bin/env node
/**
 * Layout memory — every line keeps lineIndex, y, page; parser receives spatial input.
 */
import { buildLayoutMemory } from '../core/layout/layout-memory.js';
import { COLUMN_IDS } from '../core/layout/detect-columns.js';
import { resolveParserLayoutInput } from '../core/parsing/parser-layout-input.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

function line(text, x, y, page = 1) {
  return {
    text,
    cleanedText: text,
    rawExtraction: text,
    x,
    y,
    width: 120,
    height: 12,
    page,
    line: 0,
    confidence: 90,
    source: 'native',
  };
}

const twoCol = [
  line('Yohann Azancot', 40, 760),
  line('Graphic Designer', 40, 740),
  line('EXPERIENCE', 40, 700),
  line('Nike — Lead Designer', 40, 660),
  line('2019 – Present', 40, 640),
  line('EDUCATION', 420, 700),
  line('LISAA — Bachelor', 420, 660),
];

const memory = buildLayoutMemory(twoCol);
ok(memory.lineCount === twoCol.length, `layout memory line count (${memory.lineCount})`);
ok(memory.entries.every((e) => Number.isFinite(e.lineIndex)), 'every entry has lineIndex');
ok(memory.entries.every((e) => Number.isFinite(e.y)), 'every entry has y');
ok(memory.entries.every((e) => e.page >= 1), 'every entry has page');
ok(memory.parserText.includes('Graphic Designer'), 'parser text preserves content');

const leftExp = memory.entries.find((e) => e.text.includes('Nike'));
const rightEdu = memory.entries.find((e) => e.text.includes('LISAA'));
ok(leftExp?.columnId === COLUMN_IDS.LEFT, 'left column experience line');
ok(rightEdu?.columnId === COLUMN_IDS.RIGHT, 'right column education line');

const parserInput = resolveParserLayoutInput('', {
  extractionLines: twoCol,
  rawText: twoCol.map((l) => l.text).join('\n'),
});
ok(parserInput.layoutMemory?.lineCount === twoCol.length, 'parser layout input from lines');
ok(parserInput.text.includes('EDUCATION'), 'parser text reading order includes both columns');

const parsed = runSectionEngineV2(parserInput.text, {
  rawText: parserInput.rawText,
  extractionLines: parserInput.extractionLines,
  layoutMemory: parserInput.layoutMemory,
});
ok(parsed.structured.metadata?.parserUsesLayoutMemory === true, 'section engine uses layout memory');
ok(parsed.structured.metadata?.layoutMemory?.lineCount === twoCol.length, 'structured metadata layout memory');
ok(
  String(parsed.structured.identity?.title || '').toLowerCase().includes('graphic'),
  `title from layout-backed parse (${parsed.structured.identity?.title})`
);

console.log('\nLAYOUT_MEMORY QA OK — columns', {
  left: memory.entries.filter((e) => e.columnId === COLUMN_IDS.LEFT).length,
  right: memory.entries.filter((e) => e.columnId === COLUMN_IDS.RIGHT).length,
});
