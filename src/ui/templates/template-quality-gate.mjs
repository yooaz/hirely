/**
 * P0 — Template quality gate rules (render output only).
 */

export const TEMPLATE_QUALITY_GATE_V1 = 'TEMPLATE_QUALITY_GATE_V1';

export const TEMPLATE_QUALITY_RULES = Object.freeze([
  'no_cropped_text',
  'no_excessive_blank_space',
  'no_text_overflow',
  'no_fake_content',
  'no_parser_labels',
  'no_wrong_email',
  'no_company_as_name',
  'readable_at_100',
  'printable_pdf',
  'first_page_density_55',
]);

/** Fake / placeholder copy that must never appear in production renders. */
export const TEMPLATE_QUALITY_FAKE_PATTERNS = Object.freeze([
  /lorem\s+ipsum/i,
  /\bplaceholder\b/i,
  /\bTODO\b/,
  /\bFIXME\b/,
  /\bjohn\s+doe\b/i,
  /\bjane\s+doe\b/,
  /\bexample\.com\b/i,
  /\byour\s+name\s+here\b/i,
  /\binsert\s+text\b/i,
]);

/** Parser / debug labels that must not leak into template HTML. */
export const TEMPLATE_QUALITY_PARSER_LABELS = Object.freeze([
  'missing experience',
  'low confidence',
  'confidence: 42%',
  'needs review',
  'unknown experience',
  '[body]',
  'debug parser',
  'nom à confirmer',
  'information non détectée',
  'à classer',
]);

/**
 * @param {string} html
 */
export function htmlHasFakeContent(html) {
  const src = String(html || '');
  return TEMPLATE_QUALITY_FAKE_PATTERNS.some((re) => re.test(src));
}

/**
 * @param {string} html
 * @param {{ allowUndetected?: boolean }} [opts]
 */
export function htmlHasParserLabels(html, opts = {}) {
  const lower = String(html || '').toLowerCase();
  for (const frag of TEMPLATE_QUALITY_PARSER_LABELS) {
    if (frag === 'information non détectée' || frag === 'nom à confirmer' || frag === 'à classer') {
      if (opts.allowUndetected) continue;
    }
    if (lower.includes(frag)) return frag;
  }
  return null;
}

/**
 * @param {string} html
 * @param {string} expectedEmail
 */
export function htmlEmailMatches(html, expectedEmail) {
  const email = String(expectedEmail || '').trim().toLowerCase();
  if (!email) return true;
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (!text.includes(email)) return false;
  const at = email.indexOf('@');
  if (at < 1) return true;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const mutated = new RegExp(`${local}[a-z]{1,3}@${domain.replace(/\./g, '\\.')}`, 'i');
  return !mutated.test(text);
}

/**
 * @param {object} metrics
 * @param {{ minDensity?: number, maxBlankTail?: number }} [opts]
 */
export function evaluateTemplateQualityMetrics(metrics, opts = {}) {
  const minDensity = opts.minDensity ?? 0.55;
  const maxBlankTail = opts.maxBlankTail ?? 0.42;
  const failures = [];

  if (metrics.clippedCount > 0) failures.push('no_cropped_text');
  if (metrics.fillRatio < minDensity && metrics.sectionCount >= 4) {
    failures.push('first_page_density_55');
  }
  if (metrics.blankTailRatio > maxBlankTail && metrics.fillRatio < minDensity) {
    failures.push('no_excessive_blank_space');
  }
  if (metrics.horizontalOverflow) failures.push('no_text_overflow');
  if (metrics.fakeContent) failures.push('no_fake_content');
  if (metrics.parserLabel) failures.push('no_parser_labels');
  if (!metrics.emailOk) failures.push('no_wrong_email');
  if (!metrics.nameOk) failures.push('no_company_as_name');
  if (!metrics.readable) failures.push('readable_at_100');
  if (!metrics.pdfOk) failures.push('printable_pdf');

  return { pass: failures.length === 0, failures };
}
