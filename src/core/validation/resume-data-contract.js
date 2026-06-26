/**
 * HIRELY DATA CONTRACT — strict resumeData shape + consumer guards.
 * Every imported CV must expose all required sections.
 * Renderers, templates, and ATS must read resumeData-derived views only — never raw OCR.
 */

import {
  assertTemplateCvFlowLock,
  FORBIDDEN_TEMPLATE_CV_KEYS,
} from '../pipeline/hirely-flow-lock.js';

export const HIRELY_DATA_CONTRACT_VERSION = 'data-contract-v1';

/** Required top-level resumeData sections (keys must exist; values may be empty). */
export const REQUIRED_RESUME_DATA_SECTIONS = Object.freeze([
  'identity',
  'summary',
  'experiences',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'projects',
  'unsorted',
]);

/** Empty values are valid — never emit CONTRACT_EMPTY_SECTION for these. */
export const OPTIONAL_EMPTY_SECTIONS = Object.freeze([
  'summary',
  'experiences',
  'education',
  'skills',
  'projects',
  'tools',
  'languages',
  'clients',
  'unsorted',
]);

/** Keys that must never appear on consumer inputs (template / ATS / renderer). */
export const FORBIDDEN_CONSUMER_RAW_KEYS = Object.freeze([
  'raw',
  'rawText',
  'cleanText',
  'cleanedText',
  'ocrText',
  'rawOcr',
  'rawExtraction',
  '_sourceLines',
  '_enterprise',
]);

/** Top-level resumeData keys stripped before UI/export. */
export const FORBIDDEN_RESUME_TOP_KEYS = Object.freeze([
  'rawText',
  'cleanedText',
  'text',
  'ocrText',
  'extractionText',
  'debug',
  'trace',
  'forensic',
  'cleanText',
  'rawOcr',
  'rawExtraction',
  'raw',
]);

/** Meta keys stripped before UI-facing finalResumeData. */
export const FORBIDDEN_META_KEYS = Object.freeze([
  'rawText',
  'cleanedText',
  'cleanText',
  'text',
  'ocrText',
  'extractionText',
  'raw',
  'ocr',
  'trace',
  'forensic',
  'debug',
  'rawOcr',
  'rawExtraction',
]);

function isResumeDataShape(obj) {
  return (
    !!obj &&
    typeof obj === 'object' &&
    ('identity' in obj || 'experiences' in obj || 'education' in obj || 'skills' in obj)
  );
}

function stripForbiddenMetaObject(meta = {}) {
  const m = { ...(meta && typeof meta === 'object' ? meta : {}) };
  for (const key of FORBIDDEN_META_KEYS) delete m[key];
  return m;
}

/**
 * Clone-safe strip of OCR/debug payloads.
 * Accepts full resumeData or a meta object (meta-only callers pass rd.meta).
 * @param {object} [input]
 */
export function stripForbiddenMeta(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  if (!isResumeDataShape(src)) {
    return stripForbiddenMetaObject(src);
  }
  const out = { ...src };
  for (const key of FORBIDDEN_RESUME_TOP_KEYS) delete out[key];
  if (out.meta && typeof out.meta === 'object') {
    out.meta = stripForbiddenMetaObject(out.meta);
  }
  return out;
}

const WARN_PREFIX = 'CONTRACT_';

/**
 * Soft completeness hints — informational only, never block render.
 * @param {object|null} resumeData
 */
export function validateResumeSoftChecks(resumeData) {
  const rd = resumeData && typeof resumeData === 'object' ? resumeData : {};
  const id = rd.identity && typeof rd.identity === 'object' ? rd.identity : {};
  /** @type {string[]} */
  const soft = [];
  if (!String(id.name || '').trim()) soft.push('identity.name');
  if (!String(id.email || '').trim() && !String(id.phone || '').trim()) soft.push('identity.contact');
  if (!(rd.experiences || []).length) soft.push('experiences');
  if (!(rd.education || []).length && !(rd.skills || []).length) soft.push('education_or_skills');
  return soft;
}

/**
 * Validate resumeData contract — missing sections emit warnings, never silent.
 * @param {object|null} resumeData
 * @param {{ silent?: boolean, profile?: 'pipeline'|'final' }} [opts]
 */
export function validateResumeDataContract(resumeData, opts = {}) {
  const rd = resumeData && typeof resumeData === 'object' ? resumeData : {};
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const missing = [];
  /** @type {string[]} */
  const empty = [];
  /** @type {string[]} */
  const forbidden = [];

  for (const key of REQUIRED_RESUME_DATA_SECTIONS) {
    if (!(key in rd)) {
      missing.push(key);
      warnings.push(`${WARN_PREFIX}MISSING_SECTION:${key}`);
      continue;
    }
    if (key === 'identity') {
      if (!rd.identity || typeof rd.identity !== 'object') {
        missing.push('identity');
        warnings.push(`${WARN_PREFIX}MISSING_SECTION:identity`);
      }
      continue;
    }
    if (key === 'summary') {
      if (!String(rd.summary || '').trim() && !OPTIONAL_EMPTY_SECTIONS.includes('summary')) {
        empty.push(key);
      }
      continue;
    }
    if (!Array.isArray(rd[key])) {
      missing.push(key);
      warnings.push(`${WARN_PREFIX}INVALID_SECTION_TYPE:${key}`);
      continue;
    }
    if (rd[key].length === 0 && !OPTIONAL_EMPTY_SECTIONS.includes(key)) {
      empty.push(key);
    }
  }

  for (const key of FORBIDDEN_CONSUMER_RAW_KEYS) {
    if (key in rd && String(rd[key] ?? '').length > 0) {
      forbidden.push(key);
      warnings.push(`${WARN_PREFIX}FORBIDDEN_ON_RESUME_DATA:${key}`);
    }
  }

  // meta OCR/debug fields are stripped before UI — never warn (pipeline may still hold them briefly).
  if (opts.profile !== 'pipeline' && rd.meta && typeof rd.meta === 'object') {
    for (const key of FORBIDDEN_META_KEYS) {
      if (key in rd.meta && String(rd.meta[key] ?? '').length > 0) {
        forbidden.push(`meta.${key}`);
      }
    }
  }

  for (const key of empty) {
    if (!OPTIONAL_EMPTY_SECTIONS.includes(key)) {
      warnings.push(`${WARN_PREFIX}EMPTY_SECTION:${key}`);
    }
  }

  const ok = missing.length === 0 && forbidden.length === 0;

  if (!opts.silent && warnings.length) {
    for (const w of warnings) console.warn('[HIRELY_DATA_CONTRACT]', w);
  }

  return {
    ok,
    version: HIRELY_DATA_CONTRACT_VERSION,
    warnings,
    missing,
    empty,
    forbidden,
    sections: Object.fromEntries(
      REQUIRED_RESUME_DATA_SECTIONS.map((k) => {
        if (k === 'identity') return [k, rd.identity && typeof rd.identity === 'object' ? 'object' : 'missing'];
        if (k === 'summary') return [k, String(rd.summary || '').trim() ? 'nonempty' : 'empty'];
        return [k, Array.isArray(rd[k]) ? rd[k].length : 'missing'];
      })
    ),
  };
}

/**
 * Ensure all required sections exist on resumeData (mutates copy).
 * @param {object|null} resumeData
 */
export function ensureResumeDataSections(resumeData) {
  const rd = resumeData && typeof resumeData === 'object' ? { ...resumeData } : {};
  if (!rd.identity || typeof rd.identity !== 'object') {
    rd.identity = {
      name: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      website: '',
      linkedin: '',
    };
  }
  if (typeof rd.summary !== 'string') rd.summary = '';
  for (const key of REQUIRED_RESUME_DATA_SECTIONS) {
    if (key === 'identity' || key === 'summary') continue;
    if (!Array.isArray(rd[key])) rd[key] = [];
  }
  if (!rd.meta || typeof rd.meta !== 'object') rd.meta = { warnings: [], errors: [] };
  if (!Array.isArray(rd.meta.warnings)) rd.meta.warnings = [];
  if (!Array.isArray(rd.meta.errors)) rd.meta.errors = [];
  return rd;
}

/**
 * Apply contract warnings to resumeData.meta (mutates).
 * @param {object} resumeData
 * @param {{ silent?: boolean }} [opts]
 */
export function applyResumeDataContractWarnings(resumeData, opts = {}) {
  const rd = ensureResumeDataSections(resumeData);
  rd.meta = stripForbiddenMeta(rd.meta);
  const check = validateResumeDataContract(rd, { silent: true, profile: 'pipeline' });
  const loggable = check.warnings.filter(
    (w) =>
      !/^CONTRACT_EMPTY_SECTION:(summary|projects)$/.test(w) &&
      !/^CONTRACT_FORBIDDEN_ON_RESUME_DATA:meta\./.test(w)
  );
  if (loggable.length) {
    rd.meta.warnings = [...new Set([...(rd.meta.warnings || []), ...loggable])];
    rd.meta.dataContract = {
      version: HIRELY_DATA_CONTRACT_VERSION,
      checkedAt: new Date().toISOString(),
      missing: check.missing,
      empty: check.empty,
      forbidden: check.forbidden,
      soft: validateResumeSoftChecks(rd),
    };
    if (!opts.silent) {
      for (const w of loggable) console.warn('[HIRELY_DATA_CONTRACT]', w);
    }
  } else {
    rd.meta.dataContract = {
      version: HIRELY_DATA_CONTRACT_VERSION,
      checkedAt: new Date().toISOString(),
      missing: check.missing,
      empty: check.empty,
      forbidden: check.forbidden,
      soft: validateResumeSoftChecks(rd),
    };
  }
  return { resumeData: rd, check: { ...check, warnings: loggable } };
}

/**
 * Guard: consumer (template / ATS / renderer) must not read raw OCR payloads.
 * @param {object|null} data
 * @param {string} consumer
 */
export function validateConsumerDataSource(data, consumer = 'CONSUMER', opts = {}) {
  const d = data && typeof data === 'object' ? data : {};
  /** @type {string[]} */
  const violations = [];

  for (const key of FORBIDDEN_CONSUMER_RAW_KEYS) {
    if (key in d && String(d[key] ?? '').trim().length > 0) {
      violations.push(`${consumer}_READS_RAW_OCR:${key}`);
    }
  }

  const flowLock = assertTemplateCvFlowLock(d);
  if (!flowLock.ok) {
    for (const key of flowLock.forbidden) {
      violations.push(`${consumer}_FORBIDDEN_CV_KEY:${key}`);
    }
  }

  const ok = violations.length === 0;
  if (!ok && !opts.silent) {
    for (const v of violations) console.warn('[HIRELY_DATA_CONTRACT]', v);
  }

  return { ok, violations, forbiddenKeys: [...FORBIDDEN_CONSUMER_RAW_KEYS, ...FORBIDDEN_TEMPLATE_CV_KEYS] };
}
