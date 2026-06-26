/**
 * DESIGNER_CV_MODE — creative/design CVs are not corporate ATS CVs.
 * Detects designer roles and reweights parser confidence + ATS scoring toward
 * clients, projects, portfolio, awards, and exhibitions.
 */

import { hirelyDebugLog } from '../runtime/hirely-debug.js';

export const DESIGNER_CV_MODE = 'DESIGNER_CV_MODE';

/** P1 trigger roles — activates designer mode when any match. */
export const DESIGNER_MODE_TARGET_ROLES = Object.freeze([
  'Illustrator',
  'Graphic Designer',
  'Art Director',
  'Creative Director',
  'Motion Designer',
  'Brand Designer',
  'UI Designer',
]);

/** Creative sections that gain parser + scoring weight in designer mode. */
export const DESIGNER_PRIORITY_SECTIONS = Object.freeze([
  'clients',
  'projects',
  'portfolioLinks',
  'awards',
  'exhibitions',
]);

/** Parser confidence multipliers (section-sanity). */
export const DESIGNER_SECTION_WEIGHTS = Object.freeze({
  clients: 1.45,
  projects: 1.4,
  portfolioLinks: 1.5,
  portfolio: 1.5,
  awards: 1.35,
  exhibitions: 1.35,
  experiences: 0.88,
  education: 0.9,
});

/** ATS H8 — dampen corporate readiness; boost creative portfolio layer. */
export const DESIGNER_ATS_ADJUSTMENTS = Object.freeze({
  corporateReadinessFactor: 0.72,
  creativePortfolioBoost: 1.35,
  creativeSectionsMaxBonus: 12,
  experienceWeightFactor: 0.88,
  educationWeightFactor: 0.9,
});

const DESIGNER_ROLE_RE =
  /\b(illustrator|graphic\s+designer|art\s+director|creative\s+director|motion\s+designer|brand\s+designer|ui\s+designer)\b/i;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function matchesDesignerRole(hay, role) {
  const re = new RegExp(`\\b${role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  if (!re.test(hay)) return false;
  if (role !== 'Illustrator') return true;
  const header = hay.split(/\r?\n/).slice(0, 6).join('\n');
  if (/\b(graphic\s+illustrator|freelance\s+illustrator|senior\s+illustrator|illustrator\s*[&/,])\b/i.test(header)) {
    return true;
  }
  if (/\badobe\s+illustrator\b/i.test(hay) && !/\billustrator\b/i.test(header.replace(/\badobe\s+illustrator\b/gi, ''))) {
    return false;
  }
  return /\billustrator\b/i.test(header);
}

export function detectDesignerTriggerRoles(text) {
  const hay = String(text || '');
  const found = [];
  for (const role of DESIGNER_MODE_TARGET_ROLES) {
    if (matchesDesignerRole(hay, role)) found.push(role);
  }
  return found;
}

/**
 * @param {string} text
 * @param {object} [opts]
 */
export function detectDesignerCvMode(text, opts = {}) {
  const hay = String(text || '');
  const lines = opts.lines || hay.split(/\r?\n/).filter(Boolean);
  const triggerRoles = detectDesignerTriggerRoles(hay);
  const titleHay = [lines[0], lines[1], lines[2]].filter(Boolean).join(' ');
  const roleLineHit = DESIGNER_ROLE_RE.test(titleHay) || DESIGNER_ROLE_RE.test(hay.slice(0, 600));

  const active = opts.force === true || triggerRoles.length >= 1 || roleLineHit;

  const signals = [];
  if (triggerRoles.length) signals.push(`designer_roles:${triggerRoles.join(',')}`);
  if (roleLineHit && !triggerRoles.length) signals.push('designer_role_pattern');
  if (/\b(behance|dribbble|artstation|portfolio|clients?\s+including)\b/i.test(hay)) {
    signals.push('creative_portfolio_signals');
  }

  const mode = {
    active,
    mode: DESIGNER_CV_MODE,
    triggerRoles,
    targetRolesDetected: triggerRoles,
    prioritySections: DESIGNER_PRIORITY_SECTIONS,
    sectionWeights: DESIGNER_SECTION_WEIGHTS,
    atsAdjustments: DESIGNER_ATS_ADJUSTMENTS,
    deemphasizeCorporateAts: active,
    preferCreativeSectionsFirst: active,
    signals,
  };

  if (active) hirelyDebugLog('DESIGNER_CV_MODE', { triggerRoles, signals });
  return mode;
}

/**
 * @param {number} confidence
 * @param {string} sectionKey
 * @param {object|null} designerMode
 */
export function applyDesignerSectionWeight(confidence, sectionKey, designerMode) {
  const base = Number(confidence) || 0;
  if (!designerMode?.active) return base;
  const factor = DESIGNER_SECTION_WEIGHTS[sectionKey];
  if (!factor) return base;
  return Math.min(98, Math.round(base * factor));
}

/**
 * @param {object} p normalized cv profile
 */
export function designerCreativeSignalCount(p) {
  const clients = (p.clients || []).filter(Boolean).length;
  const projects = (p.projects || []).filter(Boolean).length;
  const portfolioLinks = (p.portfolioLinks || []).filter(Boolean).length;
  const awards = (p.awards || []).filter(Boolean).length;
  const exhibitions = (p.exhibitions || []).filter(Boolean).length;
  const portfolio = p.portfolio && /^https?:\/\//i.test(String(p.portfolio)) ? 1 : 0;
  return clients + projects + portfolioLinks + awards + exhibitions + portfolio;
}

/**
 * Score designer creative sections (clients, projects, portfolio, awards, exhibitions).
 * @param {object} p
 * @param {object} designerMode
 */
export function scoreDesignerCreativeSectionsH8(p, designerMode) {
  if (!designerMode?.active) {
    return { points: 0, reasons: [], skip: true };
  }

  const clients = (p.clients || []).filter(Boolean).length;
  const projects = (p.projects || []).filter(Boolean).length;
  const portfolioLinks = (p.portfolioLinks || []).filter(Boolean).length;
  const awards = (p.awards || []).filter(Boolean).length;
  const exhibitions = (p.exhibitions || []).filter(Boolean).length;
  const hasPortfolioUrl = !!(p.portfolio && /^https?:\/\//i.test(String(p.portfolio)));

  let pts = 0;
  const reasons = [];

  if (clients >= 1) {
    pts += clients >= 3 ? 4 : 2;
    reasons.push({ t: `${clients} client reference${clients === 1 ? '' : 's'}`, ok: 1 });
  }
  if (projects >= 1) {
    pts += projects >= 2 ? 3 : 2;
    reasons.push({ t: `${projects} project highlight${projects === 1 ? '' : 's'}`, ok: 1 });
  }
  if (portfolioLinks >= 1 || hasPortfolioUrl) {
    pts += 3;
    reasons.push({ t: 'Portfolio / social links present', ok: 1 });
  }
  if (awards >= 1) {
    pts += 2;
    reasons.push({ t: `${awards} award${awards === 1 ? '' : 's'}`, ok: 1 });
  }
  if (exhibitions >= 1) {
    pts += 2;
    reasons.push({ t: `${exhibitions} exhibition${exhibitions === 1 ? '' : 's'}`, ok: 1 });
  }

  const maxBonus = designerMode.atsAdjustments?.creativeSectionsMaxBonus || 12;
  const boost = designerMode.atsAdjustments?.creativePortfolioBoost || 1.35;
  pts = Math.min(maxBonus, Math.round(pts * boost));

  if (!pts) {
    reasons.push({ t: 'Add clients, projects, or portfolio links for designer profiles', ok: 0 });
  }

  return { points: pts, reasons, skip: pts === 0 && !reasons.some((r) => r.ok) };
}

/**
 * Apply designer mode adjustments to H8 ATS result (in-place safe copy).
 * @param {object} result
 * @param {object} designerMode
 * @param {object} p normalized cv
 */
export function applyDesignerAtsAdjustments(result, designerMode, p) {
  if (!designerMode?.active || !result || typeof result !== 'object') return result;

  const out = { ...result, designerMode: { ...designerMode } };
  const adj = designerMode.atsAdjustments || DESIGNER_ATS_ADJUSTMENTS;
  const breakdown = [...(out.breakdown || [])];

  const creative = scoreDesignerCreativeSectionsH8(p, designerMode);
  if (creative.points > 0) {
    const skills = breakdown.find((c) => c.id === 'skills');
    const summary = breakdown.find((c) => c.id === 'summary');
    const experience = breakdown.find((c) => c.id === 'experience');
    if (skills) skills.points = Math.min(skills.max, skills.points + Math.round(creative.points * 0.35));
    if (summary) summary.points = Math.min(summary.max, summary.points + Math.round(creative.points * 0.25));
    if (experience) experience.points = Math.min(experience.max, experience.points + Math.round(creative.points * 0.2));
    out.designerCreative = creative;
  }

  const exp = breakdown.find((c) => c.id === 'experience');
  const edu = breakdown.find((c) => c.id === 'education');
  if (exp && adj.experienceWeightFactor < 1) {
    exp.points = Math.round(exp.points * adj.experienceWeightFactor);
  }
  if (edu && adj.educationWeightFactor < 1) {
    edu.points = Math.round(edu.points * adj.educationWeightFactor);
  }

  out.breakdown = breakdown;
  const baseScore = breakdown.reduce((sum, c) => sum + (c.points || 0), 0);
  const penaltyTotal = Array.isArray(out.penalties)
    ? out.penalties.reduce((s, x) => s + (x.points || 0), 0)
    : 0;
  out.score = Math.max(0, Math.min(100, Math.round(baseScore - penaltyTotal)));
  out.total = out.score;

  if (out.atsReadiness?.score != null) {
    const dampened = Math.round(out.atsReadiness.score * adj.corporateReadinessFactor);
    out.atsReadiness = {
      ...out.atsReadiness,
      score: dampened,
      band: out.atsReadiness.band,
      designerDampened: true,
      corporateReadinessFactor: adj.corporateReadinessFactor,
    };
    if (out.scores) {
      out.scores = { ...out.scores, ats: dampened, readability: dampened };
    }
  }

  out.archetype = 'designer';
  out.profile = 'designer';
  out.deemphasizeCorporateAts = true;

  const signal = designerCreativeSignalCount(p);
  if (signal >= 3 && Array.isArray(out.strengths)) {
    out.strengths = [
      `Designer portfolio reach: ${signal} creative signals`,
      ...out.strengths.filter((s) => !/portfolio reach/i.test(s)),
    ].slice(0, 5);
  }

  return out;
}

/**
 * @param {object|null} data resumeData or structured
 */
export function resolveDesignerCvMode(data) {
  const meta = data?.metadata?.designerCvMode || data?.meta?.designerMode;
  if (meta && typeof meta.active === 'boolean') {
    return {
      ...meta,
      mode: DESIGNER_CV_MODE,
      prioritySections: DESIGNER_PRIORITY_SECTIONS,
    };
  }

  const parts = [
    data?.identity?.title,
    data?.summary,
    ...(data?.experiences || []).map((e) => [e.role, e.company].join(' ')),
    ...(data?.clients || []),
    ...(data?.projects || []),
    ...(data?.unsorted || []),
  ];
  return detectDesignerCvMode(parts.filter(Boolean).join('\n'));
}
