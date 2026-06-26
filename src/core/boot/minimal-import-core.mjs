/**
 * P0 — Minimal import core when full barrel fails to load.
 * Keeps paste/file import alive; optional parsers disabled.
 */

/**
 * @returns {Promise<Record<string, Function>>}
 */
export async function buildMinimalImportCore() {
  const [flow, hirelyImport, canonical, resumeData, sanitize] = await Promise.all([
    import('../pipeline/hirely-flow-lock.js'),
    import('../pipeline/hirely-import.js'),
    import('../import/canonical-import.js'),
    import('../resume-data.js'),
    import('../validation/sanitize-resume-display.js'),
  ]);

  return {
    runHirelyImportFromText: hirelyImport.runHirelyImportFromText,
    canonicalImportFromFile: canonical.canonicalImportFromFile,
    canonicalImportFromText: canonical.canonicalImportFromText,
    resumeDataMeetsImportMinimum: flow.resumeDataMeetsImportMinimum,
    buildResumeData: resumeData.buildResumeData,
    resumeDataToCvData: resumeData.resumeDataToCvData,
    sanitizeResumeForDisplay: sanitize.sanitizeResumeForDisplay,
    __hirelyBootTier: 'minimal',
    __hirelyDegraded: true,
  };
}
