/**
 * Preview render gate — block premium CV template when extraction/parsing is unsafe.
 */

import { isUncertainIdentityName } from '../display/undetected-label.js';
import { isAcceptableDisplayName } from './no-fake-data-policy.js';

export const PREVIEW_RENDER_GATE_V1 = 'PREVIEW_RENDER_GATE_V1';

const PLACEHOLDER_NAME_RE =
  /^(nom à vérifier|information non détectée|name uncertain|profil professionnel)$/i;
const RAW_BLOB_ROLE_RE = /contenu extrait/i;
const SECTION_WORD_RE =
  /\b(experience|expérience|education|formation|skills|compétences|languages|langues|profile|profil|freelance|summary|résumé)\b/gi;

/**
 * @param {string} text
 */
export function looksLikeMergedExtractionBlob(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length < 100) return false;
  const sectionHits = (s.match(SECTION_WORD_RE) || []).length;
  const hasContact = /\+\d{9,}|@\w+\./.test(s);
  const hasDates = /\b(19|20)\d{2}\b/.test(s);
  return sectionHits >= 3 && (hasContact || hasDates);
}

/**
 * @param {object} [cvData]
 */
export function isRawBlobExperience(cvData) {
  const exp = cvData?.experience || [];
  if (exp.length !== 1) return false;
  const row = exp[0];
  if (!row || typeof row !== 'object') return false;
  const role = String(row.role || '').trim();
  const bullets = row.bullets || [];
  if (RAW_BLOB_ROLE_RE.test(role)) return true;
  if (bullets.length >= 16) return true;
  const joined = [role, row.company, row.dates, ...bullets].join(' ');
  return looksLikeMergedExtractionBlob(joined);
}

/**
 * @param {object} [cvData]
 * @param {object} [opts]
 */
export function assessPreviewRenderGate(cvData, opts = {}) {
  const issues = [];
  let blockPremium = false;

  const name = String(cvData?.name || '').trim();
  if (!name || PLACEHOLDER_NAME_RE.test(name) || isUncertainIdentityName(name)) {
    issues.push({ field: 'name', code: 'unsafe_name', detail: name || '(empty)' });
    blockPremium = true;
  } else if (!isAcceptableDisplayName(name, cvData?.experience || [])) {
    issues.push({ field: 'name', code: 'low_confidence_name', detail: name });
    blockPremium = true;
  }

  const summary = String(cvData?.summary || '').trim();
  if (summary && looksLikeMergedExtractionBlob(summary)) {
    issues.push({ field: 'summary', code: 'merged_blob_summary', detail: summary.slice(0, 120) });
    blockPremium = true;
  }

  if (isRawBlobExperience(cvData)) {
    issues.push({ field: 'experience', code: 'raw_blob_experience' });
    blockPremium = true;
  }

  const experiences = cvData?.experience || [];
  for (const row of experiences) {
    if (!row || typeof row !== 'object') continue;
    const blob = [row.role, row.company, row.dates, ...(row.bullets || [])].join(' ');
    if (looksLikeMergedExtractionBlob(blob)) {
      issues.push({ field: 'experience', code: 'merged_sections_in_experience', detail: String(row.role || '').slice(0, 80) });
      blockPremium = true;
      break;
    }
  }

  const expCount = experiences.filter((e) => {
    if (!e) return false;
    if (typeof e === 'string') return e.trim().length > 0;
    return !!(e.role || e.company || (e.bullets || []).length);
  }).length;

  const rawLen = Number(opts.rawTextLength) || 0;
  const userConfirmedPartial = opts.userConfirmedPartial === true;
  const recoveryOverrides = opts.recoveryOverrides || null;
  const nameOverride = String(recoveryOverrides?.name || '').trim();

  if (nameOverride && (isUncertainIdentityName(name) || !name || PLACEHOLDER_NAME_RE.test(name))) {
    if (isAcceptableDisplayName(nameOverride, cvData?.experience || [])) {
      const unsafeIdx = issues.findIndex((i) => i.code === 'unsafe_name' || i.code === 'low_confidence_name');
      if (unsafeIdx >= 0) issues.splice(unsafeIdx, 1);
      if (!issues.some((i) => i.field === 'name')) blockPremium = issues.length > 0;
      else blockPremium = true;
    }
  }

  if (!opts.bridgeLocked && rawLen > 700 && expCount <= 1 && !userConfirmedPartial) {
    issues.push({ field: 'experience', code: 'thin_structure_rich_raw', detail: `raw=${rawLen} exp=${expCount}` });
    blockPremium = true;
  }

  if (opts.extractionUnstructured === true && !opts.bridgeLocked) {
    issues.push({ field: 'extraction', code: 'unstructured_extraction' });
    blockPremium = true;
  }

  if (opts.forceBlock === true) blockPremium = true;

  if (userConfirmedPartial) {
    const criticalCodes = new Set(['unsafe_name', 'low_confidence_name', 'raw_blob_experience', 'merged_blob_summary']);
    const remaining = issues.filter((i) => criticalCodes.has(i.code));
    issues.length = 0;
    issues.push(...remaining);
    blockPremium = remaining.length > 0;
  }

  blockPremium = opts.forceBlock === true || issues.length > 0;

  return {
    version: PREVIEW_RENDER_GATE_V1,
    allowPremiumPreview: !blockPremium,
    blockPremiumRender: blockPremium,
    showCorrectionState: blockPremium,
    issues,
    sanitizedCvData: blockPremium ? sanitizeCvDataForCorrection(cvData) : cvData,
  };
}

/**
 * @param {object} [cvData]
 */
export function sanitizeCvDataForCorrection(cvData) {
  if (!cvData || typeof cvData !== 'object') return cvData;
  const out = { ...cvData };
  const name = String(out.name || '').trim();
  if (!name || PLACEHOLDER_NAME_RE.test(name) || isUncertainIdentityName(name)) {
    out.name = '';
  }
  if (looksLikeMergedExtractionBlob(out.summary || '')) out.summary = '';
  if (isRawBlobExperience(out)) out.experience = [];
  out._previewCorrectionRequired = true;
  return out;
}

/**
 * @param {object|null} gate
 */
export function shouldBlockPremiumPreview(gate) {
  return !!(gate && gate.blockPremiumRender);
}
