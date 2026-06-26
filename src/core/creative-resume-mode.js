/**
 * Creative Resume Mode — first-class sections for creative CVs (product + editor).
 */

import {
  CREATIVE_MODE_TARGET_ROLES,
  CREATIVE_FIRST_CLASS_SECTIONS,
  detectCreativeParsingMode,
  detectTargetCreativeRoles,
  isAwardsLine,
  isExhibitionsLine,
  isPublicationsLine,
  isPortfolioLinkLine,
  isCreativeClientEntityLine,
  isLikelyCreativeProjectLine,
} from './parsing/creative-parsing-mode.js';

export {
  CREATIVE_MODE_TARGET_ROLES,
  CREATIVE_FIRST_CLASS_SECTIONS,
  detectCreativeParsingMode,
  detectTargetCreativeRoles,
};

/** Block types enabled in creative studio (not folded into experience). */
export const CREATIVE_BLOCK_TYPES = [
  'summary',
  'client',
  'project',
  'exhibition',
  'award',
  'publication',
  'portfolio',
  'experience',
  'education',
  'tool',
  'language',
];

/** Smart Repair — prefer creative sections over experience. */
export const CREATIVE_SMART_REPAIR_TARGETS = [
  'client',
  'project',
  'exhibition',
  'award',
  'publication',
  'portfolio',
];

/**
 * @param {import('./resume-data.js').ResumeData} data
 */
export function resolveCreativeResumeMode(data) {
  const meta = data?.meta?.creativeMode;
  if (meta && typeof meta.active === 'boolean') {
    return {
      active: meta.active,
      targetRolesDetected: meta.targetRolesDetected || [],
      signals: meta.signals || [],
      sections: CREATIVE_FIRST_CLASS_SECTIONS,
    };
  }

  const parts = [
    data?.identity?.title,
    data?.identity?.name,
    data?.summary,
    ...(data?.experiences || []).map((e) => [e.role, e.company, e.dates].join(' ')),
    ...(data?.clients || []),
    ...(data?.projects || []),
    ...(data?.unsorted || []),
  ];
  const hay = parts.filter(Boolean).join('\n');
  const detected = detectCreativeParsingMode(hay, { lines: hay.split(/\r?\n/) });
  return {
    active: detected.active === true,
    targetRolesDetected: detected.targetRolesDetected || [],
    signals: detected.signals || [],
    sections: CREATIVE_FIRST_CLASS_SECTIONS,
  };
}

/**
 * @param {boolean} [creativeActive]
 * @returns {string[]}
 */
export function getStudioBlockTypes(creativeActive) {
  return creativeActive ? CREATIVE_BLOCK_TYPES : null;
}

/**
 * @param {boolean} [creativeActive]
 * @returns {string[]}
 */
export function getSmartRepairTargets(creativeActive) {
  return creativeActive ? CREATIVE_SMART_REPAIR_TARGETS : null;
}

function dedupeList(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const t = String(x || '').trim();
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/**
 * Move creative lines out of projects/unsorted into first-class sections (product SSOT).
 * @param {object} data resumeData-like
 */
export function reconcileCreativeSections(data) {
  const mode = resolveCreativeResumeMode(data);
  if (!mode.active) return data;

  const rd = { ...data };
  rd.awards = [...(rd.awards || [])];
  rd.exhibitions = [...(rd.exhibitions || [])];
  rd.publications = [...(rd.publications || [])];
  rd.portfolioLinks = [...(rd.portfolioLinks || [])];
  rd.clients = [...(rd.clients || [])];
  rd.projects = [...(rd.projects || [])];
  rd.unsorted = [...(rd.unsorted || [])];

  const moved = {
    awards: [],
    exhibitions: [],
    publications: [],
    portfolioLinks: [],
    clients: [],
    projects: [],
  };

  const routeLine = (line, opts = {}) => {
    const t = String(line || '').trim();
    if (!t || t.length < 2) return null;
    if (opts.fromProjects) return null;
    if (
      /^(awards?|exhibitions?|publications?|clients?|projects?|portfolio|experience|education|summary|skills?|tools?|languages?)$/i.test(
        t
      )
    ) {
      return null;
    }
    if (isPortfolioLinkLine(t)) {
      moved.portfolioLinks.push(t);
      return true;
    }
    if (isAwardsLine(t)) {
      moved.awards.push(t);
      return true;
    }
    if (isExhibitionsLine(t)) {
      moved.exhibitions.push(t);
      return true;
    }
    if (isPublicationsLine(t)) {
      moved.publications.push(t);
      return true;
    }
    if (isCreativeClientEntityLine(t)) {
      moved.clients.push(t);
      return true;
    }
    if (!opts.fromProjects && isLikelyCreativeProjectLine(t)) {
      moved.projects.push(t);
      return true;
    }
    return null;
  };

  const drain = (arr, opts = {}) => {
    const kept = [];
    for (const line of arr) {
      if (routeLine(line, opts) === true) continue;
      kept.push(line);
    }
    return kept;
  };

  rd.projects = drain(rd.projects, { fromProjects: true });
  rd.unsorted = drain(rd.unsorted);

  rd.awards.push(...moved.awards);
  rd.exhibitions.push(...moved.exhibitions);
  rd.publications.push(...moved.publications);
  rd.portfolioLinks.push(...moved.portfolioLinks);
  rd.clients.push(...moved.clients);
  rd.projects.push(...moved.projects);

  rd.awards = dedupeList(rd.awards);
  rd.exhibitions = dedupeList(rd.exhibitions);
  rd.publications = dedupeList(rd.publications);
  rd.portfolioLinks = dedupeList(rd.portfolioLinks);
  rd.clients = dedupeList(rd.clients);
  rd.projects = dedupeList(rd.projects);

  rd.meta = {
    ...(rd.meta || {}),
    creativeMode: {
      active: true,
      targetRolesDetected: mode.targetRolesDetected,
      signals: [...(mode.signals || []), 'creative_sections_reconciled'],
    },
  };
  return rd;
}
