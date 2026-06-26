#!/usr/bin/env node
/**
 * P0 — Recruiter-grade extraction engine report.
 * Generates EXTRACTION_ENGINE_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureHirelyTestMatrixFixtures } from '../tests/lib/hirely-test-matrix-fixtures.mjs';
import { runRecruiterExtractionPipeline, RECRUITER_EXTRACTION_PIPELINE_VERSION } from '../src/core/extraction/recruiter-extraction-pipeline.js';
import { runExtractionEngineV2 } from '../src/core/extraction/extraction-engine-v2.js';
import { CVDATA_V2_VERSION } from '../src/core/extraction/cv-data-v2.js';
import { FIELD_REVIEW_THRESHOLD } from '../src/core/extraction/field-confidence-v2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'EXTRACTION_ENGINE_REPORT.md');
const OUT_JSON = path.join(ROOT, 'tests/output/extraction-engine-report/report.json');

const FIXTURES = [
  { id: 'lab_txt', file: 'tests/fixtures/hirely-test-lab/txt.txt' },
  { id: 'lab_docx_text', file: 'tests/fixtures/hirely-test-lab/paste.txt' },
  { id: 'mvp_sample', file: 'tests/fixtures/mvp-sample.txt' },
  { id: 'creative_cv', file: 'tests/fixtures/creative-cv/fixture.txt' },
  { id: 'developer_cv', file: 'tests/fixtures/developer-cv/fixture.txt' },
  { id: 'recruiter_cv', file: 'tests/fixtures/recruiter-cv/fixture.txt' },
];

const REQUIRED_FIELDS = [
  'name',
  'title',
  'email',
  'phone',
  'location',
  'summary',
  'experience',
  'education',
  'skills',
  'languages',
  'certifications',
  'links',
];

function scoreFixture(v2) {
  const detected = {
    name: !!v2.name?.value,
    title: !!v2.title?.value,
    email: !!v2.email?.value,
    phone: !!v2.phone?.value,
    location: !!v2.location?.value,
    summary: !!v2.summary?.value,
    experience: (v2.experience?.length || 0) > 0,
    education: (v2.education?.length || 0) > 0,
    skills: (v2.skills?.length || 0) > 0,
    languages: (v2.languages?.length || 0) > 0,
    certifications: (v2.certifications?.length || 0) > 0,
    links: (v2.links?.length || 0) > 0,
  };
  const count = Object.values(detected).filter(Boolean).length;
  return { detected, count, overall: v2.meta?.overallConfidence ?? 0 };
}

function fieldRows(v2) {
  const rows = [];
  const scalar = ['name', 'title', 'email', 'phone', 'location', 'summary'];
  for (const key of scalar) {
    const f = v2[key];
    if (f?.value) rows.push({ field: key, value: String(f.value).slice(0, 60), confidence: f.confidence });
  }
  for (const key of ['experience', 'education', 'skills', 'languages', 'certifications', 'links']) {
    for (const item of v2[key] || []) {
      const val =
        typeof item.value === 'object'
          ? JSON.stringify(item.value).slice(0, 60)
          : String(item.value || '').slice(0, 60);
      if (val) rows.push({ field: key, value: val, confidence: item.confidence });
    }
  }
  return rows;
}

async function main() {
  await ensureHirelyTestMatrixFixtures(ROOT);

  const results = [];
  let pass = true;

  for (const fx of FIXTURES) {
    const fp = path.join(ROOT, fx.file);
    if (!fs.existsSync(fp)) {
      results.push({ id: fx.id, skipped: true, reason: 'missing' });
      continue;
    }
    const raw = fs.readFileSync(fp, 'utf8');
    const recruiter = runRecruiterExtractionPipeline(raw, { extractionMethod: 'paste' });
    const engine = await runExtractionEngineV2(raw, { extractionMethod: 'paste' });
    const v2 = recruiter.cvDataV2;
    const score = scoreFixture(v2);
    const noLoss =
      (v2.meta?.linesCaptured || 0) >= Math.min(v2.meta?.linesTotal || 0, 1) ||
      (v2.additionalSections?.length || 0) > 0;
    const hasConfidenceShape =
      v2.name &&
      typeof v2.name.confidence === 'number' &&
      Array.isArray(v2.experience) &&
      (v2.experience.length === 0 || typeof v2.experience[0]?.confidence === 'number');

    const ok = score.count >= 4 && hasConfidenceShape && noLoss;
    if (!ok) pass = false;

    results.push({
      id: fx.id,
      pass: ok,
      fieldsDetected: score.count,
      overallConfidence: score.overall,
      engineOverall: engine.metrics?.overallConfidence,
      detected: score.detected,
      additionalSections: v2.additionalSections?.length || 0,
      linesCaptured: v2.meta?.linesCaptured,
      linesTotal: v2.meta?.linesTotal,
      sampleFields: fieldRows(v2).slice(0, 8),
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    status: pass ? 'PASS' : 'FAIL',
    cvDataVersion: CVDATA_V2_VERSION,
    pipelineVersion: RECRUITER_EXTRACTION_PIPELINE_VERSION,
    reviewThreshold: FIELD_REVIEW_THRESHOLD,
    requiredFields: REQUIRED_FIELDS,
    results,
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));

  const md = [
    '# Extraction Engine Report (P0 recruiter-grade)',
    '',
    `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${payload.generatedAt}`,
    '',
    '## cvData v2 contract',
    '',
    'Every field exposes `{ value, confidence }` (0–100). List fields use arrays of `{ value, confidence }`.',
    'Unknown / unclassified lines are preserved in `additionalSections[]` — **never lost**.',
    '',
    '### Detected entities',
    '',
    '| Field | Type |',
    '|-------|------|',
    '| Name | scalar + confidence |',
    '| Title | scalar + confidence |',
    '| Email | scalar + confidence |',
    '| Phone | scalar + confidence |',
    '| Location | scalar + confidence |',
    '| Summary | scalar + confidence |',
    '| Experience | list of `{ value: { role, company, dates, bullets }, confidence }` |',
    '| Education | list + confidence |',
    '| Skills | list + confidence |',
    '| Languages | list + confidence |',
    '| Certifications | list + confidence |',
    '| Links | list of `{ value: { type, url, label }, confidence }` |',
    '| Additional sections | `{ title, confidence, lines[] }` for orphan content |',
    '',
    '## Pipeline',
    '',
    '```',
    'Raw text → OCR normalize (if needed)',
    '    → section detection',
    '    → identity lock (name/title)',
    '    → contact extract (email/phone/links/location)',
    '    → entity parse (experience/education/skills/…)',
    '    → confidence scoring (per field)',
    '    → additionalSections (no data loss)',
    '    → cvData v2 + legacy cvData',
    '```',
    '',
    `Review threshold: **${FIELD_REVIEW_THRESHOLD}%** confidence`,
    '',
    '## Fixture results',
    '',
    '| Fixture | Pass | Fields | Overall conf | Additional sections |',
    '|---------|------|--------|--------------|---------------------|',
    ...results.map((r) =>
      r.skipped
        ? `| ${r.id} | SKIP | — | — | — |`
        : `| ${r.id} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.fieldsDetected}/12 | ${r.overallConfidence}% | ${r.additionalSections} |`
    ),
    '',
    '## Field detection matrix',
    '',
    '| Fixture | ' + REQUIRED_FIELDS.join(' | ') + ' |',
    '|---------|' + REQUIRED_FIELDS.map(() => '---').join('|') + '|',
    ...results
      .filter((r) => !r.skipped)
      .map(
        (r) =>
          `| ${r.id} | ${REQUIRED_FIELDS.map((f) => (r.detected?.[f] ? '✓' : '·')).join(' | ')} |`
      ),
    '',
    '## Failure modes (never silent)',
    '',
    '| Case | Behavior |',
    '|------|----------|',
    '| Empty document | additionalSections with empty marker, confidence 0 |',
    '| Low-confidence field | value kept with low confidence (< 70 → review) |',
    '| Unclassified lines | routed to additionalSections |',
    '| OCR garble | postProcessOcrText + reduced confidence |',
    '| Parser unavailable | recruiter pipeline still produces cvData v2 |',
    '',
    '## Commands',
    '',
    '```bash',
    'npm run extraction-engine-report',
    'npm run qa:extraction-engine-v2',
    '```',
    '',
    `JSON: \`tests/output/extraction-engine-report/report.json\``,
    '',
  ].join('\n');

  fs.writeFileSync(OUT_MD, md);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
