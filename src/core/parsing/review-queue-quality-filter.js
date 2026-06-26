/**
 * P0 — Review queue quality filter.
 * Hide weak suggestions; compact noisy OCR; ambiguous types → À classer.
 */

import { classifySuggestionNoise } from './suggestion-confidence-score.js';
import { SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN } from './suggestion-classification-fix.js';

export const REVIEW_QUEUE_MIN_VISIBLE_CONFIDENCE = 35;
export const REVIEW_QUEUE_PRIMARY_TEXT_MAX = 72;

const CRITICAL_FIELD_RE =
  /^(identity|contact|name|title|email|phone|identity\.(name|title|email|phone))$/i;

/**
 * @param {object} item
 */
export function isCriticalReviewSuggestion(item = {}) {
  const meta = item.item || item;
  const field = String(meta.field || meta.detectedType || item.field || '')
    .trim()
    .toLowerCase();
  if (CRITICAL_FIELD_RE.test(field)) return true;
  const text = String(
    item.text || meta.sourceText || meta.detected || item.sourceText || item.detected || ''
  ).trim();
  if (/@/.test(text) && /\.[a-z]{2,}/i.test(text)) return true;
  if (/\+?\d[\d\s().-]{7,}\d/.test(text)) return true;
  if (meta.action === 'section_validation' && /identity|contact|name|title/i.test(field)) {
    return true;
  }
  return false;
}

/**
 * @param {object} item
 */
export function reviewSuggestionConfidence(item = {}) {
  const meta = item.item || item;
  let c = Number(item.confidence ?? meta.confidence ?? item.suggestionScore?.score);
  if (!Number.isFinite(c) && item.suggestionScore?.score != null) {
    c = Number(item.suggestionScore.score);
  }
  if (!Number.isFinite(c) && item.ocrConfidence != null) {
    c = Number(item.ocrConfidence) <= 1 ? Number(item.ocrConfidence) * 100 : Number(item.ocrConfidence);
  }
  if (!Number.isFinite(c)) return 0;
  return Math.round(Math.max(0, Math.min(100, c)));
}

/**
 * @param {object} item
 */
export function meetsReviewVisibilityThreshold(item = {}) {
  if (isCriticalReviewSuggestion(item)) return true;
  const conf = reviewSuggestionConfidence(item);
  if (conf === 0) return false;
  return conf >= REVIEW_QUEUE_MIN_VISIBLE_CONFIDENCE;
}

/**
 * @param {string} text
 * @param {number} [maxLen]
 */
export function compactSuggestionDisplayText(text, maxLen = REVIEW_QUEUE_PRIMARY_TEXT_MAX) {
  const raw = String(text || '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const noise = classifySuggestionNoise(raw);
  if (noise.classification === 'GARBAGE') {
    const token = raw.split(' ').find((w) => w.length >= 4) || raw;
    return token.length > maxLen ? `${token.slice(0, maxLen - 1)}…` : token;
  }
  if (raw.length <= maxLen) return raw;
  const cut = raw.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > Math.floor(maxLen * 0.35) ? cut.slice(0, lastSpace) : cut;
  return `${base.trim()}…`;
}

/**
 * Ambiguous or low-confidence types surface as unknown (À classer), never Skill by default.
 * @param {object} item
 * @param {{ category?: string, predictedCategory?: string, confidence?: number, needsReview?: boolean }} [resolved]
 */
export function resolveDisplayCategory(item = {}, resolved = {}) {
  const conf = Number(
    resolved.confidence ?? item.confidence ?? reviewSuggestionConfidence(item)
  );
  const needsReview =
    resolved.needsReview === true ||
    conf < REVIEW_QUEUE_MIN_VISIBLE_CONFIDENCE ||
    conf < SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN;

  const cats = Array.isArray(item.item?.possibleCategories)
    ? item.item.possibleCategories
    : Array.isArray(item.possibleCategories)
      ? item.possibleCategories
      : [];
  const topTypeConf = cats.length
    ? Math.max(
        ...cats.map((c) => Math.round(Number(c?.confidence ?? c?.score ?? 0)))
      )
    : conf;

  if (needsReview || topTypeConf < REVIEW_QUEUE_MIN_VISIBLE_CONFIDENCE) return 'unknown';

  const predicted = String(
    resolved.predictedCategory || resolved.category || item.category || item.predictedCategory || ''
  )
    .trim()
    .toLowerCase()
    .replace(/s$/, '');

  if (predicted === 'skill' && (needsReview || topTypeConf < SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN)) {
    return 'unknown';
  }

  const cat = String(resolved.category || item.category || predicted || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/s$/, '');

  if (cat === 'skill' && topTypeConf < SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN) return 'unknown';
  if (!cat || cat === 'raw') return 'unknown';
  return cat;
}

/**
 * Filter possible category rows for UI (hide 0% unless critical).
 * @param {object} item
 * @param {{ id?: string, label?: string, confidence?: number, score?: number }[]} categories
 */
export function filterVisibleCategoryAlternatives(item = {}, categories = []) {
  const critical = isCriticalReviewSuggestion(item);
  const rows = (categories || [])
    .map((c) => ({
      ...c,
      confidence: Math.round(Number(c?.confidence ?? c?.score ?? 0)),
    }))
    .filter((c) => {
      const id = String(c?.id || '').trim();
      if (!id) return false;
      if (critical) return c.confidence >= 0;
      return c.confidence > 0;
    });
  return rows.slice(0, 4);
}
