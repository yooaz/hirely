/**
 * P0 — Evaluate non-Yoaz CV import + render proof.
 */
import {
  IMPORT_STATUS,
  importStatusAllowsParser,
} from '../../src/core/import/import-status.js';

/**
 * @param {string} expected
 * @param {string} actual
 */
export function nameMatches(expected, actual) {
  const parts = String(expected || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.length >= 2);
  const hay = String(actual || '').toLowerCase();
  if (!hay || hay.length < 3 || !parts.length) return false;
  return parts.every((p) => hay.includes(p));
}

/**
 * @param {object} expected
 * @param {object} identity
 */
export function contactMatches(expected, identity = {}) {
  const email = String(identity.email || '').toLowerCase();
  const phone = String(identity.phone || '').replace(/\D/g, '');
  if (expected.email) {
    const local = expected.email.split('@')[0];
    if (email && (email === expected.email || email.includes(local))) return true;
  }
  if (expected.phoneDigits && expected.phoneDigits.length >= 8) {
    const tail = expected.phoneDigits.slice(-8);
    if (phone && phone.includes(tail)) return true;
  }
  return (email.includes('@') && email.length > 5) || phone.length >= 10;
}

/**
 * @param {{
 *   importResult?: object,
 *   resumeData?: object,
 *   renderHtml?: string,
 *   expected?: object,
 * }} row
 */
export function evaluateGeneralizationCv(row) {
  const failures = [];
  const importResult = row.importResult || {};
  const resumeData = row.resumeData || {};
  const identity = resumeData.identity || {};
  const expected = row.expected || {};

  const status = importResult.importStatus || '';
  const importOk =
    status === IMPORT_STATUS.IMPORT_SUCCESS ||
    importStatusAllowsParser(status) ||
    (importResult.resumeData && !importResult.errors?.length);
  if (!importOk) failures.push(`import:${status || 'failed'}`);

  if (!nameMatches(expected.name, identity.name)) {
    failures.push(`identity:${identity.name || '(empty)'}`);
  }
  if (!contactMatches(expected, identity)) {
    failures.push('contact');
  }

  const experiences = resumeData.experiences || [];
  const education = resumeData.education || [];
  if (experiences.length < 1) failures.push('experience');
  if (education.length < 1) failures.push('education');

  const renderHtml = String(row.renderHtml || '');
  if (renderHtml.length < 80 || /<main[^>]*>\s*<\/main>/i.test(renderHtml)) {
    failures.push('render');
  }

  return {
    pass: failures.length === 0,
    failures,
    metrics: {
      importStatus: status,
      name: identity.name || '',
      email: identity.email || '',
      phone: identity.phone || '',
      experienceCount: experiences.length,
      educationCount: education.length,
      renderLen: renderHtml.length,
    },
  };
}

/**
 * @param {object[]} rows
 */
export function aggregateGeneralizationProof(rows) {
  const passCount = rows.filter((r) => r.pass).length;
  return {
    count: rows.length,
    passCount,
    failCount: rows.length - passCount,
    pass: passCount === rows.length && rows.length > 0,
    passRate: rows.length ? Math.round((passCount / rows.length) * 100) : 0,
  };
}
