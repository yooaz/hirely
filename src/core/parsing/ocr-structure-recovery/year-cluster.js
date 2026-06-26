/**
 * Year clustering — group OCR lines by date anchors (never trust stream order).
 */

const YEAR_RE = /\b((?:19|20)\d{2})\b/g;
const YEAR_RANGE_RE =
  /\b((?:19|20)\d{2})\s*[-–—:]\s*((?:19|20)\d{2}|present|présent|current|now|actuel)\b/i;
const YEAR_ONLY_LINE_RE =
  /^(?:(?:19|20)\d{2})(?:\s+(?:(?:19|20)\d{2}|present|présent|current|now|actuel))+$/i;

/**
 * @param {string} line
 */
export function extractYearsFromLine(line) {
  const years = new Set();
  const text = String(line || '');
  YEAR_RE.lastIndex = 0;
  let m;
  while ((m = YEAR_RE.exec(text))) {
    const y = Number(m[1]);
    if (y >= 1950 && y <= 2040) years.add(y);
  }
  return [...years].sort((a, b) => a - b);
}

/**
 * @param {string} line
 */
export function lineHasYearAnchor(line) {
  const text = String(line || '').trim();
  if (!text) return false;
  if (YEAR_RANGE_RE.test(text)) return true;
  if (YEAR_ONLY_LINE_RE.test(text)) return true;
  return extractYearsFromLine(text).length > 0;
}

/**
 * @param {string} line
 */
export function isYearOnlyLine(line) {
  const text = String(line || '').trim();
  if (!text || text.length > 32) return false;
  if (YEAR_ONLY_LINE_RE.test(text)) return true;
  const years = extractYearsFromLine(text);
  if (!years.length) return false;
  const stripped = text.replace(YEAR_RE, '').replace(/[-–—:]/g, '').trim();
  return stripped.length <= 12;
}

/**
 * Sort key for experience blocks — prefer latest end year.
 * @param {string[]} lines
 */
export function yearClusterSortKey(lines) {
  const years = [];
  for (const line of lines || []) {
    years.push(...extractYearsFromLine(line));
  }
  if (!years.length) return 0;
  return Math.max(...years);
}

/**
 * Cluster line groups that share overlapping year ranges.
 * @param {{ lines: string[], section?: string }[]} groups
 */
export function sortExperienceGroupsByYear(groups = []) {
  return [...groups].sort((a, b) => yearClusterSortKey(b.lines) - yearClusterSortKey(a.lines));
}
