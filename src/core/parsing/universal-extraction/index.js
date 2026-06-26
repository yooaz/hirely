/**
 * Universal CV Extraction Engine — reconstruction layer before / alongside classification.
 */
export {
  CV_BLOCK_ENGINE,
  UNIVERSAL_DATE_DETECTOR,
  UNIVERSAL_COMPANY_DETECTOR,
  UNIVERSAL_ROLE_DETECTOR,
  UNIVERSAL_EXPERIENCE_RECONSTRUCTOR,
  UNIVERSAL_EXPERIENCE_RECALL_GOAL,
  CV_BLOCK_TYPES,
} from './types.js';

export { detectDatesInText, repairOcrYearToken, formatDateRange, normalizePresentToken } from './date-detector.js';
export { detectCompanyInLine } from './company-detector.js';
export { detectRoleInLine } from './role-detector.js';
export { runCvBlockEngine } from './cv-block-engine.js';
export {
  reconstructExperiencesFromBlocks,
  runUniversalExperienceReconstruction,
} from './experience-reconstructor.js';

import { runCvBlockEngine } from './cv-block-engine.js';
import { runUniversalExperienceReconstruction } from './experience-reconstructor.js';
import { CV_BLOCK_ENGINE, UNIVERSAL_EXPERIENCE_RECONSTRUCTOR } from './types.js';

/**
 * Full universal extraction pass: blocks → experience reconstruction.
 * @param {string} cleanedText
 * @param {object} [opts]
 */
export function runUniversalExtractionEngine(cleanedText, opts = {}) {
  const blockResult = runCvBlockEngine(cleanedText, opts);
  const structured = opts.structured || { experiences: [], reviewQueue: [] };
  const recon = runUniversalExperienceReconstruction(structured, cleanedText, {
    ...opts,
    universalBlocks: blockResult.blocks,
    lines: blockResult.lines,
  });

  return {
    blockEngine: blockResult,
    reconstruction: recon,
    structured: recon.structured,
    engines: [CV_BLOCK_ENGINE, UNIVERSAL_EXPERIENCE_RECONSTRUCTOR],
  };
}
