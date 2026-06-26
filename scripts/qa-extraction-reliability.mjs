#!/usr/bin/env node
/**
 * Extraction reliability QA — honest IMPORT_READY / IMPORT_NEEDS_PASTE gates.
 * node scripts/qa-extraction-reliability.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import {
  assessResumeDataReliability,
  resolveHonestImportState,
  textMeetsRealCvMinimum,
  validateExtractionReliabilityForExport,
} from '../src/core/validation/extraction-reliability.js';
import { IMPORT_STATE } from '../src/core/import/import-state.js';
import { REAL_CV_IMPORT_MIN_CHARS } from '../src/core/import/real-cv-import-constants.js';
import { resumeDataToCvData } from '../src/core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'tests/output/extraction-reliability');
const OUT_JSON = path.join(OUT_DIR, 'report.json');

const FIXTURES = [
  { id: 'developer-cv', dir: 'developer-cv', expectReady: true },
  { id: 'creative-cv', dir: 'creative-cv', expectReady: true },
  { id: 'consultant-cv', dir: 'consultant-cv', expectReady: true },
  { id: 'marketing-cv', dir: 'marketing-cv', expectReady: true },
  { id: 'executive-cv', dir: 'executive-cv', expectReady: true },
  { id: 'student-cv', dir: 'student-cv', expectReady: true },
  { id: 'thin-text', inline: 'John Doe\nEmail: john@example.com\n', expectReady: false },
];

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function readFixture(dir) {
  const fp = path.join(ROOT, 'tests/fixtures', dir, 'fixture.txt');
  return fs.readFileSync(fp, 'utf8');
}

/** @type {object[]} */
const rows = [];

for (const entry of FIXTURES) {
  const rawText = entry.inline || readFixture(entry.dir);
  const importResult = await runHirelyImportFromText(rawText, {
    source: entry.id,
    extractionMethod: 'paste',
    trusted: true,
  });

  const resumeData = importResult.resumeData || importResult.templateData?.resumeData || null;
  const honest = resolveHonestImportState({
    rawText,
    cleanedText: importResult.cleanedText || rawText,
    resumeData,
  });
  const assessment = assessResumeDataReliability(resumeData);
  const cvData = resumeData ? resumeDataToCvData(resumeData) : null;
  const domText = [
    resumeData?.identity?.name,
    resumeData?.identity?.email,
    resumeData?.identity?.phone,
    ...(resumeData?.experiences || []).slice(0, 3).map((e) => (typeof e === 'string' ? e : e?.title || e?.company || '')),
    ...(resumeData?.education || []).slice(0, 2),
    ...(resumeData?.clients || []).slice(0, 2),
  ]
    .filter(Boolean)
    .join('\n');
  const exportGate = validateExtractionReliabilityForExport({
    finalResumeData: resumeData,
    cvData,
    cvMetrics: { textLength: domText.length, hasEmptyState: false, headerClipped: false },
    domText,
  });

  const passState =
    entry.expectReady
      ? honest.state === IMPORT_STATE.IMPORT_READY
      : honest.state === IMPORT_STATE.IMPORT_NEEDS_PASTE;

  ok(passState, `${entry.id} honest state ${honest.state} (expect ${entry.expectReady ? 'READY' : 'NEEDS_PASTE'})`);

  if (entry.expectReady) {
    ok(assessment.importReady, `${entry.id} import minimum met`);
    ok(exportGate.ok, `${entry.id} export reliability gate`);
  } else {
    ok(!textMeetsRealCvMinimum(rawText) || !assessment.importReady, `${entry.id} blocked thin/weak data`);
  }

  rows.push({
    id: entry.id,
    rawLen: rawText.trim().length,
    honestState: honest.state,
    reason: honest.reason,
    missing: honest.missing || assessment.missing,
    warnings: assessment.warnings,
    importReady: assessment.importReady,
    exportGateOk: exportGate.ok,
    exportErrors: exportGate.errors,
    expectReady: entry.expectReady,
    pass: passState,
    counts: {
      experiences: resumeData?.experiences?.length || 0,
      education: resumeData?.education?.length || 0,
      skills: resumeData?.skills?.length || 0,
    },
  });
}

ok(REAL_CV_IMPORT_MIN_CHARS === 300, `REAL_CV_IMPORT_MIN_CHARS=${REAL_CV_IMPORT_MIN_CHARS}`);

const report = {
  generatedAt: new Date().toISOString(),
  version: 'extraction-reliability-qa-v1',
  minChars: REAL_CV_IMPORT_MIN_CHARS,
  fixtureCount: FIXTURES.length,
  passed: rows.filter((r) => r.pass).length,
  failed: rows.filter((r) => !r.pass).length,
  results: rows,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

console.log(`\nReport: ${OUT_JSON}`);
console.log(`Fixtures: ${report.passed}/${FIXTURES.length} passed`);
process.exit(failed ? 1 : 0);
