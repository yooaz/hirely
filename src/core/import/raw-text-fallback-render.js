/**
 * RAW TEXT FALLBACK RENDERER — when structured parsing fails but text > 100 chars.
 * Always produces a readable CV preview (never empty).
 */
import { SIMPLE_IMPORT_MIN_CHARS } from './v1-import-constants.js';
import {
  canContinueWithRawText,
  fallbackRawTextCvData,
  fallbackRawTextResumeData,
  renderFallbackCv,
} from './simple-import-mode.js';

export const RAW_TEXT_FALLBACK_VERSION = 'RAW_TEXT_FALLBACK_V1';

export { canContinueWithRawText as shouldUseRawTextFallback };

export function buildRawTextFallbackCvData(rawText, cleanText) {
  return fallbackRawTextCvData(rawText, cleanText);
}

export function buildRawTextFallbackResumeData(rawText, cleanText) {
  return fallbackRawTextResumeData(rawText, cleanText);
}

/**
 * HTML preview: name, "Profil professionnel", section "Contenu extrait", body = cleaned text.
 * @param {string} rawText
 * @param {string} [cleanText]
 * @param {(s: string) => string} [esc]
 */
export function renderRawTextFallbackHtml(rawText, cleanText, esc) {
  return renderFallbackCv(rawText, cleanText, esc);
}

/**
 * Full fallback package for import/review when parser output is weak.
 * @param {string} rawText
 * @param {string} [cleanText]
 */
export function buildRawTextFallbackBundle(rawText, cleanText) {
  const text = String(rawText || '').trim();
  const clean = String(cleanText || text).trim();
  if (text.length <= SIMPLE_IMPORT_MIN_CHARS) {
    return { ok: false, rawText: text, cleanText: clean, minChars: SIMPLE_IMPORT_MIN_CHARS };
  }
  return {
    ok: true,
    rawText: text,
    cleanText: clean,
    cvData: buildRawTextFallbackCvData(text, clean),
    resumeData: buildRawTextFallbackResumeData(text, clean),
    html: null,
    _simpleFallback: true,
  };
}

/**
 * @param {string} rawText
 * @param {string} [cleanText]
 * @param {(s: string) => string} [esc]
 */
export function renderRawTextFallbackBundle(rawText, cleanText, esc) {
  const bundle = buildRawTextFallbackBundle(rawText, cleanText);
  if (!bundle.ok) return bundle;
  bundle.html = renderRawTextFallbackHtml(bundle.rawText, bundle.cleanText, esc);
  return bundle;
}
