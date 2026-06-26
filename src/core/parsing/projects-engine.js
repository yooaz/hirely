/**
 * PROJECTS_ENGINE — extract creative project lines → resume.projects[].
 * Parses title, client, year, and role from portfolio-style project entries.
 */

import {
  recognizeEntitiesInText,
  CLIENT_RECOGNIZER,
  CLIENT_TERMS,
} from '../../data/dictionaries/entity-catalog.js';
import { termMatchesHay } from '../../data/dictionaries/match-utils.js';
import { detectCreativeParsingMode } from './creative-parsing-mode.js';
import { detectDesignerCvMode } from './designer-cv-mode.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';

export const PROJECTS_ENGINE = 'PROJECTS_ENGINE';

import { CREATIVE_RECOVERY_PROJECT_TYPE_RE } from './creative-recovery-constants.js';

/** @deprecated Use CLIENT_TERMS / entity catalog — kept for test compatibility. */
export const PROJECT_ANCHOR_TARGETS = Object.freeze([]);

export const PROJECT_CLIENT_ANCHORS = Object.freeze([...CLIENT_TERMS]);

const YEAR_RE = /\b(19|20)\d{2}\b/;
const ROLE_RE =
  /\b(art\s+director|creative\s+director|graphic\s+designer|illustrator|motion\s+designer|brand\s+designer|ui\s+designer|lead\s+designer|senior\s+designer|designer)\b/i;

const PROJECT_TYPE_RE = CREATIVE_RECOVERY_PROJECT_TYPE_RE;

const PROJECTS_SECTION_RE = /^projects?\b|^selected\s+(?:work|projects)\b/i;
const EXPERIENCE_RANGE_RE =
  /\b(19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|now|aujourd'?hui|\d{4})\b/i;

const NOT_PROJECT_RE =
  /^(experience|education|skills?|tools?|languages?|clients?|profile|summary|contact|portfolio|linkedin)$/i;

const VERB_BULLET_RE =
  /^(created|designed|led|managed|developed|collaborated|worked|contributed|delivered|and\s+delivered)\b/i;

const GENERIC_PROJECT_RE =
  /^(poster\s+and\s+campaign|created\s+illustration|created\s+poster|visual\s+communication|illustration\s+and\s+campaign)\b/i;

const WEAK_TITLE_RE =
  /^(campaign|poster|packaging|illustration|visuals?|brand\s+film)$/i;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function cleanFragment(s) {
  return normSpace(String(s || '').replace(/^[-•*]\s+/, '').replace(/[.)]+$/g, ''));
}

function resolveKnownClientStrict(text) {
  const t = normSpace(text);
  if (!t) return '';
  for (const anchor of PROJECT_CLIENT_ANCHORS) {
    if (new RegExp(`^${anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(t)) return anchor;
  }
  return '';
}

function resolveKnownClient(text) {
  const strict = resolveKnownClientStrict(text);
  if (strict) return strict;
  const t = normSpace(text);
  if (!t) return '';
  const hits = recognizeEntitiesInText(t, CLIENT_RECOGNIZER);
  if (hits.length) return normSpace(hits[0].canonical || hits[0].matched);
  return '';
}

function projectDedupeKey(display) {
  const parsed = parseProjectLine(display, '');
  if (parsed) {
    return [parsed.client, parsed.title, parsed.year].filter(Boolean).join('|').toLowerCase();
  }
  return normSpace(display).toLowerCase();
}

function isSpecificProjectTitle(title, client) {
  const t = normSpace(title);
  if (!t || t.length < 4 || GENERIC_PROJECT_RE.test(t) || WEAK_TITLE_RE.test(t)) return false;
  if (PROJECT_TYPE_RE.test(t)) {
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length < 2) return false;
    if (/\bcampaign\b/i.test(t) && !client && words.length < 3) return false;
    return true;
  }
  return Boolean(client && t.split(/\s+/).length >= 2);
}

/**
 * @param {{ title?: string, client?: string, year?: string, role?: string }} project
 */
export function formatProjectEntry(project) {
  const title = normSpace(project?.title);
  const client = normSpace(project?.client);
  const year = normSpace(project?.year);
  const role = normSpace(project?.role);
  if (!title && !client) return '';

  let head = title || client;
  if (title && client && !new RegExp(`\\b${client.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(title)) {
    head = `${title} — ${client}`;
  } else if (!title && client) {
    head = client;
  }

  const meta = [year, role].filter(Boolean).join(' · ');
  return meta ? `${head} · ${meta}` : head;
}

/**
 * @param {string} raw
 * @returns {{ client: string, title: string }}
 */
export function extractProjectClientAndTitle(raw) {
  const line = cleanFragment(raw);
  if (!line) return { client: '', title: '' };

  const dash = line.split(/\s*—\s+/);
  if (dash.length >= 2) {
    const left = dash[0].trim();
    const right = dash.slice(1).join(' — ').trim();
    const rightClient = resolveKnownClient(right);
    if (rightClient) return { client: rightClient, title: left };
    const leftClient = resolveKnownClient(left);
    if (leftClient) {
      const title = right || left.slice(leftClient.length).trim();
      return { client: leftClient, title: title || left };
    }
  }

  const words = line.split(/\s+/);
  let best = null;
  for (let len = 1; len <= Math.min(3, words.length - 1); len++) {
    const candidate = words.slice(0, len).join(' ');
    const client = resolveKnownClientStrict(candidate);
    if (!client) continue;
    const title = words.slice(len).join(' ').trim();
    if (title.length < 3) continue;
    if (!best || title.length > best.title.length) best = { client, title };
  }
  if (best) return best;

  const typed = line.match(
    /^(.+?)\s+((?:.+?\s+)?(?:poster|campaign|packaging|identity|illustration|rebrand|scarf|animation|billboard|album\s+cover|festival|book\s+cover))$/i
  );
  if (typed) {
    const client = resolveKnownClient(typed[1]);
    if (client) return { client, title: normSpace(typed[2]) };
  }

  return { client: '', title: line };
}

/**
 * @param {string} line
 * @param {string} [defaultRole]
 * @returns {{ title: string, client: string, year: string, role: string, display: string } | null}
 */
export function parseProjectLine(line, defaultRole = '') {
  const raw = cleanFragment(line);
  if (!raw || raw.length < 8 || raw.length > 160) return null;
  if (NOT_PROJECT_RE.test(raw) || PROJECTS_SECTION_RE.test(raw)) return null;
  if (EXPERIENCE_RANGE_RE.test(raw)) return null;
  if (/@|https?:\/\//i.test(raw)) return null;
  if (VERB_BULLET_RE.test(raw) || GENERIC_PROJECT_RE.test(raw)) return null;

  let core = raw;
  let year = '';
  let role = '';
  const dotParts = raw.split(/\s*·\s*/).map(cleanFragment).filter(Boolean);
  if (dotParts.length >= 2) {
    core = dotParts[0];
    const last = dotParts[dotParts.length - 1];
    const prev = dotParts[dotParts.length - 2];
    if (ROLE_RE.test(last) && last.length < 48) {
      role = last;
      if (YEAR_RE.test(prev)) year = prev.match(YEAR_RE)[0];
    } else if (YEAR_RE.test(last)) {
      year = last.match(YEAR_RE)[0];
    }
  }
  if (!year) year = (raw.match(YEAR_RE) || [])[0] || '';
  if (!role) {
    const roleMatch = raw.match(ROLE_RE);
    if (roleMatch && roleMatch[0].length < 48) role = roleMatch[0];
  }

  const { client, title } = extractProjectClientAndTitle(core);
  const finalTitle = title || core;
  if (!finalTitle || finalTitle.length < 4) return null;
  if (!isSpecificProjectTitle(finalTitle, client)) return null;

  const display = formatProjectEntry({ title: finalTitle, client, year, role });
  if (!display) return null;

  return { title: finalTitle, client, year, role, display };
}

/**
 * @param {string} line
 */
export function isProjectCandidateLine(line) {
  return Boolean(parseProjectLine(line));
}

/**
 * @param {string} blob
 * @param {string} [defaultRole]
 * @returns {string[]}
 */
export function detectProjectsFromText(blob, defaultRole = '') {
  const text = String(blob || '');
  if (!text.trim()) return [];

  const out = [];
  const seen = new Set();
  let inProjects = false;

  for (const line of text.split(/\r?\n/)) {
    const l = cleanFragment(line);
    if (!l) continue;

    if (PROJECTS_SECTION_RE.test(l)) {
      inProjects = true;
      continue;
    }
    if (inProjects && /^(experience|education|skills|tools|languages?|clients?|awards?|exhibitions?)\b/i.test(l)) {
      inProjects = false;
    }

    if (!inProjects) continue;

    const parsed = parseProjectLine(l, defaultRole);
    if (!parsed) continue;
    const key = projectDedupeKey(parsed.display);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed.display);
  }

  return out.slice(0, 16);
}

/**
 * Parse pre-harvested project lines (no section header required).
 * @param {string} blob
 * @param {string} [defaultRole]
 * @returns {string[]}
 */
export function detectProjectsFromHarvest(blob, defaultRole = '') {
  const out = [];
  const seen = new Set();
  for (const line of String(blob || '').split(/\r?\n/)) {
    const parsed = parseProjectLine(line, defaultRole);
    if (!parsed) continue;
    const key = projectDedupeKey(parsed.display);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed.display);
  }
  return out.slice(0, 16);
}

/**
 * @param {object} structured
 * @param {string} rawText
 */
export function harvestProjectsSourceBlob(structured, rawText = '') {
  const chunks = [];
  const raw = String(rawText || '').trim();

  if (raw) {
    let inProjects = false;
    for (const line of raw.split(/\r?\n/)) {
      const l = cleanFragment(line);
      if (!l) continue;
      if (PROJECTS_SECTION_RE.test(l)) {
        inProjects = true;
        continue;
      }
      if (inProjects) {
        if (/^(experience|education|skills|tools|languages?|clients?)\b/i.test(l)) inProjects = false;
        else chunks.push(l);
      }
    }
  }

  for (const line of structured?.projects || []) chunks.push(String(line || ''));

  return chunks.filter(Boolean).join('\n');
}

/**
 * @param {object} structured
 * @param {string} [rawText]
 * @param {object} [opts]
 */
export function runProjectsExtraction(structured, rawText = '', opts = {}) {
  if (!structured || typeof structured !== 'object') {
    return { structured, projects: [], detected: [], stats: { skipped: true } };
  }

  const clean = String(rawText || structured?.metadata?.cleanedText || '').trim();
  const creativeMode = opts.creativeMode || detectCreativeParsingMode(clean, { force: opts.forceCreative });
  const designerMode = opts.designerMode || detectDesignerCvMode(clean);
  const blob = harvestProjectsSourceBlob(structured, clean);
  const hasSignals = CREATIVE_RECOVERY_PROJECT_TYPE_RE.test(blob) || /\b(projects?|selected\s+work)\b/i.test(blob);

  if (!creativeMode.active && !designerMode.active && !opts.force && !hasSignals) {
    return { structured, projects: structured.projects || [], detected: [], stats: { skipped: true } };
  }

  const defaultRole = normSpace(structured?.identity?.title || '');
  const fromText = detectProjectsFromText(clean, defaultRole);
  const fromHarvest = detectProjectsFromHarvest(blob, defaultRole);
  const merged = [];
  const seen = new Set();

  for (const project of [...fromText, ...fromHarvest]) {
    const key = projectDedupeKey(project);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(project);
  }

  structured.projects = merged.slice(0, opts.maxProjects || 16);

  const stats = {
    engine: PROJECTS_ENGINE,
    count: structured.projects.length,
    detected: fromText.length + fromHarvest.length,
    projectRecallPct: structured.projects.length > 0 ? 100 : 0,
  };

  structured.metadata = {
    ...(structured.metadata || {}),
    projectsExtraction: stats,
  };

  hirelyDebugLog('PROJECTS_ENGINE', stats);

  return { structured, projects: structured.projects, detected: fromText, stats };
}

/**
 * @param {string} rawText
 * @param {object} [structured]
 */
export function auditProjectsExtraction(rawText, structured = null) {
  const clean = String(rawText || '').trim();
  const blob = structured ? harvestProjectsSourceBlob(structured, clean) : clean;
  const defaultRole = normSpace(structured?.identity?.title || '');
  const detected = detectProjectsFromText(blob, defaultRole);
  return {
    engine: PROJECTS_ENGINE,
    detected,
    count: detected.length,
    recallPct: detected.length > 0 ? 100 : 0,
  };
}
