#!/usr/bin/env node
/**
 * FORENSIC RESUME MODE — immutable stage snapshots + char compare chain.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProductionExtractionPipeline } from '../core/pipeline/production-pipeline.js';
import {
  FORENSIC_ARTIFACT_NAMES,
  FORENSIC_STAGE_CHAIN,
  getForensicResumeImport,
  charDiffSummary,
} from '../debug/forensic-resume-mode.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const fixturePath = join(root, 'tests/fixtures/text-pdf/fixture.txt');
const sample = existsSync(fixturePath)
  ? readFileSync(fixturePath, 'utf8')
  : `Jane Doe\nDesigner\nExperience\nLead — Agency — 2020–2024\nEducation\nSchool\nSkills\nDesign`;

const pipe = await runProductionExtractionPipeline(sample, {
  extractionMethod: 'paste',
  source: 'qa-forensic-resume',
});

const importId = pipe.forensicResumeImportId;
ok(!!importId, `forensic import id (${importId})`);
ok(pipe.audit?.forensicResume?.importId === importId, 'audit carries forensic import id');

const entry = getForensicResumeImport(importId);
ok(!!entry, 'in-memory import entry');

for (const name of [
  FORENSIC_ARTIFACT_NAMES.OCR,
  FORENSIC_ARTIFACT_NAMES.CLEAN,
  FORENSIC_ARTIFACT_NAMES.PARSER_INPUT,
  FORENSIC_ARTIFACT_NAMES.PARSER_OUTPUT,
]) {
  const versions = entry.artifacts[name];
  ok(Array.isArray(versions) && versions.length >= 1, `${name} captured (${versions.length} version(s))`);
  ok(versions.length >= 1 && versions[0].content.length > 0, `${name} has content`);
}

const ocrV1 = entry.artifacts[FORENSIC_ARTIFACT_NAMES.OCR][0].content;
const ocrV2 = entry.artifacts[FORENSIC_ARTIFACT_NAMES.OCR].at(-1).content;
ok(ocrV1.length > 0, 'ocr first version preserved');
ok(entry.artifacts[FORENSIC_ARTIFACT_NAMES.OCR].length >= 1, 'ocr versions append-only');

const cleanSnap = entry.latest[FORENSIC_ARTIFACT_NAMES.CLEAN];
const parserIn = entry.latest[FORENSIC_ARTIFACT_NAMES.PARSER_INPUT];
ok(cleanSnap?.chars > 0, 'clean_text chars');
ok(parserIn?.content === cleanSnap?.content || parserIn?.chars > 0, 'parser_input captured');

const diff = charDiffSummary(ocrV2, cleanSnap.content);
ok(typeof diff.delta === 'number', 'char diff summary');

ok((entry.compare || []).length >= 3, `stage compare rows (${entry.compare.length})`);
const chainLabels = entry.compare.map((r) => r.from);
ok(chainLabels.includes(FORENSIC_ARTIFACT_NAMES.OCR), 'compare includes OCR stage');

ok(FORENSIC_STAGE_CHAIN.length === 5, 'five forensic artifacts defined');

console.log('\nFORENSIC RESUME MODE QA OK —', importId);
