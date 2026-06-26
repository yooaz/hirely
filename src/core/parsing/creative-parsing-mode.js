/**
 * Creative parsing mode — creative CVs are not corporate CVs.
 * Roles, clients, awards, exhibitions, publications, and portfolio links stay separate from experience.
 */

import { findLongestDictionaryTerm, CLIENT_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import { findCreativeEntitiesInText } from '../../data/dictionaries/creative/index.js';
import { LAYOUT_TYPES } from '../extraction/stages/layout-detection.js';
import { mustNeverBeExperience } from './education-confidence.js';
import {
  isDictionaryExperienceJobLine,
  lineIsCreativeRoleHeadline,
} from '../../data/dictionaries/json-dictionary-match.js';

const EXPERIENCE_DATE_RE =
  /\b(19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|now|aujourd'?hui|\d{4})\b|\b(19|20)\d{2}\b/i;

const PORTFOLIO_PROJECT_RE =
  /\b(project|portfolio piece|case study|campaign|poster|packaging|cover illustration|editorial illustration|personal work|selected work|key art|illustration series|motion campaign)\b/i;

import { CREATIVE_CV_TRIGGER_ROLES } from './creative-cv-roles.js';
import { CREATIVE_RECOVERY_CLIENT_ANCHORS } from './creative-recovery-constants.js';

/** Primary creative roles — activating dedicated parser mode (see CREATIVE_CV_MODE). */
export const CREATIVE_MODE_TARGET_ROLES = CREATIVE_CV_TRIGGER_ROLES;

/** Canonical creative job titles (detection). */
export const CREATIVE_ROLE_TERMS = [
  ...CREATIVE_MODE_TARGET_ROLES,
  'Product Designer',
  'Visual Designer',
  'Senior Designer',
  'Lead Designer',
];

/** First-class CV sections in creative mode (not folded into experience). */
export const CREATIVE_FIRST_CLASS_SECTIONS = [
  'clients',
  'projects',
  'exhibitions',
  'awards',
  'publications',
];

export const CREATIVE_BUCKET_TO_BLOCK_TYPE = {
  clients: 'clients',
  projects: 'projects',
  exhibitions: 'exhibitions',
  awards: 'awards',
  publications: 'publications',
  portfolioLinks: 'portfolio',
};

export const CREATIVE_ROLE_RE =
  /\b(illustrator|artist|photographer|graphic\s+designer|art\s+director|creative\s+director|motion\s+designer|brand\s+designer|product\s+designer|visual\s+designer|senior\s+designer|lead\s+designer|designer|graphiste|directeur\s+artistique|directeur\s+créatif|illustrateur|freelance\s+designer)\b/i;

/** Anchor client entities — never merge into experience as jobs. */
export const CREATIVE_CLIENT_ENTITIES = [...CREATIVE_RECOVERY_CLIENT_ANCHORS];

const AWARDS_RE =
  /\b(award|awards|winner|won|prize|prix|trophy|medal|gold\s+award|silver\s+award|bronze|clio|d&ad|dad|cannes\s+lions?|webby|effie|adc\s+award|type\s+directors?\s+club|tdc|red\s+dot|if\s+design|pentawards?)\b/i;

const PUBLICATIONS_RE =
  /\b(publication|publications|published|press|featured\s+in|magazine|editorial|article|interview|book\s+chapter|chapter\s+in|catalogue|catalog)\b/i;

const EXHIBITIONS_RE =
  /\b(exhibition|exhibitions|exhibited|gallery|galerie|museum|musée|biennale|solo\s+show|group\s+show|art\s+fair|salon|vernissage|installation)\b/i;

const PORTFOLIO_URL_RE =
  /https?:\/\/[^\s)]+|www\.[^\s)]+/i;

const PORTFOLIO_HOST_RE =
  /\b(behance\.net|dribbble\.com|artstation\.com|instagram\.com|foundation\.app|linkedin\.com\/in\/|vimeo\.com|cargo\.site|format\.com|adobe\.com\/portfolio|portfolio)\b/i;

export const CREATIVE_EXTRA_BUCKETS = [
  'awards',
  'exhibitions',
  'publications',
  'portfolioLinks',
];

/**
 * @param {string} line
 */
export function isPortfolioLinkLine(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  if (PORTFOLIO_URL_RE.test(l)) return true;
  if (PORTFOLIO_HOST_RE.test(l) && l.length < 200) return true;
  return false;
}

/**
 * @param {string} line
 */
export function isAwardsLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 220) return false;
  if (PUBLICATIONS_RE.test(l) && !/\b(award|prize|prix|clio|d&ad|cannes)\b/i.test(l)) return false;
  return AWARDS_RE.test(l);
}

/**
 * @param {string} line
 */
export function isExhibitionsLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 220) return false;
  return EXHIBITIONS_RE.test(l);
}

/**
 * @param {string} line
 */
export function isPublicationsLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 220) return false;
  return PUBLICATIONS_RE.test(l);
}

/**
 * Standalone brand / client entity (Nike, Adobe, …) — not a job line.
 * @param {string} line
 */
function hasJobDate(line) {
  return EXPERIENCE_DATE_RE.test(String(line || ''));
}

export function isLikelyCreativeProjectLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 140) return false;
  if (hasJobDate(l) && CREATIVE_ROLE_RE.test(l)) return false;
  return PORTFOLIO_PROJECT_RE.test(l) && !isDictionaryExperienceJobLine(l);
}

export function isCreativeClientEntityLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 120) return false;
  if (/\badobe\s+illustrator\b/i.test(l)) return false;
  if (/\badobe\s+(photoshop|indesign|premiere|creative\s+suite)\b/i.test(l)) return false;
  if (isLikelyCreativeProjectLine(l)) return false;
  if (isDictionaryExperienceJobLine(l)) return false;
  if (lineIsCreativeRoleHeadline(l)) return false;
  const term = findLongestDictionaryTerm(l, CLIENT_TERMS);
  if (!term) return false;
  const words = l.split(/[,;·|]/).map((w) => w.trim()).filter(Boolean);
  if (words.length <= 4 && !hasJobDate(l)) return true;
  if (words.length === 1) return true;
  if (l.includes(',') && words.every((w) => findLongestDictionaryTerm(w, CLIENT_TERMS))) return true;
  return false;
}

/**
 * @param {string} line
 */
export function isCreativeJobLine(line) {
  const l = String(line || '').trim();
  if (!l || mustNeverBeExperience(l)) return false;
  if (
    isPortfolioLinkLine(l) ||
    isAwardsLine(l) ||
    isExhibitionsLine(l) ||
    isPublicationsLine(l) ||
    isCreativeClientEntityLine(l)
  ) {
    return false;
  }
  return isDictionaryExperienceJobLine(l) || (CREATIVE_ROLE_RE.test(l) && hasJobDate(l));
}

/**
 * Must not be folded into experience[].
 * @param {string} line
 */
export function isCreativeNonExperienceLine(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  if (mustNeverBeExperience(l)) return true;
  if (isPortfolioLinkLine(l)) return true;
  if (isAwardsLine(l)) return true;
  if (isExhibitionsLine(l)) return true;
  if (isPublicationsLine(l)) return true;
  if (isCreativeClientEntityLine(l)) return true;
  if (isLikelyCreativeProjectLine(l) && !isCreativeJobLine(l)) return true;
  return false;
}

/**
 * @param {string} line
 * @returns {{ bucket: string, confidence: number, signals: string[], parserDebug?: object }|null}
 */
export function classifyCreativeLine(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 2) return null;

  if (isPortfolioLinkLine(l)) {
    return {
      bucket: 'portfolioLinks',
      confidence: 94,
      signals: ['creative_portfolio_link'],
      parserDebug: { classificationReason: 'creative_portfolio_link', matchedDictionary: null },
    };
  }
  if (isAwardsLine(l)) {
    return {
      bucket: 'awards',
      confidence: 90,
      signals: ['creative_awards'],
      parserDebug: { classificationReason: 'creative_awards', matchedDictionary: null },
    };
  }
  if (isExhibitionsLine(l)) {
    return {
      bucket: 'exhibitions',
      confidence: 88,
      signals: ['creative_exhibitions'],
      parserDebug: { classificationReason: 'creative_exhibitions', matchedDictionary: null },
    };
  }
  if (isPublicationsLine(l)) {
    return {
      bucket: 'publications',
      confidence: 88,
      signals: ['creative_publications'],
      parserDebug: { classificationReason: 'creative_publications', matchedDictionary: null },
    };
  }
  if (isLikelyCreativeProjectLine(l) && !isCreativeJobLine(l)) {
    return {
      bucket: 'projects',
      confidence: 86,
      signals: ['creative_project'],
      parserDebug: { classificationReason: 'creative_project', matchedDictionary: null },
    };
  }
  if (isCreativeClientEntityLine(l)) {
    const term = findLongestDictionaryTerm(l, CLIENT_TERMS);
    return {
      bucket: 'clients',
      confidence: 96,
      signals: ['creative_client_entity'],
      parserDebug: {
        classificationReason: 'creative_client_entity',
        matchedDictionary: 'clients',
        matchedTerm: term,
      },
    };
  }
  if (isCreativeJobLine(l)) {
    return null;
  }
  return null;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function detectTargetCreativeRoles(text) {
  const hay = String(text || '');
  return CREATIVE_MODE_TARGET_ROLES.filter((r) =>
    new RegExp(`\\b${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(hay)
  );
}

/**
 * @param {object} classifiedBlock
 * @returns {string|null}
 */
export function rerouteCreativeBlockType(classifiedBlock) {
  const text = String(classifiedBlock?.text || '').trim();
  if (!text) return null;
  const hit = classifyCreativeLine(text);
  if (hit?.bucket && CREATIVE_BUCKET_TO_BLOCK_TYPE[hit.bucket]) {
    return CREATIVE_BUCKET_TO_BLOCK_TYPE[hit.bucket];
  }
  if (classifiedBlock?.type === 'experience' && isCreativeNonExperienceLine(text) && !isCreativeJobLine(text)) {
    if (isLikelyCreativeProjectLine(text)) return 'projects';
    if (isCreativeClientEntityLine(text)) return 'clients';
    if (isPortfolioLinkLine(text)) return 'portfolio';
    if (isAwardsLine(text)) return 'awards';
    if (isExhibitionsLine(text)) return 'exhibitions';
    if (isPublicationsLine(text)) return 'publications';
  }
  return null;
}

/**
 * Reroute misclassified blocks when creative mode is active (P0 classified blocks).
 * @param {object[]} blocks
 * @param {boolean} [creativeModeActive]
 */
export function applyCreativeModeToClassifiedBlocks(blocks = [], creativeModeActive = true) {
  if (!creativeModeActive) return { blocks, rerouted: 0 };
  let rerouted = 0;
  const out = (blocks || []).map((block) => {
    const nextType = rerouteCreativeBlockType(block);
    if (!nextType || nextType === block.type) return block;
    rerouted += 1;
    return {
      ...block,
      type: nextType,
      bucket: nextType,
      signals: [...(block.signals || []), `creative_mode:${nextType}`],
      classificationReason: 'creative_mode_reroute',
    };
  });
  return { blocks: out, rerouted, creativeMode: true };
}

/**
 * @param {string} text
 * @param {object} [opts]
 */
export function detectCreativeParsingMode(text, opts = {}) {
  const hay = String(text || '');
  const lines = opts.lines || hay.split('\n').filter(Boolean);
  const signals = [];
  let score = 0;

  const targetRoles = detectTargetCreativeRoles(hay);
  const rolesFound = CREATIVE_ROLE_TERMS.filter((r) =>
    new RegExp(`\\b${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(hay)
  );
  if (targetRoles.length) {
    score += 30 + targetRoles.length * 10;
    signals.push(`target_roles:${targetRoles.join(',')}`);
  } else if (rolesFound.length) {
    score += 25 + rolesFound.length * 8;
    signals.push(`roles:${rolesFound.length}`);
  } else if (CREATIVE_ROLE_RE.test(hay)) {
    score += 20;
    signals.push('creative_role_re');
  }

  const entities = findCreativeEntitiesInText(hay);
  if (entities.length >= 2) {
    score += 15 + Math.min(20, entities.length * 3);
    signals.push(`entities:${entities.length}`);
  }

  const anchorClients = CREATIVE_CLIENT_ENTITIES.filter((c) =>
    new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(hay)
  );
  if (anchorClients.length) {
    score += anchorClients.length * 6;
    signals.push(`clients:${anchorClients.join(',')}`);
  }

  if (opts.layoutType === LAYOUT_TYPES.CREATIVE_PORTFOLIO) {
    score += 22;
    signals.push('layout_creative_portfolio');
  }

  if (/\b(awards?|exhibitions?|publications?|selected\s+clients|portfolio)\b/i.test(hay)) {
    score += 12;
    signals.push('creative_sections');
  }

  for (const line of lines.slice(0, 80)) {
    if (isAwardsLine(line) || isExhibitionsLine(line) || isPublicationsLine(line)) {
      score += 5;
      break;
    }
  }

  const active =
    opts.force === true || score >= 35 || targetRoles.length >= 1 || rolesFound.length >= 1;

  return {
    active,
    score: Math.min(100, score),
    signals,
    mode: 'creative',
    targetRolesDetected: targetRoles,
    rolesDetected: rolesFound,
    firstClassSections: CREATIVE_FIRST_CLASS_SECTIONS,
    anchorClientsFound: anchorClients,
    entityCount: entities.length,
  };
}

/**
 * Reroute creative buckets out of experience (and skills when mis-filed).
 * @param {object} blocks
 * @param {boolean} [creativeModeActive]
 */
export function applyCreativeParsingPass(blocks, creativeModeActive = true) {
  const out = { ...blocks };
  for (const key of CREATIVE_EXTRA_BUCKETS) {
    out[key] = [...(out[key] || [])];
  }
  out.clients = [...(out.clients || [])];
  out.projects = [...(out.projects || [])];

  if (!creativeModeActive) {
    return { blocks: out, rerouted: 0 };
  }

  let rerouted = 0;
  const pullFrom = ['experience', 'skills', 'summary', 'unsorted', 'top'];

  for (const sourceKey of pullFrom) {
    const kept = [];
    for (const line of out[sourceKey] || []) {
      const l = String(line || '').trim();
      if (!l) continue;
      const hit = classifyCreativeLine(l);
      if (hit && hit.bucket !== 'experience') {
        out[hit.bucket] = out[hit.bucket] || [];
        out[hit.bucket].push(l);
        rerouted += 1;
        continue;
      }
      if (sourceKey === 'experience' && isCreativeNonExperienceLine(l)) {
        if (isLikelyCreativeProjectLine(l)) {
          out.projects.push(l);
        } else if (isCreativeClientEntityLine(l)) {
          out.clients.push(l);
        } else if (isPortfolioLinkLine(l)) {
          out.portfolioLinks.push(l);
        } else if (isAwardsLine(l)) {
          out.awards.push(l);
        } else if (isExhibitionsLine(l)) {
          out.exhibitions.push(l);
        } else if (isPublicationsLine(l)) {
          out.publications.push(l);
        } else {
          out.unsorted = out.unsorted || [];
          out.unsorted.push(l);
        }
        rerouted += 1;
        continue;
      }
      kept.push(line);
    }
    out[sourceKey] = kept;
  }

  return { blocks: out, rerouted, creativeMode: true };
}
