/**
 * UNIVERSAL_ROLE_DETECTOR — job title recovery from noisy OCR lines.
 */
import { lineLooksLikeRole } from '../../../data/dictionaries/roleKeywords.js';
import { UNIVERSAL_ROLE_DETECTOR } from './types.js';

const BULLET_RE = /^[-•*]\s+/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const ROLE_CORE_RE =
  /\b((?:senior|lead|junior|principal|staff|freelance\s+)?(?:art\s+director|creative\s+director|visual\s+designer|product\s+designer|graphic\s+designer|illustrator|motion\s+designer|ux\s+designer|ui\s+designer|frontend\s+developer|front[- ]end\s+developer|backend\s+developer|full[- ]stack\s+developer|software\s+engineer|data\s+analyst|product\s+manager|project\s+manager|marketing\s+manager|designer|developer|engineer|consultant|analyst|manager|director|producer|strategist|architect|coordinator|specialist|intern)(?:\s*\/\s*[\w\s]+)?)\b/i;

const OCR_ROLE_FIXES = [
  [/\bdesl\s*gn/i, 'design'],
  [/\billustrat/i, 'illustrat'],
  [/\bgraphlc\b/i, 'graphic'],
  [/\bdeveloer\b/i, 'developer'],
  [/\benglneer\b/i, 'engineer'],
  [/\bfron\s*tend\b/i, 'frontend'],
];

function repairOcrRoleText(text) {
  let s = String(text || '');
  for (const [re, rep] of OCR_ROLE_FIXES) s = s.replace(re, rep);
  return s.replace(/\s+/g, ' ').trim();
}

function titleCaseRole(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b[\p{L}'-]+/gu, (w) => {
      if (/^(de|du|la|le|les|of|and|&|\/)$/i.test(w)) return w.toLowerCase();
      if (w.length <= 2 && !/^[A-Z]{2,}$/.test(w)) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });
}

/**
 * @param {string} line
 * @param {{ stripCompany?: string }} [ctx]
 */
export function detectRoleInLine(line, ctx = {}) {
  let raw = repairOcrRoleText(line);
  if (!raw || EMAIL_RE.test(raw) || BULLET_RE.test(raw)) {
    return { role: '', confidence: 0, engine: UNIVERSAL_ROLE_DETECTOR };
  }

  if (ctx.stripCompany) {
    const c = String(ctx.stripCompany).trim();
    if (c && raw.toLowerCase().includes(c.toLowerCase())) {
      raw = raw.replace(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim();
    }
  }

  const m = raw.match(ROLE_CORE_RE);
  if (m) {
    const role = titleCaseRole(m[1]);
    let conf = 0.78;
    if (lineLooksLikeRole(role)) conf += 0.12;
    return { role, confidence: Math.min(0.96, conf), engine: UNIVERSAL_ROLE_DETECTOR };
  }

  if (lineLooksLikeRole(raw) && raw.length < 80) {
    return { role: titleCaseRole(raw), confidence: 0.65, engine: UNIVERSAL_ROLE_DETECTOR };
  }

  // "Graphic Designer at Nike" → role before at
  const atSplit = raw.match(/^(.+?)\s+(?:at|@|chez)\s+/i);
  if (atSplit && lineLooksLikeRole(atSplit[1])) {
    return { role: titleCaseRole(atSplit[1]), confidence: 0.7, engine: UNIVERSAL_ROLE_DETECTOR };
  }

  return { role: '', confidence: 0, engine: UNIVERSAL_ROLE_DETECTOR };
}
