/**
 * Last extraction metadata for pipeline/debug (avoids UI changes).
 */

let lastPdfExtraction = null;
let lastOcrForensic = null;
/** @type {import('./enterprise-engine.js').EnterpriseExtractionResult|null} */
let lastEnterpriseExtraction = null;
/** @type {Array<{ page: number, before: string, after: string, meta: object, at: number }>} */
let lastOcrPreprocessPreviews = [];
/** Internal OCR fusion snapshot — not exposed in product UI */
let lastOcrFusionInternal = null;
/** Last OCR rotation trial decision (debug / QA) */
let lastOcrRotationDecision = null;
/** Native pdf.js probe before OCR — used for timeout partial recovery */
let lastNativePdfProbe = null;

export function setLastPdfExtraction(meta) {
  lastPdfExtraction = meta ? { ...meta } : null;
}

export function peekLastPdfExtraction() {
  return lastPdfExtraction ? { ...lastPdfExtraction } : null;
}

export function consumeLastPdfExtraction() {
  const m = lastPdfExtraction;
  lastPdfExtraction = null;
  return m;
}

/**
 * @param {{ rawOcr: string, method?: string, postProcessed?: string }} snapshot
 */
export function setLastOcrForensic(snapshot) {
  lastOcrForensic = snapshot
    ? {
        rawOcr: String(snapshot.rawOcr || ''),
        method: snapshot.method || null,
        postProcessed: snapshot.postProcessed || null,
        at: Date.now(),
      }
    : null;
}

export function peekLastOcrForensic() {
  return lastOcrForensic ? { ...lastOcrForensic } : null;
}

export function consumeLastOcrForensic() {
  const m = lastOcrForensic;
  lastOcrForensic = null;
  return m;
}

/**
 * Full enterprise extraction bundle (lines + metadata + rawExtraction).
 * @param {import('./enterprise-engine.js').EnterpriseExtractionResult|null} result
 */
export function setLastEnterpriseExtraction(result) {
  lastEnterpriseExtraction = result
    ? {
        rawExtraction: result.rawExtraction,
        text: result.text,
        lines: [...(result.lines || [])],
        method: result.method,
        metadata: { ...(result.metadata || {}) },
        pdfExtraction: result.pdfExtraction ? { ...result.pdfExtraction } : null,
        at: Date.now(),
      }
    : null;
  try {
    if (typeof globalThis !== 'undefined') {
      globalThis.__HIRELY_LAST_ENTERPRISE__ = lastEnterpriseExtraction;
    }
  } catch {
    /* ignore */
  }
}

export function peekLastEnterpriseExtraction() {
  return lastEnterpriseExtraction ? structuredCloneLite(lastEnterpriseExtraction) : null;
}

export function consumeLastEnterpriseExtraction() {
  const m = lastEnterpriseExtraction;
  lastEnterpriseExtraction = null;
  return m ? structuredCloneLite(m) : null;
}

function structuredCloneLite(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * @param {{ page?: number, before: string, after: string, meta?: object }} entry
 */
export function pushOcrPreprocessPreview(entry) {
  if (!entry?.before || !entry?.after) return;
  lastOcrPreprocessPreviews.push({
    page: entry.page ?? 1,
    before: entry.before,
    after: entry.after,
    meta: entry.meta ? { ...entry.meta } : {},
    at: Date.now(),
  });
  if (lastOcrPreprocessPreviews.length > 6) {
    lastOcrPreprocessPreviews = lastOcrPreprocessPreviews.slice(-6);
  }
}

export function peekOcrPreprocessPreviews() {
  return lastOcrPreprocessPreviews.map((p) => ({ ...p, meta: { ...p.meta } }));
}

export function clearOcrPreprocessPreviews() {
  lastOcrPreprocessPreviews = [];
}

/** @param {object|null} record */
export function setLastOcrFusionInternal(record) {
  lastOcrFusionInternal = record ? { ...record } : null;
}

/** QA / dev only — not rendered in UI */
export function peekLastOcrFusionInternal() {
  return lastOcrFusionInternal ? JSON.parse(JSON.stringify(lastOcrFusionInternal)) : null;
}

export function clearLastOcrFusionInternal() {
  lastOcrFusionInternal = null;
}

/** @param {object|null} decision */
export function setLastOcrRotationDecision(decision) {
  lastOcrRotationDecision = decision ? JSON.parse(JSON.stringify(decision)) : null;
}

export function peekLastOcrRotationDecision() {
  return lastOcrRotationDecision ? JSON.parse(JSON.stringify(lastOcrRotationDecision)) : null;
}

export function clearLastOcrRotationDecision() {
  lastOcrRotationDecision = null;
}

/**
 * Stash native pdf.js text before OCR so outer timeouts can recover partial text.
 * @param {{ lines?: import('./extracted-line.js').ExtractedLine[], text?: string }} snapshot
 */
export function setLastNativePdfProbe(snapshot) {
  const text = String(snapshot?.text || '').trim();
  if (!text) {
    lastNativePdfProbe = null;
    return;
  }
  lastNativePdfProbe = {
    text,
    lines: (snapshot?.lines || []).map((l) => ({ ...l })),
    at: Date.now(),
  };
}

export function peekLastNativePdfProbe() {
  return lastNativePdfProbe ? structuredCloneLite(lastNativePdfProbe) : null;
}

export function clearLastNativePdfProbe() {
  lastNativePdfProbe = null;
}
