/**
 * Section-first resume parsing — delegates to SECTION_ENGINE_V2.
 * @deprecated Direct use — prefer runSectionEngineV2 from section-engine-v2.js
 */

import { runSectionEngineV2 } from './section-engine-v2.js';

/**
 * @param {string} cleanedText
 * @param {object} [opts]
 */
export function parseResumeSectionFirst(cleanedText, opts = {}) {
  const result = runSectionEngineV2(cleanedText, opts);
  console.log('PARSER_INPUT', {
    chars: result.report?.cleanChars ?? cleanedText.length,
    lines: result.lines?.length ?? 0,
    engine: 'SECTION_ENGINE_V2',
  });
  console.log('SECTIONS_FOUND', result.sectionsFound);
  const exp = result.sections?.experience || [];
  const edu = result.sections?.education || [];
  const sk = [...(result.sections?.skills || []), ...(result.sections?.tools || [])];
  console.log('EXPERIENCE_LINES', exp.length, exp.slice(0, 6));
  console.log('EDUCATION_LINES', edu.length, edu.slice(0, 6));
  console.log('SKILL_LINES', sk.length, sk.slice(0, 8));
  return {
    structured: result.structured,
    report: result.report,
    sections: result.sections,
    sectionsFound: result.sectionsFound,
    sectionBlocks: result.sectionBlocks,
    resumeJson: result.resumeJson,
  };
}
