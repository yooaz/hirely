/**
 * Rebuild canonical section text from semantically grouped OCR blocks.
 */

import { smartLineMerge, normalizeReconstructedLine } from '../text-reconstruction.js';
import { SECTION_ORDER } from './semantic-grouper.js';

function isRedundantSectionHeaderLine(line, sectionKey) {
  const l = String(line || '').trim();
  if (!l) return true;
  if (sectionKey === 'experience' && /^(work experience|professional experience|experience|expérience)$/i.test(l)) {
    return true;
  }
  if (sectionKey === 'education' && /^(education|formation)$/i.test(l)) return true;
  if (sectionKey === 'skills' && /^skills?$/i.test(l)) return true;
  return false;
}

const SECTION_LABELS = {
  profile: 'Profile',
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  tools: 'Tools',
  languages: 'Languages',
  clients: 'Clients',
  interests: 'Interests',
  contact: 'Contact',
};

/**
 * @param {Record<string, { lines: string[] }[]>} buckets
 * @param {string[]} [preambleLines]
 */
export function rebuildSectionsText(buckets = {}, preambleLines = []) {
  const out = [];
  const preamble = smartLineMerge(preambleLines.map((l) => normalizeReconstructedLine(l)).filter(Boolean));
  if (preamble.length) {
    out.push(...preamble);
    out.push('');
  }

  for (const key of SECTION_ORDER) {
    const entries = buckets[key];
    if (!entries?.length) continue;
    const label = SECTION_LABELS[key] || key;
    out.push(label);
    for (const entry of entries) {
      const merged = smartLineMerge(
        (entry.lines || [])
          .map((l) => normalizeReconstructedLine(l))
          .filter(Boolean)
          .filter((l) => !isRedundantSectionHeaderLine(l, key))
      );
      for (const line of merged) out.push(line);
    }
    out.push('');
  }

  const unsorted = buckets.unsorted || [];
  if (unsorted.length) {
    for (const entry of unsorted) {
      const merged = smartLineMerge(
        (entry.lines || []).map((l) => normalizeReconstructedLine(l)).filter(Boolean)
      );
      for (const line of merged) out.push(line);
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Extract identity preamble before first section header.
 * @param {string[]} lines
 */
export function extractPreambleLines(lines = []) {
  const preamble = [];
  for (const line of lines) {
    const low = String(line || '').toLowerCase();
    if (/^(experience|education|skills|tools|languages|clients|profile|summary)\b/.test(low)) {
      break;
    }
    if (/^(work experience|professional experience)\b/.test(low)) break;
    preamble.push(line);
  }
  return preamble;
}
