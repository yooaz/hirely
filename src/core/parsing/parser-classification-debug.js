/**
 * In-memory parser classification debug log (dictionary reason, term, score).
 * Active when ?debug=true or HIRELY_PARSER_CLASSIFICATION_DEBUG=1.
 */

/** @type {object[]} */
let _log = [];

/** @returns {boolean} */
export function isParserClassificationDebugEnabled() {
  if (globalThis.HIRELY_PARSER_CLASSIFICATION_DEBUG === true) return true;
  if (globalThis.HIRELY_PARSER_CLASSIFICATION_DEBUG === '1') return true;
  try {
    return /(?:\?|&)debug=true/.test(String(globalThis.location?.search || ''));
  } catch {
    return false;
  }
}

/**
 * Human-readable explanation for debug panels.
 * @param {object} entry
 */
export function formatDictionaryExplanation(entry = {}) {
  const dict = entry.matchedDictionary || entry.dictionaryId || null;
  const term = entry.matchedTerm || entry.term || null;
  const boost = entry.dictionaryBoost ?? entry.boost ?? null;
  const bucket = entry.bucket || entry.type || 'unknown';
  const score = entry.confidenceScore ?? entry.confidence ?? 0;
  const reason = entry.classificationReason || entry.reason || 'heuristic';

  if (!dict && !term) {
    return `${reason} → ${bucket} (${score}%)`;
  }
  const boostPart = boost != null ? ` +${boost}` : '';
  return `${reason} · dictionary:${dict} · term:"${term}"${boostPart} → ${bucket} (${score}%)`;
}

export function clearParserClassificationLog() {
  _log = [];
}

/**
 * @param {object} entry
 */
export function recordParserClassification(entry) {
  if (!entry?.line) return;
  const row = {
    at: new Date().toISOString(),
    line: entry.line,
    bucket: entry.bucket || 'unsorted',
    confidenceScore: entry.confidenceScore ?? entry.confidence ?? 0,
    classificationReason: entry.classificationReason || entry.reason || 'heuristic',
    matchedDictionary: entry.matchedDictionary ?? null,
    matchedTerm: entry.matchedTerm ?? null,
    dictionaryBoost: entry.dictionaryBoost ?? null,
    signals: entry.signals || [],
    explanation:
      entry.explanation ||
      formatDictionaryExplanation({
        ...entry,
        bucket: entry.bucket || 'unsorted',
      }),
  };
  _log.push(row);
  if (_log.length > 400) _log = _log.slice(-400);
}

/**
 * @param {object} classified
 * @param {string} line
 */
export function recordFromClassification(classified, line) {
  if (!classified) return;
  const dbg = classified.parserDebug;
  recordParserClassification({
    line: String(line || '').trim().slice(0, 200),
    bucket: classified.bucket,
    confidenceScore: classified.confidence,
    classificationReason: dbg?.classificationReason || classified.signals?.[0] || 'heuristic',
    matchedDictionary: dbg?.matchedDictionary ?? null,
    matchedTerm: dbg?.matchedTerm ?? null,
    dictionaryBoost: dbg?.dictionaryBoost ?? null,
    signals: classified.signals || [],
  });
}

export function getParserClassificationLog() {
  return [..._log];
}

export function getParserClassificationSummary() {
  const byBucket = {};
  const byDictionary = {};
  for (const row of _log) {
    byBucket[row.bucket] = (byBucket[row.bucket] || 0) + 1;
    if (row.matchedDictionary) {
      byDictionary[row.matchedDictionary] = (byDictionary[row.matchedDictionary] || 0) + 1;
    }
  }
  return { total: _log.length, byBucket, byDictionary, recent: _log.slice(-24) };
}
