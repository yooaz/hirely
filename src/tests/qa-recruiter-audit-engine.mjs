#!/usr/bin/env node
/**
 * QA — Recruiter Audit Engine (six dimensions + overall + review narrative).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runRecruiterExtractionPipeline } from '../core/extraction/recruiter-extraction-pipeline.js';
import {
  runRecruiterAuditEngine,
  RECRUITER_AUDIT_ENGINE,
  AUDIT_DIMENSIONS,
  attachRecruiterAuditToImportResult,
  formatRecruiterReviewText,
} from '../core/validation/recruiter-audit-engine.js';
import { runRecruiterAudit } from '../core/validation/recruiter-audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let passed = 0;
let failed = 0;

function ok(cond, msg) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${msg}`);
  }
}

const fixturePath = path.join(ROOT, 'tests/fixtures/developer-cv/fixture.txt');
const raw = fs.readFileSync(fixturePath, 'utf8');
const extracted = runRecruiterExtractionPipeline(raw, { extractionMethod: 'paste' });

console.log('Recruiter Audit Engine QA\n');

const audit = runRecruiterAuditEngine({
  cvData: extracted.cvData,
  cvDataV2: extracted.cvDataV2,
  resumeData: extracted.resumeData,
});

ok(audit.version === RECRUITER_AUDIT_ENGINE, 'engine version set');
ok(audit.ready === true, 'audit ready');
ok(audit.overall >= 1 && audit.overall <= 100, 'overall score in range');
ok((audit.dimensions || []).length === 6, 'six dimension scores');

for (const dim of Object.values(AUDIT_DIMENSIONS)) {
  const found = audit.dimensions.find((d) => d.id === dim.id);
  ok(found && found.score >= 0 && found.score <= 100, `${dim.label} score present`);
}

ok(Array.isArray(audit.strengths), 'strengths array');
ok(Array.isArray(audit.weaknesses), 'weaknesses array');
ok(Array.isArray(audit.recommendations) && audit.recommendations.length > 0, 'recommendations non-empty');
ok(typeof audit.reviewText === 'string' && audit.reviewText.includes('Recruiter Review'), 'reviewText narrative');
ok(audit.reviewText.includes('Strengths'), 'reviewText has strengths section');
ok(audit.reviewText.includes('Weaknesses'), 'reviewText has weaknesses section');
ok(audit.reviewText.includes('Recommendations'), 'reviewText has recommendations section');

const merged = runRecruiterAudit(extracted.cvData, {
  resumeData: extracted.resumeData,
  cvDataV2: extracted.cvDataV2,
});
ok(merged.engine?.overall === audit.overall, 'runRecruiterAudit delegates to engine');
ok(merged.dimensions?.length === 6, 'runRecruiterAudit exposes dimensions');

const attached = attachRecruiterAuditToImportResult({
  templateData: extracted.cvData,
  resumeData: extracted.resumeData,
  cvDataV2: extracted.cvDataV2,
});
ok(attached.recruiterAudit?.ready === true, 'attachRecruiterAuditToImportResult');
ok(typeof attached.auditReviewText === 'string', 'import result has auditReviewText');

const formatted = formatRecruiterReviewText({ ...audit, name: 'Test', title: 'Engineer' });
ok(formatted.includes('Test'), 'formatRecruiterReviewText includes candidate name');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
