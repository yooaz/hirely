/**
 * HIRELY P1 — Section order + visibility system.
 * Drag/reorder · hide/show · persisted in UI state · templates respect when compatible.
 */

export const PHOTO_SECTION_ORDER_VERSION = 'PHOTO_SECTION_ORDER_V1';

export const DEFAULT_SECTION_ORDER = Object.freeze([
  'summary',
  'experience',
  'clients',
  'projects',
  'education',
  'skills',
  'tools',
  'languages',
  'portfolio',
]);

/** Sections that must never be hidden (identity lives in header). */
export const SECTION_ORDER_LOCKED = Object.freeze(['identity']);

/**
 * @param {string} key
 */
export function normalizeSectionOrderKey(key) {
  const k = String(key || '').toLowerCase();
  if (k === 'experiences' || k === 'experience') return 'experience';
  if (k === 'profile') return 'summary';
  if (k === 'software') return 'tools';
  return k;
}

/**
 * @param {object} [state]
 */
export function ensureSectionOrder(state = {}) {
  if (!Array.isArray(state.sectionOrder) || !state.sectionOrder.length) {
    state.sectionOrder = DEFAULT_SECTION_ORDER.slice();
  }
  return state.sectionOrder.map(normalizeSectionOrderKey);
}

/**
 * @param {object} [state]
 */
export function ensureSectionHidden(state = {}) {
  if (!state.sectionHidden || typeof state.sectionHidden !== 'object') {
    state.sectionHidden = {};
  }
  return state.sectionHidden;
}

/**
 * @param {object} profile
 * @param {string} key
 */
export function isSectionVisible(profile, key) {
  const k = normalizeSectionOrderKey(key);
  if (SECTION_ORDER_LOCKED.includes(k)) return true;
  const hidden = profile?.sectionHidden || profile?._sectionHidden;
  if (!hidden || typeof hidden !== 'object') return true;
  return !hidden[k];
}

/**
 * @param {object} state
 * @param {string} key
 * @param {boolean} visible
 */
export function setSectionVisible(state, key, visible) {
  const k = normalizeSectionOrderKey(key);
  ensureSectionHidden(state);
  if (visible) delete state.sectionHidden[k];
  else state.sectionHidden[k] = true;
}

/**
 * @param {object} profile
 * @param {string[]} [baseOrder]
 */
export function resolveVisibleSectionOrder(profile, baseOrder = DEFAULT_SECTION_ORDER) {
  const raw = profile?.sectionOrder || profile?._sectionOrder;
  const order = Array.isArray(raw) && raw.length ? raw.map(normalizeSectionOrderKey) : baseOrder.slice();
  const seen = new Set();
  const out = [];
  for (const key of order) {
    const k = normalizeSectionOrderKey(key);
    if (!DEFAULT_SECTION_ORDER.includes(k) || seen.has(k)) continue;
    seen.add(k);
    if (isSectionVisible(profile, k)) out.push(k);
  }
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!seen.has(key) && isSectionVisible(profile, key)) out.push(key);
  }
  return out;
}

/**
 * @param {string[]} order
 */
export function atsOrderWarning(order) {
  const o = order || DEFAULT_SECTION_ORDER;
  const exp = o.indexOf('experience');
  const skills = o.indexOf('skills');
  if (exp < 0 || skills < 0) return '';
  if (skills < exp) {
    return "L'ordre ATS recommandé place l'expérience avant les compétences.";
  }
  return '';
}
