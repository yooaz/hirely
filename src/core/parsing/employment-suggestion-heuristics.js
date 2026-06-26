/**
 * Employment / freelance line detection for suggestion classification (no parsing deps).
 */

const FREELANCE_EMPLOYMENT_RE =
  /\b(independent\s*\/\s*freelance|indépendant\s*\/\s*freelance|freelance|freelancer|freelanceur|self[-\s]?employed|indépendant|travailleur\s+indépendant)\b/i;

export const COMPANY_UNCERTAIN_RE =
  /\b(company|société|societe|entreprise|role|poste|employeur)\s+à\s+(confirmer|compléter|completer|valider)/i;

const STANDALONE_EMPLOYMENT_RE = /^independent\s*\/\s*freelance$/i;

/**
 * @param {string} line
 */
export function isEmploymentCompanyLine(line) {
  const s = String(line || '').trim();
  if (!s) return false;
  if (STANDALONE_EMPLOYMENT_RE.test(s)) return true;
  if (COMPANY_UNCERTAIN_RE.test(s)) return true;
  if (FREELANCE_EMPLOYMENT_RE.test(s) && (s.length <= 96 || /\b(19|20)\d{2}\b/.test(s))) return true;
  return false;
}
