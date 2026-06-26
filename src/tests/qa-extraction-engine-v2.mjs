#!/usr/bin/env node
/**
 * Extraction Engine V2 — acceptance + benchmark on fixture corpus.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  runExtractionEngineV2,
  summarizeExtractionBatchV2,
  EXTRACTION_ENGINE_V2,
  normalizeExtractionTextV2,
} from '../core/extraction/extraction-engine-v2.js';
import { applySkillsLanguagesGuard } from '../core/extraction/skills-languages-guard.js';
import { FIELD_REVIEW_THRESHOLD } from '../core/extraction/field-confidence-v2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/extraction-engine-v2');
const OUT_JSON = path.join(OUT_DIR, 'report.json');

const FIXTURE_IDS = [
  'creative-cv',
  'yoaz-cv',
  'consultant-cv',
  'developer-cv',
  'marketing-cv',
  'recruiter-cv',
  'student-cv',
  'executive-cv',
  'two-column-cv',
  'academic-cv',
  'scanned-pdf',
  'text-pdf',
  'docx',
  'image-cv',
  'sales-cv',
];

let failed = 0;
const checks = [];

function record(id, pass, detail = '') {
  checks.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}`);
  }
}

record('engine_version', EXTRACTION_ENGINE_V2 === 'EXTRACTION_ENGINE_V2');
record('review_threshold_70', FIELD_REVIEW_THRESHOLD === 70);

const norm = normalizeExtractionTextV2('EXPÉRlENCE\ngraphi c designer\nhotmail fr');
record('ocr_normalize_runs', norm.steps.includes('ocr_postprocess') || norm.text.length > 0);

const guard = applySkillsLanguagesGuard({
  skills: ['French native', 'Figma', 'Photoshop'],
  languages: ['Illustrator', 'English fluent'],
});
record('guard_moves_language_from_skills', guard.moves.some((m) => m.from === 'skills'));
record('guard_moves_tool_from_languages', guard.moves.some((m) => m.from === 'languages'));
record('guard_keeps_figma_skill', guard.cvData.skills.some((s) => /figma/i.test(s)));

const batch = [];
const fixtureResults = [];

for (const id of FIXTURE_IDS) {
  const fp = path.join(ROOT, 'tests/fixtures', id, 'fixture.txt');
  if (!fs.existsSync(fp)) {
    fixtureResults.push({ id, skipped: true, reason: 'missing fixture.txt' });
    continue;
  }
  const raw = fs.readFileSync(fp, 'utf8');
  if (raw.trim().length < 40) {
    fixtureResults.push({ id, skipped: true, reason: 'fixture too short' });
    continue;
  }

  try {
    const result = await runExtractionEngineV2(raw, {
      source: `qa-extraction-v2:${id}`,
      extractionMethod: 'paste',
    });
    batch.push(result);
    fixtureResults.push({
      id,
      outcome: result.metrics.outcome,
      overallConfidence: result.metrics.overallConfidence,
      flaggedFields: result.metrics.flaggedFields,
      sectionsFound: result.stages.sectionDetection.count,
      name: result.structuredCvJson?.identity?.name || '',
      experienceCount: result.structuredCvJson?.experience?.length || 0,
      skillsLanguagesMoves: result.skillsLanguagesMoves?.length || 0,
    });
    record(`fixture_${id}_runs`, true, `outcome=${result.metrics.outcome} conf=${result.metrics.overallConfidence}`);
  } catch (err) {
    fixtureResults.push({ id, error: String(err.message || err) });
    record(`fixture_${id}_runs`, false, String(err.message || err));
  }
}

const summary = summarizeExtractionBatchV2(batch);

record('batch_has_samples', summary.total >= 8, `total=${summary.total}`);
record('success_rate_computed', typeof summary.successRate === 'number');
record('failure_rate_computed', typeof summary.failureRate === 'number');

const mvp = path.join(ROOT, 'tests/fixtures/mvp-sample.txt');
if (fs.existsSync(mvp)) {
  const mvpResult = await runExtractionEngineV2(fs.readFileSync(mvp, 'utf8'), { extractionMethod: 'paste' });
  record('mvp_has_name', !!(mvpResult.structuredCvJson?.identity?.name || mvpResult.cvData?.name));
  record('mvp_has_experience', (mvpResult.structuredCvJson?.experience?.length || 0) > 0);
  record('mvp_field_confidence_meta', !!mvpResult.fieldConfidence?.sections);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  version: EXTRACTION_ENGINE_V2,
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  summary: {
    total: checks.length,
    pass: checks.filter((c) => c.pass).length,
    fail: failed,
    ...summary,
  },
  checks,
  fixtures: fixtureResults,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log(`\nReport → ${OUT_JSON}`);
console.log(
  `Batch: ${summary.total} fixtures | success ${summary.successRate}% | partial ${summary.partialRate}% | fail ${summary.failureRate}%`
);

process.exit(failed > 0 ? 1 : 0);
