/**
 * Extraction Engine V2 — unified per-field confidence scoring.
 * Any field below REVIEW_THRESHOLD (70%) is flagged for review.
 */

import { P0_CONFIDENCE_THRESHOLD } from '../parsing/p0-threshold.js';
import {
  scoreIdentityName,
  scoreIdentityTitle,
  scoreIdentityEmail,
  scoreIdentityPhone,
  scoreExperienceConfidence,
  scoreEducationLine,
  scoreSkillLine,
  scoreSummaryLine,
} from '../validation/confidence-gate.js';
import {
  extractStrictLanguageLine,
  isStrictLanguageEntry,
  STRICT_LANGUAGE_NAME_RE,
} from '../parsing/strict-language-extraction.js';
import { buildLowConfidenceReviewItem } from '../validation/extraction-confidence-tiers.js';

export const EXTRACTION_FIELD_CONFIDENCE_V2 = 'EXTRACTION_FIELD_CONFIDENCE_V2';
export const FIELD_REVIEW_THRESHOLD = P0_CONFIDENCE_THRESHOLD;

const URL_RE = /^(https?:\/\/|www\.)[^\s]+$/i;
const LINKEDIN_RE = /linkedin\.com\/in\//i;
const LOCATION_RE =
  /\b(paris|lyon|london|new york|berlin|amsterdam|brussels|geneva|zurich|marseille|toulouse|bordeaux|lille|nice|montreal|toronto|singapore|dubai|remote|télétravail|teletravail)\b/i;

/** @param {string} location */
export function scoreLocationField(location) {
  const s = String(location || '').trim();
  if (!s) return 0;
  if (s.length < 3) return 25;
  if (/\d{5}/.test(s) || /,\s*[A-Z]{2}\b/.test(s)) return 92;
  if (LOCATION_RE.test(s)) return 88;
  if (s.includes(',') && s.split(',').length >= 2) return 84;
  if (s.length >= 6 && !/\b(experience|education|skills?)\b/i.test(s)) return 78;
  return 55;
}

/** @param {string} url */
export function scoreWebsiteField(url) {
  const s = String(url || '').trim();
  if (!s) return 0;
  if (LINKEDIN_RE.test(s)) return 95;
  if (URL_RE.test(s) || /^[\w.-]+\.(com|fr|io|net|org|be|ch|co)\b/i.test(s)) return 90;
  if (s.includes('.') && !/\s/.test(s)) return 72;
  return 35;
}

/** @param {string} linkedin */
export function scoreLinkedInField(linkedin) {
  const s = String(linkedin || '').trim();
  if (!s) return 0;
  if (LINKEDIN_RE.test(s)) return 98;
  if (/^linkedin$/i.test(s) || /^in\/[\w-]+$/i.test(s)) return 75;
  return 40;
}

/** @param {string} line */
export function scoreLanguageField(line) {
  const raw = String(line || '').trim();
  if (!raw) return 0;
  const strict = extractStrictLanguageLine(raw);
  if (strict.ok) return 92;
  if (STRICT_LANGUAGE_NAME_RE.test(raw) && isStrictLanguageEntry(raw)) return 85;
  if (STRICT_LANGUAGE_NAME_RE.test(raw)) return 58;
  return 25;
}

/** @param {string} line */
export function scoreCertificationField(line) {
  const s = String(line || '').trim();
  if (!s) return 0;
  if (/\b(certified|certification|certificate|license|licence|credential|aws|google|pmp|scrum)\b/i.test(s)) {
    return 88;
  }
  if (/\b(19|20)\d{2}\b/.test(s) && s.length >= 12) return 82;
  if (s.length >= 8) return 74;
  return 48;
}

/** @param {string} line */
export function scoreProjectField(line) {
  const s = String(line || '').trim();
  if (!s) return 0;
  if (/\b(project|projet|campaign|campagne|case study|portfolio)\b/i.test(s)) return 86;
  if (s.length >= 20) return 80;
  if (s.length >= 10) return 72;
  return 45;
}

/** @param {string} line */
export function scoreAchievementField(line) {
  const s = String(line || '').trim();
  if (!s) return 0;
  if (/\b(award|prix|won|winner|finalist|recognition|achievement|accomplishment)\b/i.test(s)) {
    return 90;
  }
  if (s.length >= 15) return 78;
  return 52;
}

/** Placeholder labels — not real extracted values */
const PLACEHOLDER_RE =
  /^(poste à compléter|nom à compléter|title to complete|name to complete|non détecté|undetected)$/i;

/** @param {string} line */
export function scoreExperienceStringLine(line) {
  const s = String(line || '').trim();
  if (!s || s.length < 8) return 0;
  const hasDate =
    /\b(19|20)\d{2}\s*[-–—]\s*(?:present|actuel|current|(19|20)\d{2})\b/i.test(s) ||
    /\b(19|20)\d{2}\b/.test(s);
  const parts = s.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean);
  const hasEntity = parts.some((p) => p.length > 3 && !/^(19|20)\d{2}$/.test(p));
  let score = 35;
  if (hasDate) score += 32;
  if (hasEntity) score += 22;
  if (parts.length >= 2) score += 8;
  if (s.length >= 24) score += 5;
  return Math.min(100, score);
}

/**
 * Score experience entry (object or string).
 * @param {object|string} exp
 */
export function scoreExperienceField(exp) {
  if (typeof exp === 'string') return scoreExperienceStringLine(exp);
  const objScore = scoreExperienceConfidence(exp || {});
  if (objScore > 0) return objScore;
  const label = [exp?.role, exp?.company, exp?.dates, exp?.startDate, exp?.endDate]
    .filter(Boolean)
    .join(' — ');
  return label ? scoreExperienceStringLine(label) : 0;
}

function roundScore(n) {
  return Math.round(Math.max(0, Math.min(100, Number(n) || 0)));
}

function fieldNeedsReview(score) {
  return roundScore(score) < FIELD_REVIEW_THRESHOLD;
}

/**
 * Score all extractable fields on cvData.
 * @param {object} cvData
 * @returns {{ fields: object[], sections: object, overall: number, flaggedCount: number }}
 */
export function scoreCvFieldConfidence(cvData = {}) {
  const fields = [];
  const sections = {};

  const pushField = (field, value, score, meta = {}) => {
    const conf = roundScore(score);
    const entry = {
      field,
      value: typeof value === 'string' ? value : JSON.stringify(value),
      confidence: conf,
      needsReview: fieldNeedsReview(conf),
      ...meta,
    };
    fields.push(entry);
    if (!sections[field]) sections[field] = { scores: [], count: 0, avg: 0, flagged: 0 };
    sections[field].scores.push(conf);
    sections[field].count += 1;
    if (entry.needsReview) sections[field].flagged += 1;
  };

  const pushOptional = (field, value, scorer) => {
    const v = String(value || '').trim();
    if (!v || PLACEHOLDER_RE.test(v)) return;
    pushField(field, v, scorer(v));
  };

  const id = cvData.identity || cvData;
  const experiences = cvData.experience || cvData.experiences || [];

  pushOptional('name', id.name || cvData.name, (v) =>
    scoreIdentityName(v, experiences)
  );
  pushOptional('title', id.title || cvData.title, scoreIdentityTitle);
  pushOptional('email', id.email || cvData.email, scoreIdentityEmail);
  pushOptional('phone', id.phone || cvData.phone, scoreIdentityPhone);
  pushOptional('location', id.location || cvData.location, scoreLocationField);
  pushOptional('website', id.website || cvData.portfolio || cvData.website, scoreWebsiteField);
  pushOptional('linkedin', id.linkedin || cvData.linkedin, scoreLinkedInField);

  if (cvData.summary) pushField('summary', cvData.summary, scoreSummaryLine(cvData.summary));

  for (const exp of experiences) {
    const label =
      typeof exp === 'string'
        ? exp
        : [exp?.role, exp?.company, exp?.dates].filter(Boolean).join(' · ') || JSON.stringify(exp);
    pushField('experience', label, scoreExperienceField(exp));
  }

  for (const edu of cvData.education || []) {
    pushField('education', String(edu), scoreEducationLine(edu));
  }

  for (const skill of cvData.skills || []) {
    pushField('skills', String(skill), scoreSkillLine(skill));
  }

  for (const tool of cvData.tools || []) {
    pushField('tools', String(tool), scoreSkillLine(tool));
  }

  for (const lang of cvData.languages || []) {
    pushField('languages', String(lang), scoreLanguageField(lang));
  }

  for (const cert of cvData.certifications || cvData.certificates || []) {
    pushField('certifications', String(cert), scoreCertificationField(cert));
  }

  for (const proj of cvData.projects || []) {
    const label = typeof proj === 'string' ? proj : proj?.title || proj?.name || JSON.stringify(proj);
    pushField('projects', label, scoreProjectField(label));
  }

  for (const ach of cvData.awards || cvData.achievements || []) {
    pushField('achievements', String(ach), scoreAchievementField(ach));
  }

  for (const key of Object.keys(sections)) {
    const s = sections[key];
    s.avg = s.scores.length ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) : 0;
  }

  const flaggedCount = fields.filter((f) => f.needsReview).length;
  const overall = fields.length
    ? Math.round(fields.reduce((a, f) => a + f.confidence, 0) / fields.length)
    : 0;

  return { fields, sections, overall, flaggedCount, threshold: FIELD_REVIEW_THRESHOLD };
}

/**
 * Build review-queue items for fields below threshold.
 * @param {object} cvData
 * @param {object} [opts]
 */
export function buildFieldReviewItems(cvData = {}, opts = {}) {
  const threshold = opts.threshold ?? FIELD_REVIEW_THRESHOLD;
  const scored = scoreCvFieldConfidence(cvData);
  const items = [];

  for (const f of scored.fields) {
    if (f.confidence >= threshold) continue;
    const item =
      buildLowConfidenceReviewItem({
        field: f.field,
        detectedType: f.field,
        detected: f.value,
        sourceText: f.value,
        confidence: f.confidence,
        reason: `Field confidence ${f.confidence}% < ${threshold}% — verify before display`,
      }) || {
        id: `v2-field-${f.field}-${items.length}`,
        field: f.field,
        detectedType: f.field,
        detected: f.value,
        sourceText: f.value,
        confidence: f.confidence,
        reason: `Field confidence ${f.confidence}% < ${threshold}%`,
        status: 'pending',
        action: 'edit',
      };
    items.push(item);
  }

  return { items, scored, threshold };
}

/**
 * Attach V2 field confidence report to cvData.meta.
 * @param {object} cvData
 */
export function applyFieldConfidenceV2(cvData = {}) {
  const scored = scoreCvFieldConfidence(cvData);
  const { items } = buildFieldReviewItems(cvData);

  const existing = Array.isArray(cvData.reviewQueue) ? cvData.reviewQueue : [];
  const merged = [...existing];
  const seen = new Set(existing.map((i) => `${i.field}::${i.detected}`));

  for (const item of items) {
    const key = `${item.field}::${item.detected}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return {
    ...cvData,
    reviewQueue: merged,
    meta: {
      ...(cvData.meta || {}),
      fieldConfidenceV2: {
        version: EXTRACTION_FIELD_CONFIDENCE_V2,
        threshold: FIELD_REVIEW_THRESHOLD,
        overall: scored.overall,
        flaggedCount: scored.flaggedCount,
        sections: scored.sections,
        fields: scored.fields,
        at: new Date().toISOString(),
      },
    },
  };
}
