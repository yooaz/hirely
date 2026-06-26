/**
 * CREATIVE_CV_MODE — creative portfolios are not corporate ATS CVs.
 *
 * When trigger roles are detected, creative sections (clients, projects, …)
 * take priority over generic experience/education ordering.
 */

import { CREATIVE_CV_TRIGGER_ROLES } from './creative-cv-roles.js';
import { SECTION_IDS } from './section-types-v2.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import {
  classifyCreativeLine,
  isCreativeJobLine,
  isCreativeNonExperienceLine,
  isCreativeClientEntityLine,
  isLikelyCreativeProjectLine,
  isPortfolioLinkLine,
  isAwardsLine,
  isExhibitionsLine,
  isPublicationsLine,
  detectCreativeParsingMode,
} from './creative-parsing-mode.js';

export const CREATIVE_CV_MODE = 'CREATIVE_CV_MODE';

export { CREATIVE_CV_TRIGGER_ROLES };

/**
 * Creative sections first — then ATS-style fields (not omitted, just lower priority).
 */
export const CREATIVE_SECTION_RENDER_ORDER = [
  'identity',
  'summary',
  'clients',
  'projects',
  'publications',
  'exhibitions',
  'awards',
  'portfolioLinks',
  'tools',
  'skills',
  'experiences',
  'education',
  'languages',
  'interests',
  'unsorted',
];

const CREATIVE_SECTION_IDS = [
  SECTION_IDS.CLIENTS,
  SECTION_IDS.PROJECTS,
  SECTION_IDS.PUBLICATIONS,
  SECTION_IDS.EXHIBITIONS,
  SECTION_IDS.AWARDS,
  SECTION_IDS.PORTFOLIO,
  SECTION_IDS.TOOLS,
];

/**
 * @param {string} text
 * @returns {string[]}
 */
export function detectCreativeCvTriggerRoles(text) {
  const hay = String(text || '');
  const found = [];
  for (const role of CREATIVE_CV_TRIGGER_ROLES) {
    const re = new RegExp(`\\b${role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(hay)) found.push(role);
  }
  return found;
}

/**
 * @param {string} text
 * @param {object} [opts]
 */
export function detectCreativeCvMode(text, opts = {}) {
  const hay = String(text || '');
  const lines = opts.lines || hay.split(/\r?\n/).filter(Boolean);
  const triggerRoles = detectCreativeCvTriggerRoles(hay);
  const legacy = detectCreativeParsingMode(hay, {
    ...opts,
    force: opts.force === true || triggerRoles.length > 0,
  });

  const active =
    opts.force === true || legacy.active === true || triggerRoles.length >= 1;

  return {
    ...legacy,
    active,
    mode: CREATIVE_CV_MODE,
    triggerRoles,
    targetRolesDetected: [...new Set([...triggerRoles, ...(legacy.targetRolesDetected || [])])],
    sectionRenderOrder: CREATIVE_SECTION_RENDER_ORDER,
    creativeSectionIds: CREATIVE_SECTION_IDS,
    preferCreativeSectionsFirst: true,
    avoidCorporateStructure: true,
  };
}

/**
 * @param {string} line
 * @returns {string|null} SECTION_IDS
 */
export function creativeLineToSectionId(line) {
  const hit = classifyCreativeLine(line);
  if (!hit?.bucket) return null;
  const map = {
    clients: SECTION_IDS.CLIENTS,
    projects: SECTION_IDS.PROJECTS,
    publications: SECTION_IDS.PUBLICATIONS,
    exhibitions: SECTION_IDS.EXHIBITIONS,
    awards: SECTION_IDS.AWARDS,
    portfolioLinks: SECTION_IDS.PORTFOLIO,
  };
  return map[hit.bucket] || null;
}

/**
 * Split experience-block lines into creative buckets vs real jobs.
 * @param {string[]} lines
 */
export function partitionLinesForCreativeMode(lines) {
  const jobs = [];
  const buckets = {
    [SECTION_IDS.CLIENTS]: [],
    [SECTION_IDS.PROJECTS]: [],
    [SECTION_IDS.PUBLICATIONS]: [],
    [SECTION_IDS.EXHIBITIONS]: [],
    [SECTION_IDS.AWARDS]: [],
    [SECTION_IDS.PORTFOLIO]: [],
  };

  for (const line of lines || []) {
    const l = String(line || '').trim();
    if (!l) continue;
    if (isCreativeJobLine(l)) {
      jobs.push(l);
      continue;
    }
    if (isCreativeNonExperienceLine(l) || !isCreativeJobLine(l)) {
      const sid =
        creativeLineToSectionId(l) ||
        (isCreativeClientEntityLine(l)
          ? SECTION_IDS.CLIENTS
          : isLikelyCreativeProjectLine(l)
            ? SECTION_IDS.PROJECTS
            : isPortfolioLinkLine(l)
              ? SECTION_IDS.PORTFOLIO
              : isAwardsLine(l)
                ? SECTION_IDS.AWARDS
                : isExhibitionsLine(l)
                  ? SECTION_IDS.EXHIBITIONS
                  : isPublicationsLine(l)
                    ? SECTION_IDS.PUBLICATIONS
                    : null);
      if (sid && buckets[sid]) {
        buckets[sid].push(l);
        continue;
      }
    }
    jobs.push(l);
  }

  return { jobs, buckets };
}

/**
 * Reroute misclassified lines in section blocks before field extraction.
 * @param {import('./section-types-v2.js').SectionBlockV2[]} blocks
 * @param {object} mode
 */
export function applyCreativeCvModeToSectionBlocks(blocks, mode) {
  if (!mode?.active) return blocks;
  const out = [];

  for (const block of blocks || []) {
    if (block.type !== SECTION_IDS.EXPERIENCE) {
      if (block.type === SECTION_IDS.UNKNOWN && /^interests?\b/i.test(block.headerLine || '')) {
        out.push({ ...block, type: SECTION_IDS.UNKNOWN, classifyReason: 'creative_interests_preserved' });
        continue;
      }
      out.push(block);
      continue;
    }

    const { jobs, buckets } = partitionLinesForCreativeMode(block.lines);
    if (jobs.length) {
      out.push({ ...block, lines: jobs, classifyReason: 'creative_jobs_only' });
    }
    for (const [sid, lines] of Object.entries(buckets)) {
      if (!lines.length) continue;
      out.push({
        id: `${block.id}_${sid}`,
        type: sid,
        lines,
        headerLine: null,
        startLine: block.startLine,
        endLine: block.endLine,
        detectedConfidence: 88,
        classifiedConfidence: 88,
        classifyReason: 'creative_cv_mode_reroute',
      });
    }
  }

  return out;
}

function pushUnique(arr, val) {
  const t = String(val || '').trim();
  if (!t) return;
  const k = t.toLowerCase();
  if (arr.some((x) => String(x).toLowerCase() === k)) return;
  arr.push(t);
}

/**
 * Post-extract: keep clients/projects out of experience objects; set render order.
 * @param {object} structured
 * @param {object} mode
 */
export function applyCreativeCvModeToStructured(structured, mode) {
  if (!mode?.active || !structured) return structured;

  const kept = [];
  for (const exp of structured.experiences || []) {
    const role = String(exp.role || '').trim();
    const company = String(exp.company || '').trim();
    const line = [role, company, exp.dates].filter(Boolean).join(' — ');

    if (!role && isCreativeClientEntityLine(company)) {
      pushUnique(structured.clients, company);
      continue;
    }
    if (isCreativeNonExperienceLine(line) && !isCreativeJobLine(line)) {
      const sid = creativeLineToSectionId(line);
      if (sid === SECTION_IDS.CLIENTS) pushUnique(structured.clients, company || role);
      else if (sid === SECTION_IDS.PROJECTS) pushUnique(structured.projects, role || company);
      else if (sid === SECTION_IDS.AWARDS) pushUnique(structured.awards, role || company);
      else if (sid === SECTION_IDS.EXHIBITIONS) pushUnique(structured.exhibitions, role || company);
      else if (sid === SECTION_IDS.PUBLICATIONS) pushUnique(structured.publications, role || company);
      else if (sid === SECTION_IDS.PORTFOLIO) pushUnique(structured.portfolioLinks, role || company);
      else pushUnique(structured.unsorted, line);
      continue;
    }
    kept.push(exp);
  }
  structured.experiences = kept;

  const reroutedUnsorted = [];
  for (const line of structured.unsorted || []) {
    const sid = creativeLineToSectionId(line);
    if (sid === SECTION_IDS.CLIENTS) pushUnique(structured.clients, line);
    else if (sid === SECTION_IDS.PROJECTS) pushUnique(structured.projects, line);
    else if (sid === SECTION_IDS.AWARDS) pushUnique(structured.awards, line);
    else if (sid === SECTION_IDS.EXHIBITIONS) pushUnique(structured.exhibitions, line);
    else if (sid === SECTION_IDS.PUBLICATIONS) pushUnique(structured.publications, line);
    else if (sid === SECTION_IDS.PORTFOLIO) pushUnique(structured.portfolioLinks, line);
    else reroutedUnsorted.push(line);
  }
  structured.unsorted = reroutedUnsorted;

  structured.metadata = {
    ...(structured.metadata || {}),
    creativeCvMode: mode,
    creativeParsingMode: true,
    sectionRenderOrder: CREATIVE_SECTION_RENDER_ORDER,
    avoidCorporateStructure: true,
  };

  hirelyDebugLog('CREATIVE_CV_MODE', {
    active: true,
    triggerRoles: mode.triggerRoles,
    clients: structured.clients?.length ?? 0,
    projects: structured.projects?.length ?? 0,
    experiences: structured.experiences?.length ?? 0,
  });

  return structured;
}
