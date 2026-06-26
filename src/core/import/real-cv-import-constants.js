/**
 * Real CV import thresholds — no imports (safe for import-status / render-guard).
 */

export const REAL_CV_IMPORT_ROOT_V1 = 'REAL_CV_IMPORT_ROOT_V1';

/** Minimum chars for parser / structured CV. */
export const REAL_CV_IMPORT_MIN_CHARS = 300;

/** Minimum chars before any extract is considered non-empty. */
export const REAL_CV_IMPORT_RENDER_MIN_CHARS = 20;

export const REAL_CV_IMPORT_THIN_TEXT_MSG =
  'Texte extrait trop court pour générer un CV automatiquement. Collez le contenu complet du CV.';

export const REAL_CV_IMPORT_FAILURE_REASONS = Object.freeze({
  thin_text: 'thin_text',
  ocr_timeout: 'ocr_timeout',
  ocr_quality: 'ocr_quality',
  empty_extract: 'empty_extract',
  weak_native: 'weak_native',
});
