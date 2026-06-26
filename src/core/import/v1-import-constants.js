/** V1 fast import — text PDF, DOCX, TXT, paste only. No OCR. */

export const SIMPLE_IMPORT_MIN_CHARS = 100;

/** Max import wait (ms) — no endless loading in V1. */
export const V1_IMPORT_MAX_MS = 5000;

/** Scanned / image PDF — calm paste after OCR attempted. */
export const OCR_FAILURE_PASTE_TITLE = 'Ce PDF est une image';
export const OCR_FAILURE_PASTE_LEAD =
  'Nous n’avons pas pu lire assez de texte automatiquement. Collez le texte du CV ci-dessous pour continuer.';
export const OCR_FAILURE_PASTE_CTA = 'Créer mon CV avec ce texte';

export const PDF_IMAGE_PASTE_MSG = OCR_FAILURE_PASTE_LEAD;

/** Photo / raster CV upload in V1 */
export const V1_PHOTO_PASTE_MSG =
  'Les photos de CV ne sont pas lues automatiquement en V1. Collez le texte pour continuer.';

/** @deprecated alias — image / unsupported raster import */
export const V1_UNSUPPORTED_IMAGE_MSG = V1_PHOTO_PASTE_MSG;

/** Paste-first panel — unsupported file (paste is the path forward) */
export const PASTE_FIRST_TITLE = OCR_FAILURE_PASTE_TITLE;
export const PASTE_FIRST_LEAD =
  'V1 accepte uniquement PDF texte, DOCX, TXT et texte collé.';
export const PASTE_FIRST_FORMATS_NOTE =
  'PDF texte · DOCX · TXT · texte collé';
export const PASTE_FIRST_CTA = OCR_FAILURE_PASTE_CTA;

/** Import screen — V1 format clarity */
export const V1_IMPORT_SUPPORTED_LABEL = 'Pris en charge (V1)';
export const V1_IMPORT_UNSUPPORTED_LABEL = 'Non pris en charge en V1';
export const V1_IMPORT_SUPPORTED_ITEMS = [
  'PDF texte',
  'DOCX',
  'TXT',
  'Texte collé',
];
export const V1_IMPORT_UNSUPPORTED_ITEMS = [
  'PDF scanné',
  'Photos & captures',
  'PDF protégé',
  'Lecture OCR automatique',
];

export function isV1ImportMode() {
  if (globalThis.HIRELY_SIMPLE_IMPORT_MODE === false) return false;
  if (globalThis.HIRELY_V1_IMPORT === false) return false;
  return (
    globalThis.HIRELY_SIMPLE_IMPORT_MODE === true ||
    globalThis.HIRELY_V1_IMPORT === true ||
    globalThis.HIRELY_OCR_DISABLED_V1 === true
  );
}
