/**
 * NO FAKE PASS — import gate evaluation shared by all import QA scripts.
 *
 * Terminal status (no crash) ≠ product PASS.
 * IMPORT_NEEDS_PASTE is an honest outcome but never a successful import.
 *
 * @see NO_FAKE_PASS_IMPORT_POLICY.md
 * @see NO_FAKE_PASS_IMPORT_GATE_REPORT.md
 */

import {
  isAcceptableDisplayName,
  isAcceptableDisplayPhone,
} from '../../src/core/validation/no-fake-data-policy.js';

export const NO_FAKE_PASS_VERSION = 'NO_FAKE_PASS_IMPORT_GATE_V2';
/** @deprecated alias */
export const NO_FAKE_PASS_IMPORT_GATE_V2 = NO_FAKE_PASS_VERSION;

export const MEANINGFUL_TEXT_MIN = 300;
export const PREVIEW_MIN_FOR_SUCCESS = 100;
export const PLACEHOLDER_PREVIEW_MAX = 80;

const SUCCESS_STATUSES = new Set(['IMPORT_READY', 'IMPORT_PARTIAL']);
const ACCEPTABLE_TERMINAL_STATUSES = new Set([
  'IMPORT_READY',
  'IMPORT_PARTIAL',
  'IMPORT_NEEDS_PASTE',
  'IMPORT_UNSUPPORTED',
  'IMPORT_FAILED',
]);

/**
 * @param {string} [category]
 */
export function categoryRequiresReadableOcr(category) {
  return /scanned|image|scan/i.test(String(category || ''));
}

/**
 * @param {object} row
 */
export function hasMeaningfulExtractedText(row) {
  return (row.selectedTextLength ?? 0) >= MEANINGFUL_TEXT_MIN;
}

/**
 * @param {object} row
 */
export function hasIdentitySignal(row) {
  const name = String(row.identityName || '').trim();
  const email = String(row.identityEmail || '').trim();
  const phone = String(row.identityPhone || '').trim();
  const experiences = row.experiences || [];

  if (name && isAcceptableDisplayName(name, experiences)) return true;
  if (email && email.includes('@')) return true;
  if (phone && isAcceptableDisplayPhone(phone)) return true;

  if (row.identityFound && !name && !phone) return true;
  if (row.emailFound && !name) return true;
  if (row.phoneFound && !phone) return true;

  return false;
}

/**
 * Identity OR experience OR education — core CV signal for product PASS.
 * @param {object} row
 */
export function hasIdentityExperienceOrEducation(row) {
  if ((row.experienceCount ?? 0) > 0) return true;
  if ((row.educationCount ?? 0) > 0) return true;
  return hasIdentitySignal(row);
}

/**
 * @param {object} row
 */
export function hasStructuredCv(row) {
  if (!row.hasResume) return false;
  return hasIdentityExperienceOrEducation(row);
}

/**
 * @param {object} row
 */
export function previewHasIdentityOrExperience(row) {
  return previewHasMeaningfulContent(row);
}

/**
 * @param {object} row
 */
export function previewHasMeaningfulContent(row) {
  const previewLen = row.finalPreviewLength ?? 0;
  if (previewLen < PREVIEW_MIN_FOR_SUCCESS) return false;
  if (!hasIdentityExperienceOrEducation(row)) return false;
  if (isPlaceholderOnlyCv(row)) return false;
  return true;
}

/**
 * @param {object} row
 */
export function isPlaceholderOnlyCv(row) {
  const status = row.status || row.qaOutcome || '';
  if (!SUCCESS_STATUSES.has(status)) return false;
  const previewLen = row.finalPreviewLength ?? 0;
  const emptySections =
    (row.experienceCount ?? 0) === 0 &&
    (row.educationCount ?? 0) === 0 &&
    (row.skillsCount ?? 0) === 0;
  return previewLen <= PLACEHOLDER_PREVIEW_MAX && emptySections;
}

/**
 * @param {object} row
 * @returns {string[]}
 */
export function auditRowFakeIdentity(row) {
  const reasons = [];
  const name = String(row.identityName || '').trim();
  const phone = String(row.identityPhone || '').trim();
  const experiences = row.experiences || [];

  if (name && !isAcceptableDisplayName(name, experiences)) reasons.push('fake_name');
  if (phone && !isAcceptableDisplayPhone(phone)) reasons.push('fake_phone');

  return reasons;
}

/**
 * @param {object} row
 */
export function isEmptyCv(row) {
  const status = row.status || row.qaOutcome || '';
  if (!SUCCESS_STATUSES.has(status)) return false;
  if (row.live && !row.hasResume) return true;

  const noSections =
    (row.experienceCount ?? 0) === 0 &&
    (row.educationCount ?? 0) === 0 &&
    (row.skillsCount ?? 0) === 0 &&
    (row.toolsCount ?? 0) === 0;
  const previewLen = row.finalPreviewLength ?? 0;

  return noSections && previewLen < 40;
}

/**
 * Status-only gate: no crash, no stuck loader (legacy smoke).
 * @param {object} row
 */
export function evaluateTerminalSafety(row) {
  const status = row.status || row.qaOutcome || '';
  const reasons = [];
  if (row.crashed || row.threw) reasons.push('crash');
  if (row.stuck || row.timedOut) reasons.push('stuck_loader');
  if (row.silentFail) reasons.push('silent_fail');
  if (status === 'IMPORT_CRASH' || status === 'IMPORT_STUCK') reasons.push(status);
  return { pass: reasons.length === 0, reasons };
}

/**
 * Honest terminal outcome — NEEDS_PASTE is acceptable, not a successful import.
 * @param {object} row
 */
export function evaluateImportAcceptableOutcome(row) {
  const terminal = evaluateTerminalSafety(row);
  if (!terminal.pass) {
    return { acceptable: false, reasons: terminal.reasons };
  }
  const status = row.status || row.qaOutcome || '';
  if (ACCEPTABLE_TERMINAL_STATUSES.has(status)) {
    return { acceptable: true, reasons: [] };
  }
  return { acceptable: false, reasons: ['unknown_terminal_status'] };
}

/**
 * Product-level PASS — user-visible successful import (all criteria).
 * @param {object} row
 * @returns {{ pass: boolean, reasons: string[], policyVersion: string, acceptable?: boolean }}
 */
export function evaluateImportProductPass(row) {
  const reasons = [];
  const status = row.status || row.qaOutcome || '';
  const category = row.category || '';
  const acceptable = evaluateImportAcceptableOutcome(row).acceptable;

  if (row.crashed || row.threw) reasons.push('crash');
  if (row.stuck || row.timedOut) reasons.push('stuck_loader');
  if (row.silentFail) reasons.push('silent_fail');
  if (status === 'IMPORT_CRASH' || status === 'IMPORT_STUCK') reasons.push(status);
  if (row.fakeSuccess) reasons.push('fake_success');

  if (status === 'IMPORT_NEEDS_PASTE') {
    reasons.push('paste_fallback_not_success');
    return { pass: false, reasons, policyVersion: NO_FAKE_PASS_VERSION, acceptable };
  }

  if (categoryRequiresReadableOcr(category) && !hasMeaningfulExtractedText(row)) {
    if (!['IMPORT_NEEDS_PASTE', 'IMPORT_UNSUPPORTED', 'IMPORT_FAILED'].includes(status)) {
      reasons.push('ocr_unread_wrong_status');
    }
    reasons.push('ocr_unread_not_pass');
    return { pass: false, reasons, policyVersion: NO_FAKE_PASS_VERSION, acceptable };
  }

  if (!SUCCESS_STATUSES.has(status)) {
    reasons.push('import_not_recovered');
    return { pass: false, reasons, policyVersion: NO_FAKE_PASS_VERSION, acceptable };
  }

  if (!hasMeaningfulExtractedText(row)) reasons.push('selected_text_under_300');
  if (!hasIdentityExperienceOrEducation(row)) {
    reasons.push('no_identity_experience_education');
  }
  if (!previewHasMeaningfulContent(row)) reasons.push('preview_not_meaningful');
  for (const r of auditRowFakeIdentity(row)) reasons.push(r);
  if (isEmptyCv(row)) reasons.push('empty_cv');
  if (isPlaceholderOnlyCv(row)) reasons.push('placeholder_only_cv');

  return {
    pass: reasons.length === 0,
    reasons,
    policyVersion: NO_FAKE_PASS_VERSION,
    acceptable,
  };
}
