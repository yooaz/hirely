/**
 * HIRELY H4 — generic section detection with confidence scores.
 */

import {
  SECTION_DETECTION_V1,
  scoreSectionHeader,
  getSectionAliases,
} from './section-fuzzy.js';

export { SECTION_DETECTION_V1, scoreSectionHeader, getSectionAliases };

/** Canonical sections required by H4 */
export const H4_SECTION_KEYS = [
  'experience',
  'education',
  'skills',
  'languages',
  'projects',
  'certifications',
  'volunteer',
  'interests',
];

/** Representative header labels per section (for reports / fixtures) */
export const H4_SECTION_LABELS = {
  experience: ['Experience', 'Work Experience', 'Employment', 'Professional Experience'],
  education: ['Education', 'Studies', 'Academic Background'],
  skills: ['Skills', 'Technical Skills', 'Competencies'],
  languages: ['Languages'],
  projects: ['Projects'],
  certifications: ['Certifications'],
  volunteer: ['Volunteer'],
  interests: ['Interests'],
};

const INLINE_BODY_RE = /^([A-Za-zÀ-ÿ][\w\s&/'-]{1,40})\s*[:：]\s*(.+)$/;

function bumpConfidence(map, key, confidence) {
  const prev = map[key] ?? 0;
  map[key] = Math.max(prev, confidence);
}

/**
 * Split CV text by detected section headers; attach per-section confidence.
 * @param {string} text
 * @returns {{ sections: Record<string, string[]>, sectionConfidence: Record<string, number>, headers: object[] }}
 */
export function detectSectionsWithConfidence(text) {
  const sections = { top: [] };
  const sectionConfidence = {};
  /** @type {object[]} */
  const headers = [];
  let cur = 'top';

  for (const line of String(text || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const inline = trimmed.match(INLINE_BODY_RE);
    if (inline) {
      const scored = scoreSectionHeader(inline[1]);
      if (scored) {
        cur = scored.key;
        sections[cur] = sections[cur] || [];
        bumpConfidence(sectionConfidence, cur, scored.confidence);
        headers.push({ ...scored, lineIndex: headers.length, hasBody: inline[2].length > 1 });
        if (inline[2].length > 1) sections[cur].push(inline[2].trim());
        continue;
      }
    }

    const scored = scoreSectionHeader(trimmed);
    if (scored) {
      cur = scored.key;
      sections[cur] = sections[cur] || [];
      bumpConfidence(sectionConfidence, cur, scored.confidence);
      headers.push({ ...scored, lineIndex: headers.length, hasBody: false });
    } else {
      (sections[cur] = sections[cur] || []).push(trimmed);
    }
  }

  return { sections, sectionConfidence, headers };
}

/**
 * Score a batch of candidate header lines (alias matrix for QA).
 * @param {string[]} lines
 */
export function scoreHeaderBatch(lines) {
  return (lines || []).map((line) => scoreSectionHeader(line) || { key: null, confidence: 0, matchType: 'none', line });
}
