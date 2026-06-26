import { isHirelyDebug } from '../runtime/hirely-debug.js';

/**
 * HIRELY FLOW LOCK — single canonical product pipeline.
 *
 * Import → Extract text → Clean text → Build blocks → Classify facts
 *   → Build resumeData → Safety gate → Review → Style → Export
 *
 * Forbidden in product mode:
 * - raw OCR/text → template
 * - debug/graph/audit inside resumeData
 * - duplicate parsing engines on the same import
 * - fallback parser when core pipeline succeeds
 */

export const HIRELY_FLOW_LOCK = 'HIRELY_FLOW_LOCK_V3';

/** @readonly */
export const HIRELY_FLOW_STAGES = Object.freeze([
  'IMPORT',
  'EXTRACT_TEXT',
  'CLEAN_TEXT',
  'BUILD_BLOCKS',
  'CLASSIFY_FACTS',
  'BUILD_RESUME_DATA',
  'SAFETY_GATE',
  'REVIEW',
  'STYLE',
  'EXPORT',
]);

/** Product resumeData may only expose these top-level keys. */
export const ALLOWED_RESUME_DATA_KEYS = Object.freeze([
  'identity',
  'summary',
  'experiences',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'projects',
  'portfolioLinks',
  'unsorted',
  'meta',
]);

/**
 * Creative / editor keys folded into unsorted by lockResumeDataShape — warn only, never block import.
 */
export const FLOW_LOCK_FOLD_INTO_UNSORTED_KEYS = Object.freeze([
  'exhibitions',
  'awards',
  'publications',
  'blocks',
]);

/** Product resumeData must never carry parser/debug payloads. */
export const FORBIDDEN_RESUME_DATA_KEYS = Object.freeze([
  'debugReport',
  'structuredResume',
  'audit',
  'lastPipeline',
  'forensic',
  'metadata',
  'validatedCVData',
  'templateData',
  'reviewQueue',
  'confidenceReport',
  'productionAudit',
  'resumeGraph',
  'graph',
  'documentBlocks',
  'extractionLines',
  'pdfExtraction',
  'needsReview',
  'rawText',
  'cleanText',
  'parserTrace',
  'coverageReport',
  'blocks',
  'exhibitions',
  'awards',
  'publications',
]);

/** Template cvData must never receive raw extraction text. */
export const FORBIDDEN_TEMPLATE_CV_KEYS = Object.freeze([
  'raw',
  'rawText',
  'cleanText',
  'cleanedText',
  'debugReport',
  'forensic',
  '_enterprise',
  '_sourceLines',
  '_parserReview',
  '_extractionReview',
  '_dataSanitization',
  '_dataSanitizationAudit',
  'enterpriseExtraction',
  'structuredResume',
  'audit',
  'lastPipeline',
  'reviewQueue',
  'toClassify',
  'unsorted',
  'unknownExperience',
  'rejectedLines',
  'sectionConfidence',
  'extra',
  'interests',
]);

/**
 * @returns {boolean}
 */
export function isHirelyFlowLocked() {
  if (typeof globalThis !== 'undefined' && globalThis.HIRELY_FLOW_LOCK === false) {
    return false;
  }
  return true;
}

/**
 * Fold creative-only sections into unsorted; drop editor blocks from product shape.
 * @param {object} data
 */
export function lockResumeDataShape(data) {
  if (!data || typeof data !== 'object') return data;
  const unsorted = [
    ...(Array.isArray(data.unsorted) ? data.unsorted : []),
    ...(Array.isArray(data.interests) ? data.interests : []),
    ...(Array.isArray(data.exhibitions) ? data.exhibitions : []),
    ...(Array.isArray(data.awards) ? data.awards : []),
    ...(Array.isArray(data.publications) ? data.publications : []),
  ]
    .map((x) => (typeof x === 'string' ? x : String(x?.text || '')).trim())
    .filter((l) => l.length > 1);

  const out = {
    identity: data.identity || {},
    summary: String(data.summary || '').trim(),
    experiences: Array.isArray(data.experiences) ? data.experiences : [],
    education: Array.isArray(data.education) ? data.education : [],
    skills: Array.isArray(data.skills) ? data.skills : [],
    tools: Array.isArray(data.tools) ? data.tools : [],
    languages: Array.isArray(data.languages) ? data.languages : [],
    clients: Array.isArray(data.clients) ? data.clients : [],
    projects: Array.isArray(data.projects) ? data.projects : [],
    portfolioLinks: Array.isArray(data.portfolioLinks) ? data.portfolioLinks : [],
    unsorted,
    meta: data.meta && typeof data.meta === 'object' ? { ...data.meta } : {},
  };

  for (const key of FORBIDDEN_RESUME_DATA_KEYS) {
    delete out[key];
  }
  if (out.meta && typeof out.meta === 'object') {
    const meta = { ...out.meta };
    for (const key of [
      'debugReport',
      'audit',
      'forensic',
      'pipeline',
      'parserCoverage',
      'resumeGraph',
      'structuredResume',
      'blocks',
    ]) {
      delete meta[key];
    }
    out.meta = meta;
  }
  return out;
}

export function stripResumeDataForProduct(data) {
  return lockResumeDataShape(data);
}

/**
 * @param {object|null} cvData
 */
export function stripTemplateCvData(cvData) {
  if (!cvData || typeof cvData !== 'object') return cvData;
  const out = { ...cvData };
  for (const key of FORBIDDEN_TEMPLATE_CV_KEYS) {
    delete out[key];
  }
  return out;
}

export { resumeDataMeetsImportMinimum } from '../validation/extraction-reliability.js';

export function assertResumeDataFlowLock(data) {
  if (!isHirelyFlowLocked() || !data || typeof data !== 'object') {
    return { ok: true, forbidden: [], warnings: [], fatal: [], extra: [] };
  }
  const forbidden = Object.keys(data).filter((k) => FORBIDDEN_RESUME_DATA_KEYS.includes(k));
  const extra = Object.keys(data).filter((k) => !ALLOWED_RESUME_DATA_KEYS.includes(k));
  const bad = [...new Set([...forbidden, ...extra])];
  const warnings = bad.filter((k) => FLOW_LOCK_FOLD_INTO_UNSORTED_KEYS.includes(k));
  const fatal = bad.filter((k) => !FLOW_LOCK_FOLD_INTO_UNSORTED_KEYS.includes(k));
  return {
    ok: fatal.length === 0,
    forbidden: bad,
    warnings,
    fatal,
    extra,
  };
}

/**
 * @param {string} stage
 * @param {object} [detail]
 */
export function logPipelineStage(stage, detail = {}) {
  assertFlowStage(stage);
  if (typeof globalThis !== 'undefined') {
    globalThis.__HIRELY_PIPELINE_STAGE__ = stage;
  }
  if (!isHirelyDebug()) return;
  if (detail && Object.keys(detail).length) {
    console.log(`PIPELINE_STAGE:${stage}`, detail);
  } else {
    console.log(`PIPELINE_STAGE:${stage}`);
  }
}

/**
 * @param {object|null} cvData
 */
export function assertTemplateCvFlowLock(cvData) {
  if (!isHirelyFlowLocked() || !cvData || typeof cvData !== 'object') {
    return { ok: true, forbidden: [] };
  }
  const forbidden = Object.keys(cvData).filter((k) => FORBIDDEN_TEMPLATE_CV_KEYS.includes(k));
  const hasRawPayload =
    typeof cvData.raw === 'string' ||
    typeof cvData.rawText === 'string' ||
    (typeof cvData.cleanText === 'string' && cvData.cleanText.length > 0);
  if (hasRawPayload) forbidden.push('raw_text_payload');
  return { ok: forbidden.length === 0, forbidden: [...new Set(forbidden)] };
}

/**
 * @param {string} stage
 */
export function assertFlowStage(stage) {
  if (!HIRELY_FLOW_STAGES.includes(stage)) {
    throw new Error(`HIRELY_FLOW_UNKNOWN_STAGE: ${stage}`);
  }
}
