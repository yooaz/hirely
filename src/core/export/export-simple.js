/**
 * HIRELY — Export simple: resumeData + visible preview only.
 * One primary action: Download PDF.
 */

export const EXPORT_SIMPLE_VERSION = 'export-simple-v1';

/** @param {typeof globalThis} [env] */
export function isExportSimpleEnabled(env = globalThis) {
  return (
    env.HIRELY_EXPORT_SIMPLE === true ||
    env.HIRELY_NAVIGATION_LOCK === true ||
    env.HIRELY_ONE_CV_SOURCE === true
  );
}

/**
 * @param {{ resumeData?: object|null }} state
 */
export function hasResumeDataForExport(state) {
  const rd = state?.resumeData;
  return !!(rd && typeof rd === 'object');
}

/**
 * @param {HTMLElement|null|undefined} cvDoc
 */
export function isPreviewLiveForExport(cvDoc) {
  if (!cvDoc || typeof cvDoc !== 'object') return false;
  if (!cvDoc.classList?.contains('cv--live')) return false;
  if (cvDoc.querySelector?.('.cvEmptyState')) return false;
  const textLen = String(cvDoc.innerText || '').trim().length;
  if (textLen > 40) return true;
  return (cvDoc.innerHTML?.length || 0) > 280;
}

/**
 * @param {{ resumeData?: object|null }} state
 * @param {HTMLElement|null|undefined} cvDoc
 */
export function canExportSimple(state, cvDoc) {
  return hasResumeDataForExport(state) && isPreviewLiveForExport(cvDoc);
}
