/**
 * P0 — Canonical pipeline stage result. Every stage returns this shape.
 * Never undefined. Never null. Never throw to UI.
 */

/**
 * @typedef {object} PipelineStageResult
 * @property {boolean} success
 * @property {object} data
 * @property {string[]} warnings
 * @property {string[]} errors
 */

/** @returns {PipelineStageResult} */
export function createStageResult({
  success = false,
  data = {},
  warnings = [],
  errors = [],
} = {}) {
  const safeData = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  return {
    success: success === true,
    data: safeData,
    warnings: Array.isArray(warnings) ? warnings.map(String) : [],
    errors: Array.isArray(errors) ? errors.map(String) : [],
  };
}

/**
 * Coerce unknown values into a stage result (never null/undefined).
 * @param {unknown} raw
 * @returns {PipelineStageResult}
 */
export function normalizeStageResult(raw) {
  if (!raw || typeof raw !== 'object') {
    return createStageResult({ success: false, errors: ['STAGE_RESULT_INVALID'] });
  }
  const r = /** @type {Record<string, unknown>} */ (raw);
  const errors = Array.isArray(r.errors) ? r.errors.map(String) : [];
  const warnings = Array.isArray(r.warnings) ? r.warnings.map(String) : [];
  const success =
    r.success === true ||
    (r.ok === true && errors.length === 0) ||
    (errors.length === 0 && r.success !== false && r.ok !== false);
  const data =
    r.data && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {object} */ (r.data)
      : r;
  return createStageResult({ success, data, warnings, errors });
}

/**
 * Run an async stage safely — exceptions become structured failures.
 * @template T
 * @param {string} label
 * @param {() => Promise<T>|T} fn
 * @param {object} [fallbackData]
 * @returns {Promise<PipelineStageResult>}
 */
export async function runStageSafe(label, fn, fallbackData = {}) {
  try {
    const out = await fn();
    if (out && typeof out === 'object' && ('success' in out || 'errors' in out || 'ok' in out)) {
      return normalizeStageResult(out);
    }
    return createStageResult({
      success: true,
      data: out && typeof out === 'object' ? /** @type {object} */ (out) : { value: out },
      warnings: [],
      errors: [],
    });
  } catch (err) {
    const msg = String(err?.message || err || `${label}_FAILED`);
    console.error(`STAGE_SAFE_${label}`, err);
    return createStageResult({
      success: false,
      data: fallbackData,
      warnings: [`${label}_SAFE_FALLBACK`],
      errors: [msg],
    });
  }
}

/**
 * Ensure HirelyImportResult-shaped objects always have arrays (never null).
 * @param {object} result
 */
export function normalizeImportResultShape(result = {}) {
  const r = result && typeof result === 'object' ? result : {};
  return {
    file: r.file ?? null,
    rawText: String(r.rawText ?? ''),
    cleanedText: String(r.cleanedText ?? ''),
    blocks: Array.isArray(r.blocks) ? r.blocks : [],
    structuredResume: r.structuredResume ?? null,
    templateData: r.templateData ?? null,
    resumeData: r.resumeData ?? null,
    finalResumeData: r.finalResumeData ?? null,
    parseResponse: r.parseResponse ?? null,
    debugReport: r.debugReport ?? null,
    reviewQueue: Array.isArray(r.reviewQueue) ? r.reviewQueue : [],
    rebuildEngine: r.rebuildEngine ?? null,
    rejectedLines: Array.isArray(r.rejectedLines) ? r.rejectedLines : [],
    ocrConfidence: r.ocrConfidence ?? null,
    errors: Array.isArray(r.errors) ? r.errors.map(String) : [],
    warnings: Array.isArray(r.warnings) ? r.warnings.map(String) : [],
    importStatus: String(r.importStatus ?? ''),
    importState: String(r.importState ?? ''),
    success: !Array.isArray(r.errors) || r.errors.length === 0,
  };
}

/**
 * Map stage result → import result fields.
 * @param {PipelineStageResult} stage
 * @param {object} base
 */
export function mergeStageIntoImportResult(stage, base = {}) {
  const norm = normalizeStageResult(stage);
  const out = normalizeImportResultShape(base);
  if (norm.errors.length) out.errors.push(...norm.errors);
  if (norm.warnings.length) out.warnings.push(...norm.warnings);
  if (norm.data && typeof norm.data === 'object') {
    for (const [k, v] of Object.entries(norm.data)) {
      if (v !== undefined) out[k] = v;
    }
  }
  out.success = norm.success && out.errors.length === 0;
  return out;
}
