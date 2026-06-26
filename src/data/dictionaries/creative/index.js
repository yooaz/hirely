/**
 * Hirely creative dictionaries — canonical entities for parser + OCR preservation.
 */

import { buildAlternationRe, escapeRegex, textContainsAny } from '../match-utils.js';
import { CREATIVE_SOFTWARE } from './creativeSoftware.js';
import { CREATIVE_AGENCIES } from './creativeAgencies.js';
import { LUXURY_BRANDS } from './luxuryBrands.js';
import { CREATIVE_STUDIOS } from './studios.js';
import { CREATIVE_SCHOOLS } from './creativeSchools.js';

export { CREATIVE_SOFTWARE } from './creativeSoftware.js';
export { CREATIVE_AGENCIES } from './creativeAgencies.js';
export { LUXURY_BRANDS } from './luxuryBrands.js';
export { CREATIVE_STUDIOS } from './studios.js';
export { CREATIVE_SCHOOLS } from './creativeSchools.js';

export const CREATIVE_DICTIONARY_CATEGORIES = {
  creativeSoftware: CREATIVE_SOFTWARE,
  creativeAgencies: CREATIVE_AGENCIES,
  luxuryBrands: LUXURY_BRANDS,
  studios: CREATIVE_STUDIOS,
  schools: CREATIVE_SCHOOLS,
};

/** User-requested anchor examples — used in coverage reports. */
export const CREATIVE_DICTIONARY_ANCHORS = [
  'Adobe',
  'Nike',
  'Converse',
  'Marvel',
  'Pantone',
  'PlayStation',
  'Cadillac',
  'Louis Vuitton',
  'Affinity Designer',
  'Illustrator',
  'Photoshop',
  'InDesign',
  'Behance',
  'LISAA',
  'Créapole',
];

function dedupeTerms(lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const term of list) {
      const key = String(term || '').trim();
      if (!key) continue;
      const low = key.toLowerCase();
      if (seen.has(low)) continue;
      seen.add(low);
      out.push(key);
    }
  }
  return out.sort((a, b) => b.length - a.length);
}

export const ALL_CREATIVE_ENTITIES = dedupeTerms(Object.values(CREATIVE_DICTIONARY_CATEGORIES));

/** @deprecated Use ALL_CREATIVE_ENTITIES */
export const CREATIVE_PROTECTED_TERMS = ALL_CREATIVE_ENTITIES;

export const CREATIVE_ENTITY_RE = buildAlternationRe(ALL_CREATIVE_ENTITIES);

/**
 * @param {string} text
 * @returns {boolean}
 */
export function textContainsCreativeEntity(text) {
  return CREATIVE_ENTITY_RE.test(String(text || ''));
}

/**
 * @param {string} line
 * @returns {boolean}
 */
export function isProtectedCreativeLine(line) {
  return textContainsCreativeEntity(line);
}

/**
 * @param {string} text
 * @returns {{ term: string, category: string, match: string }[]}
 */
export function findCreativeEntitiesInText(text) {
  const hay = String(text || '');
  const hits = [];
  const seen = new Set();

  for (const [category, terms] of Object.entries(CREATIVE_DICTIONARY_CATEGORIES)) {
    for (const term of terms) {
      const re = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi');
      const m = hay.match(re);
      if (!m) continue;
      const key = `${category}|${term.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ term, category, match: m[0] });
    }
  }
  return hits;
}

/**
 * @param {string} text
 * @param {object} [opts]
 * @returns {object}
 */
export function generateCreativeDictionaryCoverageReport(text, opts = {}) {
  const hay = String(text || '');
  const categories = {};
  let totalTerms = 0;
  let matchedTerms = 0;

  for (const [key, terms] of Object.entries(CREATIVE_DICTIONARY_CATEGORIES)) {
    const matched = textContainsAny(hay, terms);
    const missing = terms.filter((t) => !matched.includes(t));
    totalTerms += terms.length;
    matchedTerms += matched.length;
    categories[key] = {
      dictionarySize: terms.length,
      matchedInText: matched,
      matchedCount: matched.length,
      coveragePct: terms.length
        ? Math.round((matched.length / terms.length) * 1000) / 10
        : 0,
      missingFromText: missing.slice(0, opts.maxMissing ?? 12),
    };
  }

  const anchors = CREATIVE_DICTIONARY_ANCHORS.map((term) => {
    const found = textContainsAny(hay, [term]);
    const category =
      Object.entries(CREATIVE_DICTIONARY_CATEGORIES).find(([, list]) =>
        list.some((t) => t.toLowerCase() === term.toLowerCase())
      )?.[0] || 'unknown';
    return { term, category, found: found.length > 0, match: found[0] || null };
  });

  const entities = findCreativeEntitiesInText(hay);

  return {
    engine: 'hirely-creative-dictionaries-v1',
    textLength: hay.length,
    wordCount: hay.trim() ? hay.trim().split(/\s+/).length : 0,
    totalDictionaryTerms: totalTerms,
    uniqueEntitiesInText: entities.length,
    entitiesInText: entities.slice(0, opts.maxEntities ?? 48),
    dictionaryMatchRatePct:
      totalTerms > 0 ? Math.round((matchedTerms / totalTerms) * 1000) / 10 : 0,
    categories,
    anchors,
    anchorsFound: anchors.filter((a) => a.found).length,
    anchorsTotal: anchors.length,
    preservePolicy: 'never_auto_correct_canonical_entities',
  };
}

/**
 * @param {object} report
 */
export function printCreativeDictionaryCoverageReport(report) {
  console.log('\n═══ HIRELY Creative Dictionary — Coverage Report ═══');
  console.log(`Engine: ${report.engine}`);
  console.log(
    `Text: ${report.textLength} chars · ${report.wordCount} words · ${report.uniqueEntitiesInText} entities detected`
  );
  console.log(`Dictionary match rate (terms in text / all terms): ${report.dictionaryMatchRatePct}%`);
  console.log(`Anchors: ${report.anchorsFound}/${report.anchorsTotal} found`);
  for (const [key, cat] of Object.entries(report.categories)) {
    console.log(
      `  ${key}: ${cat.matchedCount}/${cat.dictionarySize} (${cat.coveragePct}%)` +
        (cat.matchedInText.length ? ` — e.g. ${cat.matchedInText.slice(0, 5).join(', ')}` : '')
    );
  }
  const missingAnchors = report.anchors.filter((a) => !a.found).map((a) => a.term);
  if (missingAnchors.length) {
    console.log(`  Anchors not in text: ${missingAnchors.join(', ')}`);
  }
  console.log(`Policy: ${report.preservePolicy}\n`);
}
