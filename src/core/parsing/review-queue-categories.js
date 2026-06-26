/**
 * Suggest possible categories for uncertain review-queue items.
 */
import { isEmploymentCompanyLine } from './employment-suggestion-heuristics.js';
import { filterSuggestionCategoryOptions } from './suggestion-classification-fix.js';

const CATEGORY_HINTS = Object.freeze({
  skill: [
    'branding',
    'illustration',
    'design',
    'packaging',
    'identity',
    'editorial',
    'typography',
    'vector',
    'logo',
    'art direction',
    'graphic design',
    'visual identity',
  ],
  project: [
    'project',
    'campaign',
    'cover',
    'portfolio',
    'case study',
    'rebrand',
    'series',
    'app',
    'platform',
    'muse',
  ],
  interest: ['music', 'movies', 'gaming', 'reading', 'photography', 'travel', 'cinema', 'sport'],
  tool: [
    'photoshop',
    'illustrator',
    'figma',
    'indesign',
    'adobe',
    'sketch',
    'premiere',
    'blender',
  ],
  language: ['french', 'english', 'spanish', 'german', 'native', 'fluent', 'bilingual'],
  client: ['nike', 'adobe', 'marvel', 'louis vuitton', 'cadillac'],
  education: ['school', 'university', 'academy', 'institute', 'college', 'bachelor', 'master', 'degree', 'formation', 'école'],
  experience: ['freelance', 'designer', 'director', 'consultant', 'manager', 'present', 'intern', 'engineer'],
});

const DEFAULT_AMBIGUOUS = ['skill', 'project', 'interest'];

const TYPE_LABELS = Object.freeze({
  skill: 'Skill',
  tool: 'Tool',
  language: 'Language',
  client: 'Client',
  education: 'Education',
  experience: 'Experience',
  project: 'Project',
  interest: 'Interest',
  summary: 'Summary',
  contact: 'Contact',
  identity: 'Identity',
  unknown: 'Unknown',
});

function scoreType(value, type) {
  const hay = String(value || '').toLowerCase();
  const hints = CATEGORY_HINTS[type] || [];
  let score = 0;
  for (const hint of hints) {
    if (hay.includes(hint)) score += hint.includes(' ') ? 2 : 1;
  }
  return score;
}

/**
 * @param {string} value
 * @param {string} [detectedType]
 * @returns {{ id: string, label: string, score: number }[]}
 */
const SEMANTIC_TO_CATEGORY = Object.freeze({
  SKILL: 'skill',
  TOOL: 'tool',
  LANGUAGE: 'language',
  CLIENT: 'client',
  COMPANY: 'client',
  EDUCATION: 'education',
  EXPERIENCE: 'experience',
  JOB_TITLE: 'experience',
  PERSON_NAME: 'identity',
  SUMMARY: 'summary',
  LINK: 'contact',
  UNKNOWN: 'unknown',
});

/**
 * Build category picker options from semantic detection alternatives (H12).
 * @param {Array<{ type?: string, factType?: string, confidence?: number }>} alternatives
 * @returns {{ id: string, label: string, score: number, confidence: number }[]}
 */
export function buildPossibleCategoriesFromAlternatives(alternatives) {
  const out = [];
  const seen = new Set();
  for (const alt of alternatives || []) {
    const rawType = String(alt.factType || alt.type || '').trim();
    const id =
      SEMANTIC_TO_CATEGORY[rawType] ||
      (rawType.includes('_') ? SEMANTIC_TO_CATEGORY[rawType.toUpperCase()] : null) ||
      rawType.toLowerCase().replace(/s$/, '') ||
      'unknown';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const confidence = Math.round(Number(alt.confidence ?? alt.score ?? 0));
    out.push({
      id,
      label: TYPE_LABELS[id] || id,
      score: confidence,
      confidence,
    });
  }
  out.sort((a, b) => b.confidence - a.confidence);
  return out.slice(0, 4);
}

export function suggestPossibleCategories(value, detectedType = 'unknown') {
  if (isEmploymentCompanyLine(value)) {
    return [
      { id: 'experience', label: TYPE_LABELS.experience },
      { id: 'client', label: TYPE_LABELS.client },
      { id: 'unknown', label: TYPE_LABELS.unknown },
    ];
  }

  const scores = [];
  for (const type of Object.keys(CATEGORY_HINTS)) {
    const score = scoreType(value, type);
    if (score > 0) scores.push({ id: type, label: TYPE_LABELS[type] || type, score });
  }

  scores.sort((a, b) => b.score - a.score);

  let picked = scores.slice(0, 4).map((s) => ({ id: s.id, label: s.label }));

  if (
    detectedType &&
    detectedType !== 'unknown' &&
    !picked.some((p) => p.id === detectedType)
  ) {
    picked.unshift({ id: detectedType, label: TYPE_LABELS[detectedType] || detectedType });
  }

  if (!picked.length) {
    picked = DEFAULT_AMBIGUOUS.map((id) => ({ id, label: TYPE_LABELS[id] || id }));
  }

  const ambiguous =
    !detectedType || detectedType === 'unknown' || detectedType === 'raw';
  if (ambiguous) {
    for (const id of DEFAULT_AMBIGUOUS) {
      if (!picked.some((p) => p.id === id)) {
        picked.push({ id, label: TYPE_LABELS[id] || id });
      }
    }
  }

  const seen = new Set();
  const out = [];
  for (const p of picked) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length >= 4) break;
  }
  return filterSuggestionCategoryOptions(value, out);
}

export function categoryLabel(type) {
  return TYPE_LABELS[type] || String(type || 'unknown');
}
