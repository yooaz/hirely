/**
 * P0 — Yoaz bias removal guard.
 * Demo / tuning identity markers must not appear in output unless present in source text.
 */

import {
  NAME_CONFIRM_LABEL,
  EMAIL_CONFIRM_LABEL,
  PHONE_CONFIRM_LABEL,
} from '../display/identity-labels.js';
import {
  isUncertainIdentityEmail,
  isUncertainIdentityName,
  isUncertainIdentityPhone,
} from '../display/undetected-label.js';

export const YOAZ_BIAS_GUARD_V1 = 'YOAZ_BIAS_GUARD_V1';

/** Identity / studio markers from Yoaz CV tuning — never inject without source proof. */
export const YOAZ_IDENTITY_PATTERNS = Object.freeze([
  /\byohann\s+azancot\b/i,
  /\byoazg@hotmail\.fr\b/i,
  /\byoaz@hotmail\.fr\b/i,
  /\bstudio\s+yoaz\b/i,
  /\b38\s+impressions\b/i,
  /\blontac\s+impressions\b/i,
]);

/** Static scan terms — forbidden in production code outside comments. */
export const YOAZ_PRODUCTION_FORBIDDEN_LITERALS = Object.freeze([
  'yoazg@',
  'yoaz@hotmail',
  'Yohann Azancot',
  'Studio Yoaz',
  '38 Impressions',
]);

const YOAZ_LOOSE_TOKEN_RE = /\b(yoaz|azancot)\b/i;

/**
 * @param {string} value
 */
export function valueMatchesYoazMarker(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  if (YOAZ_IDENTITY_PATTERNS.some((re) => re.test(s))) return true;
  if (YOAZ_LOOSE_TOKEN_RE.test(s) && /@|studio|impressions/i.test(s)) return true;
  return false;
}

/**
 * @param {string} sourceText
 * @param {string} value
 */
export function sourceTextContainsValue(sourceText, value) {
  const src = String(sourceText || '').toLowerCase();
  const v = String(value || '').trim().toLowerCase();
  if (!src || !v) return false;
  if (src.includes(v)) return true;
  if (/@/.test(v)) {
    const local = v.split('@')[0];
    if (local.length >= 3 && src.includes(local)) return true;
  }
  return false;
}

/**
 * @param {string} sourceText
 */
export function sourceContainsYoazIdentity(sourceText) {
  const src = String(sourceText || '');
  if (!src) return false;
  return YOAZ_IDENTITY_PATTERNS.some((re) => re.test(src));
}

function stripYoazListItems(list, sourceText) {
  const kept = [];
  const stripped = [];
  for (const item of list || []) {
    const s = String(item || '').trim();
    if (!s) continue;
    if (valueMatchesYoazMarker(s) && !sourceTextContainsValue(sourceText, s)) {
      stripped.push(s);
      continue;
    }
    kept.push(s);
  }
  return { kept, stripped };
}

/**
 * @param {import('../resume-data.js').ResumeData} resumeData
 * @param {{ sourceText?: string, rawText?: string, cleanedText?: string }} [opts]
 */
export function applyYoazBiasGuard(resumeData, opts = {}) {
  if (!resumeData || typeof resumeData !== 'object') {
    return { resumeData, stripped: [], violations: [] };
  }

  const sourceText = [
    opts.sourceText,
    opts.rawText,
    opts.cleanedText,
    resumeData.meta?.rawText,
    resumeData.meta?.cleanedText,
  ]
    .filter(Boolean)
    .join('\n');

  const rd = { ...resumeData };
  const stripped = [];
  const violations = [];
  const id = { ...(rd.identity || {}) };

  for (const [field, confirmLabel, isUncertain] of [
    ['name', NAME_CONFIRM_LABEL, isUncertainIdentityName],
    ['email', EMAIL_CONFIRM_LABEL, isUncertainIdentityEmail],
    ['phone', PHONE_CONFIRM_LABEL, isUncertainIdentityPhone],
  ]) {
    const val = String(id[field] || '').trim();
    if (!val) continue;
    const yoazLeak = valueMatchesYoazMarker(val) && !sourceTextContainsValue(sourceText, val);
    if (yoazLeak) {
      stripped.push({ field: `identity.${field}`, value: val });
      id[field] = confirmLabel;
      violations.push(`yoaz_marker_without_source:${field}`);
    }
  }

  rd.identity = id;

  const clients = stripYoazListItems(rd.clients, sourceText);
  if (clients.stripped.length) {
    stripped.push(...clients.stripped.map((v) => ({ field: 'clients', value: v })));
    violations.push('yoaz_client_without_source');
  }
  rd.clients = clients.kept;

  const edu = stripYoazListItems(rd.education, sourceText);
  if (edu.stripped.length) {
    stripped.push(...edu.stripped.map((v) => ({ field: 'education', value: v })));
    violations.push('yoaz_education_without_source');
  }
  rd.education = edu.kept;

  const expKept = [];
  for (const exp of rd.experiences || []) {
    const company = String(exp?.company || '').trim();
    const role = String(exp?.role || '').trim();
    const companyLeak = valueMatchesYoazMarker(company) && !sourceTextContainsValue(sourceText, company);
    const roleLeak = valueMatchesYoazMarker(role) && !sourceTextContainsValue(sourceText, role);
    if (companyLeak || roleLeak) {
      stripped.push({
        field: 'experiences',
        value: `${role} @ ${company}`.trim(),
      });
      violations.push('yoaz_experience_without_source');
      continue;
    }
    expKept.push(exp);
  }
  rd.experiences = expKept;

  if (stripped.length) {
    rd.meta = {
      ...(rd.meta || {}),
      yoazBiasGuard: {
        version: YOAZ_BIAS_GUARD_V1,
        strippedCount: stripped.length,
        at: new Date().toISOString(),
      },
    };
  }

  return { resumeData: rd, stripped, violations };
}

/**
 * Apply field-specific confirm labels when identity contact fields are missing.
 * @param {object} identity
 */
export function applyIdentityConfirmLabels(identity = {}) {
  const id = { ...identity };
  const name = String(id.name || '').trim();
  if (!name || isUncertainIdentityName(name)) {
    id.name = '';
  }
  const email = String(id.email || '').trim();
  if (!email || isUncertainIdentityEmail(email)) {
    id.email = '';
  }
  const phone = String(id.phone || '').trim();
  if (!phone || isUncertainIdentityPhone(phone)) {
    id.phone = '';
  }
  return id;
}
