/**
 * HIRELY — One CV source: resumeData.
 *
 * Review, templates, and export must read resumeData only.
 * Template cvData is a derived adapter (resumeDataToCvData) — never a parallel truth.
 *
 * Deprecated parallel sources (do not read on product path):
 *   finalResumeData, state.cvData cache, structuredResume, confidenceReport gates
 */

export const ONE_CV_SOURCE_VERSION = 'cv-source-v1';

/** @param {typeof globalThis} [env] */
export function isOneCvSourceEnabled(env = globalThis) {
  return env.HIRELY_ONE_CV_SOURCE === true || env.HIRELY_V1_SCOPE_LOCK === true;
}

/**
 * @param {{ resumeData?: object|null }} state
 */
export function getResumeDataFromState(state) {
  const rd = state?.resumeData;
  return rd && typeof rd === 'object' ? rd : null;
}

/**
 * Product render readiness from resumeData (no finalResumeContract / semantic gates).
 * @param {object|null} resumeData
 * @param {{ resumeDataIsRenderable?: Function }} [core]
 */
export function isResumeDataReady(resumeData, core) {
  if (!resumeData || typeof resumeData !== 'object') return false;
  if (core?.resumeDataIsRenderable) {
    return core.resumeDataIsRenderable(resumeData, { skipNormalize: true });
  }
  const id = resumeData.identity || {};
  if (String(id.name || '').trim() || String(id.title || '').trim()) return true;
  if (String(resumeData.summary || '').trim()) return true;
  if ((resumeData.experiences || []).length || (resumeData.education || []).length) return true;
  if ((resumeData.skills || []).length || (resumeData.tools || []).length) return true;
  if ((resumeData.unsorted || []).length) return true;
  return false;
}

/**
 * Section counts from resumeData (review / preview / export parity).
 * @param {object|null} resumeData
 */
export function sectionCountsFromResumeData(resumeData) {
  const zeros = {
    experiences: 0,
    education: 0,
    skills: 0,
    tools: 0,
    languages: 0,
    clients: 0,
    projects: 0,
  };
  if (!resumeData) return { ...zeros };
  const frd = resumeData;
  const expN = (frd.experiences || []).filter((e) => {
    if (!e) return false;
    if (typeof e === 'string') return e.trim().length > 0;
    return !!(e.role || e.company || e.dates || (e.bullets || []).filter(Boolean).length);
  }).length;
  const eduN = (frd.education || []).filter((e) => {
    if (!e) return false;
    if (typeof e === 'string') return e.trim().length > 0;
    return !!(e.school || e.degree || e.field || e.dates || e.startDate || e.endDate || e.display || e.education);
  }).length;
  const lineN = (k) => (frd[k] || []).filter((s) => String(s || '').trim()).length;
  return {
    experiences: expN,
    education: eduN,
    skills: lineN('skills'),
    tools: lineN('tools'),
    languages: lineN('languages'),
    clients: lineN('clients'),
    projects: lineN('projects'),
  };
}

/**
 * Adapter: resumeData → template cvData (read-only derived view).
 * @param {object|null} resumeData
 * @param {{ buildTemplateInputFromResume?: Function, resumeDataToCvData?: Function }} core
 * @param {(cv: object) => object} normalizeCvData
 */
export function templateCvFromResumeData(resumeData, core, normalizeCvData) {
  if (!resumeData || !core) return null;
  if (core.buildTemplateInputFromResume) {
    return normalizeCvData(core.buildTemplateInputFromResume(resumeData));
  }
  if (core.resumeDataToCvData) {
    return normalizeCvData(core.resumeDataToCvData(resumeData, { skipNormalize: true }));
  }
  return null;
}

/**
 * Minimal contract object when one-source mode skips buildFinalResumeData.
 * @param {object|null} resumeData
 * @param {boolean} renderable
 */
export function buildOneSourceContract(resumeData, renderable) {
  return {
    ok: !!resumeData,
    renderable: !!renderable,
    version: ONE_CV_SOURCE_VERSION,
    reasons: [],
    oneCvSource: true,
  };
}
