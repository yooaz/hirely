/**
 * UNIVERSAL_EXPERIENCE_RECONSTRUCTOR — never discard career lines; low confidence → review queue.
 */
import { detectDatesInText, formatDateRange } from './date-detector.js';
import { detectCompanyInLine } from './company-detector.js';
import { detectRoleInLine } from './role-detector.js';
import {
  CV_BLOCK_TYPES,
  UNIVERSAL_EXPERIENCE_RECONSTRUCTOR,
  UNIVERSAL_EXPERIENCE_RECALL_GOAL,
} from './types.js';
import { normalizeReviewItem, mergeReviewQueues } from '../review-queue-merge.js';
import { hirelyDebugLog } from '../../runtime/hirely-debug.js';
import { getEducationLineSignals } from '../education-confidence.js';
import { parseDashSeparatedExperienceLine } from '../classification-fixes.js';

const BULLET_RE = /^[-•*]\s+/;

function normKey(exp) {
  return [
    String(exp?.role || '').toLowerCase(),
    String(exp?.company || '').toLowerCase(),
    String(exp?.startDate || exp?.dates || '').replace(/\D/g, '').slice(0, 8),
  ].join('|');
}

function mergeExperiences(existing, incoming) {
  const out = [...(existing || [])];
  const seen = new Set(out.map(normKey));
  for (const exp of incoming || []) {
    const key = normKey(exp);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(exp);
  }
  return out.slice(0, 32);
}

function buildExperienceFromParts({ role, company, dates, bullets = [], confidence }) {
  const r = String(role || '').trim();
  const c = String(company || '').trim();
  const d = dates || {};
  const hasRole = Boolean(r);
  const hasCompany = Boolean(c);
  const hasDate = Boolean(d.startDate || d.endDate);

  if (!hasDate) return null;
  if (!hasRole && !hasCompany) return null;
  if (hasRole && !hasCompany) return null;

  return {
    role: r,
    company: c,
    startDate: d.startDate || '',
    endDate: d.endDate || '',
    dates: formatDateRange(d),
    bullets: bullets.filter(Boolean).slice(0, 8),
    confidence: confidence ?? Math.min(0.95, 0.45 + [hasRole, hasCompany, hasDate].filter(Boolean).length * 0.18),
    source: UNIVERSAL_EXPERIENCE_RECONSTRUCTOR,
  };
}

function isEducationCareerLine(text) {
  const edu = getEducationLineSignals(String(text || ''));
  return edu.isEducationLine && /\b(licence|license|bachelor|master|mba|phd|bsc|ba|dnsep|university|université|école|ecole)\b/i.test(text);
}

function tryDashExperience(line) {
  const dash = parseDashSeparatedExperienceLine(line);
  if (!dash?.role || !dash?.company) return null;
  return {
    role: dash.role,
    company: dash.company,
    startDate: dash.startDate || '',
    endDate: dash.endDate || '',
    dates: dash.dates || '',
    bullets: [],
    confidence: 0.82,
    source: UNIVERSAL_EXPERIENCE_RECONSTRUCTOR,
  };
}

function reviewItemForLine(line, reason, confidence) {
  return normalizeReviewItem({
    field: 'experiences',
    detected: String(line || '').trim().slice(0, 200),
    reason: reason || 'Universal extraction — confirm experience',
    status: 'pending',
    confidence: confidence ?? 0.45,
    source: UNIVERSAL_EXPERIENCE_RECONSTRUCTOR,
  });
}

/**
 * @param {object[]} blocks — from CV_BLOCK_ENGINE
 * @param {string[]} [lines]
 */
export function reconstructExperiencesFromBlocks(blocks, lines = []) {
  const experiences = [];
  const reviewQueue = [];
  const consumed = new Set();

  for (const block of blocks || []) {
    const text = String(block?.text || '').trim();
    if (!text || isEducationCareerLine(text)) continue;

    const type = block.universalType || block.type;
    if (type !== CV_BLOCK_TYPES.EXPERIENCE && block.confidence < 0.45) continue;

    const dates = block.signals?.dates || detectDatesInText(text);
    const dashExp = tryDashExperience(text);
    if (dashExp) {
      experiences.push(dashExp);
      consumed.add(text);
      continue;
    }

    const roleHit = block.role?.role ? block.role : detectRoleInLine(text, { stripCompany: block.company?.company });
    const companyHit = block.company?.company
      ? block.company
      : detectCompanyInLine(text, { hasDate: Boolean(dates.startDate), hasRole: Boolean(roleHit.role) });

    const bullets = (block.lines || text.split('\n'))
      .map((l) => String(l || '').replace(BULLET_RE, '').trim())
      .filter((l) => l.length > 12 && BULLET_RE.test(String(l)) === false);

    const exp = buildExperienceFromParts({
      role: roleHit.role,
      company: companyHit.company,
      dates,
      bullets: bullets.length ? bullets : [],
      confidence: Math.min(roleHit.confidence, companyHit.confidence, dates.confidence || 0.5),
    });

    if (exp) {
      experiences.push(exp);
      consumed.add(text);
    } else if (roleHit.role && (dates.startDate || dates.endDate) && !companyHit.company) {
      reviewQueue.push(reviewItemForLine(text, 'Role and dates detected — confirm employer', 0.62));
    } else if (type === CV_BLOCK_TYPES.EXPERIENCE || dates.confidence >= 0.55) {
      reviewQueue.push(reviewItemForLine(text, 'Partial experience signals — confirm role, company, or dates'));
    }
  }

  // Line sweep — never discard career-like lines
  for (const line of lines || []) {
    const l = String(line || '').trim();
    if (!l || l.length < 8 || consumed.has(l) || isEducationCareerLine(l)) continue;

    const dashExp = tryDashExperience(l);
    if (dashExp) {
      experiences.push(dashExp);
      consumed.add(l);
      continue;
    }

    const dates = detectDatesInText(l);
    const role = detectRoleInLine(l);
    const company = detectCompanyInLine(l, { hasDate: Boolean(dates.startDate), hasRole: Boolean(role.role) });

    const exp = buildExperienceFromParts({ role: role.role, company: company.company, dates });
    if (exp && exp.confidence >= 0.55) {
      experiences.push(exp);
      consumed.add(l);
    } else if (role.role && (dates.startDate || dates.endDate) && !company.company) {
      reviewQueue.push(reviewItemForLine(l, 'Role and dates detected — confirm employer', 0.62));
    } else if (dates.confidence >= 0.6 || role.confidence >= 0.65 || company.confidence >= 0.65) {
      reviewQueue.push(reviewItemForLine(l, 'Career line retained for review'));
    }
  }

  return { experiences, reviewQueue };
}

/**
 * @param {object} structured
 * @param {string} rawText
 * @param {object} [opts]
 */
export function runUniversalExperienceReconstruction(structured, rawText, opts = {}) {
  const blocks = opts.universalBlocks || opts.blocks || [];
  const lines =
    opts.lines ||
    String(rawText || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

  const rebuilt = reconstructExperiencesFromBlocks(blocks, lines);
  const merged = mergeExperiences(structured?.experiences, rebuilt.experiences);

  const reviewQueue = mergeReviewQueues(structured?.reviewQueue, rebuilt.reviewQueue);

  const expected = Number(opts.expectedExperienceCount || 0);
  const recall =
    expected > 0 ? Math.min(1, merged.length / expected) : merged.length > 0 ? 1 : 0;

  hirelyDebugLog('UNIVERSAL_EXPERIENCE_RECONSTRUCTOR', {
    engine: UNIVERSAL_EXPERIENCE_RECONSTRUCTOR,
    recovered: rebuilt.experiences.length,
    merged: merged.length,
    queued: rebuilt.reviewQueue.length,
    recall,
  });

  return {
    engine: UNIVERSAL_EXPERIENCE_RECONSTRUCTOR,
    structured: {
      ...structured,
      experiences: merged,
      reviewQueue,
      metadata: {
        ...(structured?.metadata || {}),
        universalExtraction: {
          engine: UNIVERSAL_EXPERIENCE_RECONSTRUCTOR,
          recovered: rebuilt.experiences.length,
          mergedTotal: merged.length,
          reviewQueued: rebuilt.reviewQueue.length,
          recallGoal: UNIVERSAL_EXPERIENCE_RECALL_GOAL,
          recall,
        },
      },
    },
    reviewQueue: rebuilt.reviewQueue,
    stats: {
      recovered: rebuilt.experiences.length,
      merged: merged.length,
      queued: rebuilt.reviewQueue.length,
      recall,
    },
  };
}

export { UNIVERSAL_EXPERIENCE_RECALL_GOAL };
