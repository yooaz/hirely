/**
 * HIRELY P2 — Photo System
 * Upload · crop · scale · position · hide · remove · PDF export
 * V2: safe zones, no transform overflow, auto face-centered crop
 */

import { TEMPLATE_FAMILY_V2_IDS } from '../templates/template-families-v2.mjs';
import {
  PHOTO_SYSTEM_V2,
  PHOTO_SAFE_ZONE,
  PHOTO_CROP_DEFAULT as V2_CROP_DEFAULT,
  inferPortraitFocusPoint,
  autoCropPhotoDataUrl,
  buildPhotoImgHtml as buildPhotoImgHtmlV2,
  sanitizePhotoCrop,
  getPhotoHtmlFromState as getPhotoHtmlFromStateV2,
} from './photo-system-v2.mjs';

export const PHOTO_SYSTEM_V2_ENGINE = PHOTO_SYSTEM_V2;
export { PHOTO_SYSTEM_V2, PHOTO_SAFE_ZONE, inferPortraitFocusPoint, autoCropPhotoDataUrl, sanitizePhotoCrop };

export const PHOTO_ACCEPT_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

export const PHOTO_CROP_DEFAULT = V2_CROP_DEFAULT;

/** Templates that support optional photo (all featured V2 + legacy). */
export const PHOTO_SUPPORTED_TEMPLATE_IDS = Object.freeze([
  ...TEMPLATE_FAMILY_V2_IDS,
  'ats',
  'ats-elite',
  'ats-executive',
  'executive-luxury',
  'editorial-magazine',
  'creative-director',
  'art-director-portfolio',
  'swiss-editorial',
  'visual-timeline',
  'agency-designer',
  'startup-builder',
  'tech-structured',
  'luxury-minimal',
  'creative-portfolio',
]);

/** Photo slot exists but hidden unless user enables. */
export const PHOTO_HIDDEN_BY_DEFAULT_IDS = Object.freeze([
  'ats',
  'ats-elite',
  'ats-recruiter',
  'ats-executive',
]);

/**
 * @param {string} templateId
 * @param {(id: string) => { id: string }} [resolveTemplate]
 */
export function resolvePhotoTemplateId(templateId, resolveTemplate) {
  const raw = String(templateId || 'ats').toLowerCase();
  if (typeof resolveTemplate === 'function') {
    try {
      return String(resolveTemplate(raw).id || raw).toLowerCase();
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * @param {string} templateId
 * @param {(id: string) => { id: string }} [resolveTemplate]
 */
export function templateSupportsPhoto(templateId, resolveTemplate) {
  const id = resolvePhotoTemplateId(templateId, resolveTemplate);
  return PHOTO_SUPPORTED_TEMPLATE_IDS.includes(id);
}

/**
 * @param {string} templateId
 */
export function defaultPhotoEnabledForTemplate(templateId) {
  const id = String(templateId || '').toLowerCase();
  return !PHOTO_HIDDEN_BY_DEFAULT_IDS.includes(id);
}

/**
 * @param {{ photo?: string|null, includePhoto?: boolean, photoPerTemplate?: Record<string, boolean> }} state
 * @param {string} templateId
 * @param {(id: string) => { id: string }} [resolveTemplate]
 */
export function isPhotoActive(state, templateId, resolveTemplate) {
  if (!state?.photo) return false;
  const tpl = resolvePhotoTemplateId(templateId || state.template, resolveTemplate);
  if (!templateSupportsPhoto(tpl, resolveTemplate)) return false;
  const per = state.photoPerTemplate || {};
  const enabled = per[tpl] !== undefined ? !!per[tpl] : defaultPhotoEnabledForTemplate(tpl);
  return enabled && !!state.includePhoto;
}

/**
 * @param {string} photoDataUrl
 * @param {{ zoom?: number, x?: number, y?: number }} [crop]
 */
export function buildPhotoImgHtml(photoDataUrl, crop = PHOTO_CROP_DEFAULT) {
  return buildPhotoImgHtmlV2(photoDataUrl, sanitizePhotoCrop(crop));
}

/**
 * @param {object} state
 * @param {string} [templateId]
 * @param {(id: string) => { id: string }} [resolveTemplate]
 */
export function getPhotoHtmlFromState(state, templateId, resolveTemplate) {
  return getPhotoHtmlFromStateV2(state, templateId, (s, tpl) =>
    isPhotoActive(s, tpl, resolveTemplate)
  );
}

/**
 * @param {object} state
 * @param {string} templateId
 */
export function hidePhotoOnTemplate(state, templateId) {
  const tpl = String(templateId || state.template || '').toLowerCase();
  if (!state.photoPerTemplate) state.photoPerTemplate = {};
  state.photoPerTemplate[tpl] = false;
  state.includePhoto = false;
}

/**
 * @param {object} state
 */
export function removePhotoFromState(state) {
  state.photo = null;
  state.includePhoto = false;
  state.photoCrop = { ...PHOTO_CROP_DEFAULT };
  state.photoPerTemplate = {};
}
