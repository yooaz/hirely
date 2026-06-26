/**
 * P0 — Evaluate generic non-Yoaz CV import → parse → preview proof.
 */
import { nameMatches } from './generalization-proof-eval.mjs';
import { auditNoFakeDataPolicy } from '../../src/core/validation/no-fake-data-policy.js';
import {
  EMAIL_CONFIRM_LABEL,
  PHONE_CONFIRM_LABEL,
  NAME_CONFIRM_LABEL,
  isUncertainIdentityEmail,
  isUncertainIdentityPhone,
} from '../../src/core/display/undetected-label.js';

const YOAZ_OUTPUT_RE =
  /\b(yohann|yoaz|azancot|yoazg@hotmail|yoaz@hotmail|studio\s+yoaz|38\s+impressions|lontac\s+impressions)\b/i;

const FAKE_PHONE_POLLUTION_RE = /^(19|20)\d{2}/;

/**
 * @param {string} expectedEmail
 * @param {string} actualEmail
 */
export function emailMatches(expectedEmail, actualEmail) {
  const expected = String(expectedEmail || '').trim().toLowerCase();
  const actual = String(actualEmail || '').trim().toLowerCase();
  if (!expected) return true;
  if (!actual || isUncertainIdentityEmail(actual)) return false;
  if (actual === expected) return true;
  const local = expected.split('@')[0];
  return actual.includes(local) && actual.includes('@');
}

/**
 * @param {string} expectedDigits
 * @param {string} actualPhone
 */
export function phoneMatchesOrAbsent(expectedDigits, actualPhone) {
  const actual = String(actualPhone || '').trim();
  if (!actual || isUncertainIdentityPhone(actual)) return true;
  const digits = actual.replace(/\D/g, '');
  if (!digits) return true;
  if (FAKE_PHONE_POLLUTION_RE.test(digits)) return false;
  const expected = String(expectedDigits || '').replace(/\D/g, '');
  if (!expected || expected.length < 8) return true;
  const tail = expected.slice(-8);
  return digits.includes(tail) || expected.includes(digits.slice(-8));
}

/**
 * @param {string} blob
 */
export function hasYoazLeak(blob) {
  return YOAZ_OUTPUT_RE.test(String(blob || ''));
}

/**
 * @param {string} html
 * @param {object} expected
 */
export function previewIsNonEmpty(html, expected = {}) {
  const renderHtml = String(html || '');
  if (renderHtml.length < 120) return false;
  if (/<main[^>]*>\s*<\/main>/i.test(renderHtml)) return false;
  if (/cvEmptyState|emptyPreview/i.test(renderHtml)) return false;
  const nameParts = String(expected.name || '')
    .split(/\s+/)
    .filter((p) => p.length >= 2);
  if (nameParts.length && !nameParts.some((p) => renderHtml.toLowerCase().includes(p.toLowerCase()))) {
    return false;
  }
  return true;
}

/**
 * @param {{
 *   importResult?: object,
 *   finalResumeData?: object,
 *   renderHtml?: string,
 *   expected?: object,
 *   reviewItems?: object[],
 * }} row
 */
export function evaluateGenericCvProof(row) {
  const failures = [];
  const importResult = row.importResult || {};
  const frd = row.finalResumeData || {};
  const identity = frd.identity || {};
  const expected = row.expected || {};
  const blob = JSON.stringify({ frd, html: row.renderHtml || '' });

  if (!importResult.resumeData && importResult.errors?.length) {
    failures.push(`import:${importResult.errors[0] || 'failed'}`);
  }

  const displayName = String(identity.name || '').trim();
  if (!nameMatches(expected.name, displayName) || displayName === NAME_CONFIRM_LABEL) {
    failures.push(`name:${displayName || '(empty)'}`);
  }

  const displayEmail = String(identity.email || '').trim();
  if (!emailMatches(expected.email, displayEmail)) {
    failures.push(`email:${displayEmail || '(empty)'}`);
  }

  const displayPhone = String(identity.phone || '').trim();
  if (!phoneMatchesOrAbsent(expected.phoneDigits, displayPhone)) {
    failures.push(`phone:${displayPhone || '(empty)'}`);
  }

  if (hasYoazLeak(blob)) failures.push('yoaz_leak');

  const fakeAudit = auditNoFakeDataPolicy({
    finalResumeData: frd,
    reviewQueue: row.reviewItems || [],
  });
  if (!fakeAudit.pass) {
    failures.push(`fake:${fakeAudit.violations.map((v) => v.type).join(',')}`);
  }

  const experiences = frd.experiences || [];
  const education = frd.education || [];
  if (experiences.length < 1) failures.push('experience_empty');
  if (education.length < 1) failures.push('education_empty');

  if (!previewIsNonEmpty(row.renderHtml, expected)) failures.push('preview_empty');

  return {
    pass: failures.length === 0,
    failures,
    metrics: {
      importStatus: importResult.importStatus || '',
      name: displayName,
      email: displayEmail,
      phone: displayPhone,
      experienceCount: experiences.length,
      educationCount: education.length,
      renderLen: String(row.renderHtml || '').length,
      fakeViolations: fakeAudit.violations.length,
      yoazLeak: hasYoazLeak(blob),
    },
  };
}

/**
 * @param {object[]} rows
 */
export function aggregateGenericCvProof(rows) {
  const passCount = rows.filter((r) => r.pass).length;
  return {
    count: rows.length,
    passCount,
    failCount: rows.length - passCount,
    pass: passCount === rows.length && rows.length > 0,
    passRate: rows.length ? Math.round((passCount / rows.length) * 100) : 0,
  };
}
