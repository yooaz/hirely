/**
 * SECTION_ENGINE_V2 — stage 2: classify detected blocks (no field extraction).
 */

import { SECTION_IDS } from './section-types-v2.js';
import { SEMANTIC_PARSE_MODE } from './semantic-line-types.js';
import { classifyLine } from './line-cleaner.js';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /https?:\/\/|linkedin\.com|behance\.|dribbble\./i;

/**
 * @param {import('./section-types-v2.js').SectionBlockV2[]} blocks
 * @returns {import('./section-types-v2.js').SectionBlockV2[]}
 */
export function classifySectionBlocks(blocks) {
  return (blocks || []).map((block) => {
    if (
      block.parseMode === SEMANTIC_PARSE_MODE ||
      String(block.classifyReason || '').startsWith('semantic')
    ) {
      return {
        ...block,
        classifiedConfidence: block.detectedConfidence ?? 85,
        classifyReason: block.classifyReason || 'semantic_infer',
      };
    }

    const lines = block.lines || [];
    const hay = lines.join('\n');
    let type = block.type || SECTION_IDS.UNKNOWN;
    let confidence = block.detectedConfidence ?? 70;
    let classifyReason = 'header';

    if (type === SECTION_IDS.PREAMBLE) {
      const contactHits =
        (EMAIL_RE.test(hay) ? 1 : 0) +
        (PHONE_RE.test(hay) ? 1 : 0) +
        (URL_RE.test(hay) ? 1 : 0);
      const expHits = lines.filter((l) => classifyLine(l) === 'experience').length;
      const profileHits = lines.filter((l) => /^(profile|profil)\b/i.test(l)).length;

      if (profileHits) {
        type = SECTION_IDS.PROFILE;
        confidence = 78;
        classifyReason = 'preamble_profile_header';
      } else if (contactHits >= 2 && lines.length <= 6) {
        type = SECTION_IDS.CONTACT;
        confidence = 85;
        classifyReason = 'preamble_contact';
      } else if (expHits >= 2) {
        type = SECTION_IDS.EXPERIENCE;
        confidence = 72;
        classifyReason = 'preamble_experience_heuristic';
      } else if (lines.length <= 4 && lines.some((l) => l.length > 40)) {
        type = SECTION_IDS.PROFILE;
        confidence = 68;
        classifyReason = 'preamble_identity_zone';
      } else {
        type = SECTION_IDS.PROFILE;
        confidence = 60;
        classifyReason = 'preamble_default_profile';
      }
    }

    if (type === SECTION_IDS.UNKNOWN && lines.length) {
      const dominant = dominantLineClass(lines);
      if (dominant) {
        type = dominant;
        confidence = 62;
        classifyReason = 'line_class_vote';
      }
    }

    if (type === SECTION_IDS.SUMMARY && lines.some((l) => /\b(19|20)\d{2}\b/.test(l))) {
      type = SECTION_IDS.EXPERIENCE;
      confidence = 65;
      classifyReason = 'summary_has_dates';
    }

    return {
      ...block,
      type,
      classifiedConfidence: Math.min(99, Math.round(confidence)),
      classifyReason,
    };
  });
}

/**
 * @param {string[]} lines
 * @returns {string|null}
 */
function dominantLineClass(lines) {
  const votes = new Map();
  for (const line of lines) {
    const c = classifyLine(line);
    if (!c || c === 'unknown') continue;
    const mapped =
      c === 'experience'
        ? SECTION_IDS.EXPERIENCE
        : c === 'education'
          ? SECTION_IDS.EDUCATION
          : c === 'skills'
            ? SECTION_IDS.SKILLS
            : c === 'tools'
              ? SECTION_IDS.TOOLS
              : c === 'languages'
                ? SECTION_IDS.LANGUAGES
                : c === 'clients'
                  ? SECTION_IDS.CLIENTS
                  : c === 'awards'
                    ? SECTION_IDS.AWARDS
                    : c === 'publications'
                      ? SECTION_IDS.PUBLICATIONS
                      : c === 'projects'
                        ? SECTION_IDS.PROJECTS
                        : c === 'summary'
                          ? SECTION_IDS.SUMMARY
                          : c === 'contact'
                            ? SECTION_IDS.CONTACT
                            : null;
    if (!mapped) continue;
    votes.set(mapped, (votes.get(mapped) || 0) + 1);
  }
  let best = null;
  let max = 0;
  for (const [k, v] of votes) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return max >= 2 ? best : null;
}
