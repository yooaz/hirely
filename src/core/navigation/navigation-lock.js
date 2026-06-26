/**
 * HIRELY — Navigation lock (resumeData only).
 *
 * If resumeData exists: Review, Style, Export enabled.
 * If no resumeData: Import only.
 * No review, template, export, premium, or validation locks on navigation.
 */

export const NAVIGATION_LOCK_VERSION = 'navigation-lock-v1';

/** @param {typeof globalThis} [env] */
export function isNavigationLockEnabled(env = globalThis) {
  return (
    env.HIRELY_NAVIGATION_LOCK === true ||
    env.HIRELY_ONE_CV_SOURCE === true ||
    env.HIRELY_V1_SCOPE_LOCK === true
  );
}

/**
 * @param {{ resumeData?: object|null }} state
 */
export function hasResumeDataForNavigation(state) {
  const rd = state?.resumeData;
  return !!(rd && typeof rd === 'object');
}

/**
 * @param {'import'|'edit'|'verify'|'style'|'export'|string} step
 * @param {{ resumeData?: object|null }} state
 */
export function isNavigationStepEnabled(step, state) {
  const s = String(step || '').trim();
  if (s === 'import' || s === 'verify') return true;
  return hasResumeDataForNavigation(state);
}

/**
 * @param {'import'|'edit'|'verify'|'style'|'export'|string} step
 * @param {{ resumeData?: object|null }} state
 */
export function canNavigateToStep(step, state) {
  return isNavigationStepEnabled(step, state);
}

/** Open validation shape — navigation lock never blocks steps when resumeData exists. */
export function buildNavigationLockValidation(state) {
  const has = hasResumeDataForNavigation(state);
  return {
    version: NAVIGATION_LOCK_VERSION,
    status: has ? 'VALID' : 'INVALID',
    reasons: has ? [] : ['NO_RESUME_DATA'],
    blockReview: false,
    blockStyle: false,
    blockExport: false,
    showRecovery: false,
    navigationLock: true,
    hasResumeData: has,
  };
}
