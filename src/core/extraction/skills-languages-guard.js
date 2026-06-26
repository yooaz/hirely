/**
 * Extraction V2 — prevent skills/languages cross-contamination.
 */

import {
  STRICT_LANGUAGE_NAME_RE,
  extractStrictLanguageLine,
  isForbiddenLanguageLine,
  buildStrictLanguageReviewItem,
} from '../parsing/strict-language-extraction.js';
import { scoreSkillLine } from '../validation/confidence-gate.js';

export const SKILLS_LANGUAGES_GUARD_V2 = 'SKILLS_LANGUAGES_GUARD_V2';

const SOFTWARE_RE =
  /\b(figma|photoshop|illustrator|indesign|after effects|premiere|sketch|blender|cinema 4d|xd|affinity|lightroom|excel|word|powerpoint|python|javascript|typescript|react|node\.?js|sql|aws|azure|jira|confluence|slack|notion|behance|pantone)\b/i;

const PROFICIENCY_ONLY_RE =
  /^(native|fluent|bilingual|conversational|intermediate|courant|bilingue|natif|professional|advanced|beginner)$/i;

/**
 * @param {string} line
 */
export function looksLikeLanguageNotSkill(line) {
  const s = String(line || '').trim();
  if (!s) return false;
  if (PROFICIENCY_ONLY_RE.test(s)) return true;
  if (isForbiddenLanguageLine(s)) return false;
  if (STRICT_LANGUAGE_NAME_RE.test(s) && !SOFTWARE_RE.test(s)) return true;
  const strict = extractStrictLanguageLine(s);
  return strict.ok;
}

/**
 * @param {string} line
 */
export function looksLikeSkillNotLanguage(line) {
  const s = String(line || '').trim();
  if (!s) return false;
  if (SOFTWARE_RE.test(s)) return true;
  if (STRICT_LANGUAGE_NAME_RE.test(s)) return false;
  return scoreSkillLine(s) >= 75 && !STRICT_LANGUAGE_NAME_RE.test(s);
}

/**
 * Re-route misclassified skills ↔ languages.
 * @param {object} cvData
 */
export function applySkillsLanguagesGuard(cvData = {}) {
  const skills = [...(cvData.skills || [])];
  const tools = [...(cvData.tools || [])];
  const languages = [...(cvData.languages || [])];
  const reviewItems = [];
  const moves = [];

  const keptSkills = [];
  for (const item of skills) {
    const s = String(item || '').trim();
    if (!s) continue;
    if (looksLikeLanguageNotSkill(s)) {
      const strict = extractStrictLanguageLine(s);
      if (strict.ok) {
        languages.push(strict.display);
        moves.push({ from: 'skills', to: 'languages', value: s });
      } else {
        const ri = buildStrictLanguageReviewItem(s, 'skill_bucket_language_candidate');
        if (ri) reviewItems.push(ri);
      }
      continue;
    }
    keptSkills.push(s);
  }

  const keptLanguages = [];
  for (const item of languages) {
    const s = String(item || '').trim();
    if (!s) continue;
    if (looksLikeSkillNotLanguage(s)) {
      keptSkills.push(s);
      moves.push({ from: 'languages', to: 'skills', value: s });
      continue;
    }
    const strict = extractStrictLanguageLine(s);
    if (strict.ok) {
      keptLanguages.push(strict.display);
    } else if (STRICT_LANGUAGE_NAME_RE.test(s)) {
      const ri = buildStrictLanguageReviewItem(s, 'language_low_confidence');
      if (ri) reviewItems.push(ri);
    } else if (!isForbiddenLanguageLine(s)) {
      keptLanguages.push(s);
    } else {
      const ri = buildStrictLanguageReviewItem(s, 'forbidden_language_ocr');
      if (ri) reviewItems.push(ri);
    }
  }

  const keptTools = [];
  for (const item of tools) {
    const s = String(item || '').trim();
    if (!s) continue;
    if (looksLikeLanguageNotSkill(s)) {
      const strict = extractStrictLanguageLine(s);
      if (strict.ok) {
        languages.push(strict.display);
        moves.push({ from: 'tools', to: 'languages', value: s });
      }
      continue;
    }
    keptTools.push(s);
  }

  const dedupe = (arr) => [...new Set(arr.map((x) => String(x).trim()).filter(Boolean))];

  return {
    cvData: {
      ...cvData,
      skills: dedupe(keptSkills),
      tools: dedupe(keptTools),
      languages: dedupe(keptLanguages),
    },
    reviewItems,
    moves,
    version: SKILLS_LANGUAGES_GUARD_V2,
  };
}
