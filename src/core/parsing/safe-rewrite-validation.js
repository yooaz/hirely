/**
 * Safe rewrite validation — improve prose without inventing facts.
 * Each rewrite stores originalText, rewrittenText, sourceSection, sourceConfidence, factsUsed.
 */

export const SAFE_REWRITE_VALIDATION = 'SAFE_REWRITE_VALIDATION_V1';
export const SAFE_REWRITE_CONFIDENCE_MIN = 75;

const VERB_START_RE =
  /^(led|built|shipped|managed|created|collaborated|directed|produced|delivered|launched|scaled|facilitated|reduced|improved|designed|developed|implemented|oversaw|coordinated|spearheaded|drove|optimized|established|mentored|supported|analyzed|conducted|prepared|executed|handled|maintained|streamlined|crafted|illustrated|edited|advised|guided|partnered|owned|grew|increased|decreased|transformed|automated|migrated|served|held)\b/i;

/** Professional glue allowed without counting as invented facts. */
const ALLOWED_BOILERPLATE_RE =
  /\b(related visual deliverables|initiatives|work spanning|and related|professional grade|across)\b/gi;

/** Rewrite verbs / glue tokens that may appear without being extracted literally. */
const ALLOWED_REWRITE_TOKENS = new Set([
  'created',
  'delivered',
  'managed',
  'served',
  'held',
  'built',
  'led',
  'facilitated',
  'collaborated',
  'visual',
  'deliverables',
  'initiatives',
  'spanning',
  'related',
  'work',
  'professional',
]);

const STOP_TOKENS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'at', 'in', 'on', 'to', 'of', 'as', 'by', 'from',
  'into', 'over', 'under', 'through', 'during', 'while', 'that', 'which', 'this', 'their', 'your',
]);

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function extractYears(text) {
  return [...new Set(String(text || '').match(/\b(19|20)\d{2}\b/g) || [])];
}

function extractMetrics(text) {
  const s = String(text || '');
  const out = [];
  const patterns = [
    /\b\d{1,3}(?:\.\d+)?%/g,
    /\$[\d,]+(?:\.\d+)?[kmb]?/gi,
    /\b\d[\d,]*\+?\s*(?:users?|customers?|clients?|revenue|sales|projects?|employees?)\b/gi,
    /\b(?:increased|decreased|reduced|grew|improved|boosted|raised|lowered)\s+(?:by\s+)?\d[\d,]*%?/gi,
  ];
  for (const re of patterns) {
    for (const m of s.matchAll(re)) out.push(m[0].toLowerCase());
  }
  return [...new Set(out)];
}

function contentTokens(text) {
  const stripped = String(text || '')
    .toLowerCase()
    .replace(ALLOWED_BOILERPLATE_RE, ' ')
    .replace(/[^a-z0-9\s%-]/g, ' ');
  return [
    ...new Set(
      stripped
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 2 && !STOP_TOKENS.has(t))
    ),
  ];
}

function stripBoilerplate(text) {
  return cleanText(String(text || '').replace(ALLOWED_BOILERPLATE_RE, ' '));
}

/**
 * Facts traceable to original extraction + structured context (role, company, dates).
 * @param {string} originalText
 * @param {{ role?: string, company?: string, dates?: string, startDate?: string, endDate?: string, bullets?: string[] }} [context]
 */
export function extractFactsUsed(originalText, context = {}) {
  const blob = [
    originalText,
    context.role,
    context.company,
    context.dates,
    context.startDate,
    context.endDate,
    ...(context.bullets || []),
  ]
    .filter(Boolean)
    .join('\n');

  const facts = [];
  const pushUnique = (fact) => {
    const f = cleanText(fact);
    if (!f || f.length < 2) return;
    const key = f.toLowerCase();
    if (facts.some((x) => x.toLowerCase() === key)) return;
    facts.push(f);
  };

  for (const year of extractYears(blob)) pushUnique(year);
  for (const metric of extractMetrics(blob)) pushUnique(metric);

  const fragments = String(originalText || '')
    .split(/\n+|\s*[-•*]\s+|\s*[.·;]\s+/)
    .map(cleanText)
    .filter((s) => s.length > 2 && !/^(graphic designer|illustrator)$/i.test(s));

  for (const frag of fragments) pushUnique(frag);

  for (const token of contentTokens(blob)) {
    if (token.length >= 4) pushUnique(token);
  }

  if (context.role) pushUnique(context.role);
  if (context.company) pushUnique(context.company);
  if (context.dates) pushUnique(context.dates);

  return facts;
}

/**
 * Detect forbidden inventions in rewritten text.
 * @returns {string[]} violation codes
 */
export function detectRewriteViolations(originalText, rewrittenText, context = {}) {
  const original = cleanText(originalText);
  const rewritten = stripBoilerplate(rewrittenText);
  const sourceBlob = [
    original,
    context.role,
    context.company,
    context.dates,
    context.startDate,
    context.endDate,
    ...(context.bullets || []),
  ]
    .filter(Boolean)
    .join(' ');

  /** @type {string[]} */
  const violations = [];

  const sourceYears = new Set(extractYears(sourceBlob));
  for (const year of extractYears(rewritten)) {
    if (!sourceYears.has(year)) violations.push(`INVENT_DATE:${year}`);
  }

  const sourceMetrics = new Set(extractMetrics(sourceBlob));
  for (const metric of extractMetrics(rewritten)) {
    if (!sourceMetrics.has(metric)) violations.push(`INVENT_METRIC:${metric}`);
  }

  const servedAs = rewritten.match(/\b(?:served|worked|held(?:\s+the\s+role)?)\s+as\s+([^.(]+)/i);
  if (servedAs) {
    const inventedRole = servedAs[1].trim();
    const sourceRole = cleanText(context.role || '');
    if (
      inventedRole &&
      sourceRole &&
      !sourceRole.toLowerCase().includes(inventedRole.toLowerCase().slice(0, 12)) &&
      !original.toLowerCase().includes(inventedRole.toLowerCase().slice(0, 12))
    ) {
      violations.push(`INVENT_TITLE:${inventedRole}`);
    }
  }

  const atCompany = rewritten.match(/\bat\s+([A-Z][A-Za-z0-9&.'\s-]{2,40})(?:\s*\(|\.|,|$)/);
  if (atCompany) {
    const inventedCo = atCompany[1].trim();
    const sourceCo = cleanText(context.company || '');
    if (
      inventedCo &&
      sourceCo &&
      !sourceCo.toLowerCase().includes(inventedCo.toLowerCase()) &&
      !inventedCo.toLowerCase().includes(sourceCo.toLowerCase()) &&
      !sourceBlob.toLowerCase().includes(inventedCo.toLowerCase())
    ) {
      violations.push(`INVENT_COMPANY:${inventedCo}`);
    }
  }

  const sourceTokens = new Set(contentTokens(sourceBlob));
  const rewrittenTokens = contentTokens(rewritten);
  const novel = rewrittenTokens.filter(
    (t) => !sourceTokens.has(t) && t.length >= 5 && !ALLOWED_REWRITE_TOKENS.has(t)
  );
  if (novel.length >= 4) {
    violations.push(`INVENT_ACHIEVEMENT:${novel.slice(0, 3).join(',')}`);
  }

  return violations;
}

/**
 * @param {string} originalText
 * @param {string} rewrittenText
 * @param {string[]} factsUsed
 */
export function isRewriteTraceable(originalText, rewrittenText, factsUsed = []) {
  const original = cleanText(originalText);
  const rewritten = cleanText(rewrittenText);
  if (!original || !rewritten) return false;
  if (!factsUsed.length) return false;

  const originalLower = original.toLowerCase();
  const grounded = factsUsed.filter((f) => originalLower.includes(String(f).toLowerCase().slice(0, Math.min(12, f.length))));
  if (!grounded.length) return false;

  const rewrittenTokens = contentTokens(rewritten);
  const factTokens = new Set(factsUsed.flatMap((f) => contentTokens(f)));
  const overlap = rewrittenTokens.filter((t) => factTokens.has(t)).length;
  return overlap >= 1 || VERB_START_RE.test(rewritten);
}

/**
 * @param {number} sourceConfidence
 * @param {string[]} violations
 * @param {string} originalText
 * @param {string} rewrittenText
 * @param {string[]} factsUsed
 */
export function scoreRewriteConfidence(sourceConfidence, violations, originalText, rewrittenText, factsUsed = []) {
  let score = Math.round(Number(sourceConfidence) || 70);

  const original = cleanText(originalText);
  const rewritten = cleanText(rewrittenText);
  const sourceTokens = new Set(contentTokens(original));
  const rewrittenTokens = contentTokens(rewritten);
  const overlap =
    rewrittenTokens.length > 0
      ? rewrittenTokens.filter((t) => sourceTokens.has(t)).length / rewrittenTokens.length
      : 0;

  score = Math.round(score * 0.55 + overlap * 100 * 0.35 + (factsUsed.length > 0 ? 10 : 0));

  for (const v of violations) {
    if (v.startsWith('INVENT_DATE') || v.startsWith('INVENT_METRIC')) score -= 30;
    else if (v.startsWith('INVENT_COMPANY') || v.startsWith('INVENT_TITLE')) score -= 25;
    else if (v.startsWith('INVENT_ACHIEVEMENT')) score -= 20;
  }

  if (!isRewriteTraceable(original, rewritten, factsUsed)) score -= 25;

  return Math.max(0, Math.min(100, score));
}

/**
 * @param {{
 *   originalText: string,
 *   rewrittenText: string,
 *   sourceSection: string,
 *   sourceConfidence?: number,
 *   context?: object,
 * }} input
 */
export function buildSafeRewriteRecord(input) {
  const originalText = cleanText(input.originalText);
  const rewrittenText = cleanText(input.rewrittenText);
  const sourceSection = String(input.sourceSection || 'experience').trim();
  const factsUsed = extractFactsUsed(originalText, input.context || {});
  const violations = detectRewriteViolations(originalText, rewrittenText, input.context || {});
  const sourceConfidence = Math.round(Number(input.sourceConfidence) || 70);
  const rewriteConfidence = scoreRewriteConfidence(
    sourceConfidence,
    violations,
    originalText,
    rewrittenText,
    factsUsed
  );
  const traceable = isRewriteTraceable(originalText, rewrittenText, factsUsed);
  const autoApply = rewriteConfidence >= SAFE_REWRITE_CONFIDENCE_MIN && violations.length === 0 && traceable;

  return {
    originalText,
    rewrittenText,
    sourceSection,
    sourceConfidence,
    factsUsed,
    rewriteConfidence,
    violations,
    traceable,
    autoApplied: autoApply,
    engine: SAFE_REWRITE_VALIDATION,
    blockedReason: autoApply
      ? null
      : violations[0] ||
        (rewriteConfidence < SAFE_REWRITE_CONFIDENCE_MIN ? `LOW_CONFIDENCE:${rewriteConfidence}` : 'NOT_TRACEABLE'),
  };
}

/**
 * Apply safe rewrite gate — returns applied text or original when blocked.
 * @param {ReturnType<typeof buildSafeRewriteRecord>} record
 */
export function applySafeRewriteGate(record) {
  if (record.autoApplied) {
    return { text: record.rewrittenText, record, suggestion: null };
  }
  return {
    text: record.originalText,
    record,
    suggestion: {
      kind: 'rewrite',
      originalText: record.originalText,
      suggestedText: record.rewrittenText,
      sourceSection: record.sourceSection,
      confidence: record.rewriteConfidence,
      reason: record.blockedReason,
      factsUsed: record.factsUsed,
    },
  };
}

/**
 * Validate a rewrite record meets acceptance (traceable to original).
 * @param {ReturnType<typeof buildSafeRewriteRecord>} record
 */
export function validateRewriteRecord(record) {
  const errors = [];
  if (!record.originalText) errors.push('MISSING_ORIGINAL');
  if (!record.rewrittenText) errors.push('MISSING_REWRITTEN');
  if (!record.factsUsed?.length) errors.push('MISSING_FACTS_USED');
  if (!record.traceable) errors.push('NOT_TRACEABLE');
  if (record.violations?.length) errors.push(...record.violations);
  return { ok: errors.length === 0, errors, record };
}
