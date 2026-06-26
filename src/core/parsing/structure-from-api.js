/**
 * Optional LLM structuring via /api/structure-cv (Gemini).
 */

function structureUrl() {
  if (globalThis.HIRELY_STRUCTURE_CV_URL) return globalThis.HIRELY_STRUCTURE_CV_URL;
  if (typeof location !== 'undefined' && location.origin && location.origin !== 'null') {
    const base = location.pathname.replace(/\/[^/]*$/, '/');
    return `${location.origin}${base}api/structure-cv`;
  }
  return '';
}

export function llmStructureConfigured() {
  return Boolean(structureUrl()) && typeof fetch === 'function';
}

/**
 * @param {string} rawText
 * @returns {Promise<object|null>} cvData or null
 */
export async function fetchStructuredCvData(rawText) {
  const url = structureUrl();
  if (!url) return null;
  const text = String(rawText || '').trim();
  if (text.length < 40) return null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok || !data?.cvData) return null;
    return data.cvData;
  } catch (e) {
    console.warn('LLM structure', e);
    return null;
  }
}

/**
 * Merge LLM cvData over parser output (parser wins on non-empty fields).
 */
export function mergeCvData(parserData, llmData) {
  if (!llmData || typeof llmData !== 'object') return parserData;
  const out = { ...parserData };
  for (const key of ['name', 'title', 'email', 'phone', 'linkedin', 'portfolio', 'location', 'summary']) {
    const v = String(llmData[key] || '').trim();
    if (v && (!out[key] || String(out[key]).length < v.length)) out[key] = v;
  }
  for (const key of ['experience', 'education', 'skills', 'tools', 'languages', 'clients']) {
    const arr = Array.isArray(llmData[key]) ? llmData[key].filter(Boolean) : [];
    if (arr.length && (!out[key] || !out[key].length)) out[key] = arr;
  }
  return out;
}
