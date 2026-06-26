/**
 * Ground LLM output in source OCR text — drop ungrounded fields (no hallucination).
 */

import { AI_RECONSTRUCTION_CONFIDENCE_MIN } from './ai-reconstruction-schema.js';

const PLACEHOLDER_RE =
  /\b(n\/a|na|unknown|not available|tbd|xxx|lorem ipsum|example company|your name|insert name|placeholder)\b/i;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;

export function normalizeGroundingText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} value
 * @param {string} sourceNorm
 */
export function groundingScoreForValue(value, sourceNorm) {
  const v = normalizeGroundingText(value);
  if (!v || v.length < 2) return 0;
  if (PLACEHOLDER_RE.test(v)) return 0;

  if (EMAIL_RE.test(value)) {
    const em = String(value).match(EMAIL_RE)?.[0]?.toLowerCase();
    return em && sourceNorm.includes(em) ? 98 : 0;
  }
  if (PHONE_RE.test(value)) {
    const digits = String(value).replace(/\D/g, '');
    const srcDigits = sourceNorm.replace(/\D/g, '');
    return digits.length >= 8 && srcDigits.includes(digits.slice(-9)) ? 95 : 0;
  }

  if (sourceNorm.includes(v)) return 96;

  const words = v.split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return v.length >= 4 && sourceNorm.includes(v.slice(0, 12)) ? 70 : 0;
  const hits = words.filter((w) => sourceNorm.includes(w)).length;
  const ratio = hits / words.length;
  if (ratio >= 0.85) return 92;
  if (ratio >= 0.65) return 78;
  if (ratio >= 0.5) return 55;
  return 0;
}

function isGrounded(value, sourceNorm) {
  return groundingScoreForValue(value, sourceNorm) >= AI_RECONSTRUCTION_CONFIDENCE_MIN;
}

/**
 * @param {object} exp
 * @param {string} sourceNorm
 */
function scoreExperience(exp, sourceNorm) {
  if (typeof exp === 'string') {
    return groundingScoreForValue(exp, sourceNorm);
  }
  const parts = [
    exp?.role,
    exp?.company,
    exp?.dates,
    exp?.startDate,
    exp?.endDate,
    ...(exp?.bullets || []),
  ].filter(Boolean);
  if (!parts.length) return 0;
  const scores = parts.map((p) => groundingScoreForValue(String(p), sourceNorm));
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/**
 * @param {unknown} raw
 * @param {string} sourceText
 */
export function groundAiResumeJson(raw, sourceText) {
  const sourceNorm = normalizeGroundingText(sourceText);
  const fieldScores = {};
  const dropped = [];

  const identityIn = raw?.identity && typeof raw.identity === 'object' ? raw.identity : {};
  const identity = {};
  for (const key of ['name', 'title', 'email', 'phone', 'location', 'linkedin', 'website']) {
    const v = String(identityIn[key] || '').trim();
    if (!v) continue;
    const score = groundingScoreForValue(v, sourceNorm);
    fieldScores[`identity.${key}`] = score;
    if (isGrounded(v, sourceNorm)) identity[key] = v;
    else dropped.push({ field: `identity.${key}`, value: v, score });
  }

  const pickArray = (arr, key, minScore = AI_RECONSTRUCTION_CONFIDENCE_MIN) => {
    const list = Array.isArray(arr) ? arr : [];
    const out = [];
    const scores = [];
    for (const item of list) {
      if (key === 'experience') {
        const sc = scoreExperience(item, sourceNorm);
        scores.push(sc);
        if (sc >= minScore) {
          if (typeof item === 'string') out.push(item);
          else {
            out.push({
              role: String(item.role || '').trim(),
              company: String(item.company || '').trim(),
              startDate: String(item.startDate || '').trim(),
              endDate: String(item.endDate || '').trim(),
              bullets: (item.bullets || []).filter((b) => isGrounded(b, sourceNorm)),
            });
          }
        } else dropped.push({ field: key, value: item, score: sc });
        continue;
      }
      const text = typeof item === 'string' ? item : JSON.stringify(item);
      const sc = groundingScoreForValue(text, sourceNorm);
      scores.push(sc);
      if (sc >= minScore) out.push(typeof item === 'string' ? item.trim() : text);
      else dropped.push({ field: key, value: text, score: sc });
    }
    if (scores.length) fieldScores[key] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    else fieldScores[key] = 0;
    return out;
  };

  const resume = {
    identity,
    experience: pickArray(raw?.experience, 'experience'),
    education: pickArray(raw?.education, 'education'),
    skills: pickArray(raw?.skills, 'skills'),
    tools: pickArray(raw?.tools, 'tools'),
    languages: pickArray(raw?.languages, 'languages'),
    projects: pickArray(raw?.projects, 'projects'),
    clients: pickArray(raw?.clients, 'clients'),
    awards: pickArray(raw?.awards, 'awards'),
    publications: pickArray(raw?.publications, 'publications'),
  };

  const scoreValues = Object.values(fieldScores).filter((n) => n > 0);
  const confidence = scoreValues.length
    ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
    : 0;

  return {
    resume,
    confidence,
    fieldScores,
    dropped,
    groundedOnly: true,
  };
}
