/**
 * CLIENT_DETECTION_ENGINE — detect brand clients in creative CVs.
 * Harvests "Worked for:", bullet lists, and entity dictionary matches → resume.clients[].
 */

import { recognizeEntitiesInText, CLIENT_RECOGNIZER, SCHOOL_TERMS } from '../../data/dictionaries/entity-catalog.js';
import { findLongestDictionaryTerm } from '../../data/dictionaries/json-dictionary-match.js';
import { termMatchesHay } from '../../data/dictionaries/match-utils.js';
import { clientNamesInText } from './field-sanitize.js';
import { extractCleanClientBrands } from './resume-output-quality.js';
import { detectCreativeParsingMode } from './creative-parsing-mode.js';
import { detectDesignerCvMode } from './designer-cv-mode.js';
import { hirelyDebugLog } from '../runtime/hirely-debug.js';
import { CREATIVE_RECOVERY_CLIENT_ANCHORS } from './creative-recovery-constants.js';

export const CLIENT_DETECTION_ENGINE = 'CLIENT_DETECTION_ENGINE';

/** P1 creative recovery anchor brands (+ legacy Google/Sony). */
export const CLIENT_ANCHOR_TARGETS = Object.freeze([
  ...CREATIVE_RECOVERY_CLIENT_ANCHORS,
  'Google',
  'Sony',
]);

const CLIENT_INTRO_RE =
  /\b(worked\s+(?:for|with)|clients?\s+including|collaborated\s+with|recognized\s+brands|cultural\s+clients|brands?\s+including|selected\s+clients|notable\s+clients|for\s+clients?\s+such\s+as|including)\b/i;

const WORKED_FOR_HEADER_RE = /^worked\s+(?:for|with)\s*:?\s*$/i;

const TOOL_ADOBE_RE = /\badobe\s+(photoshop|illustrator|indesign|premiere|after\s+effects|creative\s+suite|xd)\b/i;

const LIST_SPLIT_RE = /\s*,\s*|\s+and\s+|\s*&\s*|·|;/i;

const NOT_CLIENT_RE =
  /^(illustrator|illustration|packaging|photoshop|indesign|portfolio|linkedin|graphic\s+design|art\s+direction|print\s+production|logo\s+design|visual\s+identity|poster\s+design|skills?|tools?|languages?|education|french|english|creative\s+suite|web\s+&\s+motion\s+design|visual\s+communication)$/i;

const AGENCY_CLIENT_RE = /^(mccann|publicis|havas|betc|ddb|akqa|ogilvy)$/i;

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

function isToolNotClient(line, canonical) {
  const l = normSpace(line);
  const c = normSpace(canonical).toLowerCase();
  if (c !== 'adobe') return false;
  if (TOOL_ADOBE_RE.test(l)) return true;
  if (/\badobe\s+creative\s+suite\b/i.test(l) && !CLIENT_INTRO_RE.test(l)) return true;
  return false;
}

/**
 * @param {string} fragment
 * @param {string} [contextLine]
 */
function isRejectedClientName(name) {
  const n = normSpace(name);
  if (!n || n.length < 2) return true;
  if (NOT_CLIENT_RE.test(n)) return true;
  if (AGENCY_CLIENT_RE.test(n)) return true;
  if (/@|https?:\/\//i.test(n)) return true;
  return false;
}

function canonicalizeClientFragment(fragment, contextLine = '') {
  const frag = cleanFragment(fragment);
  if (!frag || frag.length < 2 || frag.length > 80) return null;
  if (isSchoolEntity(frag) || isRejectedClientName(frag)) return null;

  const hits = recognizeEntitiesInText(frag, CLIENT_RECOGNIZER);
  if (hits.length) {
    const best = hits[0];
    const name = normSpace(best.canonical || best.matched);
    if (!name || isToolNotClient(contextLine || frag, name)) return null;
    return name;
  }

  for (const anchor of CLIENT_ANCHOR_TARGETS) {
    if (termMatchesHay(frag, anchor) && !isToolNotClient(contextLine || frag, anchor)) return anchor;
  }

  const keyword = clientNamesInText(frag)[0];
  if (keyword && !isToolNotClient(contextLine || frag, keyword)) return keyword;

  if (/^[A-ZÀ-Ö][\w&.'+-]{1,40}$/.test(frag) && !isSchoolEntity(frag)) return frag;
  return null;
}

/**
 * @param {string} line
 * @returns {string[]}
 */
export function parseClientListLine(line) {
  const raw = normSpace(line);
  if (!raw) return [];

  let payload = raw;
  const intro = raw.match(CLIENT_INTRO_RE);
  if (intro) {
    payload = raw.slice(intro.index + intro[0].length).trim();
  }
  if (!payload) return [];

  const parts = payload.split(LIST_SPLIT_RE).map(cleanFragment).filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const part of parts) {
    const name = canonicalizeClientFragment(part, raw);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function detectClientsFromText(text) {
  const hay = String(text || '');
  if (!hay) return [];

  const found = [];
  const seen = new Set();
  const push = (name) => {
    const n = normSpace(name);
    if (!n || isSchoolEntity(n)) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push(n);
  };

  const lines = hay.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let afterWorkedFor = false;

  for (const line of lines) {
    if (WORKED_FOR_HEADER_RE.test(line)) {
      afterWorkedFor = true;
      continue;
    }
    if (afterWorkedFor) {
      if (/^(experience|education|skills|tools|profile|summary)\b/i.test(line)) {
        afterWorkedFor = false;
      } else {
        const single = canonicalizeClientFragment(line, line);
        if (single) push(single);
        continue;
      }
    }

    if (CLIENT_INTRO_RE.test(line) || line.includes(',') || LIST_SPLIT_RE.test(line)) {
      for (const c of parseClientListLine(line)) push(c);
      for (const hit of recognizeEntitiesInText(line, CLIENT_RECOGNIZER)) {
        const name = normSpace(hit.canonical || hit.matched);
        if (!name || isToolNotClient(line, name) || isRejectedClientName(name)) continue;
        push(name);
      }
    }
  }

  for (const anchor of CLIENT_ANCHOR_TARGETS) {
    if (termMatchesHay(hay, anchor) && !isToolNotClient(hay, anchor) && !isRejectedClientName(anchor)) {
      push(anchor);
    }
  }

  for (const c of clientNamesInText(hay)) {
    if (!isRejectedClientName(c)) push(c);
  }

  return found;
}

/**
 * @param {object} structured
 * @param {string} [rawText]
 */
export function harvestClientSourceBlob(structured, rawText = '') {
  const chunks = [];
  const raw = String(rawText || '').trim();
  if (raw) {
    const rawLines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let inWorkedFor = false;
    for (const line of rawLines) {
      if (WORKED_FOR_HEADER_RE.test(line)) {
        inWorkedFor = true;
        continue;
      }
      if (inWorkedFor) {
        if (/^(experience|education|skills|tools|profile|summary)\b/i.test(line)) inWorkedFor = false;
        else chunks.push(line);
        continue;
      }
      if (CLIENT_INTRO_RE.test(line) || /^clients?\b/i.test(line)) chunks.push(line);
    }
  }

  if (structured?.summary) chunks.push(structured.summary);
  for (const line of structured?.clients || []) chunks.push(String(line || ''));
  for (const line of structured?.unsorted || []) chunks.push(String(line || ''));
  for (const line of structured?.projects || []) chunks.push(String(line || ''));

  for (const exp of structured?.experiences || []) {
    if (typeof exp === 'string') {
      chunks.push(exp);
      continue;
    }
    if (!exp || typeof exp !== 'object') continue;
    chunks.push([exp.role, exp.company, exp.description].filter(Boolean).join(' '));
    for (const b of exp.bullets || []) chunks.push(String(b || ''));
    for (const c of exp.clients || []) chunks.push(String(c || ''));
  }

  return chunks.filter(Boolean).join('\n');
}

/**
 * @param {object} structured
 * @param {string} [rawText]
 * @param {object} [opts]
 */
export function runClientDetection(structured, rawText = '', opts = {}) {
  if (!structured || typeof structured !== 'object') {
    return { structured, clients: [], detected: [], stats: { skipped: true } };
  }

  const clean = String(rawText || structured?.metadata?.cleanedText || '').trim();
  const creativeMode = opts.creativeMode || detectCreativeParsingMode(clean, { force: opts.forceCreative });
  const designerMode = opts.designerMode || detectDesignerCvMode(clean);
  const hasClientSection =
    (structured.clients || []).length > 0 ||
    /\bclients?\s*[:·]?\s*$/im.test(clean) ||
    /\b(worked\s+(?:for|with)|selected\s+clients|notable\s+clients)\b/i.test(clean);
  if (!creativeMode.active && !designerMode.active && !opts.force && !hasClientSection) {
    return { structured, clients: structured.clients || [], detected: [], stats: { skipped: true } };
  }

  const blob = harvestClientSourceBlob(structured, clean);
  const fromText = detectClientsFromText(blob);
  const fromBrands = extractCleanClientBrands(structured.clients || [], blob.split('\n'));

  const merged = [];
  const seen = new Set();
  for (const name of [...(structured.clients || []), ...fromText, ...fromBrands]) {
    const parsed = parseClientListLine(String(name || ''));
    const candidates = parsed.length ? parsed : [canonicalizeClientFragment(name, blob)].filter(Boolean);
    for (const c of candidates) {
      const key = c.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(c);
    }
  }

  structured.clients = merged.slice(0, opts.maxClients || 32);

  for (const exp of structured.experiences || []) {
    if (!exp || typeof exp !== 'object') continue;
    const expBlob = [...(exp.bullets || []), exp.description || ''].join(' ');
    const expClients = detectClientsFromText(expBlob);
    if (expClients.length) {
      exp.clients = [...new Set([...(exp.clients || []), ...expClients])];
    }
  }

  const anchorFound = CLIENT_ANCHOR_TARGETS.filter((a) =>
    structured.clients.some((c) => c.toLowerCase() === a.toLowerCase())
  );

  const stats = {
    engine: CLIENT_DETECTION_ENGINE,
    count: structured.clients.length,
    detected: fromText.length,
    anchorFound,
    anchorRecallPct: CLIENT_ANCHOR_TARGETS.length
      ? Math.round((anchorFound.length / CLIENT_ANCHOR_TARGETS.filter((a) => termMatchesHay(blob, a)).length || 1) * 100)
      : 100,
  };

  structured.metadata = {
    ...(structured.metadata || {}),
    clientDetection: stats,
  };

  hirelyDebugLog('CLIENT_DETECTION_ENGINE', stats);

  return { structured, clients: structured.clients, detected: fromText, stats };
}

/**
 * @param {string} rawText
 * @param {object} [structured]
 */
export function auditClientDetection(rawText, structured = null) {
  const clean = String(rawText || '').trim();
  const blob = structured ? harvestClientSourceBlob(structured, clean) : clean;
  const detected = detectClientsFromText(blob);
  const expected = CLIENT_ANCHOR_TARGETS.filter((a) => termMatchesHay(clean, a));
  const found = expected.filter((a) => detected.some((d) => d.toLowerCase() === a.toLowerCase()));
  const recallPct = expected.length ? Math.round((found.length / expected.length) * 100) : 100;

  return {
    engine: CLIENT_DETECTION_ENGINE,
    detected,
    expected,
    found,
    recallPct,
    count: detected.length,
  };
}
