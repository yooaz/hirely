/**
 * Real CV benchmark pack — fake data + data loss detection.
 */
import { auditNoFakeDataPolicy } from '../../src/core/validation/no-fake-data-policy.js';
import { auditRowFakeIdentity } from './no-fake-pass-import-policy.mjs';
import { MEANINGFUL_TEXT_MIN } from './no-fake-pass-import-policy.mjs';

/**
 * @param {object} row
 */
export function detectFakeData(row) {
  const reasons = [...auditRowFakeIdentity(row)];
  const rd = row.resumeData || row.finalResumeData || null;
  if (rd) {
    const audit = auditNoFakeDataPolicy({
      finalResumeData: rd,
      reviewQueue: row.reviewQueue || [],
    });
    if (!audit.pass) {
      for (const v of audit.violations) {
        reasons.push(v.type || 'fake_data');
      }
    }
  }
  const unique = [...new Set(reasons)];
  return { detected: unique.length > 0, reasons: unique };
}

/**
 * @param {object} row
 */
export function detectDataLoss(row) {
  const reasons = [];
  const selected = row.selectedTextLength ?? 0;
  const preview = row.previewLength ?? row.finalPreviewLength ?? 0;
  const status = row.status || '';
  const structure =
    (row.experienceCount ?? 0) +
    (row.educationCount ?? 0) +
    (row.skillsCount ?? 0);

  const accountedPct = row.contentAccountedPct;
  if (accountedPct != null && accountedPct < 45 && selected >= MEANINGFUL_TEXT_MIN) {
    reasons.push('low_content_accounting');
  }

  if (
    ['IMPORT_READY', 'IMPORT_PARTIAL'].includes(status) &&
    selected >= MEANINGFUL_TEXT_MIN &&
    structure === 0 &&
    preview < 80
  ) {
    reasons.push('structured_sections_missing');
  }

  if (
    ['IMPORT_READY', 'IMPORT_PARTIAL'].includes(status) &&
    selected >= 500 &&
    preview > 0 &&
    preview < Math.min(120, selected * 0.12)
  ) {
    reasons.push('preview_much_shorter_than_extract');
  }

  if (selected >= MEANINGFUL_TEXT_MIN && preview < 40 && status === 'IMPORT_READY') {
    reasons.push('tiny_preview_on_ready');
  }

  const unique = [...new Set(reasons)];
  return { detected: unique.length > 0, reasons: unique };
}

/**
 * @param {object} row
 */
export function enrichBenchmarkMetrics(row) {
  const fake = detectFakeData(row);
  const loss = detectDataLoss(row);
  return {
    ...row,
    fakeDataDetected: fake.detected,
    fakeDataReasons: fake.reasons,
    dataLossDetected: loss.detected,
    dataLossReasons: loss.reasons,
  };
}
