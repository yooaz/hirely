/**
 * DEDUPE_FINAL_RESUME — last-pass dedupe on locked finalResumeData only.
 */

import {
  dedupeEducationStrings,
  dedupeExperienceEntries,
  dedupeStringList,
  dedupeClientList,
  dedupeProjectList,
  dedupeBySimilarity,
  pickRicherStringLabel,
} from '../parsing/dedupe-engine.js';
import { isValidEducationItem } from '../parsing/field-sanitize.js';

export const DEDUPE_FINAL_RESUME = 'DEDUPE_FINAL_RESUME_V3';

/**
 * Reject impossible or dirty education duplicates (garbage fragments).
 * @param {string[]} education
 */
function rejectDirtyEducationDuplicates(education = []) {
  const out = [];
  const seenSchoolOnly = new Set();

  for (const line of education || []) {
    const raw = String(line || '').replace(/\s+/g, ' ').trim();
    if (!raw || !isValidEducationItem(raw)) continue;

    const schoolOnly = !/\d{4}/.test(raw) && raw.split(/\s+/).length <= 4;
    if (schoolOnly) {
      const key = raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
      if (seenSchoolOnly.has(key)) continue;
      seenSchoolOnly.add(key);
    }
    out.push(raw);
  }
  return out;
}

/**
 * @param {object|null} finalResumeData
 * @returns {object|null}
 */
export function dedupeFinalResumeData(finalResumeData) {
  if (!finalResumeData || typeof finalResumeData !== 'object') return finalResumeData;

  const identity = finalResumeData.identity || {};
  const education = rejectDirtyEducationDuplicates(
    dedupeEducationStrings(finalResumeData.education || [], { identity })
  );

  const out = {
    ...finalResumeData,
    education,
    experiences: dedupeExperienceEntries(finalResumeData.experiences || []),
    skills: dedupeStringList(finalResumeData.skills),
    tools: dedupeStringList(finalResumeData.tools),
    languages: dedupeStringList(finalResumeData.languages),
    clients: dedupeClientList(finalResumeData.clients),
    projects: dedupeProjectList(finalResumeData.projects),
  };
  return out;
}

/**
 * Assert no duplicate entities remain in finalResumeData (QA helper).
 * @param {object|null} finalResumeData
 */
export function auditFinalResumeDuplicates(finalResumeData) {
  if (!finalResumeData || typeof finalResumeData !== 'object') {
    return { ok: true, duplicates: [] };
  }
  const duplicates = [];

  const checkList = (field, items = []) => {
    const kept = [];
    for (const item of items || []) {
      const label = String(item || '').trim();
      if (!label) continue;
      for (const prev of kept) {
        if (dedupeBySimilarity([prev, label], { pickRicher: pickRicherStringLabel }).length === 1) {
          duplicates.push({ field, a: prev, b: label });
          break;
        }
      }
      kept.push(label);
    }
  };

  checkList('skills', finalResumeData.skills);
  checkList('tools', finalResumeData.tools);
  checkList('languages', finalResumeData.languages);
  checkList('clients', finalResumeData.clients);
  checkList('projects', finalResumeData.projects);
  checkList('education', finalResumeData.education);

  const expLabels = (finalResumeData.experiences || []).map((e) =>
    [e.role, e.company, e.dates].filter(Boolean).join(' — ')
  );
  checkList('experiences', expLabels);

  return { ok: duplicates.length === 0, duplicates };
}
