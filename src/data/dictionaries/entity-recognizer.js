/**
 * Entity recognition — dictionary entities with aliases, longest-match, word boundaries.
 * Not regex-only classification: each hit resolves to a canonical entity id + type.
 */

const WORD_CHAR_RE = /[\p{L}\p{N}]/u;

/**
 * @param {string} text
 */
export function normalizeForMatch(text) {
  return String(text || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} hay
 * @param {number} start
 * @param {number} len
 */
function hasWordBoundary(hay, start, len) {
  const before = start > 0 ? hay[start - 1] : ' ';
  const after = start + len < hay.length ? hay[start + len] : ' ';
  return !WORD_CHAR_RE.test(before) && !WORD_CHAR_RE.test(after);
}

/**
 * @typedef {object} EntityRecord
 * @property {string} id
 * @property {string} name
 * @property {string} entityType
 * @property {string[]} aliases
 * @property {number} boost
 * @property {string} dictionaryId
 */

/**
 * @typedef {object} EntityIndexEntry
 * @property {string} normalized
 * @property {string} surface
 * @property {EntityRecord} entity
 */

/**
 * Build searchable index from a dictionary JSON file.
 * @param {object} dictionary
 */
export function buildEntityIndex(dictionary) {
  const dictionaryId = dictionary.id || 'unknown';
  const entityType = dictionary.entityType || dictionary.id || 'unknown';
  const boost = Number(dictionary.boost) || 20;
  const entities = dictionary.entities || [];
  /** @type {EntityIndexEntry[]} */
  const index = [];

  for (const ent of entities) {
    const record = {
      id: String(ent.id || ent.name || '').trim(),
      name: String(ent.name || '').trim(),
      entityType: ent.type || entityType,
      aliases: Array.isArray(ent.aliases) ? ent.aliases.map(String) : [],
      boost: Number(ent.boost) || boost,
      dictionaryId,
    };
    if (!record.name) continue;

    const surfaces = [record.name, ...record.aliases];
    const seen = new Set();
    for (const surface of surfaces) {
      const s = String(surface || '').trim();
      if (!s) continue;
      const key = normalizeForMatch(s);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      index.push({
        normalized: key,
        surface: s,
        entity: record,
      });
    }
  }

  index.sort((a, b) => b.normalized.length - a.normalized.length);
  return { dictionaryId, entityType, boost, index };
}

/**
 * Flatten entities → terms list (backward compat).
 * @param {object} dictionary
 */
export function flattenDictionaryTerms(dictionary) {
  const terms = [];
  const seen = new Set();
  for (const ent of dictionary.entities || []) {
    for (const s of [ent.name, ...(ent.aliases || [])]) {
      const t = String(s || '').trim();
      if (!t || seen.has(t.toLowerCase())) continue;
      seen.add(t.toLowerCase());
      terms.push(t);
    }
  }
  for (const t of dictionary.terms || []) {
    const k = String(t || '').trim();
    if (!k || seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    terms.push(k);
  }
  return terms.sort((a, b) => b.length - a.length);
}

/**
 * Find all non-overlapping entity hits in text (longest match wins per span).
 * @param {string} text
 * @param {ReturnType<typeof buildEntityIndex>} recognizer
 */
export function recognizeEntitiesInText(text, recognizer) {
  if (!text || !recognizer?.index?.length) return [];

  const hay = normalizeForMatch(text);
  if (!hay) return [];

  /** @type {Array<{ start: number, end: number, entry: EntityIndexEntry }>} */
  const raw = [];

  for (const entry of recognizer.index) {
    const phrase = entry.normalized;
    if (!phrase) continue;
    let pos = 0;
    while (pos <= hay.length - phrase.length) {
      const idx = hay.indexOf(phrase, pos);
      if (idx === -1) break;
      if (hasWordBoundary(hay, idx, phrase.length)) {
        raw.push({ start: idx, end: idx + phrase.length, entry });
      }
      pos = idx + 1;
    }
  }

  raw.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - b.start - (a.end - a.start);
  });

  /** @type {typeof raw} */
  const kept = [];
  for (const hit of raw) {
    const overlaps = kept.some((k) => !(hit.end <= k.start || hit.start >= k.end));
    if (!overlaps) kept.push(hit);
  }

  return kept.map((hit) => ({
    entityId: hit.entry.entity.id,
    canonical: hit.entry.entity.name,
    entityType: hit.entry.entity.entityType,
    dictionaryId: hit.entry.entity.dictionaryId,
    boost: hit.entry.entity.boost,
    matched: hit.entry.surface,
    normalized: hit.entry.normalized,
    start: hit.start,
    end: hit.end,
  }));
}

/**
 * Best single entity hit for a line (highest boost, then longest match).
 * @param {string} text
 * @param {ReturnType<typeof buildEntityIndex>} recognizer
 */
export function findBestEntity(text, recognizer) {
  const hits = recognizeEntitiesInText(text, recognizer);
  if (!hits.length) return null;
  hits.sort((a, b) => b.boost - a.boost || b.matched.length - a.matched.length);
  return hits[0];
}

/**
 * Multi-dictionary recognizer registry.
 * @param {object[]} dictionaries
 */
export function buildEntityRegistry(dictionaries = []) {
  const byType = new Map();
  const all = [];

  for (const dict of dictionaries) {
    const rec = buildEntityIndex(dict);
    all.push(rec);
    const type = rec.entityType;
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(rec);
  }

  return {
    recognizers: all,
    byType,
    /**
     * @param {string} text
     * @param {string} [entityType]
     */
    recognize(text, entityType = null) {
      const recs = entityType ? byType.get(entityType) || [] : all;
      const hits = [];
      for (const rec of recs) {
        hits.push(...recognizeEntitiesInText(text, rec));
      }
      if (!hits.length) return null;
      hits.sort((a, b) => b.boost - a.boost || b.matched.length - a.matched.length);
      return hits[0];
    },
    recognizeAll(text) {
      const hits = [];
      for (const rec of all) {
        hits.push(...recognizeEntitiesInText(text, rec));
      }
      return hits;
    },
  };
}
