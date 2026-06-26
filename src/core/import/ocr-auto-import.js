/**
 * P0 — Automatic OCR for image/scanned PDFs (Tesseract.js). Never force paste.
 */
import { detectInputFileType } from '../extraction/file-type-detect.js';
import { OCR_CONFIDENCE_WARN_THRESHOLD } from '../extraction/ocr-quality-score.js';

export const OCR_AUTO_IMPORT_VERSION = 'OCR_AUTO_P0_V1';
export { OCR_CONFIDENCE_WARN_THRESHOLD };

export const OCR_ANALYZING_LABEL = 'Lecture du PDF…';

export const OCR_PROGRESS_ANALYZING = 'Lecture du PDF…';
export const OCR_PROGRESS_RUNNING = 'Reconnaissance du texte…';
export const OCR_PROGRESS_EXTRACTING = 'Reconnaissance du texte…';
export const OCR_PROGRESS_BUILDING = 'Création du CV…';

export const OCR_PROGRESS_LABELS_EN = Object.freeze({
  analyzing: 'Reading PDF…',
  running: 'Recognizing text…',
  extracting: 'Recognizing text…',
  building: 'Building CV…',
});

export const OCR_PROGRESS_LABELS_FR = Object.freeze({
  analyzing: OCR_PROGRESS_ANALYZING,
  running: OCR_PROGRESS_RUNNING,
  extracting: OCR_PROGRESS_EXTRACTING,
  building: OCR_PROGRESS_BUILDING,
});

export function ocrProgressLabel(key, lang = 'fr') {
  const k = String(key || '').toLowerCase();
  if (lang === 'en') {
    return OCR_PROGRESS_LABELS_EN[k] || OCR_PROGRESS_LABELS_EN.analyzing;
  }
  return OCR_PROGRESS_LABELS_FR[k] || OCR_PROGRESS_LABELS_FR.analyzing;
}

export const OCR_LOW_CONFIDENCE_MSG =
  'Lecture partielle — vérifiez les lignes extraites.';

/**
 * @param {File|{ name?: string, type?: string }} file
 */
export function fileNeedsOcrPipeline(file) {
  const kind = detectInputFileType(file).kind;
  return kind === 'pdf' || kind === 'image';
}

export function isOcrAutoImportEnabled() {
  if (globalThis.HIRELY_OCR_DISABLED_V1 === true) return false;
  if (globalThis.HIRELY_OCR_AUTO === false) return false;
  return true;
}

/**
 * @param {number} score 0–100
 */
export function ocrConfidenceWarning(score) {
  const n = Number(score);
  if (!Number.isFinite(n) || n >= OCR_CONFIDENCE_WARN_THRESHOLD) return null;
  return OCR_LOW_CONFIDENCE_MSG;
}

/**
 * @param {number} score
 */
export function formatOcrConfidenceLabel(score) {
  const n = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  return `Extraction OCR · ${n}% confiance`;
}

const PROGRESS_KEY_MAP = Object.freeze({
  analyzing: OCR_PROGRESS_ANALYZING,
  running: OCR_PROGRESS_RUNNING,
  extracting: OCR_PROGRESS_EXTRACTING,
  building: OCR_PROGRESS_BUILDING,
});

/** Push calm OCR stage copy to import UI (Lecture du PDF… / Reconnaissance du texte…). */
export function notifyOcrImportProgress(keyOrMessage) {
  const raw = String(keyOrMessage || '').trim();
  if (!raw) return;
  const msg = PROGRESS_KEY_MAP[raw.toLowerCase()] || raw;
  try {
    if (typeof globalThis.HIRELY_SET_IMPORT_LIVE_STATUS === 'function') {
      globalThis.HIRELY_SET_IMPORT_LIVE_STATUS(msg);
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof globalThis.HIRELY_ON_OCR_IMPORT_PROGRESS === 'function') {
      globalThis.HIRELY_ON_OCR_IMPORT_PROGRESS(msg);
    }
  } catch {
    /* ignore */
  }
}
