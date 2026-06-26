#!/usr/bin/env node
/**
 * Page document classifier — Yohann CV page 1 resume / page 2 portfolio.
 * node src/tests/qa-page-document-classifier-yoaz.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PAGE_DOCUMENT_CLASS,
  PAGE_DOCUMENT_CLASSIFIER,
  classifyPageDocument,
  classifyDocumentPages,
  filterLinesForResumeParsing,
  filterSpatialBlocksForResumeParsing,
  extractPortfolioItems,
  buildPageDocumentClassificationDebug,
  buildPageDecisionReasons,
  buildExcludedPagesTrace,
} from '../core/layout/page-document-classifier.js';
import { classifyDocumentPageLayouts } from '../core/layout/page-layout.js';
import { detectSectionBlocks } from '../core/parsing/section-detect-v2.js';
import { spatialBlocksFromLayoutMemory } from '../core/layout/spatial-block.js';
import { buildLayoutMemory } from '../core/layout/layout-memory.js';
import { parseSkillsFromSegments } from '../core/parsing/cv-skills-block-parser.js';
import { CV_SECTION } from '../core/parsing/section-heading-dictionary.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/page-document-classifier-yoaz');
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

const page1Lines = loadLines('tests/fixtures/yoaz-pdf-benchmark/page1-lines.json').filter(
  (l) => (l.page || 1) === 1
);
const page2Lines = loadLines('tests/fixtures/yoaz-pdf-benchmark/page2-lines.json');
const page2Snippet = loadLines('tests/fixtures/yoaz-pdf-benchmark/page1-lines.json').filter(
  (l) => (l.page || 1) === 2
);
const allLines = [...page1Lines, ...page2Lines];

const pageLayouts = classifyDocumentPageLayouts(allLines);
const classification = classifyDocumentPages(allLines, { pageLayouts });

writeFileSync(
  join(outDir, 'yoaz-page-document-classification.json'),
  JSON.stringify(buildPageDocumentClassificationDebug(classification), null, 2)
);

const p1 = classification.pages.find((p) => p.page === 1);
const p2 = classification.pages.find((p) => p.page === 2);

ok(p1?.page_class === PAGE_DOCUMENT_CLASS.RESUME_CORE, `page1 resume_core (got ${p1?.page_class})`);
ok(p1?.confidence >= 0.7, `page1 confidence >= 0.7 (${p1?.confidence})`);
ok(p1?.cv_heading_sections?.length >= 4, `page1 has CV headings (${p1?.cv_heading_sections?.length})`);

ok(p2?.page_class === PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE, `page2 portfolio_page (got ${p2?.page_class})`);
ok(p2?.confidence >= 0.7, `page2 confidence >= 0.7 (${p2?.confidence})`);
ok((p2?.portfolio_caption_count || 0) >= 3, `page2 portfolio captions >= 3 (${p2?.portfolio_caption_count})`);

ok(classification.resume_core_pages.includes(1), 'resume_core_pages includes 1');
ok(classification.portfolio_pages.includes(2), 'portfolio_pages includes 2');
ok(classification.excluded_pages?.includes(2), 'excluded_pages includes 2');
ok(classification.classifier === 'PAGE_DOCUMENT_CLASSIFIER_V2', 'classifier V2');

ok(Array.isArray(classification.excluded_pages_trace), 'excluded_pages_trace present');
const page2Trace = classification.excluded_pages_trace.find((t) => t.page === 2);
ok(page2Trace, 'excluded trace for page 2');
if (page2Trace) {
  ok(!page2Trace.included_in_resume_parsing, 'page2 not in resume parsing');
  ok(page2Trace.excluded_from.includes('skills'), 'page2 excluded from skills');
  ok(page2Trace.excluded_from.includes('experience'), 'page2 excluded from experience');
  ok(page2Trace.decision_reasons?.length >= 2, `page2 decision_reasons (${page2Trace.decision_reasons?.length})`);
  ok(
    page2Trace.decision_reasons.some((r) => /portfolio|caption|headings/i.test(r)),
    'page2 reasons mention portfolio signals'
  );
}

const page1Trace = classification.excluded_pages_trace.find((t) => t.page === 1);
ok(page1Trace?.included_in_resume_parsing, 'page1 included in resume parsing');
ok(p1?.decision_reasons?.length >= 2, `page1 decision_reasons (${p1?.decision_reasons?.length})`);

writeFileSync(
  join(outDir, 'yoaz-excluded-pages-trace.json'),
  JSON.stringify(classification.excluded_pages_trace, null, 2)
);

const portfolioItems = extractPortfolioItems(allLines, classification);
ok(portfolioItems.length >= 4, `portfolio_items >= 4 (got ${portfolioItems.length})`);
ok(
  portfolioItems.some((i) => /sunglass/i.test(i.title)),
  'portfolio_items includes Sunglass project'
);
ok(
  portfolioItems.every((i) => i.page_number === 2),
  'portfolio_items all from page 2'
);

// Page 2 snippet from page1-lines.json (2 lines) also portfolio
const snippetClass = classifyPageDocument(page2Snippet, 2);
ok(
  snippetClass.page_class === PAGE_DOCUMENT_CLASS.PORTFOLIO_PAGE,
  `page2 snippet portfolio_page (got ${snippetClass.page_class})`
);

// Resume line filter excludes page 2
const resumeLines = filterLinesForResumeParsing(allLines, classification);
ok(!resumeLines.some((l) => (l.page || 1) === 2), 'filterLines removes page 2');
ok(resumeLines.length === page1Lines.length, `resume lines = page1 count (${resumeLines.length})`);

// Spatial block filter
const memory = buildLayoutMemory(allLines, { source: 'pdf_native' });
const spatialBlocks = spatialBlocksFromLayoutMemory(memory);
const resumeBlocks = filterSpatialBlocksForResumeParsing(spatialBlocks, classification);
ok(
  !resumeBlocks.some((b) => b.page_number === 2),
  'filterSpatialBlocks removes page 2'
);
ok(resumeBlocks.every((b) => b.page_number === 1), 'resume blocks are page 1 only');

// Pipeline integration — portfolio captions must not appear in skills parse
const detected = detectSectionBlocks(
  allLines.map((l) => l.text).join('\n'),
  {
    layoutMemory: memory,
    spatialBlocks,
    extractionLines: allLines,
    pageDocumentClassification: classification,
    pageLayouts,
  }
);

ok(detected.pageDocumentClassification?.portfolio_pages?.includes(2), 'pipeline exposes portfolio_pages');
ok(Array.isArray(detected.excluded_pages_trace), 'pipeline exposes excluded_pages_trace');
ok(detected.excluded_pages_trace?.some((t) => t.page === 2 && !t.included_in_resume_parsing), 'pipeline trace excludes page 2');
ok(detected.pageClassificationDebug?.excluded_pages_trace?.length >= 2, 'pipeline pageClassificationDebug');
ok(Array.isArray(detected.portfolio_items), 'pipeline exposes portfolio_items');
ok(detected.portfolio_items.length >= 4, `pipeline portfolio_items >= 4 (${detected.portfolio_items.length})`);

const skillNames = (detected.skillItems || []).map((s) => s.name.toLowerCase());
ok(!skillNames.some((n) => /sunglass|playstation|god of war|elon musk/i.test(n)), 'skills parse excludes portfolio captions');
ok(
  skillNames.some((n) => /photoshop|illustrator|indesign/i.test(n)),
  `skills parse still has tools (${skillNames.join(', ')})`
);

// Direct segment check on unfiltered vs pipeline
const pollutedSegments = (detected.sectionSegmentation?.segments || []).concat(
  page2Lines.map((l, i) => ({
    text: l.text,
    section: CV_SECTION.PROJECTS,
    page_number: 2,
    block_id: `p2-${i}`,
  }))
);
const pollutedSkills = parseSkillsFromSegments(pollutedSegments);
const pollutedNames = pollutedSkills.items.map((s) => s.name.toLowerCase());
ok(
  pollutedNames.some((n) => /playstation|sunglass/i.test(n)) === false ||
    detected.skillItems.length < pollutedSkills.items.length,
  'page gate reduces portfolio pollution vs unfiltered segments'
);

console.log('\n--- classification ---');
console.log(
  classification.pages.map((p) => ({
    page: p.page,
    page_class: p.page_class,
    confidence: p.confidence,
    signals: p.signals,
  }))
);
console.log(`\nDebug: ${join(outDir, 'yoaz-page-document-classification.json')}`);
console.log(failed ? `\n${failed} FAILED` : '\nAll page document classifier checks passed');
process.exit(failed ? 1 : 0);
