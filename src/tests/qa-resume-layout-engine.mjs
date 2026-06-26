#!/usr/bin/env node
/**
 * Resume layout engine — production-grade spatial page layout + zones.
 * node src/tests/qa-resume-layout-engine.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLayoutMemory } from '../core/layout/layout-memory.js';
import { spatialBlocksFromLayoutMemory } from '../core/layout/spatial-block.js';
import { PAGE_LAYOUT_TYPES } from '../core/layout/page-layout.js';
import { PAGE_DOCUMENT_CLASS } from '../core/layout/page-document-classifier.js';
import {
  runResumeLayoutAnalysis,
  assignZonesToSpatialBlocks,
  blocksShareReadingZone,
  buildResumeLayoutDebug,
} from '../core/layout/resume-layout-engine.js';
import { extractGeometricBlocks, mergeAdjacentLineBlocks, extractLineBlocks } from '../core/layout/block-extractor.js';
import { detectSectionBlocks } from '../core/parsing/section-detect-v2.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/resume-layout-engine');
mkdirSync(outDir, { recursive: true });

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK ', msg);
  }
}

function loadYoazDocument() {
  const lines = [];
  for (const rel of [
    'tests/fixtures/yoaz-pdf-benchmark/page1-lines.json',
    'tests/fixtures/yoaz-pdf-benchmark/page2-lines.json',
  ]) {
    const raw = JSON.parse(readFileSync(join(root, rel), 'utf8'));
    for (const l of raw.lines || []) {
      lines.push({
        ...l,
        page: l.page || raw.page,
        cleanedText: l.text,
        rawExtraction: l.text,
        confidence: 90,
        source: 'native',
      });
    }
  }
  const layoutMemory = buildLayoutMemory(lines);
  const spatialBlocks = spatialBlocksFromLayoutMemory(layoutMemory);
  return { lines, spatialBlocks, layoutMemory };
}

console.log('\n=== RESUME LAYOUT ENGINE ===\n');

const { lines, spatialBlocks } = loadYoazDocument();
const stage = runResumeLayoutAnalysis({ lines, spatialBlocks });
const debug = buildResumeLayoutDebug(stage);

writeFileSync(join(outDir, 'yoaz-resume-layout-debug.json'), JSON.stringify(debug, null, 2));

ok(stage.engine === 'RESUME_LAYOUT_ENGINE_V1', 'engine id set');
ok(stage.pages.length === 2, `two pages classified (${stage.pages.length})`);

const page1 = stage.pages.find((p) => p.page === 1);
const page2 = stage.pages.find((p) => p.page === 2);

ok(page1?.layout_type === PAGE_LAYOUT_TYPES.SIDEBAR_LEFT, `page1 sidebar_left (got ${page1?.layout_type})`);
ok(page1?.page_class === PAGE_DOCUMENT_CLASS.RESUME_CORE, `page1 resume_core (got ${page1?.page_class})`);
ok(page1?.zones?.length >= 2, 'page1 has >=2 zones');
ok(Number.isFinite(page1?.split_x), `page1 split_x (${page1?.split_x})`);

const sidebar = page1?.zones?.find((z) => z.role === 'sidebar');
const main = page1?.zones?.find((z) => z.role === 'main');
ok(sidebar, 'page1 sidebar zone');
ok(main, 'page1 main zone');

const sidebarPreview = (sidebar?.preview || []).join(' ').toLowerCase();
const mainPreview = (main?.preview || []).join(' ').toLowerCase();
ok(/yoaz@|french|english|profile|years old/.test(sidebarPreview), `sidebar content roles: ${sidebarPreview.slice(0, 80)}`);
ok(/experience|education|skills|lisaa|freelancer|mccann/.test(mainPreview), `main content roles: ${mainPreview.slice(0, 80)}`);

ok(page2?.layout_type === PAGE_LAYOUT_TYPES.PORTFOLIO_PAGE, `page2 portfolio_page (got ${page2?.layout_type})`);
ok(page2?.page_class === PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE, `page2 portfolio class (got ${page2?.page_class})`);
ok(page2?.parse_resume_sections === false, 'page2 skips resume section parsing');
ok(page2?.zones?.[0]?.zone_id === 'portfolio_grid', 'page2 portfolio_grid zone');

const zoned = assignZonesToSpatialBlocks(spatialBlocks, stage);
const p1Blocks = zoned.filter((b) => b.page_number === 1);
const sidebarBlocks = p1Blocks.filter((b) => b.zone_id === 'sidebar');
const mainBlocks = p1Blocks.filter((b) => b.zone_id === 'main');
ok(sidebarBlocks.length >= 4, `sidebar blocks >= 4 (${sidebarBlocks.length})`);
ok(mainBlocks.length >= 6, `main blocks >= 6 (${mainBlocks.length})`);

const crossPair = sidebarBlocks[0] && mainBlocks[0];
if (crossPair) {
  ok(
    !blocksShareReadingZone(
      { x: sidebarBlocks[0].bbox.x, y: sidebarBlocks[0].bbox.y, cx: sidebarBlocks[0].bbox.x, text: sidebarBlocks[0].text, bbox: sidebarBlocks[0].bbox },
      { x: mainBlocks[0].bbox.x, y: mainBlocks[0].bbox.y, cx: mainBlocks[0].bbox.x + 200, text: mainBlocks[0].text, bbox: mainBlocks[0].bbox },
      page1
    ),
    'sidebar vs main blocks do not share reading zone'
  );
}

const geo = extractGeometricBlocks(lines.filter((l) => (l.page || 1) === 1), {
  resumeLayoutStage: stage,
});
const lineBlocks = extractLineBlocks(lines.filter((l) => (l.page || 1) === 1));
const merged = mergeAdjacentLineBlocks(lineBlocks, { resumeLayoutStage: stage, lines });
const crossMerge = merged.some((b) => {
  const texts = (b.lines || []).map((l) => String(l.text || l.cleanedText || '')).join(' ');
  return /french native/i.test(texts) && /lisaa|mccann|education/i.test(texts);
});
ok(!crossMerge, 'geometric merge does not cross sidebar/main zones');

const detection = detectSectionBlocks('', {
  extractionLines: lines,
  spatialBlocks,
  structureFirst: true,
});
ok(detection.resumeLayoutStage != null, 'section detect wires resumeLayoutStage');
ok(detection.resumeLayoutDebug?.pages?.length === 2, 'section detect exposes layout debug JSON');
ok(
  detection.resumeLayoutDebug.pages[0].layout_type === PAGE_LAYOUT_TYPES.SIDEBAR_LEFT,
  'pipeline debug page1 layout'
);
ok(
  detection.resumeLayoutDebug.pages[1].layout_type === PAGE_LAYOUT_TYPES.PORTFOLIO_PAGE,
  'pipeline debug page2 layout'
);

console.log(`\nDebug: ${join(outDir, 'yoaz-resume-layout-debug.json')}`);
console.log('\n--- page 1 zones ---');
console.log(JSON.stringify(debug.pages[0].zones, null, 2));

process.exit(failed ? 1 : 0);
