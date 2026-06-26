#!/usr/bin/env node
/**
 * Skills block parser — Yohann fixture regression tests.
 * node src/tests/qa-skills-block-parser-yoaz.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseSkillsLines,
  parseSkillsFromSegments,
  parseSkillsSectionBlocks,
  dedupeSkillBlockItems,
  SKILLS_BLOCK_PARSER,
  MIN_SKILLS_EMIT_CONFIDENCE,
  SKILL_CATEGORY,
  assessSkillsSectionPurity,
  buildSkillsParseDebug,
} from '../core/parsing/cv-skills-block-parser.js';
import {
  isSkillsSectionPollution,
  isDeniedClientBrand,
  isOcrSkillFragment,
  pollutionReason,
} from '../core/parsing/skills-section-pollution-filter.js';
import { CV_SECTION } from '../core/parsing/section-heading-dictionary.js';
import { normalizeCompareString } from '../core/parsing/dedupe-engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/skills-block-parser-yoaz');
const goldenDir = join(root, 'tests/golden');
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

const yoazSkillsLines = [
  'Photoshop',
  'Illustrator',
  'Indesign',
  'Affinity designer',
  'Procreate',
  'After effect',
];

const expectedTools = [
  'Photoshop',
  'Illustrator',
  'InDesign',
  'Affinity Designer',
  'Procreate',
  'After Effects',
];

const { items, byCategory, stats, reject_trace, parse_debug, section_purity } =
  parseSkillsLines(yoazSkillsLines);

ok(SKILLS_BLOCK_PARSER === 'SKILLS_BLOCK_PARSER_V2', 'parser id is V2');
ok(section_purity.strict_pass, 'yoaz: skills section purity passes');
ok(section_purity.purity_ratio >= 0.9, `yoaz: high purity ratio (got ${section_purity.purity_ratio})`);

ok(items.length === 6, `yoaz: 6 skill items (got ${items.length})`);
ok(stats.deduped === 6, 'yoaz: no dedupe on clean fixture');
ok(items.every((e) => e.parser === SKILLS_BLOCK_PARSER), 'yoaz: parser id set');
ok(items.every((e) => e.confidence >= 0.55), 'yoaz: all confidence >= 0.55');
ok(byCategory[SKILL_CATEGORY.TOOLS].length === 6, `yoaz: 6 tools (got ${byCategory.tools.length})`);

for (const tool of expectedTools) {
  ok(
    byCategory.tools.some((t) => normalizeCompareString(t) === normalizeCompareString(tool)),
    `yoaz: tools include ${tool}`
  );
}

// Pollution filter unit checks
ok(isDeniedClientBrand('Nike'), 'pollution: Nike denied');
ok(isDeniedClientBrand('Converse'), 'pollution: Converse denied');
ok(isDeniedClientBrand('Pantone'), 'pollution: Pantone denied');
ok(isDeniedClientBrand('Adobe'), 'pollution: standalone Adobe denied');
ok(
  isSkillsSectionPollution('Nike', { sourceLine: 'Clients include Nike, Converse', isSkillsSection: false }),
  'pollution: client list line'
);
ok(
  isSkillsSectionPollution('visual communication', {
    sourceLine: 'Créapôle, visual communication',
    isSkillsSection: false,
  }),
  'pollution: education program'
);
ok(
  isSkillsSectionPollution('Sunglass Man', {
    sourceLine: 'Personal Project Sunglass Man Illustration',
    isSkillsSection: false,
  }),
  'pollution: portfolio caption'
);
ok(
  isSkillsSectionPollution('Photography', { sourceLine: 'Photography', isSkillsSection: false }),
  'pollution: interest hobby'
);

// Mixed pollution blocks — only skills section tokens survive
const pollutedBlocks = [
  ...yoazSkillsLines.map((text, i) => ({
    text,
    block_id: `skill-${i}`,
    section: CV_SECTION.SKILLS,
  })),
  {
    text: 'Clients include Nike, Converse, Pantone, Adobe, Arte',
    block_id: 'exp-clients',
    section: CV_SECTION.EXPERIENCE,
  },
  {
    text: 'Créapôle, visual communication',
    block_id: 'edu-1',
    section: CV_SECTION.EDUCATION,
  },
  {
    text: 'Personal Project Sunglass Man Illustration',
    block_id: 'port-1',
    section: CV_SECTION.PROJECTS,
  },
  { text: 'Nike', block_id: 'client-1', section: CV_SECTION.OTHER },
  { text: 'Photography', block_id: 'int-1', section: CV_SECTION.INTERESTS },
  {
    text: 'Graphic Designer & Illustrator',
    block_id: 'title-1',
    section: CV_SECTION.SUMMARY,
  },
];

const clean = parseSkillsSectionBlocks(pollutedBlocks);
ok(clean.reject_trace.length === 0, 'pollution gate: non-skills blocks skipped without token trace');
const allNames = [...clean.byCategory.tools, ...clean.byCategory.technical].map((n) =>
  normalizeCompareString(n)
);

ok(clean.items.length === 6, `pollution gate: 6 items from mixed blocks (got ${clean.items.length})`);
ok(!allNames.includes('nike'), 'pollution gate: no Nike');
ok(!allNames.includes('converse'), 'pollution gate: no Converse');
ok(!allNames.includes('pantone'), 'pollution gate: no Pantone');
ok(!allNames.includes('adobe'), 'pollution gate: no standalone Adobe');
ok(!allNames.some((n) => n.includes('visual communication')), 'pollution gate: no education');
ok(!allNames.some((n) => n.includes('sunglass')), 'pollution gate: no portfolio');
ok(!allNames.includes('photography'), 'pollution gate: no interest Photography');

// Mis-tagged pollution inside skills section — strict filter + reject trace
const misTaggedPollution = pollutedBlocks
  .filter((b) => !b.block_id.startsWith('skill-'))
  .map((b) => ({ ...b, section: CV_SECTION.SKILLS }));
const misTagged = parseSkillsSectionBlocks([
  ...yoazSkillsLines.map((text, i) => ({
    text,
    block_id: `skill-${i}`,
    section: CV_SECTION.SKILLS,
  })),
  ...misTaggedPollution,
]);
ok(misTagged.items.length === 6, `mis-tagged: still 6 skills (got ${misTagged.items.length})`);
ok(misTagged.reject_trace.length >= 5, `mis-tagged: reject trace (got ${misTagged.reject_trace?.length})`);
ok(
  misTagged.reject_trace.some((e) => e.reason === 'client_brand' || e.reason === 'client_list_line'),
  'mis-tagged: client rejection traced'
);
ok(
  misTagged.reject_trace.some((e) => e.reason === 'education_program' || e.reason === 'education_school'),
  'mis-tagged: education rejection traced'
);
writeFileSync(
  join(outDir, 'yoaz-skills-reject-trace.json'),
  JSON.stringify(misTagged.reject_trace, null, 2)
);

// Page 2 portfolio fixture must not leak
const page2 = readFileSync(
  join(root, 'tests/fixtures/yoaz-pdf-benchmark/fixture-page2.txt'),
  'utf8'
)
  .split(/\r?\n/)
  .map((t) => t.trim())
  .filter(Boolean);

const page2Blocks = page2.map((text, i) => ({
  text,
  block_id: `p2-${i}`,
  section: CV_SECTION.PROJECTS,
}));
const page2Parse = parseSkillsSectionBlocks(page2Blocks);
ok(page2Parse.items.length === 0, `page2 portfolio: 0 skills (got ${page2Parse.items.length})`);

// Cross-section: Illustrator tool in skills OK; title bleed not harvested without allowCrossSection
const crossBlocks = [
  { text: 'Illustrator', block_id: 's1', section: CV_SECTION.SKILLS },
  { text: 'Graphic Designer & Illustrator', block_id: 'id-1', section: CV_SECTION.SUMMARY },
];
const cross = parseSkillsSectionBlocks(crossBlocks);
ok(cross.items.length === 1, 'cross-section: only skills-section Illustrator');
ok(cross.items[0].name === 'Illustrator', 'cross-section: Illustrator is tool');

// Dedupe unit
const dup = dedupeSkillBlockItems([
  {
    name: 'Photoshop',
    category: 'tools',
    source_block_ids: ['a'],
    confidence: 0.9,
    parser: SKILLS_BLOCK_PARSER,
  },
  {
    name: 'photoshop',
    category: 'tools',
    source_block_ids: ['b'],
    confidence: 0.95,
    parser: SKILLS_BLOCK_PARSER,
  },
]);
ok(dup.length === 1, 'dedupe: merges case variants');
ok(dup[0].source_block_ids.length === 2, 'dedupe: merges block ids');

// Strict allowlist — unknown OCR fragment in skills section is rejected
const unknown = parseSkillsLines(['xy zq', 'Photoshop']);
ok(unknown.items.length === 1, `strict: only dictionary-backed skill (got ${unknown.items.length})`);
ok(unknown.items[0].name === 'Photoshop', 'strict: keeps Photoshop');
ok(
  unknown.reject_trace.some(
    (e) =>
      e.reason === 'ocr_fragment' ||
      e.reason === 'not_in_allowlist' ||
      e.reason === 'technical_not_in_allowlist'
  ),
  'strict: rejects OCR fragment'
);

// Weak confidence cross-section without dictionary
const weakCross = parseSkillsSectionBlocks([
  { text: 'Brand Strategy', block_id: 'w1', section: CV_SECTION.SUMMARY },
]);
ok(weakCross.items.length === 0, 'strict: no cross-section non-tool harvest');

ok(isOcrSkillFragment('xy'), 'ocr fragment: short token');
ok(pollutionReason('Nike', { isSkillsSection: true }) === 'client_brand', 'pollution reason: Nike');

writeFileSync(
  join(outDir, 'yoaz-skills-parse-debug.json'),
  JSON.stringify(parse_debug, null, 2)
);

// Segment path
const taggedSegments = yoazSkillsLines.map((text, i) => ({
  text,
  block_id: `seg-${i}`,
  reading_order: i,
  section: CV_SECTION.SKILLS,
  is_heading: false,
}));
const fromSeg = parseSkillsFromSegments(taggedSegments);
ok(fromSeg.items.length === 6, `segment path: 6 items (got ${fromSeg.items.length})`);

// Golden snapshot
const goldenPath = join(goldenDir, 'yoaz-skills-parsed.expected.json');
const golden = JSON.parse(readFileSync(goldenPath, 'utf8'));
const snapshot = {
  fixture: golden.fixture,
  parser: SKILLS_BLOCK_PARSER,
  tools: byCategory.tools,
  items: items.map((e) => ({
    name: e.name,
    category: e.category,
    source_block_ids: e.source_block_ids,
    confidence: e.confidence,
  })),
};
writeFileSync(join(outDir, 'yoaz-skills-parsed.json'), JSON.stringify(snapshot, null, 2));

for (let i = 0; i < golden.items.length; i++) {
  const exp = golden.items[i];
  const got = snapshot.items[i];
  ok(!!got, `golden item ${i} exists`);
  if (!got) continue;
  ok(exp.name === got.name, `golden[${i}] name ${exp.name} (got ${got.name})`);
  ok(exp.category === got.category, `golden[${i}] category ${exp.category}`);
}

console.log('\n--- stats ---', stats);
console.log(failed ? `\n${failed} FAILED` : '\nAll skills block parser checks passed');
process.exit(failed ? 1 : 0);
