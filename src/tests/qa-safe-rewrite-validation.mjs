#!/usr/bin/env node
/**
 * Safe rewrite validation gate — no invented facts, full traceability.
 * node src/tests/qa-safe-rewrite-validation.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import {
  rewriteExperienceDescription,
  rewriteResumeExperiences,
} from '../core/parsing/cv-experience-rewrite.js';
import {
  SAFE_REWRITE_CONFIDENCE_MIN,
  buildSafeRewriteRecord,
  detectRewriteViolations,
  isRewriteTraceable,
  validateRewriteRecord,
} from '../core/parsing/safe-rewrite-validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let failed = 0;
const checks = [];

function ok(cond, msg) {
  checks.push({ label: msg, ok: !!cond });
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function testAllowedGrammarRewrite() {
  const result = rewriteExperienceDescription('Graphic designer. Posters. Packaging.', {
    role: 'Freelance Graphic Designer',
    company: 'Independent',
  });
  ok(result.rewriteRecords?.length > 0, 'fragment rewrite produces records');
  ok(result.rewrittenDescription.toLowerCase().includes('posters'), 'allowed rewrite keeps posters');
  ok(
    result.rewriteRecords.every((r) => r.originalText && r.rewrittenText && r.factsUsed?.length),
    'every record has trace fields'
  );
  ok(
    result.rewriteRecords.every((r) => isRewriteTraceable(r.originalText, r.rewrittenText, r.factsUsed)),
    'every applied rewrite is traceable'
  );
}

function testForbiddenInventionBlocked() {
  const record = buildSafeRewriteRecord({
    originalText: 'Designed posters for local clients.',
    rewrittenText:
      'Increased revenue by 40% as Senior VP at Acme Corp while leading 200 engineers (2010–2015).',
    sourceSection: 'experience',
    sourceConfidence: 80,
    context: { role: 'Designer', company: 'Studio', dates: '2018–2020' },
  });
  ok(record.rewriteConfidence < SAFE_REWRITE_CONFIDENCE_MIN, 'invented facts block auto rewrite');
  ok(!record.autoApplied, 'invented rewrite not auto-applied');
  ok(record.violations.length > 0, 'invention violations detected');
  const validation = validateRewriteRecord(record);
  ok(!validation.ok, 'invented rewrite fails validation');
}

function testLowConfidenceToSuggestions() {
  const record = buildSafeRewriteRecord({
    originalText: 'Design.',
    rewrittenText: 'Delivered comprehensive enterprise transformation programs globally.',
    sourceSection: 'experience',
    sourceConfidence: 55,
    context: { role: 'Designer', company: 'Studio', dates: '2018–2020' },
  });
  ok(record.rewriteConfidence < SAFE_REWRITE_CONFIDENCE_MIN, 'low confidence below threshold');
  ok(!record.autoApplied, 'low confidence not auto-applied');
}

function testViolationDetection() {
  const violations = detectRewriteViolations(
    'Built APIs for internal tools.',
    'Built APIs and grew revenue by 55% at Globex Industries as CTO (2001–2003).',
    { role: 'Engineer', company: 'Inhouse', dates: '2019–2021' }
  );
  ok(violations.some((v) => v.startsWith('INVENT_')), 'detects multiple invention types');
}

async function testFixtureTraceability(id) {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures', id, 'fixture.txt'), 'utf8');
  const imp = await runHirelyImportFromText(raw, { source: id, extractionMethod: 'paste' });
  const rd = rewriteResumeExperiences(imp.resumeData || { experiences: [] });
  const records = (rd.experiences || []).flatMap((e) => e.rewriteRecords || []);
  ok(records.length > 0, `${id} produces rewrite records`);
  const traceable = records.filter((r) =>
    isRewriteTraceable(r.originalText, r.rewrittenText, r.factsUsed)
  ).length;
  ok(traceable === records.length, `${id} all records traceable (${traceable}/${records.length})`);
  const invented = records.filter((r) => (r.violations || []).length > 0);
  ok(
    invented.every((r) => !r.autoApplied),
    `${id} invented lines never auto-applied`
  );
}

async function main() {
  ok(SAFE_REWRITE_CONFIDENCE_MIN === 75, 'confidence threshold is 75');

  testAllowedGrammarRewrite();
  testForbiddenInventionBlocked();
  testLowConfidenceToSuggestions();
  testViolationDetection();

  for (const id of ['developer-cv', 'creative-cv', 'marketing-cv', 'consultant-cv']) {
    await testFixtureTraceability(id);
  }

  const outDir = path.join(ROOT, 'tests/output/safe-rewrite-validation');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'report.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), checks, failed, pass: failed === 0 }, null, 2)
  );

  if (failed) {
    console.error(`\nqa-safe-rewrite-validation FAILED (${failed})`);
    process.exit(1);
  }
  console.log('\nqa-safe-rewrite-validation PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
