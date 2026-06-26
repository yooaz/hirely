/**
 * P1 — Template density: section counting + A4 first-page fill metrics.
 */
import { A4_HEIGHT_PX } from '../../core/export/pdf-export-config.js';

/** Sections needed before cvDensity--filled + stricter first-page fill gate. */
export const DENSITY_MIN_SECTIONS_FOR_FILL = 4;
export const DENSITY_MIN_SECTIONS_FOR_FILLED = 4;
export const DENSITY_MIN_FIRST_PAGE_FILL = 0.5;
/** P0 template quality gate — fail below this first-page fill ratio. */
export const TEMPLATE_QUALITY_MIN_FIRST_PAGE_DENSITY = 0.55;
/** Max blank tail below last content block on page 1 (excessive whitespace). */
export const TEMPLATE_QUALITY_MAX_BLANK_TAIL = 0.42;
export const DENSITY_MIN_VISIBLE_TEXT = 80;
/** P0 polish — identity header + at least this many major sections on page 1 when data exists. */
export const DENSITY_POLISH_MIN_MAJOR_SECTIONS_PAGE1 = 3;

/** Section types counted toward density QA (matches resumeData contract). */
export const DENSITY_SECTION_KEYS = Object.freeze([
  'identity',
  'summary',
  'experiences',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'projects',
]);

function hasIdentity(data) {
  const id = data?.identity;
  if (id && typeof id === 'object') {
    return !!(id.name || id.title || id.email || id.phone || id.location);
  }
  return !!(data?.name || data?.title || data?.email || data?.phone || data?.location);
}

function hasSummary(data) {
  return !!String(data?.summary || '').trim();
}

function hasExperiences(data) {
  const exp = data?.experiences || data?.experience || [];
  if (!Array.isArray(exp) || !exp.length) return false;
  return exp.some((e) => {
    if (!e) return false;
    if (typeof e === 'string') return String(e).trim().length > 0;
    return !!(e.role || e.company || e.dates || (e.bullets || []).filter(Boolean).length);
  });
}

function hasList(key, data) {
  const arr = data?.[key];
  return Array.isArray(arr) && arr.some((s) => String(s || '').trim().length > 0);
}

function hasEducation(data) {
  const edu = data?.education || [];
  if (!Array.isArray(edu) || !edu.length) return false;
  return edu.some((e) => {
    if (!e) return false;
    if (typeof e === 'string') return String(e).trim().length > 0;
    return !!(e.school || e.degree || e.field || e.dates);
  });
}

/**
 * Count populated section types (flat cvData or resumeData shape).
 * @param {object} data
 * @returns {number}
 */
export function countPopulatedSections(data) {
  if (!data || typeof data !== 'object') return 0;
  let n = 0;
  if (hasIdentity(data)) n += 1;
  if (hasSummary(data)) n += 1;
  if (hasExperiences(data)) n += 1;
  if (hasEducation(data)) n += 1;
  if (hasList('skills', data)) n += 1;
  if (hasList('tools', data)) n += 1;
  if (hasList('languages', data)) n += 1;
  if (hasList('clients', data)) n += 1;
  if (hasList('projects', data)) n += 1;
  return n;
}

/**
 * @param {number} sectionCount
 * @returns {'sparse'|'filled'}
 */
export function resolveDensityMode(sectionCount) {
  return sectionCount >= DENSITY_MIN_SECTIONS_FOR_FILLED ? 'filled' : 'sparse';
}

/**
 * @param {number} sectionCount
 * @returns {string}
 */
export function densityClassForSectionCount(sectionCount) {
  return `cvDensity--${resolveDensityMode(sectionCount)}`;
}

/**
 * Measure how much of an A4 page the cvInner content occupies.
 * @param {number} contentPx scrollHeight of .cvInner
 * @param {number} [pageHeightPx]
 */
export function firstPageFillRatio(contentPx, pageHeightPx = A4_HEIGHT_PX) {
  if (!pageHeightPx || contentPx <= 0) return 0;
  return Math.min(1, contentPx / pageHeightPx);
}

export function passesFirstPageFillGate(sectionCount, fillRatio) {
  if (sectionCount < DENSITY_MIN_SECTIONS_FOR_FILL) return true;
  const fillPct = Math.round(fillRatio * 1000) / 10;
  return fillPct >= DENSITY_MIN_FIRST_PAGE_FILL * 100;
}

/** Major content blocks counted toward first-page visibility (excludes identity header). */
export const MAJOR_SECTION_CLASS_HINTS = Object.freeze([
  'cvSection--summary',
  'cvSection--experience',
  'cvSection--education',
  'cvSection--skills',
  'cvSection--tools',
  'cvSection--software',
  'cvSection--languages',
  'cvSection--clients',
  'cvSection--projects',
]);

/**
 * @param {number} majorSectionCount sections on page 1 (excluding identity)
 * @param {boolean} hasIdentity
 */
export function passesMajorSectionsPage1Gate(majorSectionCount, hasIdentity) {
  if (!hasIdentity) return false;
  return majorSectionCount >= DENSITY_POLISH_MIN_MAJOR_SECTIONS_PAGE1;
}
