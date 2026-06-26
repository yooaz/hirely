/**
 * Guards against early plain-text flattening in the structure-first parse path.
 *
 * Allowed flatten sites (last-resort only):
 *   - audit / forensic / debug export
 *   - LLM reconstruction side channel
 *   - explicit legacy consumer with structure_preserved=false
 */

/** @readonly */
export const FLATTEN_ALLOWED_SITES = Object.freeze({
  AUDIT: 'audit',
  FORENSIC: 'forensic',
  LLM_FALLBACK: 'llm_fallback',
  EXPORT: 'export',
  LEGACY_CONSUMER: 'legacy_consumer',
  DERIVED_SNAPSHOT: 'derived_snapshot',
});

/** Sites that must NOT flatten before section detection */
const FORBIDDEN_BEFORE_SECTIONS = new Set([
  'semantic_infer',
  'section_detect',
  'block_builder',
  'experience_parser',
  'education_parser',
  'skills_parser',
  'column_recovery',
]);

/**
 * @typedef {object} FlatTextGuard
 * @property {(site: string, reason?: string) => void} recordFlatten
 * @property {() => { ok: boolean, violations: string[], allowed: string[] }} assertNoEarlyFlatten
 * @property {() => string[]} getViolations
 * @property {boolean} structureFirst
 */

/**
 * @param {object} [opts]
 * @returns {FlatTextGuard}
 */
export function createFlatTextGuard(opts = {}) {
  const structureFirst = opts.structureFirst !== false;
  /** @type {{ site: string, reason: string, at: string }[]} */
  const events = [];
  /** @type {string[]} */
  const allowed = [];

  return {
    structureFirst,

    recordFlatten(site, reason = '') {
      const s = String(site || 'unknown');
      if (Object.values(FLATTEN_ALLOWED_SITES).includes(s)) {
        allowed.push(s);
        return;
      }
      events.push({ site: s, reason: String(reason || ''), at: new Date().toISOString() });
    },

    getViolations() {
      if (!structureFirst) return [];
      return events
        .filter((e) => FORBIDDEN_BEFORE_SECTIONS.has(e.site))
        .map((e) => `${e.site}: ${e.reason || 'plain-text flatten'}`);
    },

    assertNoEarlyFlatten() {
      const violations = this.getViolations();
      return { ok: violations.length === 0, violations, allowed: [...allowed] };
    },
  };
}

/** @type {FlatTextGuard|null} */
let activeGuard = null;

/**
 * @param {FlatTextGuard|null} guard
 */
export function setActiveFlatTextGuard(guard) {
  activeGuard = guard;
}

/** @returns {FlatTextGuard|null} */
export function getActiveFlatTextGuard() {
  return activeGuard;
}

/**
 * @param {string} site
 * @param {string} [reason]
 */
export function recordFlattenIfActive(site, reason) {
  activeGuard?.recordFlatten(site, reason);
}
