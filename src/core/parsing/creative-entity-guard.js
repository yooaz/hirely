/**
 * Mask creative dictionary entities before OCR char fixes — never auto-correct them.
 */

import {
  ALL_CREATIVE_ENTITIES,
  CREATIVE_DICTIONARY_CATEGORIES,
  findCreativeEntitiesInText,
} from '../../data/dictionaries/creative/index.js';
import { CREATIVE_AGENCIES } from '../../data/dictionaries/creative/creativeAgencies.js';
import { CREATIVE_SCHOOLS } from '../../data/dictionaries/creative/creativeSchools.js';
import { escapeRegex } from '../../data/dictionaries/match-utils.js';

const MASK_PREFIX = '\uE000CRE';
const MASK_SUFFIX = '\uE001';

/** OCR typo patterns → canonical dictionary form only (whitelist). */
export const CREATIVE_OCR_CANONICAL_HINTS = [
  [/\bphotosh0p\b/gi, 'Photoshop'],
  [/\bphotoshop\b/gi, 'Photoshop'],
  [/\billustrat0r\b/gi, 'Illustrator'],
  [/\billustrator\b/gi, 'Illustrator'],
  [/\bindes[1i]gn\b/gi, 'InDesign'],
  [/\bindesign\b/gi, 'InDesign'],
  [/\badobe\b/gi, 'Adobe'],
  [/\bpantone\b/gi, 'Pantone'],
  [/\bplaystation\b/gi, 'PlayStation'],
  [/\bbehance\b/gi, 'Behance'],
  [/\baffinity\s*designer\b/gi, 'Affinity Designer'],
  [/\blouis\s*vuitton\b/gi, 'Louis Vuitton'],
  [/\blouis\s*vuit0n\b/gi, 'Louis Vuitton'],
  [/\blou[i1l]s\s*vu[i1l]tt[o0]n\b/gi, 'Louis Vuitton'],
  [/\bni[kk]e\b/gi, 'Nike'],
  [/\bconverse\b/gi, 'Converse'],
  [/\bmarvel\b/gi, 'Marvel'],
  [/\bcadillac\b/gi, 'Cadillac'],
];

function buildDictionaryOcrHints(terms = []) {
  const hints = [];
  const seen = new Set();
  for (const term of terms) {
    const canonical = String(term || '').trim();
    if (!canonical || canonical.length < 3) continue;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const ascii = key.normalize('NFD').replace(/\p{M}/gu, '');
    const pattern =
      ascii !== key
        ? new RegExp(`\\b(?:${escapeRegex(key)}|${escapeRegex(ascii)})\\b`, 'gi')
        : new RegExp(`\\b${escapeRegex(key)}\\b`, 'gi');
    hints.push([pattern, canonical]);
  }
  return hints;
}

const DICTIONARY_OCR_HINTS = buildDictionaryOcrHints([
  ...CREATIVE_SCHOOLS,
  ...CREATIVE_AGENCIES.filter((a) => ALL_CREATIVE_ENTITIES.some((t) => t.toLowerCase() === a.toLowerCase())),
]);

const SORTED_ENTITIES = [...ALL_CREATIVE_ENTITIES].sort((a, b) => b.length - a.length);

/**
 * @param {string} text
 * @returns {{ masked: string, originals: string[] }}
 */
export function maskCreativeEntities(text) {
  let masked = String(text || '');
  const originals = [];

  for (const term of SORTED_ENTITIES) {
    const re = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi');
    masked = masked.replace(re, (match) => {
      const id = originals.length;
      originals.push(match);
      return `${MASK_PREFIX}${id}${MASK_SUFFIX}`;
    });
  }
  return { masked, originals };
}

/**
 * @param {string} masked
 * @param {string[]} originals
 * @returns {string}
 */
export function unmaskCreativeEntities(masked, originals) {
  return String(masked || '').replace(
    new RegExp(`${escapeRegex(MASK_PREFIX)}(\\d+)${escapeRegex(MASK_SUFFIX)}`, 'g'),
    (_, id) => originals[Number(id)] ?? ''
  );
}

/**
 * Apply a transform only on non-masked segments (masked spans copied verbatim).
 * @param {string} text
 * @param {(segment: string) => string} transform
 */
export function transformPreservingCreativeEntities(text, transform) {
  const { masked, originals } = maskCreativeEntities(text);
  const transformed = transform(masked);
  return unmaskCreativeEntities(transformed, originals);
}

/**
 * Allowed OCR fixes: canonical hints only, never inside masked entities.
 * @param {string} line
 */
export function applyCreativeOcrCanonicalHints(line) {
  return transformPreservingCreativeEntities(String(line || ''), (segment) => {
    let l = segment;
    for (const [re, rep] of [...CREATIVE_OCR_CANONICAL_HINTS, ...DICTIONARY_OCR_HINTS]) {
      if (!ALL_CREATIVE_ENTITIES.some((t) => t.toLowerCase() === String(rep).toLowerCase())) continue;
      l = l.replace(re, rep);
    }
    return l;
  });
}

export { findCreativeEntitiesInText, CREATIVE_DICTIONARY_CATEGORIES };
