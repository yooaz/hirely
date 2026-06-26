/**
 * P0 — Block invented / client-only experience rows.
 */

import { findLongestDictionaryTerm, CLIENT_TERMS } from '../../data/dictionaries/json-dictionary-match.js';

export const INVENTED_EXPERIENCE_BULLET_RE =
  /^(contributed\s+as\b|delivered\s+creative\s+work\b|designed\s+and\s+delivered\s+creative\s+work\b|created\s+(posters|packaging|logos?|brand|visual)\b)/i;

export const INVENTED_EXPERIENCE_ROLE_RE =
  /^(at\s+)?(present|présent|current|now|aujourd'?hui|actuel)$/i;

const DATE_ONLY_RE = /^(?:19|20)\d{2}(?:\s*[-–—]\s*(?:\d{4}|present|présent|current))?$/i;

/**
 * @param {object} exp
 * @returns {boolean}
 */
export function isClientOnlyExperienceCompany(company) {
  const c = String(company || '').trim();
  if (!c) return false;
  if (findLongestDictionaryTerm(c, CLIENT_TERMS)) return true;
  if (/^(nike|adobe|marvel|playstation|converse|louis\s+vuitton|cadillac|visa|arte|fortune)\b/i.test(c)) {
    return true;
  }
  return false;
}

/**
 * @param {object} exp
 * @returns {{ invented: boolean, reason?: string, clientBrand?: string }}
 */
export function auditInventedExperience(exp) {
  if (!exp || typeof exp !== 'object') return { invented: false };

  const role = String(exp.role || exp.title || '').trim();
  const company = String(exp.company || '').trim();
  const bullets = (exp.bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
  const blob = `${role} ${company} ${bullets.join(' ')}`.trim();

  if (exp.expandedFromClient) {
    return { invented: true, reason: 'expanded_from_client', clientBrand: company || role };
  }

  for (const b of bullets) {
    if (INVENTED_EXPERIENCE_BULLET_RE.test(b)) {
      return { invented: true, reason: 'invented_bullet', clientBrand: company };
    }
  }

  if (INVENTED_EXPERIENCE_BULLET_RE.test(blob)) {
    return { invented: true, reason: 'invented_phrase', clientBrand: company };
  }

  if (/^contributed\s+as\s+at\b/i.test(blob)) {
    return { invented: true, reason: 'contributed_as_at', clientBrand: company };
  }

  const weakRole = !role || INVENTED_EXPERIENCE_ROLE_RE.test(role) || /^at\s+/i.test(role);
  if (weakRole && company && isClientOnlyExperienceCompany(company)) {
    return { invented: true, reason: 'client_as_company', clientBrand: company };
  }

  if (weakRole && INVENTED_EXPERIENCE_ROLE_RE.test(company)) {
    return { invented: true, reason: 'present_as_company', clientBrand: company };
  }

  if (!role && company && !exp.startDate && !exp.dates && !bullets.length) {
    if (isClientOnlyExperienceCompany(company) || DATE_ONLY_RE.test(company)) {
      return { invented: true, reason: 'company_only_row', clientBrand: company };
    }
  }

  return { invented: false };
}

/**
 * @param {object[]} experiences
 * @returns {{ kept: object[], clients: string[], review: object[], rejected: object[] }}
 */
export function stripInventedExperiences(experiences = []) {
  const kept = [];
  const clients = [];
  const review = [];
  const rejected = [];

  for (const exp of experiences || []) {
    const audit = auditInventedExperience(exp);
    if (!audit.invented) {
      kept.push(exp);
      continue;
    }
    rejected.push({ exp, ...audit });
    const brand = String(audit.clientBrand || exp.company || exp.role || '').trim();
    if (brand && isClientOnlyExperienceCompany(brand)) clients.push(brand);
    else if (brand) {
      review.push({
        field: 'experiences',
        detected: brand,
        sourceText: [exp.role, exp.company, ...(exp.bullets || [])].filter(Boolean).join(' — '),
        confidence: 48,
        reason: audit.reason || 'invented_experience',
        status: 'pending',
      });
    }
  }

  return { kept, clients: [...new Set(clients)], review, rejected };
}
