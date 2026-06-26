#!/usr/bin/env node
/**
 * Section segmenter — sidebar CV tests (Yohann page 1 benchmark).
 * node src/tests/qa-section-segmenter-yoaz.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CV_SECTION, matchSectionHeading } from '../core/parsing/section-heading-dictionary.js';
import {
  segmentCvLines,
  segmentCvBlocks,
  buildSectionMapDebug,
  segmentsInSection,
} from '../core/parsing/section-segmenter.js';
import { spatialBlocksFromLayoutEntries } from '../core/layout/spatial-block.js';
import { buildLayoutMemory } from '../core/layout/layout-memory.js';
import { classifyDocumentPageLayouts } from '../core/layout/page-layout.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/section-segmenter-yoaz');
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

function headingSection(segments, textRe) {
  const h = segments.find((s) => s.is_heading && textRe.test(s.text));
  return h?.section || null;
}

function sectionHasText(segments, section, textRe) {
  return segments.some((s) => s.section === section && !s.is_heading && textRe.test(s.text));
}

// --- Dictionary unit checks ---
ok(matchSectionHeading('WORK EXPERIENCE')?.section === CV_SECTION.EXPERIENCE, 'dict: WORK EXPERIENCE');
ok(matchSectionHeading('PROFILE')?.section === CV_SECTION.SUMMARY, 'dict: PROFILE -> summary');
ok(matchSectionHeading('PROFIL')?.section === CV_SECTION.SUMMARY, 'dict: PROFIL -> summary');
ok(matchSectionHeading('FORMATION')?.section === CV_SECTION.EDUCATION, 'dict: FORMATION -> education');
ok(matchSectionHeading('LANGUES')?.section === CV_SECTION.LANGUAGES, 'dict: LANGUES');
ok(matchSectionHeading('CONTACT')?.section === CV_SECTION.CONTACT, 'dict: CONTACT');
ok(matchSectionHeading('INTERESTS')?.section === CV_SECTION.INTERESTS, 'dict: INTERESTS');
ok(matchSectionHeading('INTEREST')?.section === CV_SECTION.INTERESTS, 'dict: INTEREST -> interests');

// --- Unknown blocks stay isolated ---
{
  const orphanBlocks = [
    { block_id: 'o1', page_number: 1, reading_order: 0, text: 'Random project notes about zebras', bbox: { x: 360, y: 400, width: 200, height: 12 } },
    { block_id: 'o2', page_number: 1, reading_order: 1, text: 'More unstructured content here', bbox: { x: 360, y: 380, width: 200, height: 12 } },
  ];
  const orphanResult = segmentCvBlocks(orphanBlocks);
  ok(
    orphanResult.segments.every((s) => s.section === CV_SECTION.OTHER && s.reason === 'isolated_unknown'),
    'unknown main blocks stay other (no forced classification)'
  );
}

// --- FR heading dictionary ---
ok(matchSectionHeading('EXPÉRIENCE PROFESSIONNELLE')?.section === CV_SECTION.EXPERIENCE, 'dict: FR experience');
ok(matchSectionHeading('COMPÉTENCES')?.section === CV_SECTION.SKILLS, 'dict: FR skills');

// --- Yohann PDF benchmark page 1 (sidebar_left coordinates) ---
const yoazLines = loadLines('tests/fixtures/yoaz-pdf-benchmark/page1-lines.json');
const yoazPage1 = yoazLines.filter((l) => (l.page || 1) === 1);
const yoazResult = segmentCvLines(yoazPage1);

writeFileSync(
  join(outDir, 'yoaz-page1-section-map.json'),
  JSON.stringify(yoazResult.sectionMap, null, 2)
);

ok(yoazResult.stats.headingCount >= 6, `yoaz page1 headings >= 6 (${yoazResult.stats.headingCount})`);
ok(yoazResult.stats.propagated >= 8, `yoaz page1 propagated blocks >= 8 (${yoazResult.stats.propagated})`);

ok(headingSection(yoazResult.segments, /^PROFILE$/i) === CV_SECTION.SUMMARY, 'yoaz: PROFILE -> summary');
ok(headingSection(yoazResult.segments, /^LANGUAGES$/i) === CV_SECTION.LANGUAGES, 'yoaz: LANGUAGES -> languages');
ok(headingSection(yoazResult.segments, /^WORK EXPERIENCE$/i) === CV_SECTION.EXPERIENCE, 'yoaz: WORK EXPERIENCE -> experience');
ok(headingSection(yoazResult.segments, /^EDUCATION$/i) === CV_SECTION.EDUCATION, 'yoaz: EDUCATION -> education');
ok(headingSection(yoazResult.segments, /^SKILLS$/i) === CV_SECTION.SKILLS, 'yoaz: SKILLS -> skills');
ok(headingSection(yoazResult.segments, /^INTERESTS$/i) === CV_SECTION.INTERESTS, 'yoaz: INTERESTS -> interests');

ok(
  sectionHasText(yoazResult.segments, CV_SECTION.CONTACT, /yoaz@hotmail|494344839/i),
  'yoaz: contact lines (email/phone) -> contact'
);
ok(
  sectionHasText(yoazResult.segments, CV_SECTION.SUMMARY, /35 years old|illustrator and graphic designer/i),
  'yoaz: profile body -> summary (propagation)'
);
ok(
  sectionHasText(yoazResult.segments, CV_SECTION.EXPERIENCE, /Freelancer|McCann|2011 - 2023/i),
  'yoaz: experience body -> experience'
);
ok(
  sectionHasText(yoazResult.segments, CV_SECTION.EDUCATION, /LISAA|Créapôle/i),
  'yoaz: education body -> education'
);
ok(
  sectionHasText(yoazResult.segments, CV_SECTION.SKILLS, /Photoshop|Illustrator/i),
  'yoaz: skills body -> skills'
);
ok(
  sectionHasText(yoazResult.segments, CV_SECTION.INTERESTS, /Photography|Snowboard/i),
  'yoaz: interests body -> interests'
);

// Sidebar vs main zone propagation
const sidebarExp = yoazResult.segments.filter(
  (s) => s.zone_id === 'sidebar' && s.section === CV_SECTION.EXPERIENCE && !s.is_heading
);
const mainLang = yoazResult.segments.filter(
  (s) => s.zone_id === 'main' && s.section === CV_SECTION.LANGUAGES && !s.is_heading
);
ok(sidebarExp.length === 0, 'yoaz: experience headings in main do not leak to sidebar');
ok(mainLang.length === 0, 'yoaz: languages stay in sidebar (no leak to main)');

// --- Fixture with explicit CONTACT header (fixture-page1 text lines) ---
const fixturePage1 = readFileSync(
  join(root, 'tests/fixtures/yoaz-pdf-benchmark/fixture-page1.txt'),
  'utf8'
)
  .split(/\r?\n/)
  .map((t) => t.trim())
  .filter(Boolean)
  .map((text, i) => ({
    text,
    cleanedText: text,
    page: 1,
    x: text === 'CONTACT' || /yoaz@|4943|Boulevard|PROFILE|LANGUAGES/i.test(text) ? 70 : 360,
    y: 800 - i * 18,
    width: 200,
    height: 14,
    line: i,
    source: 'paste',
  }));

const fixtureResult = segmentCvLines(fixturePage1);
ok(headingSection(fixtureResult.segments, /^CONTACT$/i) === CV_SECTION.CONTACT, 'fixture: CONTACT header');
ok(headingSection(fixtureResult.segments, /^PROFILE$/i) === CV_SECTION.SUMMARY, 'fixture: PROFILE -> summary');

// --- Two-column sidebar CV (yoaz-cv) ---
const legacyLines = loadLines('tests/fixtures/yoaz-cv/two-column-lines.json');
const legacyResult = segmentCvLines(legacyLines);

writeFileSync(
  join(outDir, 'yoaz-two-column-section-map.json'),
  JSON.stringify(legacyResult.sectionMap, null, 2)
);

ok(headingSection(legacyResult.segments, /^Profile$/i) === CV_SECTION.SUMMARY, 'two-col: Profile -> summary');
ok(headingSection(legacyResult.segments, /^Experience$/i) === CV_SECTION.EXPERIENCE, 'two-col: Experience');
ok(headingSection(legacyResult.segments, /^Languages$/i) === CV_SECTION.LANGUAGES, 'two-col: Languages in sidebar');
ok(
  sectionHasText(legacyResult.segments, CV_SECTION.CONTACT, /yoaz@hotmail|\+33/i),
  'two-col: contact strip -> contact'
);
ok(
  segmentsInSection(legacyResult.segments, CV_SECTION.EXPERIENCE).some((s) => /Freelance|Nike/i.test(s.text)),
  'two-col: experience propagation'
);

// Debug map structure
ok(yoazResult.sectionMap.version === '1', 'section map version');
ok(yoazResult.sectionMap.heading_timeline?.length >= 6, 'section map heading timeline');
ok(yoazResult.sectionMap.pages?.[1]?.zones, 'section map has page 1 zones');
ok(
  Object.keys(yoazResult.sectionMap.pages[1].zones).length >= 1,
  'section map zones populated'
);

console.log('\nSection counts (yoaz page1):', yoazResult.stats.bySection);
console.log(`Debug: ${join(outDir, 'yoaz-page1-section-map.json')}`);

process.exit(failed ? 1 : 0);
