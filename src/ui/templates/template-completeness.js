/**
 * HIRELY P0 — Template completeness scoring (content visibility).
 * Content first: every populated section must appear in rendered HTML.
 */

export const REQUIRED_CONTENT_SECTIONS = [
  'identity',
  'summary',
  'experience',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
];

const SECTION_LABEL_HINTS = {
  identity: ['cvName', 'cvTitle', 'cvContact'],
  summary: ['cvLead', 'cvSection--summary', 'Summary', 'Profil', 'Profile'],
  experience: ['cvSection--experience', 'Experience', 'Expérience'],
  education: ['cvSection--education', 'Education', 'Formation'],
  skills: ['cvSection--skills', 'Skills', 'Compétences', 'cvSkillLine'],
  tools: ['cvSection--tools', 'cvSection--software', 'Tools', 'Outils', 'Software', 'cvToolsLine'],
  languages: ['cvSection--languages', 'Languages', 'Langues', 'cvLangLine'],
  clients: ['cvSection--clients', 'Clients'],
};

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w\s@.+/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function tokensForItem(item) {
  const raw = typeof item === 'string' ? item : JSON.stringify(item);
  const n = norm(raw);
  const parts = n.split(/\s+/).filter((w) => w.length >= 3);
  if (!parts.length) return [n].filter(Boolean);
  return [parts[0], parts.slice(0, 3).join(' ')];
}

function itemVisible(htmlText, item) {
  const hay = norm(htmlText);
  if (!hay) return false;
  for (const tok of tokensForItem(item)) {
    if (tok && hay.includes(norm(tok))) return true;
  }
  return false;
}

function sectionItems(profile, key) {
  if (key === 'identity') {
    const bits = [profile.name, profile.title, profile.email, profile.phone].filter(Boolean);
    return bits.length ? bits : [];
  }
  if (key === 'summary') {
    return profile.summary ? [profile.summary] : [];
  }
  const arr = profile[key];
  if (!Array.isArray(arr) || !arr.length) return [];
  return arr;
}

function sectionStructuralHint(html, key) {
  const hints = SECTION_LABEL_HINTS[key] || [];
  return hints.some((h) => html.includes(h));
}

/**
 * Score one template render against profile data.
 * @returns {{ score: number, sections: Record<string, { expected: number, visible: number, pct: number, pass: boolean }>, pass: boolean }}
 */
export function scoreTemplateCompleteness(html, profile) {
  const text = stripHtml(html);
  const sections = {};
  let weightedExpected = 0;
  let weightedVisible = 0;

  for (const key of REQUIRED_CONTENT_SECTIONS) {
    const items = sectionItems(profile, key);
    if (!items.length) {
      sections[key] = { expected: 0, visible: 0, pct: 100, pass: true, skipped: true };
      continue;
    }
    let visible = 0;
    for (const item of items) {
      if (itemVisible(text, item)) visible++;
    }
    const expected = items.length;
    const pct = expected ? Math.round((visible / expected) * 100) : 100;
    const structural = sectionStructuralHint(html, key);
    const pass = pct === 100 || (key !== 'identity' && structural && visible >= Math.max(1, expected - 1));
    sections[key] = { expected, visible, pct, pass, structural };
    weightedExpected += expected;
    weightedVisible += visible;
  }

  const score = weightedExpected ? Math.round((weightedVisible / weightedExpected) * 100) : 100;
  const pass = score === 100 && Object.values(sections).every((s) => s.skipped || s.pass);

  return { score, sections, pass };
}

/**
 * @param {Record<string, string>} renders templateId → html
 * @param {object} profile
 */
export function scoreAllTemplates(renders, profile) {
  const templates = {};
  let allPass = true;
  for (const [id, html] of Object.entries(renders)) {
    const result = scoreTemplateCompleteness(html, profile);
    templates[id] = result;
    if (!result.pass) allPass = false;
  }
  return { templates, pass: allPass };
}

/** P0 lock — finalResumeData sections (plural experiences, includes projects). */
export const LOCK_SECTIONS = [
  'identity',
  'summary',
  'experiences',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'projects',
];

const LOCK_BLOCK_PATTERNS = {
  identity: /<header[^>]*class="[^"]*cvHead/gi,
  summary: /<section[^>]*cvSection--summary|<p[^>]*class="[^"]*cvLead/gi,
  experiences: /<section[^>]*cvSection--experience/gi,
  education: /<section[^>]*cvSection--education/gi,
  skills: /<section[^>]*cvSection--skills/gi,
  tools: /<section[^>]*cvSection--(?:software|tools)/gi,
  languages: /<section[^>]*cvSection--languages/gi,
  clients: /<section[^>]*cvSection--clients/gi,
  projects: /<section[^>]*cvSection--projects/gi,
};

const LOCK_INLINE_PATTERNS = {
  summary: /class="[^"]*cvLead/gi,
  skills: /class="[^"]*cvSkillLine/gi,
  tools: /class="[^"]*cvToolsLine/gi,
  languages: /class="[^"]*cvLangLine/gi,
  clients: /class="[^"]*cvClientLine/gi,
};

function countPatternMatches(html, pattern) {
  if (!pattern) return 0;
  const re = new RegExp(pattern.source, pattern.flags);
  return (html.match(re) || []).length;
}

function countDomBlocks(html, key) {
  const blocks = countPatternMatches(html, LOCK_BLOCK_PATTERNS[key]);
  if (blocks) return blocks;
  return countPatternMatches(html, LOCK_INLINE_PATTERNS[key]);
}

function sourceItemsForLockSection(frd, key) {
  if (!frd || typeof frd !== 'object') return [];
  if (key === 'identity') {
    const id = frd.identity || {};
    return [id.name, id.title, id.email, id.phone].filter((s) => String(s || '').trim());
  }
  if (key === 'summary') {
    const s = String(frd.summary || '').trim();
    return s ? [s] : [];
  }
  if (key === 'experiences') {
    return (frd.experiences || []).filter((e) => {
      if (!e) return false;
      if (typeof e === 'string') return String(e).trim().length > 0;
      return !!(e.role || e.company || e.dates || (e.bullets || []).filter(Boolean).length);
    });
  }
  if (key === 'education') {
    return (frd.education || []).filter((e) => {
      if (!e) return false;
      if (typeof e === 'string') return String(e).trim().length > 0;
      return !!(e.school || e.degree || e.field || e.dates || e.startDate || e.endDate);
    });
  }
  const arr = frd[key];
  if (!Array.isArray(arr)) return [];
  return arr.filter((s) => String(s || '').trim());
}

/**
 * Count populated sections in finalResumeData.
 * @param {object} finalResumeData
 */
export function countSourceSections(finalResumeData) {
  const counts = {};
  const items = {};
  for (const key of LOCK_SECTIONS) {
    const list = sourceItemsForLockSection(finalResumeData, key);
    items[key] = list;
    counts[key] = list.length;
  }
  return { counts, items };
}

function itemVisibleForLock(text, item, key) {
  if (key === 'experiences' && item && typeof item === 'object') {
    const bits = [item.role, item.company, item.dates].filter((s) => String(s || '').trim());
    if (bits.some((b) => itemVisible(text, b))) return true;
    return itemVisible(text, JSON.stringify(item));
  }
  if (key === 'education' && item && typeof item === 'object') {
    const bits = [item.degree, item.school, item.field, item.dates].filter((s) => String(s || '').trim());
    if (bits.some((b) => itemVisible(text, b))) return true;
    const joined = bits.join(' — ');
    return joined ? itemVisible(text, joined) : false;
  }
  return itemVisible(text, item);
}

function sectionStructuralLock(html, key, domBlocks) {
  if (domBlocks > 0) return true;
  const inline = LOCK_INLINE_PATTERNS[key];
  if (inline && countPatternMatches(html, inline) > 0) return true;
  if (key === 'identity' && /class="[^"]*cvName/gi.test(html)) return true;
  if (key === 'experiences' && /class="[^"]*cvExpEntry/gi.test(html)) return true;
  if (key === 'experiences' && /class="[^"]*cv(?:V3(?:Ma|Pa|Se)|Ar)Exp/gi.test(html)) return true;
  if (key === 'education' && /class="[^"]*cvEdu(?:Entry|Line)/gi.test(html)) return true;
  if (key === 'projects' && /class="[^"]*cvProjectEntry/gi.test(html)) return true;
  return false;
}

/**
 * Lock score: finalResumeData counts vs DOM visibility (100% gate).
 * @param {string} html
 * @param {object} finalResumeData
 */
export function scoreTemplateCompletenessLock(html, finalResumeData) {
  const text = stripHtml(html);
  const { counts, items } = countSourceSections(finalResumeData);
  const sections = {};
  let weightedExpected = 0;
  let weightedVisible = 0;

  for (const key of LOCK_SECTIONS) {
    const sourceCount = counts[key] || 0;
    const domBlocks = countDomBlocks(html, key);

    if (!sourceCount) {
      sections[key] = {
        sourceCount: 0,
        domCount: 0,
        visible: 0,
        domBlocks,
        pct: 100,
        pass: domBlocks === 0,
        skipped: true,
        structural: false,
      };
      continue;
    }

    let visible = 0;
    for (const item of items[key] || []) {
      if (itemVisibleForLock(text, item, key)) visible++;
    }
    const domCount = visible;
    const pct = Math.round((visible / sourceCount) * 100);
    const structural = sectionStructuralLock(html, key, domBlocks);
    const pass = sourceCount === domCount && domCount === visible && pct === 100;
    sections[key] = {
      sourceCount,
      domCount,
      visible,
      domBlocks,
      pct,
      pass,
      skipped: false,
      structural,
    };
    weightedExpected += sourceCount;
    weightedVisible += visible;
  }

  const score = weightedExpected ? Math.round((weightedVisible / weightedExpected) * 100) : 100;
  const pass = score === 100 && Object.values(sections).every((s) => s.skipped ? s.pass : s.pass);

  return { score, sections, pass };
}

/**
 * @param {Record<string, string>} renders templateId → html
 * @param {object} finalResumeData
 */
export function scoreAllTemplatesLock(renders, finalResumeData) {
  const templates = {};
  let allPass = true;
  for (const [id, html] of Object.entries(renders)) {
    const result = scoreTemplateCompletenessLock(html, finalResumeData);
    templates[id] = result;
    if (!result.pass) allPass = false;
  }
  return { templates, pass: allPass };
}
