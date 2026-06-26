/**
 * DEDUPE_ENGINE — normalize, fuzzy compare, merge duplicate rows (OCR + native PDF).
 * Uses Levenshtein ratio, token overlap, and normalized keys.
 * V3: safe dedup — never drop unique clients/projects/experience tokens embedded in longer lines.
 */

import { dedupeEducationEntries } from './education-dedupe.js';
import { isSectionLabelLeakage } from '../validation/section-label-leakage-guard.js';

export const DEDUPE_ENGINE = 'DEDUPE_ENGINE_V3';
export const DEDUPE_SIMILARITY_DEFAULT = 0.88;
export const DEDUPE_SIMILARITY_SHORT = 0.92;

const FREELANCE_SIGNAL_RE =
  /\b(freelance|independent|indépendant|self[- ]?employed|auto[- ]?entrepreneur|consultant indépendant)\b/i;

const DEDUPE_KEY_MAX = 280;

function collapseDedupeWs(text) {
  let out = '';
  let prevWs = false;
  const s = String(text || '').slice(0, DEDUPE_KEY_MAX);
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      if (!prevWs && out.length) {
        out += ' ';
        prevWs = true;
      }
    } else {
      out += ch;
      prevWs = false;
    }
  }
  return out.trim();
}

/**
 * Normalize date separators for stable compare (2011–2022, 2011/2022 → 2011 to 2022).
 * @param {string} s
 */
export function normalizeDateCompareKey(s) {
  const t = String(s || '').slice(0, DEDUPE_KEY_MAX);
  const re =
    /\b((?:19|20)\d{2})\s*[-–—/]\s*((?:19|20)\d{2}|present|présent|current|now|aujourd'?hui)\b/gi;
  let result = '';
  let lastIndex = 0;
  let m;
  while ((m = re.exec(t)) !== null) {
    result += t.slice(lastIndex, m.index);
    const end = /present|présent|current|now|aujourd/i.test(m[2]) ? 'present' : m[2];
    result += `${m[1]} to ${end}`;
    lastIndex = m.index + m[0].length;
  }
  return result + t.slice(lastIndex);
}

/**
 * Trim, collapse spaces, lowercase, strip punctuation for stable compare keys.
 * @param {string} s
 */
export function normalizeCompareString(s) {
  try {
    let t = collapseDedupeWs(String(s || '').slice(0, DEDUPE_KEY_MAX)).toLowerCase();
    t = t.normalize('NFD').replace(/\p{M}/gu, '');
    t = normalizeDateCompareKey(t);
    let out = '';
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (/[.,;:!?'"()[\]{}]/.test(ch)) out += ' ';
      else out += ch;
    }
    return collapseDedupeWs(out);
  } catch {
    return collapseDedupeWs(String(s || '').slice(0, 80)).toLowerCase();
  }
}

/**
 * Levenshtein edit distance (iterative, bounded).
 * @param {string} a
 * @param {string} b
 */
export function levenshteinDistance(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  const m = s.length;
  const n = t.length;
  const cap = 320;
  if (m > cap || n > cap) {
    return s.length === t.length ? 0 : Math.abs(m - n) + 1;
  }

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[n];
}

/**
 * @param {string} a
 * @param {string} b
 */
export function levenshteinSimilarity(a, b) {
  const na = normalizeCompareString(a);
  const nb = normalizeCompareString(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (!maxLen) return 1;
  return 1 - levenshteinDistance(na, nb) / maxLen;
}

/**
 * Token Jaccard similarity on normalized words.
 * @param {string} a
 * @param {string} b
 */
export function tokenSimilarity(a, b) {
  const ta = new Set(
    normalizeCompareString(a)
      .split(' ')
      .filter((w) => w.length > 1)
  );
  const tb = new Set(
    normalizeCompareString(b)
      .split(' ')
      .filter((w) => w.length > 1)
  );
  if (!ta.size && !tb.size) return normalizeCompareString(a) === normalizeCompareString(b) ? 1 : 0;
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) {
    if (tb.has(w)) inter += 1;
  }
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

/**
 * Combined fuzzy + semantic similarity score in [0, 1].
 * @param {string} a
 * @param {string} b
 */
export function semanticSimilarity(a, b) {
  const na = normalizeCompareString(a);
  const nb = normalizeCompareString(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const short = na.length <= nb.length ? na : nb;
  const long = na.length > nb.length ? na : nb;
  if (short.length >= 4 && long.includes(short)) return 0.95;

  const lev = levenshteinSimilarity(a, b);
  const tok = tokenSimilarity(a, b);
  return Math.max(lev, tok, lev * 0.55 + tok * 0.45);
}

/**
 * Safe similarity for OCR dedup — protects unique entities and section labels.
 * @param {string} a
 * @param {string} b
 * @param {{ respectSectionLabels?: boolean }} [opts]
 */
export function semanticSimilarityForDedup(a, b, opts = {}) {
  const na = normalizeCompareString(a);
  const nb = normalizeCompareString(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  if (opts.respectSectionLabels !== false) {
    const aLabel = isSectionLabelLeakage(a);
    const bLabel = isSectionLabelLeakage(b);
    if (aLabel !== bLabel) return 0;
  }

  const short = na.length <= nb.length ? na : nb;
  const long = na.length > nb.length ? na : nb;

  if (short.length >= 4 && long.includes(short)) {
    const ratio = short.length / long.length;
    const shortTokens = short.split(' ').filter((w) => w.length > 1);
    const longTokens = long.split(' ').filter((w) => w.length > 1);
    if (shortTokens.length === 1 && longTokens.length >= 3 && ratio < 0.5) return 0;
    if (ratio >= 0.55) {
      return Math.max(0.92, levenshteinSimilarity(a, b), tokenSimilarity(a, b));
    }
  }

  const lev = levenshteinSimilarity(a, b);
  const tok = tokenSimilarity(a, b);
  return Math.max(lev, tok, lev * 0.55 + tok * 0.45);
}

function similarityThresholdFor(label) {
  const len = normalizeCompareString(label).length;
  return len <= 12 ? DEDUPE_SIMILARITY_SHORT : DEDUPE_SIMILARITY_DEFAULT;
}

/**
 * Pick the richer of two string labels (longer, more tokens).
 * @param {string} a
 * @param {string} b
 */
export function pickRicherStringLabel(a, b) {
  const sa = collapseDedupeWs(a);
  const sb = collapseDedupeWs(b);
  if (!sa) return sb;
  if (!sb) return sa;
  if (sa.length !== sb.length) return sa.length > sb.length ? sa : sb;
  const ta = sa.split(/\s+/).length;
  const tb = sb.split(/\s+/).length;
  return ta >= tb ? sa : sb;
}

/**
 * Fuzzy dedupe via Levenshtein + token similarity. First occurrence wins order.
 * @param {Array<string|object>} items
 * @param {object} [opts]
 * @param {number} [opts.threshold]
 * @param {(item: *) => string} [opts.toLabel]
 * @param {(a: *, b: *) => *} [opts.pickRicher]
 * @param {(a: *, b: *) => number} [opts.similarity]
 */
export function dedupeBySimilarity(items = [], opts = {}) {
  const toLabel = opts.toLabel || ((item) => collapseDedupeWs(item));
  const pickRicher =
    opts.pickRicher ||
    ((a, b) => {
      const la = toLabel(a);
      const lb = toLabel(b);
      if (typeof a === 'string' && typeof b === 'string') {
        return pickRicherStringLabel(a, b);
      }
      return la.length >= lb.length ? a : b;
    });
  const similarity =
    opts.similarity ||
    ((a, b) => semanticSimilarityForDedup(toLabel(a), toLabel(b)));
  const threshold = opts.threshold ?? DEDUPE_SIMILARITY_DEFAULT;

  const kept = [];
  for (const item of items || []) {
    const label = toLabel(item);
    if (!label) continue;

    let merged = false;
    const itemThreshold = opts.threshold ?? similarityThresholdFor(label);

    for (let i = 0; i < kept.length; i++) {
      const existingLabel = toLabel(kept[i]);
      const score = similarity(kept[i], item);
      const gate = Math.max(itemThreshold, similarityThresholdFor(existingLabel));
      if (score >= gate) {
        kept[i] = pickRicher(kept[i], item);
        merged = true;
        break;
      }
    }
    if (!merged) kept.push(item);
  }
  return kept;
}

/**
 * Case-insensitive fuzzy list dedupe; keeps richest label per cluster.
 * @param {string[]} items
 */
export function dedupeStringList(items = []) {
  return dedupeEntityStringList(items);
}

/**
 * Dedupe client/project/skill strings without dropping unique entities.
 * @param {string[]} items
 * @param {object} [opts]
 */
export function dedupeEntityStringList(items = [], opts = {}) {
  return dedupeBySimilarity(
    (items || []).map((item) => collapseDedupeWs(item)).filter(Boolean),
    {
      toLabel: (item) => collapseDedupeWs(item),
      pickRicher: (a, b) => pickRicherStringLabel(a, b),
      similarity: (a, b) => semanticSimilarityForDedup(a, b, opts),
    }
  );
}

/** @param {string[]} items */
export function dedupeClientList(items = []) {
  return dedupeEntityStringList(items, { respectSectionLabels: true });
}

/** @param {string[]} items */
export function dedupeProjectList(items = []) {
  return dedupeEntityStringList(items, { respectSectionLabels: true });
}

function isFreelanceLike(exp) {
  const role = String(exp?.role || '');
  const company = String(exp?.company || '');
  if (FREELANCE_SIGNAL_RE.test(role) || FREELANCE_SIGNAL_RE.test(company)) return true;
  if (!company.trim() && FREELANCE_SIGNAL_RE.test(role)) return true;
  return !company.trim() && /^freelance\b/i.test(role.trim());
}

function normalizeFreelanceRole(role) {
  const r = normalizeCompareString(role);
  if (!r || r === 'freelance') return 'freelance';
  if (FREELANCE_SIGNAL_RE.test(r)) return 'freelance';
  return r;
}

/**
 * @param {object} exp
 */
export function experienceDedupeKey(exp) {
  let role = normalizeCompareString(exp?.role);
  let company = normalizeCompareString(exp?.company);
  const dates = normalizeCompareString(
    exp?.dates || [exp?.startDate, exp?.endDate].filter(Boolean).join('–')
  );
  if (isFreelanceLike(exp)) {
    role = normalizeFreelanceRole(role);
    company = 'independent';
  }
  return `${role}|${company}|${dates}`;
}

/**
 * @param {string} line
 */
export function educationLineDedupeKey(line) {
  return normalizeCompareString(line);
}

/**
 * @param {object} a
 * @param {object} b
 */
export function pickRicherExperience(a, b) {
  const score = (e) => {
    let s = 0;
    s += (e?.bullets || []).filter(Boolean).length * 12;
    s += String(e?.role || '').trim().length;
    s += String(e?.company || '').trim().length;
    s += String(e?.dates || '').trim().length;
    s += String(e?.description || '').trim().length;
    return s;
  };
  return score(a) >= score(b) ? { ...a } : { ...b };
}

/**
 * @param {object} a
 * @param {object} b
 */
export function experienceSimilarity(a, b) {
  if (!a || !b) return 0;
  const keyA = experienceDedupeKey(a);
  const keyB = experienceDedupeKey(b);
  if (keyA === keyB) return 1;

  const roleSim = semanticSimilarityForDedup(a.role, b.role);
  const companySim = semanticSimilarityForDedup(a.company, b.company);
  const companyA = normalizeCompareString(a.company);
  const companyB = normalizeCompareString(b.company);
  if (companyA && companyB && companyA !== companyB && companySim < 0.88) return 0;
  const datesA = normalizeCompareString(a.dates || [a.startDate, a.endDate].filter(Boolean).join(' '));
  const datesB = normalizeCompareString(b.dates || [b.startDate, b.endDate].filter(Boolean).join(' '));
  const datesMatch = !datesA || !datesB || datesA === datesB || semanticSimilarity(datesA, datesB) >= 0.9;

  if (companySim >= 0.9 && roleSim >= 0.85 && datesMatch) {
    return Math.min(1, (companySim + roleSim) / 2 + 0.08);
  }
  return semanticSimilarityForDedup(
    [a.role, a.company, a.dates].filter(Boolean).join(' — '),
    [b.role, b.company, b.dates].filter(Boolean).join(' — ')
  );
}

/**
 * Merge duplicate structured experience entries (role + company + dates).
 * @param {object[]} experiences
 */
export function dedupeExperienceEntries(experiences = []) {
  const pre = [];
  const byKey = new Map();
  const order = [];

  for (const exp of experiences || []) {
    if (!exp || typeof exp !== 'object') continue;
    const key = experienceDedupeKey(exp);
    if (!key.replace(/\|/g, '').length) {
      order.push({ key: `__row_${order.length}`, exp: { ...exp } });
      continue;
    }
    if (byKey.has(key)) {
      byKey.set(key, pickRicherExperience(byKey.get(key), exp));
      continue;
    }
    byKey.set(key, { ...exp });
    order.push({ key, exp: byKey.get(key) });
  }

  const seen = new Set();
  for (const { key, exp } of order) {
    if (key.startsWith('__row_')) {
      pre.push(exp);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    pre.push(byKey.get(key));
  }

  return dedupeBySimilarity(pre, {
    threshold: 0.9,
    toLabel: (exp) => [exp?.role, exp?.company, exp?.dates].filter(Boolean).join(' — '),
    pickRicher: pickRicherExperience,
    similarity: experienceSimilarity,
  });
}

/**
 * Exact normalized dedupe then school/program merge.
 * @param {string[]} education
 * @param {object} [opts]
 */
export function dedupeEducationStrings(education = [], opts = {}) {
  const pre = dedupeBySimilarity(
    (education || []).map((item) => collapseDedupeWs(item)).filter(Boolean),
    {
      toLabel: (item) => collapseDedupeWs(item),
      pickRicher: (a, b) => pickRicherStringLabel(a, b),
    }
  );
  return dedupeEducationEntries(pre, opts);
}

/**
 * Dedupe flat cvData.experience string lines.
 * @param {string[]} lines
 */
export function dedupeCvExperienceLines(lines = []) {
  return dedupeBySimilarity(
    (lines || []).map((line) => collapseDedupeWs(line)).filter(Boolean),
    {
      toLabel: (item) => collapseDedupeWs(item),
      pickRicher: (a, b) => pickRicherStringLabel(a, b),
    }
  );
}

/**
 * Dedupe plain-text lines from OCR + native PDF merge.
 * @param {string[]} lines
 */
export function dedupeTextLinesBySimilarity(lines = []) {
  return dedupeBySimilarity(
    (lines || [])
      .map((line) => collapseDedupeWs(line))
      .filter((line) => line && !isSectionLabelLeakage(line)),
    {
      threshold: 0.9,
      toLabel: (item) => collapseDedupeWs(item),
      pickRicher: (a, b) => pickRicherStringLabel(a, b),
      similarity: (a, b) => semanticSimilarityForDedup(a, b),
    }
  );
}
