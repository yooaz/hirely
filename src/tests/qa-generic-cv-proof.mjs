#!/usr/bin/env node
/**
 * P0 — Generic CV proof: 20 non-Yoaz profiles through import → parse → preview.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { resumeDataToCvData } from '../core/resume-data.js';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import {
  GENERIC_CV_PROOF_ENGINE,
  GENERIC_CV_PROFILES,
  loadGenericCvCorpus,
  assertCorpusUniqueness,
} from '../../tests/lib/generic-cv-proof-corpus.mjs';
import {
  evaluateGenericCvProof,
  aggregateGenericCvProof,
} from '../../tests/lib/generic-cv-proof-eval.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/generic-cv-proof');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

fs.mkdirSync(OUT_DIR, { recursive: true });

const corpus = loadGenericCvCorpus(ROOT);
const uniquenessIssues = assertCorpusUniqueness(corpus);
if (uniquenessIssues.length) {
  console.error('Corpus uniqueness failures:', uniquenessIssues.join('; '));
  process.exit(1);
}

if (corpus.length !== GENERIC_CV_PROFILES.length) {
  console.error(`Expected ${GENERIC_CV_PROFILES.length} profiles, got ${corpus.length}`);
  process.exit(1);
}

const T = loadHirelyTemplates();
const rows = [];

for (const fixture of corpus) {
  const row = {
    id: fixture.id,
    label: fixture.label,
    templateId: fixture.templateId,
    expected: fixture.expected,
    pass: false,
    failures: [],
    metrics: {},
    error: null,
  };

  try {
    const importResult = await runHirelyImportFromText(fixture.text, {
      source: `generic-cv-proof:${fixture.id}`,
      extractionMethod: 'paste',
      file: {
        name: fixture.fileName,
        type: 'text/plain',
        size: fixture.text.length,
      },
    });

    const built = buildFinalResumeData(importResult?.resumeData || {}, {
      silent: true,
      rawText: fixture.text,
      existingReview: importResult?.reviewQueue || [],
    });

    const frd = built.finalResumeData;
    const cv = resumeDataToCvData(frd || {}, { skipNormalize: true });
    const renderHtml = frd ? String(T.render(cv, fixture.templateId) || '') : '';

    const evalResult = evaluateGenericCvProof({
      importResult,
      finalResumeData: frd,
      renderHtml,
      expected: fixture.expected,
      reviewItems: built.reviewItems || [],
    });

    row.pass = evalResult.pass;
    row.failures = evalResult.failures;
    row.metrics = evalResult.metrics;
    row.importResult = {
      importStatus: importResult?.importStatus,
      errors: (importResult?.errors || []).slice(0, 3),
    };
  } catch (err) {
    row.error = String(err?.message || err);
    row.failures = ['crash'];
  }

  rows.push(row);
  const mark = row.pass ? 'PASS' : 'FAIL';
  console.log(`${mark} ${fixture.id} — ${row.failures.join(', ') || 'ok'}`);
}

const summary = aggregateGenericCvProof(rows);

const report = {
  version: GENERIC_CV_PROOF_ENGINE,
  generatedAt: new Date().toISOString(),
  pass: summary.pass,
  summary,
  profiles: GENERIC_CV_PROFILES,
  results: rows,
};

fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

console.log(
  `\n═══ Generic CV Proof: ${summary.passCount}/${summary.count} (${summary.passRate}%) ` +
    `${report.pass ? 'PASS' : 'FAIL'} ═══`
);

process.exit(report.pass ? 0 : 1);
