#!/usr/bin/env node
/**
 * Page layout detection — Yohann CV sidebar_left benchmark.
 * node src/tests/qa-page-layout-yoaz.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PAGE_LAYOUT_TYPES,
  classifyPageLayout,
  classifyDocumentPageLayouts,
  buildPageLayoutDebug,
  zoneOrderedLines,
  lineReadingZone,
} from '../core/layout/page-layout.js';
import {
  runResumeLayoutAnalysis,
  buildResumeLayoutDebug,
} from '../core/layout/resume-layout-engine.js';
import { PAGE_DOCUMENT_CLASS } from '../core/layout/page-document-classifier.js';
import { detectLayout, LAYOUT_TYPES } from '../core/layout/detect-layout.js';
import { reconstructDocument } from '../core/layout/document-reconstruction.js';
import { COLUMN_IDS } from '../core/layout/detect-columns.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/page-layout-yoaz');
mkdirSync(outDir, { recursive: true });

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function loadLines(rel) {
  const raw = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  return raw.lines.map((l, i) => ({
    ...l,
    cleanedText: l.text,
    rawExtraction: l.text,
    confidence: 90,
    source: 'native',
    line: i,
  }));
}

const yoazLines = [
  ...loadLines('tests/fixtures/yoaz-pdf-benchmark/page1-lines.json'),
  ...loadLines('tests/fixtures/yoaz-pdf-benchmark/page2-lines.json'),
];
const legacyLines = loadLines('tests/fixtures/yoaz-cv/two-column-lines.json');

const page1 = classifyPageLayout(yoazLines, 1);
const page2 = classifyPageLayout(yoazLines, 2);
const docLayouts = classifyDocumentPageLayouts(yoazLines);
const debugJson = buildPageLayoutDebug(docLayouts);

writeFileSync(join(outDir, 'yoaz-page-layout-debug.json'), JSON.stringify(debugJson, null, 2));

ok(page1.layout_type === PAGE_LAYOUT_TYPES.SIDEBAR_LEFT, `page1 layout_type=sidebar_left (got ${page1.layout_type})`);
ok(page1.confidence >= 70, `page1 confidence >= 70 (${page1.confidence})`);
ok(page1.sidebar?.side === 'left', 'page1 sidebar.side=left');
ok(Number.isFinite(page1.split_x), `page1 split_x defined (${page1.split_x})`);
ok(page1.reading_zones?.length >= 2, 'page1 has sidebar + main reading zones');

const sidebarZone = page1.reading_zones.find((z) => z.role === 'sidebar');
const mainZone = page1.reading_zones.find((z) => z.role === 'main');
ok(sidebarZone, 'sidebar reading zone present');
ok(mainZone, 'main reading zone present');

const sidebarHay = (sidebarZone?.preview || []).join(' ').toLowerCase();
ok(/profile|french|english|yoaz@hotmail/.test(sidebarHay), `sidebar contains profile/contact/languages: ${sidebarHay}`);

const mainHay = (mainZone?.preview || []).join(' ').toLowerCase();
ok(/experience|education|skills|lisaa|freelancer|mccann/.test(mainHay), `main contains experience/education/skills: ${mainHay}`);

const ordered = zoneOrderedLines(page1, yoazLines.filter((l) => (l.page || 1) === 1));
const sidebarLines = ordered.filter((l) => l._readingZone === 'sidebar');
const mainLines = ordered.filter((l) => l._readingZone === 'main');
ok(sidebarLines.length >= 5, `sidebar zone line count >= 5 (${sidebarLines.length})`);
ok(mainLines.length >= 8, `main zone line count >= 8 (${mainLines.length})`);

const firstMainIdx = ordered.findIndex((l) => l._readingZone === 'main');
const lastSidebarIdx = ordered.map((l) => l._readingZone).lastIndexOf('sidebar');
ok(lastSidebarIdx < firstMainIdx, 'reading order: full sidebar zone before main zone');

const mergedRow = yoazLines.filter((l) => (l.page || 1) === 1 && Math.abs(l.y - 730) < 20);
if (mergedRow.length >= 2) {
  const zones = new Set(mergedRow.map((l) => lineReadingZone(page1, l)));
  ok(zones.size === 1 || zones.size === 2, 'same-row lines stay in distinct zones (no cross-merge)');
}

const layout = detectLayout({ lines: yoazLines });
ok(
  layout.pageLayoutType === PAGE_LAYOUT_TYPES.SIDEBAR_LEFT ||
    layout.layoutType === LAYOUT_TYPES.LEFT_SIDEBAR,
  `detectLayout maps to sidebar (${layout.pageLayoutType || layout.layoutType})`
);

const recon = reconstructDocument(yoazLines, { source: 'pdf_native', forbidPlainTextFallback: true });
ok(recon.ok, 'document reconstruction ok');
ok(recon.pageLayoutDebug?.layout_type === PAGE_LAYOUT_TYPES.SIDEBAR_LEFT, 'recon exposes pageLayoutDebug');
writeFileSync(
  join(outDir, 'yoaz-reconstruction-layout-debug.json'),
  JSON.stringify(recon.pageLayoutDebug, null, 2)
);

const leftBlocks = (recon.geometricBlocks?.blocks || []).filter((b) => b.column === COLUMN_IDS.LEFT);
const rightBlocks = (recon.geometricBlocks?.blocks || []).filter((b) => b.column === COLUMN_IDS.RIGHT);
ok(leftBlocks.length >= 4, `left column blocks >= 4 (${leftBlocks.length})`);
ok(rightBlocks.length >= 6, `right column blocks >= 6 (${rightBlocks.length})`);

const leftText = leftBlocks.map((b) => b.text).join(' ').toLowerCase();
const rightText = rightBlocks.map((b) => b.text).join(' ').toLowerCase();
ok(!/lisaa|mccann|education|skills/.test(leftText), 'left sidebar does not contain main-column sections');
ok(!/french native|english fluent/.test(rightText), 'main column does not contain sidebar languages');

const legacyPage1 = classifyPageLayout(legacyLines, 1);
ok(
  legacyPage1.layout_type === PAGE_LAYOUT_TYPES.SIDEBAR_LEFT,
  `legacy two-column fixture also sidebar_left (${legacyPage1.layout_type})`
);

ok(
  page2.layout_type === PAGE_LAYOUT_TYPES.PORTFOLIO_PAGE ||
    page2.layout_type === PAGE_LAYOUT_TYPES.SINGLE_COLUMN ||
    page2.layout_type === PAGE_LAYOUT_TYPES.COMPLEX,
  `page2 portfolio layout (${page2.layout_type})`
);

const resumeLayout = runResumeLayoutAnalysis({
  lines: yoazLines,
  spatialBlocks: yoazLines.map((l, i) => ({
    block_id: `t-${i}`,
    page_number: l.page || 1,
    text: l.text,
    normalized_text: l.text,
    bbox: { x: l.x, y: l.y, width: l.width || 80, height: l.height || 14 },
    reading_order: i,
    source: 'test',
  })),
});
const resumeDebug = buildResumeLayoutDebug(resumeLayout);
writeFileSync(join(outDir, 'yoaz-resume-layout-engine-debug.json'), JSON.stringify(resumeDebug, null, 2));
ok(
  resumeLayout.pages.find((p) => p.page === 1)?.layout_type === PAGE_LAYOUT_TYPES.SIDEBAR_LEFT,
  'resume engine page1 sidebar_left'
);
ok(
  resumeLayout.pages.find((p) => p.page === 2)?.layout_type === PAGE_LAYOUT_TYPES.PORTFOLIO_PAGE,
  'resume engine page2 portfolio_page'
);
ok(
  resumeLayout.pages.find((p) => p.page === 2)?.page_class === PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE,
  'resume engine page2 portfolio class'
);

console.log('\n--- page 1 debug sample ---');
console.log(JSON.stringify(debugJson.pages[0], null, 2));
console.log(`\nDebug written: ${join(outDir, 'yoaz-page-layout-debug.json')}`);

process.exit(failed ? 1 : 0);
