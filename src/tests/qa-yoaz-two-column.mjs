#!/usr/bin/env node
/**
 * Yohann Azancot two-column layout — left sidebar vs right body, no section mixing.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectLayout, LAYOUT_TYPES } from '../core/extraction/layout-detector.js';
import { buildOrderedBlocks } from '../core/extraction/reading-order.js';
import { COLUMN_IDS } from '../core/extraction/layout-blocks.js';
import { buildDocumentBlocks } from '../core/parsing/document-block.js';
import { buildStructuredResumeFromDocumentBlocks } from '../core/parsing/structured-resume-from-blocks.js';
import { structuredToCvData } from '../core/parsing/structured-resume.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const fixture = JSON.parse(
  readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/two-column-lines.json'), 'utf8')
);

const lines = fixture.lines.map((l, i) => ({
  ...l,
  cleanedText: l.text,
  rawExtraction: l.text,
  confidence: 90,
  source: 'native',
  line: i,
}));

const layout = detectLayout({ lines });
ok(
  layout.layoutType === LAYOUT_TYPES.LEFT_SIDEBAR ||
    layout.layoutType === LAYOUT_TYPES.TWO_COLUMN,
  `layout detected: ${layout.layoutType}`
);

const stage = buildOrderedBlocks({ lines, layoutType: layout.layoutType });
ok(stage.usedColumnReconstruction === true, 'column reconstruction used');
ok(stage.orderedBlocks.length >= 5, 'ordered section blocks');

const leftSections = stage.orderedBlocks
  .filter((b) => b.column === COLUMN_IDS.LEFT)
  .map((b) => b.section || b.sectionKey || b.text);
const rightSections = stage.orderedBlocks
  .filter((b) => b.column === COLUMN_IDS.RIGHT)
  .map((b) => b.section || b.sectionKey || b.text);

ok(leftSections.some((h) => /profile|summary/i.test(String(h))), 'left: Profile');
ok(leftSections.some((h) => /languages/i.test(String(h))), 'left: Languages');
ok(rightSections.some((h) => /experience/i.test(String(h))), 'right: Experience');
ok(rightSections.some((h) => /education/i.test(String(h))), 'right: Education');
ok(rightSections.some((h) => /skills/i.test(String(h))), 'right: Skills');
ok(rightSections.some((h) => /interests/i.test(String(h))), 'right: Interests');

const parseOrder = stage.orderedBlocks.map((b) => b.text?.split('\n')[0] || '').join('|');
const profileIdx = parseOrder.toLowerCase().indexOf('profile');
const expIdx = parseOrder.toLowerCase().indexOf('experience');
const langIdx = parseOrder.toLowerCase().indexOf('languages');
ok(profileIdx >= 0 && expIdx > profileIdx, 'Profile before Experience in reading order');
ok(langIdx >= 0 && expIdx > langIdx, 'Languages before Experience (left column first)');

const docStage = buildDocumentBlocks({ layoutBlocks: stage.orderedBlocks });
const structured = buildStructuredResumeFromDocumentBlocks(docStage.documentBlocks, {
  rawText: lines.map((l) => l.text).join('\n'),
  cleanedText: lines.map((l) => l.text).join('\n'),
  readingStage: stage,
  layoutType: layout.layoutType,
  extractionLines: lines,
});
const cv = structuredToCvData(structured);

ok(cv.education.some((e) => /LISAA/i.test(e)), 'education has LISAA');
ok(cv.experience.some((e) => /Nike|Freelance/i.test(e)), 'experience has job');
ok(cv.languages.length >= 1, 'languages populated');
ok(!cv.experience.some((e) => /LISAA/i.test(e)), 'LISAA not in experience');
ok(!cv.education.some((e) => /Nike/i.test(e)), 'Nike not in education');

const expLineIdx = stage.orderedLines.findIndex((l) => /^Experience$/i.test(l.text));
const langLineIdx = stage.orderedLines.findIndex((l) => /^Languages$/i.test(l.text));
ok(expLineIdx > langLineIdx, 'Experience line after Languages in reading order');

process.exit(failed ? 1 : 0);
