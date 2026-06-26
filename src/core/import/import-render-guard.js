/**
 * Block empty / placeholder CV render after failed extraction.
 */

import { NAME_UNCERTAIN_LABEL, TITLE_UNCERTAIN_LABEL } from '../parsing/parser-recovery.js';

import {
  REAL_CV_IMPORT_RENDER_MIN_CHARS,
  REAL_CV_IMPORT_MIN_CHARS,
  hasMeaningfulImportText as hasMeaningfulImportTextRoot,
  hasRenderableImportText as hasRenderableImportTextRoot,
} from './real-cv-import-root.js';

export const MIN_IMPORT_RENDER_CHARS = REAL_CV_IMPORT_RENDER_MIN_CHARS;
export const MIN_IMPORT_MEANINGFUL_CHARS = REAL_CV_IMPORT_MIN_CHARS;

/**
 * @param {string} [rawText]
 * @param {string} [cleanedText]
 */
export function hasRenderableImportText(rawText, cleanedText = '') {
  return hasRenderableImportTextRoot(rawText, cleanedText);
}

/**
 * @param {string} [rawText]
 * @param {string} [cleanedText]
 */
export function hasMeaningfulImportText(rawText, cleanedText = '') {
  return hasMeaningfulImportTextRoot(rawText, cleanedText);
}

/**
 * @param {object|null|undefined} resumeData
 * @param {object|null|undefined} [cvData]
 */
export function isPlaceholderOnlyResume(resumeData, cvData = null) {
  const name = String(resumeData?.identity?.name || cvData?.name || '').trim();
  const title = String(resumeData?.identity?.title || cvData?.title || '').trim();
  const uncertainName = name === NAME_UNCERTAIN_LABEL || /confirmer/i.test(name);
  const uncertainTitle = title === TITLE_UNCERTAIN_LABEL || /compléter/i.test(title);
  const hasSections =
    (resumeData?.experiences?.length || 0) > 0 ||
    (resumeData?.education?.length || 0) > 0 ||
    (cvData?.experience?.length || 0) > 0 ||
    (resumeData?.summary?.length || 0) > 40 ||
    (cvData?.summary?.length || 0) > 40;
  const unsortedCount =
    (resumeData?.unsorted?.length || 0) + (cvData?.unsorted?.length || 0);
  return (uncertainName || uncertainTitle) && !hasSections && unsortedCount < 3;
}
