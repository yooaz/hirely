/**
 * Generic career / education line signals — no candidate-specific literals.
 */

/** Common professional role tokens (not person or school names). */
export const GENERIC_ROLE_WORDS_RE =
  /\b(designer|illustrator|developer|engineer|manager|consultant|marketer|sales|recruiter|teacher|artist|director|assistant|intern|analyst|specialist|coordinator|lead|head|officer|architect|administrator)\b/i;

/** Freelance / self-employment patterns. */
export const FREELANCE_RE =
  /\b(freelance|freelancer|self[- ]?employed|independent|contractor|consultant)\b/i;

/** Internship patterns. */
export const INTERNSHIP_RE = /\b(internship|intern\b|stage\b|apprenticeship|trainee)\b/i;

/** Experience section or career-bearing line. */
export const CAREER_SECTION_RE =
  /\b(work\s+experience|employment(\s+history)?|professional\s+experience|expérience|experience|career\s+history|parcours)\b/i;

/** Date range on a line (career signal). */
export const DATE_RANGE_RE = /\b(19|20)\d{2}\s*[-–—]\s*(?:present|current|(19|20)\d{2})\b/i;

/** Year ladder without explicit range. */
export const CAREER_YEAR_RE = /\b(19|20)\d{2}\b/;

/** Agency / company-like context near role. */
export const ORGANIZATION_CONTEXT_RE =
  /\b(agency|agence|studio|group|corp|inc|ltd|gmbh|sarl|sas|company|firm|consulting)\b/i;

/** Combined: line likely describes employment history. */
export const GENERIC_CAREER_LINE_RE = new RegExp(
  [
    CAREER_SECTION_RE.source,
    FREELANCE_RE.source,
    INTERNSHIP_RE.source,
    GENERIC_ROLE_WORDS_RE.source,
    DATE_RANGE_RE.source,
    ORGANIZATION_CONTEXT_RE.source,
  ].join('|'),
  'i'
);

/** Generic education keywords (dictionary supplements, not hardcoded schools). */
export const GENERIC_EDUCATION_HINT_RE =
  /\b(school|university|college|institute|academy|bachelor|master|mba|phd|degree|diploma|formation|école|licence|mastère|licentiate)\b/i;

/**
 * @param {string} line
 */
export function lineLooksLikeCareerHistory(line) {
  const s = String(line || '').trim();
  if (s.length < 6) return false;
  if (GENERIC_CAREER_LINE_RE.test(s)) return true;
  if (CAREER_YEAR_RE.test(s) && GENERIC_ROLE_WORDS_RE.test(s)) return true;
  return false;
}

/**
 * @param {string} blob
 */
export function blobHasCareerSignals(blob) {
  const hay = String(blob || '').toLowerCase();
  return (
    DATE_RANGE_RE.test(hay) ||
    CAREER_SECTION_RE.test(hay) ||
    FREELANCE_RE.test(hay) ||
    (CAREER_YEAR_RE.test(hay) && GENERIC_ROLE_WORDS_RE.test(hay))
  );
}

/**
 * @param {string} blob
 */
export function unsortedHasCareerLines(unsorted = []) {
  const hay = (unsorted || []).join('\n').toLowerCase();
  return lineLooksLikeCareerHistory(hay) || blobHasCareerSignals(hay);
}
