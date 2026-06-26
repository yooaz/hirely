/**
 * P0 — Forbid placeholder / uncertain copy in final CV preview and PDF.
 * Placeholders belong in the review panel only.
 */

import { UNDETECTED_INFORMATION_LABEL } from '../display/undetected-label.js';
import { normalizeReviewItem, mergeReviewQueues } from '../parsing/review-queue-merge.js';

export const FINAL_CV_PLACEHOLDER_GUARD = 'FINAL_CV_PLACEHOLDER_GUARD_V1';

/** Must never render as CV content (review panel may show French review copy). */
export const FINAL_CV_FORBIDDEN_PLACEHOLDERS = Object.freeze([
  UNDETECTED_INFORMATION_LABEL,
  'Nom à confirmer',
  'Nom à compléter',
  'Identity needs review',
  'Poste à compléter',
  'Company à confirmer',
  'Entreprise à confirmer',
  'Role à confirmer',
  'Rôle à confirmer',
  'Date à confirmer',
  'Title to confirm',
  'Name to confirm',
]);

const FORBIDDEN_PLACEHOLDER_SET = new Set(
  FINAL_CV_FORBIDDEN_PLACEHOLDERS.map((l) => l.toLowerCase())
);

const PLACEHOLDER_FIELD_RE =
  /^(information non détectée|nom à confirmer|nom à compléter|poste à compléter|company à confirmer|entreprise à confirmer|role à confirmer|rôle à confirmer|date à confirmer|title to confirm|name to confirm|—|-{2,}|n\/?a|tbd|xxx+|\[.*\])$/i;

const PLACEHOLDER_INLINE_RE = /(?:à|a)\s+confirmer\b|to\s+confirm\b/i;

function norm(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isFinalCvPlaceholder(text) {
  const s = norm(text);
  if (!s) return false;
  const low = s.toLowerCase();
  if (FORBIDDEN_PLACEHOLDER_SET.has(low)) return true;
  if (PLACEHOLDER_FIELD_RE.test(s)) return true;
  if (PLACEHOLDER_INLINE_RE.test(s)) return true;
  return false;
}

/**
 * @param {string} text
 * @returns {string}
 */
export function stripFinalCvPlaceholder(text) {
  const s = norm(text);
  if (!s || isFinalCvPlaceholder(s)) return '';
  return s;
}

/**
 * @param {object} exp
 * @returns {boolean}
 */
export function experienceHasUnknownCompany(exp) {
  const company = norm(exp?.company);
  return !company || isFinalCvPlaceholder(company);
}

/**
 * @param {object} exp
 * @returns {boolean}
 */
export function experienceMustLeaveFinalCv(exp) {
  if (!exp || typeof exp !== 'object') return true;
  const role = norm(exp.role);
  const company = norm(exp.company);
  const dates = norm(exp.dates || [exp.startDate, exp.endDate].filter(Boolean).join('–'));
  if (experienceHasUnknownCompany(exp)) return true;
  if (isFinalCvPlaceholder(role)) return true;
  if (isFinalCvPlaceholder(dates)) return true;
  const head = [role, company, dates].filter(Boolean).join(' — ');
  if (isFinalCvPlaceholder(head)) return true;
  return false;
}

/**
 * @param {object} exp
 * @returns {object|null}
 */
function buildPlaceholderExperienceReviewItem(exp) {
  const role = norm(exp?.role);
  const company = norm(exp?.company);
  const dates = norm(exp.dates || [exp.startDate, exp.endDate].filter(Boolean).join('–'));
  const bullets = (exp?.bullets || []).map((b) => norm(b)).filter(Boolean);
  const sourceText = [role, company, dates, ...bullets].filter(Boolean).join(' — ');
  if (!sourceText) return null;

  let reason = 'Expérience incomplète — validation requise';
  if (experienceHasUnknownCompany(exp)) reason = 'Entreprise à confirmer';
  else if (isFinalCvPlaceholder(role)) reason = 'Rôle à confirmer';
  else if (isFinalCvPlaceholder(dates)) reason = 'Date à confirmer';

  return normalizeReviewItem({
    field: 'experiences',
    detectedType: 'experience',
    detected: sourceText,
    sourceText,
    sourceLines: bullets.length ? bullets : [sourceText],
    confidence: 42,
    reason,
    status: 'pending',
    placeholderGuard: true,
  });
}

function sanitizeExperienceEntry(exp) {
  if (experienceMustLeaveFinalCv(exp)) {
    return { exp: null, rejected: [exp], reviewItem: buildPlaceholderExperienceReviewItem(exp) };
  }

  const out = { ...exp };
  const rejected = [];

  for (const field of ['role', 'company', 'dates', 'location', 'description', 'rewrittenDescription']) {
    const raw = norm(out[field]);
    if (!raw) continue;
    const cleaned = stripFinalCvPlaceholder(raw);
    if (!cleaned) {
      rejected.push(raw);
      delete out[field];
    } else {
      out[field] = cleaned;
    }
  }

  const bullets = [];
  for (const bullet of out.bullets || []) {
    const cleaned = stripFinalCvPlaceholder(bullet);
    if (!cleaned) {
      if (norm(bullet)) rejected.push(norm(bullet));
      continue;
    }
    bullets.push(cleaned);
  }
  out.bullets = bullets;

  if (experienceMustLeaveFinalCv(out)) {
    return { exp: null, rejected: [exp, ...rejected], reviewItem: buildPlaceholderExperienceReviewItem(exp) };
  }

  return { exp: out, rejected, reviewItem: null };
}

function filterStringList(list = []) {
  const kept = [];
  const rejected = [];
  for (const item of list || []) {
    const cleaned = stripFinalCvPlaceholder(item);
    if (!cleaned) {
      if (norm(item)) rejected.push(norm(item));
      continue;
    }
    kept.push(cleaned);
  }
  return { kept, rejected };
}

/**
 * @param {object} finalResumeData
 * @returns {{ violations: { section: string, text: string }[] }}
 */
export function auditFinalCvPlaceholders(finalResumeData = {}) {
  const violations = [];
  const push = (section, text) => {
    const s = norm(text);
    if (s && isFinalCvPlaceholder(s)) violations.push({ section, text: s });
  };

  push('summary', finalResumeData.summary);
  for (const field of ['education', 'skills', 'tools', 'languages', 'clients', 'projects', 'suggestions']) {
    for (const item of finalResumeData[field] || []) push(field, item);
  }
  for (const exp of finalResumeData.experiences || []) {
    push('experiences', exp?.role);
    push('experiences', exp?.company);
    push('experiences', exp?.dates);
    push('experiences', exp?.description);
    for (const bullet of exp?.bullets || []) push('experiences', bullet);
    const head = [exp?.role, exp?.company, exp?.dates].filter(Boolean).join(' — ');
    push('experiences', head);
    if (experienceHasUnknownCompany(exp)) {
      violations.push({ section: 'experiences', text: head || norm(exp?.company) || '(unknown company)' });
    }
  }
  for (const field of ['name', 'title', 'location', 'email', 'phone']) {
    push(`identity.${field}`, finalResumeData.identity?.[field]);
  }

  return { violations };
}

/**
 * @param {object|null} finalResumeData
 * @returns {object|null}
 */
export function stripPlaceholderContentFromFinalResume(finalResumeData) {
  if (!finalResumeData || typeof finalResumeData !== 'object') return finalResumeData;

  const out = { ...finalResumeData };
  const rejected = [];
  /** @type {object[]} */
  const reviewItems = [];

  out.summary = stripFinalCvPlaceholder(out.summary);

  for (const field of ['education', 'skills', 'tools', 'languages', 'clients', 'projects', 'suggestions']) {
    const result = filterStringList(out[field]);
    out[field] = result.kept;
    rejected.push(...result.rejected);
  }

  const experiences = [];
  for (const exp of out.experiences || []) {
    const result = sanitizeExperienceEntry(exp);
    rejected.push(...result.rejected.map((x) => (typeof x === 'string' ? x : norm(x?.company) || norm(x?.role))));
    if (result.reviewItem) reviewItems.push(result.reviewItem);
    if (result.exp) experiences.push(result.exp);
  }
  out.experiences = experiences;

  if (out.identity && typeof out.identity === 'object') {
    const identity = { ...out.identity };
    for (const field of ['name', 'title', 'location', 'email', 'phone']) {
      if (!(field in identity)) continue;
      const cleaned = stripFinalCvPlaceholder(identity[field]);
      if (!cleaned && norm(identity[field])) rejected.push(norm(identity[field]));
      if (cleaned) identity[field] = cleaned;
      else delete identity[field];
    }
    out.identity = identity;
  }

  const rejectedUnique = [...new Set(rejected.map((x) => norm(x)).filter(Boolean))].slice(0, 32);
  out.metaSafe = {
    ...(out.metaSafe || {}),
    finalCvPlaceholderGuard: FINAL_CV_PLACEHOLDER_GUARD,
    finalCvPlaceholderRejected: rejectedUnique,
    debug: {
      ...(out.metaSafe?.debug || {}),
      finalCvPlaceholders: {
        guard: FINAL_CV_PLACEHOLDER_GUARD,
        rejected: rejectedUnique,
        reviewCount: reviewItems.length,
        at: new Date().toISOString(),
      },
    },
  };

  out._placeholderReviewItems = reviewItems;
  return out;
}

/**
 * Final P0 gate — run before finalResumeData commit.
 * @param {object|null} finalResumeData
 * @param {{ existingReview?: object[] }} [opts]
 * @returns {{ finalResumeData: object|null, reviewItems: object[] }}
 */
export function sanitizeFinalCvPlaceholdersBeforeCommit(finalResumeData, opts = {}) {
  if (!finalResumeData || typeof finalResumeData !== 'object') {
    return { finalResumeData, reviewItems: [] };
  }

  let out = stripPlaceholderContentFromFinalResume({ ...finalResumeData });
  let audit = auditFinalCvPlaceholders(out);
  const reviewItems = [...(out._placeholderReviewItems || [])];
  delete out._placeholderReviewItems;

  if (audit.violations.length) {
    out = stripPlaceholderContentFromFinalResume(out);
    audit = auditFinalCvPlaceholders(out);
  }

  const mergedReview = mergeReviewQueues(opts.existingReview || [], reviewItems);

  out.metaSafe = {
    ...(out.metaSafe || {}),
    finalCvPlaceholderGuard: FINAL_CV_PLACEHOLDER_GUARD,
    debug: {
      ...(out.metaSafe?.debug || {}),
      finalCvPlaceholders: {
        guard: FINAL_CV_PLACEHOLDER_GUARD,
        rejected: out.metaSafe?.finalCvPlaceholderRejected || [],
        violationsAtCommit: audit.violations,
        reviewCount: reviewItems.length,
        committedAt: new Date().toISOString(),
      },
    },
  };

  return { finalResumeData: out, reviewItems: mergedReview };
}

/**
 * Flat cvData sanitizer for template / PDF path.
 * @param {object} cvData
 */
export function stripPlaceholderContentFromCvData(cvData) {
  if (!cvData || typeof cvData !== 'object') return cvData;
  const out = { ...cvData };

  out.summary = stripFinalCvPlaceholder(out.summary);
  out.name = stripFinalCvPlaceholder(out.name);
  out.title = stripFinalCvPlaceholder(out.title);
  out.location = stripFinalCvPlaceholder(out.location);

  for (const field of ['education', 'skills', 'tools', 'languages', 'clients', 'projects']) {
    const result = filterStringList(out[field]);
    out[field] = result.kept;
  }

  if (Array.isArray(out.experience)) {
    const experience = [];
    for (const item of out.experience) {
      if (typeof item === 'string') {
        const cleaned = stripFinalCvPlaceholder(item);
        if (cleaned && !isFinalCvPlaceholder(cleaned)) experience.push(cleaned);
        continue;
      }
      if (item && typeof item === 'object') {
        if (experienceMustLeaveFinalCv(item)) continue;
        const result = sanitizeExperienceEntry(item);
        if (result.exp) experience.push(result.exp);
      }
    }
    out.experience = experience;
  }

  return out;
}

/**
 * @param {object} frd
 * @returns {boolean}
 */
export function finalCvHasPlaceholderContent(frd = {}) {
  return auditFinalCvPlaceholders(frd).violations.length > 0;
}
