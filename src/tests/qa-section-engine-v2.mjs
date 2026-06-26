#!/usr/bin/env node
/**
 * SECTION_ENGINE_V2 — detect → classify → extract → resume JSON (no raw field extract).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSectionEngineV2, SECTION_IDS } from '../core/parsing/section-engine-v2.js';
import { buildStructuredResumeFromBlocks } from '../core/parsing/structured-resume-from-blocks.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const fixturePath = join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
const sample = existsSync(fixturePath)
  ? readFileSync(fixturePath, 'utf8')
  : `Name\nTitle\nWORK EXPERIENCE\nRole — Co — 2020\nEDUCATION\nSchool\nSKILLS\nA, B`;

const result = runSectionEngineV2(sample, { rawText: sample });
const { structured, report, sectionBlocks, resumeJson } = result;

ok(sectionBlocks.length >= 5, `section blocks detected (${sectionBlocks.length})`);
ok(
  sectionBlocks.some((b) => b.type === SECTION_IDS.EXPERIENCE),
  'EXPERIENCE block present'
);
ok(
  sectionBlocks.some((b) =>
    [SECTION_IDS.EDUCATION, SECTION_IDS.SKILLS, SECTION_IDS.PROFILE].includes(b.type)
  ),
  'education/skills/profile detected'
);
ok(structured.metadata?.neverRawFieldExtract === true, 'neverRawFieldExtract flag');
ok(report.coveragePercent > 80, `coverage > 80% (${report.coveragePercent}%)`);
ok((structured.experiences || []).length > 0, `experience extracted (${structured.experiences.length})`);
ok(resumeJson.experience?.length > 0, 'resume JSON has experience');
ok((structured.unsorted || []).length < 15, `unsorted < 15 (${structured.unsorted.length})`);

const fromBlocks = buildStructuredResumeFromBlocks([], {
  rawText: sample,
  cleanedText: sample,
  extractionMethod: 'paste',
});
ok(
  fromBlocks.metadata?.parseSource?.includes('SECTION_ENGINE_V2'),
  'blocks path uses SECTION_ENGINE_V2'
);

console.log('\nSECTION_ENGINE_V2 QA OK — coverage', report.coveragePercent, '%');
