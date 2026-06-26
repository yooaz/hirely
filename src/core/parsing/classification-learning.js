/**
 * Lightweight classification learning — human corrections improve future parses.
 * Persists in localStorage (browser) or in-memory (Node tests).
 */

export const CLASSIFICATION_LEARNING_VERSION = 'classification-learning-v1';
export const LEARNED_CONFIDENCE = 0.97;

const STORAGE_KEY = 'hirely-classification-learning';
const MAX_ENTRIES = 500;

/** @type {Record<string, object>|null} */
let memoryStore = null;

function readStore() {
  if (typeof globalThis !== 'undefined' && globalThis.__HIRELY_CLASSIFICATION_LEARNING__) {
    return globalThis.__HIRELY_CLASSIFICATION_LEARNING__;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  if (!memoryStore) memoryStore = {};
  return memoryStore;
}

function writeStore(store) {
  if (typeof globalThis !== 'undefined') {
    globalThis.__HIRELY_CLASSIFICATION_LEARNING__ = store;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* ignore quota */
    }
  }
  memoryStore = store;
}

/**
 * @param {string} value
 */
export function normalizeLearningKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * @param {object} correction
 * @param {string} correction.value
 * @param {string} correction.chosenType — singular fact type (skill, tool, …)
 * @param {string} [correction.sourceLine]
 * @param {string[]} [correction.possibleTypes]
 */
export function recordClassificationCorrection(correction = {}) {
  const value = String(correction.value || '').trim();
  const chosenType = String(correction.chosenType || '').trim().toLowerCase();
  const key = normalizeLearningKey(value);
  if (!key || !chosenType) return null;

  const store = readStore();
  const prev = store[key] || {};
  const entry = {
    value,
    chosenType,
    sourceLine: String(correction.sourceLine || value).trim(),
    possibleTypes: correction.possibleTypes || prev.possibleTypes || [],
    count: (prev.count || 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  store[key] = entry;

  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys
      .map((k) => ({ k, at: store[k]?.updatedAt || '' }))
      .sort((a, b) => String(a.at).localeCompare(String(b.at)));
    for (let i = 0; i < keys.length - MAX_ENTRIES; i += 1) {
      delete store[sorted[i].k];
    }
  }

  writeStore(store);
  return entry;
}

/**
 * @param {string} value
 * @returns {{ type: string, confidence: number, learned: true, correctionCount: number }|null}
 */
export function lookupLearnedClassification(value) {
  const key = normalizeLearningKey(value);
  if (!key) return null;
  const hit = readStore()[key];
  if (!hit?.chosenType) return null;
  return {
    type: hit.chosenType,
    confidence: LEARNED_CONFIDENCE,
    learned: true,
    correctionCount: hit.count || 1,
  };
}

/** Test helper — reset learning store. */
export function clearClassificationLearning() {
  writeStore({});
}

/** @returns {object[]} */
export function listClassificationCorrections() {
  const store = readStore();
  return Object.values(store).sort((a, b) =>
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  );
}
