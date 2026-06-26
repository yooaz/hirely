/**
 * Block signal heuristics — regex + lightweight patterns.
 */

import type { BlockSignals } from '../../types/blocks.types.js';

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4})?/;
const URL_RE = /\bhttps?:\/\/[^\s]+/i;
const DATE_RANGE_RE =
  /\b(?:\d{1,2}[/.-]\d{2,4}|\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)[a-zéû.]*\s*\d{2,4})\b.*?(?:-|–|—|à|to|until|present|aujourd|current|actuel)/i;
const BULLET_RE = /^[\s]*[-•●▪◦*]\s+/;
const JOB_TITLE_HINT =
  /\b(developer|développeur|engineer|ingénieur|manager|consultant|lead|architect|designer|analyst|director|chef de|responsable)\b/i;

export function computeBlockSignals(text: string, opts?: { isBold?: boolean; fontSize?: number }): BlockSignals {
  const t = String(text || '').trim();
  const short = t.length < 80;
  const uppercaseRatio =
    t.replace(/[^A-Za-zÀ-ÿ]/g, '').length > 0
      ? (t.replace(/[^A-ZÀ-Ÿ]/g, '').length / t.replace(/[^A-Za-zÀ-ÿ]/g, '').length)
      : 0;

  return {
    looks_like_heading: short && (uppercaseRatio > 0.6 || (opts?.fontSize ?? 0) >= 14 || !!opts?.isBold),
    looks_like_date: DATE_RANGE_RE.test(t) || /\b(19|20)\d{2}\b/.test(t),
    looks_like_email: EMAIL_RE.test(t),
    looks_like_phone: PHONE_RE.test(t) && !EMAIL_RE.test(t),
    looks_like_url: URL_RE.test(t) || /linkedin\.com/i.test(t) || /github\.com/i.test(t),
    looks_like_bullet: BULLET_RE.test(t),
    looks_like_company: /\b(SA|SAS|SARL|Inc\.?|Ltd\.?|GmbH|Corp\.?)\b/i.test(t),
    looks_like_job_title: JOB_TITLE_HINT.test(t),
  };
}

export const EMAIL_PATTERN = EMAIL_RE;
export const PHONE_PATTERN = PHONE_RE;
export const DATE_RANGE_PATTERN = DATE_RANGE_RE;
