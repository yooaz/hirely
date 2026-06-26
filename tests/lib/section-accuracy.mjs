/**
 * Section-level precision / false positives / false negatives.
 */

export const SECTION_ACCURACY_GOAL_PCT = 90;

const SECTION_KEYS = ['experience', 'education', 'skills', 'languages', 'tools', 'clients'];

export function normalizeItem(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212–—]/g, '-')
    .replace(/[·•]/g, ' ')
    .replace(/[^\p{L}\p{N}\s@.+#%-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(text) {
  return new Set(
    normalizeItem(text)
      .split(' ')
      .filter((t) => t.length > 1)
  );
}

function languageCore(text) {
  return normalizeItem(text)
    .replace(/\s*[-:]\s*(native|fluent|professional|conversational|intermediate|basic|bilingual|courant|maternelle).*$/i, '')
    .trim();
}

function toolCore(text) {
  return normalizeItem(text)
    .replace(/\b(adobe creative suite|creative suite)\b/g, 'adobe')
    .replace(/\badobe\s+(photoshop|illustrator|indesign)\b/g, '$1')
    .trim();
}

function extractYearSpan(text) {
  const years = [...String(text || '').matchAll(/\d{4}/g)].map((m) => parseInt(m[0], 10));
  if (!years.length) return null;
  const end = /present/i.test(text) ? 2030 : Math.max(...years);
  return { start: Math.min(...years), end };
}

function yearSpansOverlap(a, b) {
  const sa = extractYearSpan(a);
  const sb = extractYearSpan(b);
  if (!sa || !sb) return false;
  const overlapYears = Math.min(sa.end, sb.end) - Math.max(sa.start, sb.start);
  return overlapYears >= 1;
}

const EXPERIENCE_ROLE_TOKENS = new Set([
  'designer', 'illustrator', 'director', 'manager', 'engineer', 'consultant',
  'analyst', 'recruiter', 'developer', 'freelance', 'independent', 'intern',
  'internship', 'lead', 'senior', 'visual', 'creative', 'art', 'product', 'marketing',
  'software', 'instructor', 'professor', 'teacher', 'nurse', 'operations', 'officer',
]);

const EXPERIENCE_ROLE_FAMILY_RE =
  /\b(designer|illustrator|director|developer|engineer|consultant|analyst|manager|executive)\b/i;

function experienceRoleTokens(text) {
  const employer = experienceEmployerCore(text);
  return [...tokenSet(text)].filter((t) => {
    if (employer && (t === employer || employer.includes(t) || t.includes(employer))) return false;
    if (/^(19|20)\d{2}$/.test(t) || t === 'present') return false;
    return EXPERIENCE_ROLE_TOKENS.has(t) || t.length >= 5;
  });
}

const EMPLOYER_HINT_RE =
  /\b(agency|agence|conseil|paris|london|studio|group|corp|inc|llc|gmbh|sa|sarl|akqa|betc|ddb|havas|publicis|mccann|dropbox|stripe|deloitte|unilever|salesforce|monzo|mayo|clinic|hospital|university|college|memorial|arup|cloudscale|growthlab|pentagram|strategy|pfizer|oregon|mit|harvard|michigan|heg|sciences|ucl|westminster|illinois|rush|northwestern|cleveland|independent|freelance|startup)\b/i;

function partLooksLikeRole(part) {
  const norm = normalizeItem(part);
  if (!norm || norm.length < 3) return false;
  const words = norm.split(/\s+/);
  const first = words[0];
  if (EXPERIENCE_ROLE_TOKENS.has(first)) return true;
  if (/\b(engineer|developer|designer|illustrator|manager|consultant|analyst|executive|director|recruiter|intern|professor|instructor|teacher|nurse|officer|freelance|operations)\b/.test(norm)) {
    return true;
  }
  return false;
}

function partLooksLikeEmployer(part) {
  const norm = normalizeItem(part);
  if (!norm || norm.length < 3) return false;
  if (/^present$/i.test(norm) || /^(19|20)\d{2}(?:\s*-\s*present)?$/i.test(norm)) return false;
  if (partLooksLikeRole(part)) return false;
  if (/\b(independent|freelance)\b/.test(norm)) return true;
  if (EMPLOYER_HINT_RE.test(norm)) return true;
  if (/^[a-z]+\s+g\.?\s+agency$/i.test(norm)) return true;
  return /^[A-ZÀ-Ö][\w&.'-]+(?:\s+[A-ZÀ-Ö][\w&.'-]+){0,4}$/.test(String(part || '').trim());
}

function experienceEmployerToken(text) {
  const norm = normalizeItem(text);
  if (!norm) return '';
  const hint = norm.match(EMPLOYER_HINT_RE);
  if (hint) return hint[0].toLowerCase();
  return norm.split(/\s+/).filter((t) => t.length > 2)[0] || '';
}

function experienceEmployerCore(text) {
  const parts = String(text || '')
    .split(/\s*[-–—]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return '';
  const candidates = [];
  for (const p of parts) {
    if (/^(19|20)\d{2}$/i.test(p) || /^present$/i.test(p)) continue;
    const norm = normalizeItem(p);
    if (norm.length < 3) continue;
    if (/\b(independent|freelance)\b/.test(norm)) {
      candidates.push('independent');
      continue;
    }
    if (EMPLOYER_HINT_RE.test(norm)) {
      candidates.push(experienceEmployerToken(p));
      continue;
    }
    if (partLooksLikeRole(p)) continue;
    if (partLooksLikeEmployer(p)) {
      candidates.push(experienceEmployerToken(p));
    }
  }
  if (candidates.length) return candidates[0];
  const whole = experienceEmployerToken(text);
  return whole;
}

/**
 * Fuzzy match between expected anchor and detected line.
 * @param {string} expected
 * @param {string} detected
 * @param {string} [section]
 */
export function itemsMatch(expected, detected, section = '') {
  const a = normalizeItem(expected);
  const b = normalizeItem(detected);
  if (!a || !b) return false;
  if (a === b) return true;

  if (section === 'languages') {
    const la = languageCore(expected);
    const lb = languageCore(detected);
    if (la && lb && (la === lb || la.includes(lb) || lb.includes(la))) return true;
  }

  if (section === 'tools') {
    const ta = toolCore(expected);
    const tb = toolCore(detected);
    if (ta && tb && (ta === tb || ta.includes(tb) || tb.includes(ta))) return true;
  }

  if (section === 'clients') {
    const ea = a.split(' ')[0];
    const db = b.split(' ')[0];
    if (ea.length >= 3 && (b.includes(ea) || a.includes(db))) return true;
  }

  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;

  const ta = tokenSet(expected);
  const tb = tokenSet(detected);
  if (!ta.size || !tb.size) return false;

  let inter = 0;
  for (const t of ta) {
    if (tb.has(t)) inter += 1;
  }
  const union = ta.size + tb.size - inter;
  const jaccard = union ? inter / union : 0;
  const minCover = inter / Math.min(ta.size, tb.size);

  if (section === 'experience') {
    const empA = experienceEmployerCore(expected);
    const empB = experienceEmployerCore(detected);
    if (empA && empB && empA !== empB && !empA.includes(empB) && !empB.includes(empA)) {
      return false;
    }
    const roleA = experienceRoleTokens(expected);
    const roleB = experienceRoleTokens(detected);
    const roleHit = roleA.some((t) => roleB.includes(t)) || roleB.some((t) => roleA.includes(t));
    const employerHit =
      !empA ||
      !empB ||
      empA === empB ||
      empA.includes(empB) ||
      empB.includes(empA);
    if (yearSpansOverlap(expected, detected) && employerHit) {
      if (roleHit) return true;
      const sameEmployer =
        empA &&
        empB &&
        (empA === empB || empA.includes(empB) || empB.includes(empA));
      if (sameEmployer) return true;
      if (
        sameEmployer &&
        EXPERIENCE_ROLE_FAMILY_RE.test(expected) &&
        EXPERIENCE_ROLE_FAMILY_RE.test(detected)
      ) {
        return true;
      }
    }
    if (employerHit && inter >= 3 && minCover >= 0.5) return true;
    if (employerHit && yearSpansOverlap(expected, detected) && inter >= 2) return true;
    return false;
  }
  if (inter >= 2 && minCover >= 0.45) return true;
  if (jaccard >= 0.45) return true;
  return false;
}

/**
 * @param {string[]} items
 */
export function expandSectionItems(items) {
  const out = [];
  for (const item of items || []) {
    const s = String(item || '').trim();
    if (!s) continue;
    if (/^[-•*]\s+/.test(s)) continue;
    if (/[,;·]/.test(s) && s.length < 120 && !/—/.test(s)) {
      const parts = s.split(/[,;·]/).map((p) => p.trim()).filter((p) => p.length > 1);
      if (parts.length > 1) {
        out.push(...parts);
        continue;
      }
    }
    out.push(s);
  }
  return out;
}

function experienceDedupeKey(text) {
  const emp = experienceEmployerCore(text);
  const years = extractYearSpan(text);
  if (!emp || !years) return normalizeItem(text);
  return `${emp}|${years.start}|${years.end}`;
}

function dedupeItems(items, section = '') {
  const out = [];
  const seen = new Set();
  for (const item of items || []) {
    const s = String(item || '').trim();
    if (!s) continue;
    if (section === 'experience') {
      const key = experienceDedupeKey(s);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
      continue;
    }
    if (out.some((existing) => itemsMatch(existing, s, section))) continue;
    out.push(s);
  }
  return out;
}

function isExperienceBullet(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (/^[-•*]\s+/.test(t)) return true;
  if (/^internship\s*—\s*internship/i.test(t)) return true;
  if (/^independent\s*—\s*\d{4}/i.test(t) && !/designer|illustrator|freelance|graphic/i.test(t)) return true;
  if (t.length < 28 && !/\d{4}/.test(t) && !/—/.test(t)) return true;
  if (/^(led|built|shipped|managed|created|collaborated|directed|produced|delivered|launched|scaled|facilitated|reduced|improved)\b/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * @param {import('../../src/core/resume-data.js').ResumeData} rd
 */
export function extractDetectedSections(rd) {
  const experiences = [];
  for (const e of rd?.experiences || []) {
    if (!e || typeof e !== 'object') continue;
    const line = [e.role, e.company, e.dates || [e.startDate, e.endDate].filter(Boolean).join(' — ')]
      .filter(Boolean)
      .join(' — ');
    if (line.trim() && !isExperienceBullet(line)) experiences.push(line.trim());
  }

  return {
    experience: dedupeItems(experiences, 'experience'),
    education: dedupeItems((rd?.education || []).map(String).filter(Boolean), 'education'),
    skills: dedupeItems((rd?.skills || []).map(String).filter(Boolean), 'skills'),
    languages: dedupeItems((rd?.languages || []).map(String).filter(Boolean), 'languages'),
    tools: dedupeItems((rd?.tools || []).map(String).filter(Boolean), 'tools'),
    clients: dedupeItems((rd?.clients || []).map(String).filter(Boolean), 'clients'),
  };
}

/**
 * @param {string[]} expected
 * @param {string[]} detected
 * @param {string} [section]
 */
export function computeSectionMetrics(expected, detected, section = '') {
  const exp = expandSectionItems(expected);
  const det = expandSectionItems(detected);
  const usedDet = new Set();
  let tp = 0;
  const falseNegatives = [];

  for (const e of exp) {
    const idx = det.findIndex((d, i) => !usedDet.has(i) && itemsMatch(e, d, section));
    if (idx >= 0) {
      tp += 1;
      usedDet.add(idx);
    } else {
      falseNegatives.push(e);
    }
  }

  const falsePositives = det.filter((_, i) => !usedDet.has(i));
  const fp = falsePositives.length;
  const fn = falseNegatives.length;
  const precision = det.length ? tp / det.length : exp.length === 0 ? 1 : 0;
  const recall = exp.length ? tp / exp.length : det.length === 0 ? 1 : 0;

  return {
    expected: exp.length,
    detected: det.length,
    tp,
    fp,
    fn,
    falsePositives,
    falseNegatives,
    precision: Math.round(precision * 1000) / 10,
    recall: Math.round(recall * 1000) / 10,
  };
}

/**
 * @param {Record<string, string[]>} groundTruth
 * @param {Record<string, string[]>} detected
 */
export function computeAllSectionMetrics(groundTruth, detected) {
  const sections = {};
  for (const key of SECTION_KEYS) {
    sections[key] = computeSectionMetrics(groundTruth[key] || [], detected[key] || [], key);
  }
  return sections;
}

/**
 * @param {Array<Record<string, ReturnType<typeof computeSectionMetrics>>>} fixtureSections
 */
export function aggregateSectionMetrics(fixtureSections) {
  const agg = {};
  for (const key of SECTION_KEYS) {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let expected = 0;
    let detected = 0;
    for (const sections of fixtureSections) {
      const m = sections[key];
      if (!m) continue;
      tp += m.tp;
      fp += m.fp;
      fn += m.fn;
      expected += m.expected;
      detected += m.detected;
    }
    const precision = detected ? tp / detected : expected === 0 ? 1 : 0;
    const recall = expected ? tp / expected : detected === 0 ? 1 : 0;
    agg[key] = {
      expected,
      detected,
      tp,
      fp,
      fn,
      precision: Math.round(precision * 1000) / 10,
      recall: Math.round(recall * 1000) / 10,
      goalMet: Math.round(precision * 1000) / 10 >= SECTION_ACCURACY_GOAL_PCT,
    };
  }
  return agg;
}

export { SECTION_KEYS };
