#!/usr/bin/env node
/**
 * P1 Two-column recovery — left/right detect, separate reconstruct, merge.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectLayout, LAYOUT_TYPES } from '../core/layout/detect-layout.js';
import { applyReadingOrder } from '../core/layout/reading-order.js';
import { COLUMN_IDS } from '../core/layout/detect-columns.js';
import { recoverTwoColumnSections, isMultiColumnLayoutType } from '../core/layout/two-column-recovery.js';
import { buildLayoutMemory } from '../core/layout/layout-memory.js';
import { buildDocumentBlocks } from '../core/parsing/document-block.js';
import { buildStructuredResumeFromDocumentBlocks } from '../core/parsing/structured-resume-from-blocks.js';
import { structuredToCvData } from '../core/parsing/structured-resume.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { SECTION_IDS } from '../core/parsing/section-types-v2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/two-column-recovery');
mkdirSync(outDir, { recursive: true });

const checks = [];
let failed = 0;

function record(id, pass, detail) {
  checks.push({ id, pass, detail });
  if (!pass) {
    console.error('FAIL', id, detail || '');
    failed++;
  } else {
    console.log('OK', id, detail || '');
  }
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
record(
  'layout_detected',
  layout.layoutType === LAYOUT_TYPES.LEFT_SIDEBAR || layout.layoutType === LAYOUT_TYPES.TWO_COLUMN,
  layout.layoutType
);

const reading = applyReadingOrder({ lines, layout, layoutType: layout.layoutType });
record('column_reconstruction', reading.usedColumnReconstruction === true, 'usedColumnReconstruction');

const memory = buildLayoutMemory(lines, { layout, orderedLines: reading.orderedLines });
record('layout_memory_multi_column', isMultiColumnLayoutType(memory.layoutType), memory.layoutType);

const leftEntries = memory.entries.filter((e) => e.columnId === COLUMN_IDS.LEFT);
const rightEntries = memory.entries.filter((e) => e.columnId === COLUMN_IDS.RIGHT);
record('left_column_detected', leftEntries.length >= 4, `lines=${leftEntries.length}`);
record('right_column_detected', rightEntries.length >= 8, `lines=${rightEntries.length}`);

const langBeforeExp = memory.entries.findIndex((e) => /^Languages$/i.test(e.text));
const expLine = memory.entries.findIndex((e) => /^Experience$/i.test(e.text));
record('reading_order_left_first', langBeforeExp >= 0 && expLine > langBeforeExp, `lang@${langBeforeExp} exp@${expLine}`);

const recovery = recoverTwoColumnSections(lines.map((l) => l.text).join('\n'), {
  extractionLines: lines,
  readingStage: reading,
  layoutMemory: memory,
  layout,
});
record('recovery_applied', recovery.applied === true, recovery.reason || '');
record('recovery_left_sections', recovery.leftColumn?.sections?.includes(SECTION_IDS.LANGUAGES), recovery.leftColumn?.sections?.join(','));
record('recovery_right_sections', recovery.rightColumn?.sections?.includes(SECTION_IDS.EXPERIENCE), recovery.rightColumn?.sections?.join(','));

const engine = runSectionEngineV2(lines.map((l) => l.text).join('\n'), {
  extractionLines: lines,
  readingStage: reading,
  layoutMemory: memory,
  layoutType: layout.layoutType,
});
record('section_engine_two_column_flag', engine.twoColumnRecovery === true, String(engine.twoColumnRecovery));

const detectedTypes = new Set((engine.blocks || recovery.blocks || []).map((b) => b.type));
record('sections_skills', detectedTypes.has(SECTION_IDS.SKILLS), [...detectedTypes].join(','));
record('sections_languages', detectedTypes.has(SECTION_IDS.LANGUAGES), [...detectedTypes].join(','));
record('sections_education', detectedTypes.has(SECTION_IDS.EDUCATION), [...detectedTypes].join(','));
record('sections_experience', detectedTypes.has(SECTION_IDS.EXPERIENCE), [...detectedTypes].join(','));

const docStage = buildDocumentBlocks({ layoutBlocks: reading.orderedBlocks });
const structured = buildStructuredResumeFromDocumentBlocks(docStage.documentBlocks, {
  rawText: lines.map((l) => l.text).join('\n'),
  cleanedText: lines.map((l) => l.text).join('\n'),
  readingStage: reading,
  layoutMemory: memory,
  layoutType: layout.layoutType,
  extractionLines: lines,
});
const cv = structuredToCvData(structured);

record('cv_education_lisaa', cv.education.some((e) => /LISAA/i.test(e)), cv.education.join(' | '));
record('cv_experience_job', cv.experience.some((e) => /Nike|Freelance/i.test(e)), cv.experience.slice(0, 2).join(' | '));
record('cv_languages', cv.languages.length >= 1, cv.languages.join(' | '));
record('cv_skills', cv.skills.length >= 1, cv.skills.slice(0, 3).join(' | '));
record('cv_lisaa_not_experience', !cv.experience.some((e) => /LISAA/i.test(e)), 'LISAA leak');
record('cv_nike_not_education', !cv.education.some((e) => /Nike/i.test(e)), 'Nike leak');
record(
  'cv_languages_not_education',
  !cv.education.some((e) => /French — native|English — fluent/i.test(e)),
  'language leak'
);

const report = {
  generatedAt: new Date().toISOString(),
  fixture: 'tests/fixtures/yoaz-cv/two-column-lines.json',
  layoutType: layout.layoutType,
  checks,
  passed: checks.filter((c) => c.pass).length,
  total: checks.length,
  pass: failed === 0,
  recovery: {
    applied: recovery.applied,
    stats: recovery.stats,
    leftColumn: recovery.leftColumn,
    rightColumn: recovery.rightColumn,
  },
};

writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
