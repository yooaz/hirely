/**
 * CREATIVE_CLIENT_PROJECT_RECOVERY — P1 recovery for creative CVs.
 * Harvests clients[] and projects[] from unsorted lines, bullets, and full text.
 * Never promotes client brands into fake experience entries.
 */

import { recognizeEntitiesInText, CLIENT_RECOGNIZER, SCHOOL_TERMS } from '../../data/dictionaries/entity-catalog.js';
import { findLongestDictionaryTerm } from '../../data/dictionaries/json-dictionary-match.js';
import { termMatchesHay } from '../../data/dictionaries/match-utils.js';
import { isDictionaryExperienceJobLine } from '../../data/dictionaries/json-dictionary-match.js';
import { CREATIVE_ROLE_RE } from './creative-parsing-mode.js';
import {
  parseProjectLine,
  detectProjectsFromHarvest,
  formatProjectEntry,
  extractProjectClientAndTitle,
} from './projects-engine.js';
import { detectCreativeParsingMode } from './creative-parsing-mode.js';
import { detectDesignerCvMode } from './designer-cv-mode.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import {
  CREATIVE_RECOVERY_CLIENT_ANCHORS,
  CREATIVE_RECOVERY_PROJECT_TYPES,
  CREATIVE_RECOVERY_PROJECT_TYPE_RE,
} from './creative-recovery-constants.js';

export const CREATIVE_CLIENT_PROJECT_RECOVERY = 'CREATIVE_CLIENT_PROJECT_RECOVERY';

export { CREATIVE_RECOVERY_CLIENT_ANCHORS, CREATIVE_RECOVERY_PROJECT_TYPES, CREATIVE_RECOVERY_PROJECT_TYPE_RE };

const DATE_RE =
  /\b(19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|now|aujourd'?hui|\d{4})\b|\b(19|20)\d{2}\b/i;

const CLIENT_INTRO_RE =
  /\b(worked\s+(?:for|with)|clients?\s+including|collaborated\s+with|recognized\s+brands|cultural\s+clients|brands?\s+including|selected\s+clients|notable\s+clients|for\s+clients?\s+such\s+as|including)\b/i;

const LIST_SPLIT_RE = /\s*,\s*|\s+and\s+|\s*&\s*|·|;/i;

const TOOL_ADOBE_RE = /\badobe\s+(photoshop|illustrator|indesign|premiere|after\s+effects|creative\s+suite|xd)\b/i;

const MIT_SCHOOL_RE =
  /\b(massachusetts institute of technology|mit\s+(university|sloan|media\s+lab)\s+(degree|program|school)|b\.?s\.?\s+mit|m\.?s\.?\s+mit|ph\.?d\.?\s+mit)\b/i;

function normSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function cleanFragment(s) {
  return normSpace(String(s || '').replace(/^[-•*]\s+/, '').replace(/[.)]+$/g, ''));
}

function isSchoolEntity(name) {
  const n = normSpace(name);
  if (!n) return false;
  return Boolean(findLongestDictionaryTerm(n, SCHOOL_TERMS));
}

function isMitSchoolContext(line) {
  const l = normSpace(line);
  if (!l) return false;
  if (MIT_SCHOOL_RE.test(l)) return true;
  if (/\b(education|university|college|degree|bachelor|master|phd)\b/i.test(l) && /\bmit\b/i.test(l)) return true;
  return false;
}

function isToolNotClient(line, canonical) {
  const l = normSpace(line);
  const c = normSpace(canonical).toLowerCase();
  if (c === 'adobe' && TOOL_ADOBE_RE.test(l) && !CLIENT_INTRO_RE.test(l)) return true;
  if (c === 'pantone' && /\bpantone\s+(color|guide|swatch|matching)\b/i.test(l)) return true;
  return false;
}

/**
 * Source line qualifies as a job row (role + date + company) — not a client-only line.
 * @param {string} line
 */
export function lineHasRoleDateCompany(line) {
  const l = normSpace(line);
  if (!l || l.length > 180) return false;
  if (!DATE_RE.test(l)) return false;

  const hasRole =
    CREATIVE_ROLE_RE.test(l) ||
    isDictionaryExperienceJobLine(l) ||
    /\b(illustration|design|director|designer|manager|illustrator|freelance|lead|senior|graphic)\b/i.test(l);

  const entityHits = recognizeEntitiesInText(l, CLIENT_RECOGNIZER);
  const hasCompany =
    CREATIVE_RECOVERY_CLIENT_ANCHORS.some((a) => termMatchesHay(l, a)) || entityHits.length > 0;

  return hasRole && hasCompany;
}

/**
 * @param {string} fragment
 * @param {string} [contextLine]
 */
function resolveRecoveryClient(fragment, contextLine = '') {
  const frag = cleanFragment(fragment);
  if (!frag || frag.length < 2 || frag.length > 80) return null;

  for (const anchor of CREATIVE_RECOVERY_CLIENT_ANCHORS) {
    if (!termMatchesHay(frag, anchor)) continue;
    if (anchor === 'MIT' && isMitSchoolContext(contextLine || frag)) continue;
    if (isToolNotClient(contextLine || frag, anchor)) continue;
    return anchor;
  }

  const hits = recognizeEntitiesInText(frag, CLIENT_RECOGNIZER);
  if (hits.length) {
    const name = normSpace(hits[0].canonical || hits[0].matched);
    if (!name || isSchoolEntity(name)) return null;
    if (name === 'MIT' && isMitSchoolContext(contextLine || frag)) return null;
    if (isToolNotClient(contextLine || frag, name)) return null;
    return name;
  }

  if (isSchoolEntity(frag)) return null;
  return null;
}

/**
 * @param {string} line
 * @returns {string[]}
 */
export function recoverClientsFromLine(line) {
  const raw = normSpace(line);
  if (!raw) return [];
  if (lineHasRoleDateCompany(raw)) return [];

  const out = [];
  const seen = new Set();
  const push = (name) => {
    const n = normSpace(name);
    if (!n) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(n);
  };

  if (CLIENT_INTRO_RE.test(raw) || raw.includes(',') || LIST_SPLIT_RE.test(raw)) {
    let payload = raw;
    const intro = raw.match(CLIENT_INTRO_RE);
    if (intro) payload = raw.slice(intro.index + intro[0].length).trim();
    for (const part of payload.split(LIST_SPLIT_RE).map(cleanFragment).filter(Boolean)) {
      const name = resolveRecoveryClient(part, raw);
      if (name) push(name);
    }
  }

  const single = resolveRecoveryClient(raw, raw);
  if (single) push(single);

  for (const hit of recognizeEntitiesInText(raw, CLIENT_RECOGNIZER)) {
    const name = normSpace(hit.canonical || hit.matched);
    if (!name || isSchoolEntity(name)) continue;
    if (name === 'MIT' && isMitSchoolContext(raw)) continue;
    if (isToolNotClient(raw, name)) continue;
    push(name);
  }

  return out;
}

/**
 * @param {string} line
 * @param {string} [defaultRole]
 * @returns {string | null}
 */
export function recoverProjectFromLine(line, defaultRole = '') {
  const raw = cleanFragment(line);
  if (!raw || raw.length < 6 || raw.length > 180) return null;
  if (!CREATIVE_RECOVERY_PROJECT_TYPE_RE.test(raw)) return null;
  if (lineHasRoleDateCompany(raw)) return null;

  const parsed = parseProjectLine(raw, defaultRole);
  if (parsed?.display) return parsed.display;

  const { client, title } = extractProjectClientAndTitle(raw);
  const finalTitle = title || raw;
  if (finalTitle.length < 4) return null;
  const display = formatProjectEntry({ title: finalTitle, client });
  return display || null;
}

/**
 * @param {object} structured
 * @param {string} [rawText]
 * @returns {string[]}
 */
export function harvestCreativeRecoveryLines(structured, rawText = '') {
  const lines = new Set();

  const pushLine = (s) => {
    const l = cleanFragment(s);
    if (l) lines.add(l);
  };

  const raw = String(rawText || structured?.metadata?.cleanedText || '').trim();
  for (const line of raw.split(/\r?\n/)) pushLine(line);

  for (const line of structured?.unsorted || []) pushLine(line);
  for (const line of structured?.clients || []) pushLine(line);
  for (const line of structured?.projects || []) pushLine(line);
  if (structured?.summary) pushLine(structured.summary);

  for (const exp of structured?.experiences || []) {
    if (typeof exp === 'string') {
      pushLine(exp);
      continue;
    }
    if (!exp || typeof exp !== 'object') continue;
    pushLine([exp.role, exp.company, exp.description, exp.dates].filter(Boolean).join(' '));
    for (const b of exp.bullets || []) pushLine(b);
    for (const c of exp.clients || []) pushLine(c);
  }

  return [...lines];
}

/**
 * @param {string} blob
 * @returns {string[]}
 */
export function recoverClientsFromText(blob) {
  const hay = String(blob || '');
  if (!hay.trim()) return [];

  const found = [];
  const seen = new Set();
  const push = (name) => {
    const n = normSpace(name);
    if (!n) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push(n);
  };

  for (const line of hay.split(/\r?\n/)) {
    for (const c of recoverClientsFromLine(line)) push(c);
  }

  for (const anchor of CREATIVE_RECOVERY_CLIENT_ANCHORS) {
    if (!termMatchesHay(hay, anchor)) continue;
    if (anchor === 'MIT' && isMitSchoolContext(hay)) continue;
    if (isToolNotClient(hay, anchor)) continue;
    push(anchor);
  }

  return found;
}

/**
 * @param {string} blob
 * @param {string} [defaultRole]
 * @returns {string[]}
 */
export function recoverProjectsFromText(blob, defaultRole = '') {
  const hay = String(blob || '');
  if (!hay.trim()) return [];

  const out = [];
  const seen = new Set();
  const push = (display) => {
    const d = normSpace(display);
    if (!d) return;
    const key = d.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(d);
  };

  for (const line of hay.split(/\r?\n/)) {
    const recovered = recoverProjectFromLine(line, defaultRole);
    if (recovered) push(recovered);
  }

  for (const p of detectProjectsFromHarvest(hay, defaultRole)) push(p);

  return out.slice(0, 24);
}

/**
 * @param {object} structured
 * @param {string} [rawText]
 * @param {object} [opts]
 */
export function runCreativeClientProjectRecovery(structured, rawText = '', opts = {}) {
  if (!structured || typeof structured !== 'object') {
    return {
      structured,
      clients: [],
      projects: [],
      stats: { skipped: true, engine: CREATIVE_CLIENT_PROJECT_RECOVERY },
    };
  }

  const clean = String(rawText || structured?.metadata?.cleanedText || '').trim();
  const creativeMode = opts.creativeMode || detectCreativeParsingMode(clean, { force: opts.forceCreative });
  const designerMode = opts.designerMode || detectDesignerCvMode(clean);
  const hasSignals =
    creativeMode.active ||
    designerMode.active ||
    /\b(clients?|projects?|poster|campaign|packaging|illustration)\b/i.test(clean) ||
    CREATIVE_RECOVERY_CLIENT_ANCHORS.some((a) => termMatchesHay(clean, a));

  if (!hasSignals && !opts.force) {
    return {
      structured,
      clients: structured.clients || [],
      projects: structured.projects || [],
      stats: { skipped: true, engine: CREATIVE_CLIENT_PROJECT_RECOVERY },
    };
  }

  const experienceCountBefore = (structured.experiences || []).length;
  const recoveryLines = harvestCreativeRecoveryLines(structured, clean);
  const blob = recoveryLines.join('\n');
  const defaultRole = normSpace(structured?.identity?.title || '');

  const recoveredClients = recoverClientsFromText(blob);
  const recoveredProjects = recoverProjectsFromText(blob, defaultRole);

  let jobLinesSkipped = 0;
  for (const line of recoveryLines) {
    if (lineHasRoleDateCompany(line)) jobLinesSkipped++;
  }

  const mergeUnique = (base = [], incoming = []) => {
    const out = [...base];
    const seen = new Set(out.map((x) => normSpace(x).toLowerCase()));
    for (const item of incoming) {
      const n = normSpace(item);
      if (!n) continue;
      const key = n.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(n);
    }
    return out;
  };

  structured.clients = mergeUnique(structured.clients || [], recoveredClients).slice(0, opts.maxClients || 40);
  structured.projects = mergeUnique(structured.projects || [], recoveredProjects).slice(0, opts.maxProjects || 24);

  const experienceCountAfter = (structured.experiences || []).length;
  const fakeExperiencesPrevented = Math.max(0, jobLinesSkipped);

  const expectedClients = CREATIVE_RECOVERY_CLIENT_ANCHORS.filter((a) => termMatchesHay(clean, a));
  const clientAnchorsFound = expectedClients.filter((a) =>
    structured.clients.some((c) => c.toLowerCase() === a.toLowerCase())
  );

  const projectTypesFound = CREATIVE_RECOVERY_PROJECT_TYPES.filter((t) => {
    const re = new RegExp(`\\b${t.replace(/\s+/g, '\\s+')}\\b`, 'i');
    return structured.projects.some((p) => re.test(p));
  });

  const stats = {
    engine: CREATIVE_CLIENT_PROJECT_RECOVERY,
    clientsRecovered: recoveredClients.length,
    projectsRecovered: recoveredProjects.length,
    clientsCount: structured.clients.length,
    projectsCount: structured.projects.length,
    jobLinesSkipped,
    fakeExperiencesPrevented,
    experienceCountBefore,
    experienceCountAfter,
    experienceInflation: experienceCountAfter - experienceCountBefore,
    clientAnchorsFound,
    clientAnchorRecallPct: expectedClients.length
      ? Math.round((clientAnchorsFound.length / expectedClients.length) * 100)
      : structured.clients.length > 0
        ? 100
        : 0,
    projectTypesFound,
    projectTypeRecallPct: CREATIVE_RECOVERY_PROJECT_TYPES.filter((t) =>
      CREATIVE_RECOVERY_PROJECT_TYPE_RE.test(clean) && new RegExp(`\\b${t.replace(/\s+/g, '\\s+')}\\b`, 'i').test(clean)
    ).length
      ? Math.round(
          (projectTypesFound.length /
            CREATIVE_RECOVERY_PROJECT_TYPES.filter((t) =>
              new RegExp(`\\b${t.replace(/\s+/g, '\\s+')}\\b`, 'i').test(clean)
            ).length) *
            100
        )
      : structured.projects.length > 0
        ? 100
        : 0,
  };

  structured.metadata = {
    ...(structured.metadata || {}),
    creativeClientProjectRecovery: stats,
  };

  hirelyDebugLog('CREATIVE_CLIENT_PROJECT_RECOVERY', stats);

  return {
    structured,
    clients: structured.clients,
    projects: structured.projects,
    stats,
  };
}

/**
 * @param {string} rawText
 * @param {object} [structured]
 */
export function auditCreativeClientProjectRecovery(rawText, structured = null) {
  const clean = String(rawText || '').trim();
  const blob = structured ? harvestCreativeRecoveryLines(structured, clean).join('\n') : clean;
  const clients = recoverClientsFromText(blob);
  const projects = recoverProjectsFromText(blob, normSpace(structured?.identity?.title || ''));

  const expectedClients = CREATIVE_RECOVERY_CLIENT_ANCHORS.filter((a) => termMatchesHay(clean, a));
  const foundClients = expectedClients.filter((a) => clients.some((c) => c.toLowerCase() === a.toLowerCase()));

  const expectedProjectTypes = CREATIVE_RECOVERY_PROJECT_TYPES.filter((t) =>
    new RegExp(`\\b${t.replace(/\s+/g, '\\s+')}\\b`, 'i').test(clean)
  );
  const foundProjectTypes = expectedProjectTypes.filter((t) =>
    projects.some((p) => new RegExp(`\\b${t.replace(/\s+/g, '\\s+')}\\b`, 'i').test(p))
  );

  return {
    engine: CREATIVE_CLIENT_PROJECT_RECOVERY,
    clients,
    projects,
    expectedClients,
    foundClients,
    clientRecallPct: expectedClients.length ? Math.round((foundClients.length / expectedClients.length) * 100) : 100,
    expectedProjectTypes,
    foundProjectTypes,
    projectTypeRecallPct: expectedProjectTypes.length
      ? Math.round((foundProjectTypes.length / expectedProjectTypes.length) * 100)
      : projects.length > 0
        ? 100
        : 0,
  };
}
