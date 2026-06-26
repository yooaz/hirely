#!/usr/bin/env node
/**
 * EXPORT REWRITE — export only requires resume object exists.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createResumeFromText } from '../core/import/text-first-engine.js';
import { createMinimalResume } from '../core/import/text-first-engine.js';
import {
  canExportWithResume,
  validateExportResumeOnly,
  applyExportIsolationToValidation,
  EXPORT_REWRITE_VERSION,
} from '../core/export/export-rewrite.js';
import { validateExportLock } from '../core/export/export-lock.js';
import { validateCvData, CV_DATA_STATUS } from '../core/validation/cv-data-protection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../../tests/output/export-rewrite/report.json');

const PARTIAL_TEXT = `Alex Martin
alex@example.com`;

let failed = 0;
const checks = [];
function ok(cond, id, detail = '') {
  checks.push({ id, pass: !!cond, detail });
  if (!cond) {
    failed++;
    console.error('FAIL', id, detail);
  } else console.log('OK', id, detail || '');
}

function liveCvMetrics() {
  return {
    className: 'cv cv--live template-classic',
    hasEmptyState: false,
    textLength: 240,
    widthPx: 794,
    scrollHeight: 1100,
    clientHeight: 400,
    sectionCount: 3,
    headerClipped: false,
  };
}

function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const resume = createResumeFromText(PARTIAL_TEXT);
  const shell = createMinimalResume();

  ok(canExportWithResume(resume), 'partial_resume_can_export');
  ok(canExportWithResume(shell), 'minimal_shell_can_export');
  ok(!canExportWithResume(null), 'null_resume_blocked');
  ok(!canExportWithResume({ experiences: [] }), 'no_identity_blocked');

  const lockOk = validateExportResumeOnly({
    resumeData: resume,
    cvMetrics: liveCvMetrics(),
  });
  ok(lockOk.ok, 'resume_only_lock_ok', lockOk.errors?.join('|'));
  ok(lockOk.resumeOnly === true, 'resume_only_flag');
  ok(lockOk.version === EXPORT_REWRITE_VERSION, 'rewrite_version');

  const lockNoResume = validateExportResumeOnly({ cvMetrics: liveCvMetrics() });
  ok(!lockNoResume.ok, 'no_resume_lock_fail');
  ok(lockNoResume.errors.includes('NO_RESUME_OBJECT'), 'no_resume_error');

  const exportLock = validateExportLock({
    resumeData: resume,
    finalResumeData: resume,
    cvMetrics: liveCvMetrics(),
    cvData: { name: 'Alex Martin', email: 'alex@example.com' },
    domText: 'Alex Martin',
  });
  ok(exportLock.ok, 'validate_export_lock_resume_only', exportLock.errors?.join('|'));
  ok(exportLock.resumeOnly === true, 'export_lock_resume_only_path');

  const isolated = applyExportIsolationToValidation(
    {
      status: CV_DATA_STATUS.INVALID,
      blockReview: true,
      blockStyle: true,
      blockExport: true,
      reasons: ['name_missing', 'experience_missing'],
    },
    resume
  );
  ok(isolated.blockExport === false, 'export_isolation_unblocks');
  ok(isolated.exportIsolation === true, 'export_isolation_flag');

  const cvProt = validateCvData({
    cvData: { name: 'Alex Martin', email: 'alex@example.com', experience: [] },
    finalResumeData: resume,
    previewLive: true,
    cvRenderable: true,
  });
  ok(cvProt.blockExport === false, 'cv_data_protection_export_open', cvProt.status);

  const report = {
    feature: 'EXPORT_REWRITE',
    generatedAt: new Date().toISOString(),
    checks,
    pass: failed === 0,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(failed ? '\nFAIL export-rewrite' : '\nPASS export-rewrite');
  process.exit(failed ? 1 : 0);
}

main();
