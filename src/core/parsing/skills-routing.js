/**
 * P0 — Route detected skills/tools into resumeData.skills / resumeData.tools.
 * Handles section headers, comma/bullet lists, and header-stripped orphan lines.
 */

import { fuzzySectionKey } from './section-fuzzy.js';
import { splitBySectionHeaders } from './section-mapper.js';
import { splitListItems } from './rich-parser.js';
import { isStrictSoftwareLine } from './classification-fixes.js';
import { passesExperienceGate } from './line-cleaner.js';
import { TOOLS } from '../../data/dictionaries/tools.js';
import { SKILLS, SKILL_HINT_RE } from '../../data/dictionaries/skills.js';
import { textContainsAny } from '../../data/dictionaries/match-utils.js';
import {
  findLongestDictionaryTerm,
  TOOL_TERMS,
} from '../../data/dictionaries/json-dictionary-match.js';

const INFRA_TOOL_RE =
  /\b(postgresql|postgres|docker|aws|kubernetes|k8s|hubspot|tableau|powerpoint|excel|canva|meta\s+ads|google\s+analytics|git|node\.?js|react|javascript|typescript|python|java|sql)\b/i;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const DEGREE_YEAR_RE =
  /\b(b\.?\s*s\.?|b\.?\s*a\.?|m\.?\s*s\.?c?\.?|mba|bachelor|master|diploma|licence|university|college|école|ecole)\b.*\b(19|20)\d{2}\b/i;

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pushUnique(list, item) {
  const s = String(item || '').trim();
  if (!s) return list;
  const k = s.toLowerCase();
  if (list.some((x) => String(x).trim().toLowerCase() === k)) return list;
  return [...list, s];
}

function isToolToken(item) {
  const t = String(item || '').trim();
  if (!t || t.length < 2 || t.length > 56) return false;
  if (isStrictSoftwareLine(t)) return true;
  if (findLongestDictionaryTerm(t, TOOL_TERMS)) return true;
  if (INFRA_TOOL_RE.test(t)) return true;
  return TOOLS.some((tool) => new RegExp(`\\b${escapeRe(tool)}\\b`, 'i').test(t));
}

function isSkillToken(item) {
  const t = String(item || '').trim();
  if (!t || t.length < 2 || t.length > 56) return false;
  if (isToolToken(t)) return false;
  if (passesExperienceGate(t) && /\b(19|20)\d{2}\b/.test(t)) return false;
  if (textContainsAny(t, SKILLS) || SKILL_HINT_RE.test(t)) return true;
  if (/\b(19|20)\d{2}\b/.test(t)) return false;
  return t.length >= 3 && t.length <= 40;
}

export function isCommaOrBulletListLine(line) {
  const s = String(line || '').trim();
  if (!s || s.length < 6) return false;
  if (EMAIL_RE.test(s) || PHONE_RE.test(s)) return false;
  if (DEGREE_YEAR_RE.test(s)) return false;
  if (passesExperienceGate(s) && /\s[—–-]\s/.test(s) && /\b(19|20)\d{2}\b/.test(s)) return false;
  if (/^[-•*]\s+/.test(s)) return true;
  return /[,;·]/.test(s);
}

/**
 * @param {string} line
 * @returns {'skills'|'tools'|null}
 */
export function classifySkillToolListLine(line) {
  const s = String(line || '').trim();
  if (!isCommaOrBulletListLine(s)) return null;
  const parts = splitListItems(s);
  if (parts.length < 2) return null;

  const toolHits = parts.filter(isToolToken).length;
  const skillHits = parts.filter(isSkillToken).length;
  if (toolHits >= 2 && toolHits >= skillHits) return 'tools';
  if (skillHits >= 2) return 'skills';
  if (toolHits >= 2) return 'tools';
  if (parts.length >= 2 && parts.every((p) => p.length <= 40)) return 'skills';
  return null;
}

/**
 * @param {object} rd
 * @param {string} line
 * @param {'skills'|'tools'|null} [forcedBucket]
 * @returns {boolean}
 */
export function routeListLineToSkillsAndTools(rd, line, forcedBucket = null) {
  const bucket = forcedBucket || classifySkillToolListLine(line);
  if (!bucket || !rd) return false;

  const parts = splitListItems(line);
  if (!parts.length) return false;

  let routed = false;
  for (const part of parts) {
    if (isToolToken(part)) {
      rd.tools = pushUnique(rd.tools || [], part);
      routed = true;
      continue;
    }
    if (bucket === 'skills' || isSkillToken(part)) {
      rd.skills = pushUnique(rd.skills || [], part);
      routed = true;
    }
  }
  return routed;
}

function lineAlreadyRouted(line, rd) {
  const norm = String(line || '').trim().toLowerCase();
  if (!norm) return true;
  const parts = splitListItems(line);
  if (!parts.length) return false;
  return parts.every((part) => {
    const k = part.toLowerCase();
    return (
      (rd.skills || []).some((s) => s.toLowerCase() === k) ||
      (rd.tools || []).some((t) => t.toLowerCase() === k)
    );
  });
}

/**
 * Recover skills/tools from raw text — including header-stripped pipeline output.
 * @param {import('../resume-data.js').ResumeData} rd
 */
export function routeSkillsAndToolsFromRawText(rd) {
  if (!rd) return rd;
  const raw = String(rd.meta?.rawText || rd.meta?.cleanedText || '').trim();
  if (!raw) return rd;

  rd.skills = [...(rd.skills || [])];
  rd.tools = [...(rd.tools || [])];

  const blocks = splitBySectionHeaders(raw);
  for (const line of blocks.skills || []) {
    routeListLineToSkillsAndTools(rd, line, 'skills');
  }
  for (const line of blocks.tools || []) {
    routeListLineToSkillsAndTools(rd, line, 'tools');
  }

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (fuzzySectionKey(line.replace(/[:：]\s*$/, ''))) continue;
    if (lineAlreadyRouted(line, rd)) continue;
    const bucket = classifySkillToolListLine(line);
    if (bucket) routeListLineToSkillsAndTools(rd, line, bucket);
  }

  return rd;
}

/**
 * Drain comma-list skill/tool lines from unsorted.
 * @param {import('../resume-data.js').ResumeData} rd
 */
export function routeSkillsFromUnsorted(rd) {
  if (!rd || !(rd.unsorted || []).length) return rd;
  rd.skills = [...(rd.skills || [])];
  rd.tools = [...(rd.tools || [])];

  const remaining = [];
  let section = null;

  for (const raw of rd.unsorted) {
    const line = String(raw || '').trim();
    if (!line) continue;

    const headerKey = fuzzySectionKey(line.replace(/[:：]\s*$/, ''));
    if (headerKey === 'skills' || headerKey === 'tools') {
      section = headerKey;
      const inline = line.match(/^[^:]+:\s*(.+)$/);
      if (inline?.[1]?.trim()) {
        routeListLineToSkillsAndTools(rd, inline[1], headerKey);
      }
      continue;
    }

    if (section === 'skills' || section === 'tools') {
      if (routeListLineToSkillsAndTools(rd, line, section)) continue;
      remaining.push(line);
      continue;
    }

    if (routeListLineToSkillsAndTools(rd, line)) continue;
    remaining.push(line);
  }

  rd.unsorted = remaining;
  return rd;
}

/**
 * Merge block-detected skills with enterprise-approved skills (no either/or drop).
 */
export function mergeDetectedSkills(blockSkills = [], enterpriseSkills = [], opts = {}) {
  const toolSet = opts.toolSet || new Set();
  const langSet = opts.langSet || new Set();
  const seen = new Set();
  const out = [];

  const add = (s) => {
    const t = String(s || '').trim();
    const k = t.toLowerCase();
    if (!t || seen.has(k)) return;
    if (toolSet.has(k) || langSet.has(k)) return;
    seen.add(k);
    out.push(t);
  };

  for (const s of blockSkills || []) add(s);
  for (const s of enterpriseSkills || []) add(s);
  return out.slice(0, 16);
}

/**
 * Merge block-detected tools with enterprise-approved tools.
 */
export function mergeDetectedTools(blockTools = [], enterpriseTools = [], opts = {}) {
  const skillSet = opts.skillSet || new Set();
  const seen = new Set();
  const out = [];

  const add = (s) => {
    const t = String(s || '').trim();
    const k = t.toLowerCase();
    if (!t || seen.has(k)) return;
    if (skillSet.has(k)) return;
    seen.add(k);
    out.push(t);
  };

  for (const t of blockTools || []) add(t);
  for (const t of enterpriseTools || []) add(t);
  return out.slice(0, 14);
}

/**
 * Full skills/tools routing pass for resumeData.
 * @param {import('../resume-data.js').ResumeData} rd
 */
export function applySkillsRoutingPass(rd) {
  if (!rd) return rd;
  rd = routeSkillsAndToolsFromRawText(rd);
  rd = routeSkillsFromUnsorted(rd);
  return rd;
}
