#!/usr/bin/env node
/**
 * P0 — Review before template lock acceptance tests.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  REVIEW_BEFORE_TEMPLATE_LOCK_V1,
  classifyCriticalReviewItem,
  buildReviewBeforeTemplateLockReport,
  isTemplateReady,
  isExportReadyAfterReview,
} from '../core/validation/review-before-template-lock.js';
import { normalizeReviewItem } from '../core/parsing/review-queue-merge.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { NAME_CONFIRM_LABEL } from '../core/display/identity-labels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/review-before-template-lock');
const OUT_JSON = path.join(OUT_DIR, 'report.json');

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

record('policy_version', REVIEW_BEFORE_TEMPLATE_LOCK_V1 === 'REVIEW_BEFORE_TEMPLATE_LOCK_V1');

const nameItem = normalizeReviewItem({
  field: 'identity.name',
  detected: 'McCann Paris',
  sourceText: 'McCann Paris',
  confidence: 42,
  status: 'pending',
  reason: 'Nom à confirmer',
});
record('classify_uncertain_name', classifyCriticalReviewItem(nameItem) === 'uncertain_name');

const expItem = normalizeReviewItem({
  field: 'experiences',
  detected: 'Designer — Internship — 2010-Present',
  sourceText: 'Designer — Internship — 2010-Present',
  confidence: 38,
  status: 'pending',
  fakeExperienceGate: true,
  reason: 'Expérience rejetée (guessed_present)',
});
record('classify_uncertain_experience', classifyCriticalReviewItem(expItem) === 'uncertain_experience');

const skillItem = normalizeReviewItem({
  field: 'skills',
  detected: 'Branding',
  sourceText: 'Branding',
  confidence: 80,
  status: 'pending',
});
record('non_critical_skill', classifyCriticalReviewItem(skillItem) === null);

const lockedWithName = buildReviewBeforeTemplateLockReport({
  reviewQueue: [nameItem],
  identity: { name: NAME_CONFIRM_LABEL, email: 'a@test.com' },
  exportReady: true,
});
record('blocks_template_uncertain_name', !lockedWithName.templateReady);
record('blocks_export_uncertain_name', !lockedWithName.exportReady);
record('shows_name_reason', lockedWithName.reasons.some((r) => /nom|name/i.test(r)));

const lockedOcr = buildReviewBeforeTemplateLockReport({
  reviewQueue: [],
  identity: { name: 'Alex Martin', email: 'a@test.com' },
  ocrFallbackRequired: true,
});
record('blocks_template_ocr_fallback', !lockedOcr.templateReady);
record('ocr_action', lockedOcr.actions.includes('paste_fallback'));

const clear = buildReviewBeforeTemplateLockReport({
  reviewQueue: [],
  identity: { name: 'Alex Martin', email: 'alex@test.com', phone: '+33 6 12 34 56 78' },
  exportReady: true,
});
record('unlocks_template_when_clear', isTemplateReady(clear));
record('unlocks_export_when_clear', isExportReadyAfterReview(clear));

const OCR_CV = [
  'Profil!',
  'Graphic Designer',
  'designer@test.com',
  'Experience',
  'Profil! — summary line',
  'Languages',
  'Native am',
].join('\n');

const imported = await runHirelyImportFromText(OCR_CV, { source: 'qa-review-template-lock', extractionMethod: 'paste' });
const sanitized = sanitizeResumeForDisplay(imported?.resumeData || {});
const built = buildFinalResumeData(sanitized, {
  silent: true,
  rawText: OCR_CV,
  existingReview: imported?.reviewQueue || [],
});
const pipelineLock = buildReviewBeforeTemplateLockReport({
  reviewQueue: built.reviewItems || imported?.reviewQueue || [],
  identity: built.finalResumeData?.identity || {},
  exportReady: false,
});
record('pipeline_blocks_template_with_review', !pipelineLock.templateReady || pipelineLock.criticalCount > 0);

const fr = built.finalResumeData || {};
const previewCorrupt = [fr.identity?.name, fr.identity?.email, ...(fr.experiences || []).map((e) => e.role)]
  .filter(Boolean)
  .join(' | ');
record('pipeline_no_profil_experience', !/profil!/i.test(previewCorrupt));

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  version: REVIEW_BEFORE_TEMPLATE_LOCK_V1,
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  acceptance: {
    no_corrupted_template_data: checks.find((c) => c.id === 'pipeline_no_profil_experience')?.pass,
    template_locked_with_critical: checks.find((c) => c.id === 'blocks_template_uncertain_name')?.pass,
    template_unlocks_when_clear: checks.find((c) => c.id === 'unlocks_template_when_clear')?.pass,
    ocr_fallback_blocks: checks.find((c) => c.id === 'blocks_template_ocr_fallback')?.pass,
  },
  summary: { total: checks.length, pass: checks.filter((c) => c.pass).length, fail: failed },
  checks,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

console.log(`\n═══ Review Before Template Lock: ${report.summary.pass}/${report.summary.total} PASS ═══`);
process.exit(failed ? 1 : 0);
