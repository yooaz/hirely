/**
 * H18 — Zero invented content.
 * Canonical UI label when OCR / DOCX / TXT / user edit did not supply a value.
 */

import {
  UNDETECTED_INFORMATION_LABEL,
  NAME_CONFIRM_LABEL,
  EMAIL_CONFIRM_LABEL,
  PHONE_CONFIRM_LABEL,
  TITLE_CONFIRM_LABEL,
  EMAIL_UNCERTAIN_LABEL,
  IDENTITY_NEEDS_REVIEW_LABEL,
} from './identity-labels.js';

export {
  UNDETECTED_INFORMATION_LABEL,
  NAME_CONFIRM_LABEL,
  EMAIL_CONFIRM_LABEL,
  PHONE_CONFIRM_LABEL,
  TITLE_CONFIRM_LABEL,
  EMAIL_UNCERTAIN_LABEL,
  IDENTITY_NEEDS_REVIEW_LABEL,
};

/** Legacy uncertain labels (pre-H18) — treated as missing, never as real CV content. */
export const LEGACY_UNCERTAIN_NAME_LABELS = Object.freeze([
  NAME_CONFIRM_LABEL,
  IDENTITY_NEEDS_REVIEW_LABEL,
  'Nom à compléter',
  'Name to confirm',
  UNDETECTED_INFORMATION_LABEL,
]);

export const LEGACY_UNCERTAIN_EMAIL_LABELS = Object.freeze([
  EMAIL_CONFIRM_LABEL,
  IDENTITY_NEEDS_REVIEW_LABEL,
  'Email to confirm',
  UNDETECTED_INFORMATION_LABEL,
]);

export const LEGACY_UNCERTAIN_PHONE_LABELS = Object.freeze([
  PHONE_CONFIRM_LABEL,
  IDENTITY_NEEDS_REVIEW_LABEL,
  'Phone to confirm',
  UNDETECTED_INFORMATION_LABEL,
]);

export const LEGACY_UNCERTAIN_TITLE_LABELS = Object.freeze([
  TITLE_CONFIRM_LABEL,
  'Title to confirm',
  UNDETECTED_INFORMATION_LABEL,
]);

/** Demo / sample identity markers — must not appear without explicit user sample load. */
export const DEMO_IDENTITY_MARKERS = Object.freeze([
  /^alex\s+martin$/i,
  /^senior\s+art\s+director$/i,
  /\byohann\s+azancot\b/i,
  /\byoazg@hotmail\.fr\b/i,
  /\byoaz@hotmail\.fr\b/i,
  /\bstudio\s+yoaz\b/i,
]);

/** Fabricated export-rescue patterns blocked by H18. */
export const FABRICATED_EXPORT_PATTERNS = Object.freeze([
  /^professional profile$/i,
  /^clients:\s/i,
  /^skills:\s/i,
  /^contributed\s+as\b/i,
  /^delivered\s+creative\s+work\b/i,
  /^designed\s+and\s+delivered\s+creative\s+work\b/i,
  /^(experiences?|clients?|summary|tools?|skills?|education|formation|languages?|projects?|identity|identité?)$/i,
  /^market reviews$/i,
  /\bà\s+confirmer\b/i,
  /^information non détectée$/i,
]);

export function normLabel(s) {
  let out = '';
  let prevWs = false;
  const t = String(s || '').slice(0, 120);
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      if (!prevWs && out.length) {
        out += ' ';
        prevWs = true;
      }
    } else {
      out += ch;
      prevWs = false;
    }
  }
  return out.trim();
}

export function isUndetectedLabel(value) {
  return normLabel(value) === UNDETECTED_INFORMATION_LABEL;
}

export function isUncertainIdentityName(value) {
  const s = normLabel(value);
  if (!s) return true;
  if (normLabel(IDENTITY_NEEDS_REVIEW_LABEL) === s) return true;
  return LEGACY_UNCERTAIN_NAME_LABELS.some((l) => normLabel(l) === s);
}

export function isUncertainIdentityTitle(value) {
  const s = normLabel(value);
  if (!s) return true;
  return LEGACY_UNCERTAIN_TITLE_LABELS.some((l) => normLabel(l) === s);
}

export function isUncertainIdentityEmail(value) {
  const s = normLabel(value);
  if (!s) return true;
  return LEGACY_UNCERTAIN_EMAIL_LABELS.some((l) => normLabel(l) === s);
}

export function isUncertainIdentityPhone(value) {
  const s = normLabel(value);
  if (!s) return true;
  return LEGACY_UNCERTAIN_PHONE_LABELS.some((l) => normLabel(l) === s);
}

export function isMissingIdentityField(value, kind = 'name') {
  if (kind === 'title') return isUncertainIdentityTitle(value);
  if (kind === 'email') return isUncertainIdentityEmail(value);
  if (kind === 'phone') return isUncertainIdentityPhone(value);
  return isUncertainIdentityName(value);
}

/** Display label for empty / uncertain identity fields. */
export function undetectedDisplayLabel(value, kind = 'name') {
  if (kind === 'name' && isUncertainIdentityName(value)) return NAME_CONFIRM_LABEL;
  if (kind === 'email' && isUncertainIdentityEmail(value)) return EMAIL_CONFIRM_LABEL;
  if (kind === 'phone' && isUncertainIdentityPhone(value)) return PHONE_CONFIRM_LABEL;
  if (kind === 'title' && isUncertainIdentityTitle(value)) return TITLE_CONFIRM_LABEL;
  if (isMissingIdentityField(value, kind)) return UNDETECTED_INFORMATION_LABEL;
  return normLabel(value);
}

/** Strip legacy uncertain markers to empty string for resumeData storage. */
export function stripUncertainToEmpty(value, kind = 'name') {
  if (isMissingIdentityField(value, kind)) return '';
  return normLabel(value);
}

/**
 * @param {object} resumeData
 * @returns {string[]} invented content violations
 */
export function auditResumeDataForInventedContent(resumeData) {
  const violations = [];
  if (!resumeData || typeof resumeData !== 'object') return violations;

  const id = resumeData.identity || {};
  const name = normLabel(id.name);
  const title = normLabel(id.title);

  if (name && DEMO_IDENTITY_MARKERS[0].test(name) && !resumeData.meta?.userSampleLoaded) {
    violations.push(`demo identity name: ${name}`);
  }

  const summary = normLabel(resumeData.summary);
  if (summary && FABRICATED_EXPORT_PATTERNS.some((re) => re.test(summary))) {
    violations.push(`fabricated summary: ${summary.slice(0, 80)}`);
  }

  for (const exp of resumeData.experiences || []) {
    const role = normLabel(exp?.role);
    const company = normLabel(exp?.company);
    if (role && FABRICATED_EXPORT_PATTERNS.some((re) => re.test(role))) {
      violations.push(`fabricated experience role: ${role}`);
    }
    if (company && FABRICATED_EXPORT_PATTERNS.some((re) => re.test(company))) {
      violations.push(`fabricated experience company: ${company}`);
    }
    for (const bullet of exp?.bullets || []) {
      const b = normLabel(bullet);
      if (b && FABRICATED_EXPORT_PATTERNS.some((re) => re.test(b))) {
        violations.push(`fabricated experience bullet: ${b.slice(0, 80)}`);
      }
    }
    if (/^contributed\s+as\s+at\b/i.test(`${role} ${company}`)) {
      violations.push(`invented experience: Contributed as at ${company || role}`);
    }
  }

  return violations;
}
