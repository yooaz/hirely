import { buildAlternationRe } from './match-utils.js';
import { CREATIVE_AGENCIES } from './creative/creativeAgencies.js';
import { LUXURY_BRANDS } from './creative/luxuryBrands.js';
import { CREATIVE_STUDIOS } from './creative/studios.js';

/** Brands / employers — must not be mistaken for a person's name. */
export const CLIENT_COMPANY_KEYWORDS = [
  ...new Set([...LUXURY_BRANDS, ...CREATIVE_AGENCIES, ...CREATIVE_STUDIOS]),
];

export const CLIENT_BRAND_RE = buildAlternationRe(CLIENT_COMPANY_KEYWORDS);

/** @deprecated Use CLIENT_COMPANY_KEYWORDS */
export const KNOWN_CLIENTS = CLIENT_COMPANY_KEYWORDS;

export function detectClientsInText(text) {
  return CLIENT_COMPANY_KEYWORDS.filter((c) =>
    new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(String(text || ''))
  );
}

export function lineLooksLikeClientList(line) {
  const hits = detectClientsInText(line);
  if (hits.length >= 2) return true;
  const words = String(line || '').split(/\s+/).filter(Boolean);
  const brandWords = words.filter((w) =>
    CLIENT_COMPANY_KEYWORDS.some((c) => c.toLowerCase() === w.toLowerCase())
  );
  return words.length >= 2 && brandWords.length / words.length >= 0.5;
}
