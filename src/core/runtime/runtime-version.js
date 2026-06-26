/**
 * Runtime version stamp — verify browser loads the same core modules as Node tests.
 */

import { HIRELY_RUNTIME_STAMPS } from './runtime-stamps.js';

let versionLogged = false;

/**
 * @returns {object}
 */
export function getHirelyRuntimeVersion() {
  return {
    tag: 'HIRELY_RUNTIME_VERSION',
    generatedAt: HIRELY_RUNTIME_STAMPS.generatedAt,
    timestamp: new Date().toISOString(),
    files: { ...HIRELY_RUNTIME_STAMPS.files },
    runtime: typeof window !== 'undefined' ? 'browser' : 'node',
    href: typeof location !== 'undefined' ? String(location.href || '') : '',
  };
}

/**
 * Log once per page load / Node process.
 */
export function logHirelyRuntimeVersion() {
  if (versionLogged) return getHirelyRuntimeVersion();
  versionLogged = true;
  const payload = getHirelyRuntimeVersion();
  console.log('HIRELY_RUNTIME_VERSION', payload);
  return payload;
}

/**
 * @param {import('../resume-data.js').ResumeData|null|undefined} rd
 * @param {string} [path]
 */
export function logResumeDataCounts(rd, path = 'unknown') {
  const counts = {
    experiences: rd?.experiences?.length ?? 0,
    education: rd?.education?.length ?? 0,
    skills: rd?.skills?.length ?? 0,
    tools: rd?.tools?.length ?? 0,
    languages: rd?.languages?.length ?? 0,
    clients: rd?.clients?.length ?? 0,
    projects: rd?.projects?.length ?? 0,
    unsorted: rd?.unsorted?.length ?? 0,
  };
  const tag = typeof window !== 'undefined' ? 'BROWSER_RESUMEDATA_COUNTS' : 'NODE_RESUMEDATA_COUNTS';
  console.log(tag, { path, ...counts });
  return counts;
}
