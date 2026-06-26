/**
 * PDF extraction budget — must cover WASM cold start + render + multipass OCR in browser.
 * UI import race for PDF is 180s (`importTimeoutMs`); keep extraction within that envelope.
 */

/** Per-page OCR budget when computing multi-page extraction ceiling. */
export const PDF_OCR_PER_PAGE_MS =
  typeof globalThis !== 'undefined' &&
  Number(globalThis.HIRELY_PDF_OCR_PER_PAGE_MS) > 0
    ? Number(globalThis.HIRELY_PDF_OCR_PER_PAGE_MS)
    : 28000;

/** Hard ceiling for single-page PDF/OCR — 30s default (scanned page 1 needs render + tess). */
export const PDF_EXTRACTION_MAX_MS =
  typeof globalThis !== 'undefined' &&
  Number(globalThis.HIRELY_PDF_EXTRACTION_MAX_MS) > 0
    ? Number(globalThis.HIRELY_PDF_EXTRACTION_MAX_MS)
    : 45000;

/**
 * Total extraction budget for a PDF (hybrid / multi-page OCR).
 * @param {number} [pageCount]
 */
export function pdfExtractionBudgetMs(pageCount = 1) {
  const pages = Math.max(1, Number(pageCount) || 1);
  const perPage = PDF_OCR_PER_PAGE_MS;
  const floor = PDF_EXTRACTION_MAX_MS;
  const computed = perPage * pages + 8000;
  const cap =
    typeof globalThis !== 'undefined' &&
    Number(globalThis.HIRELY_PDF_EXTRACTION_HARD_CAP_MS) > 0
      ? Number(globalThis.HIRELY_PDF_EXTRACTION_HARD_CAP_MS)
      : 120000;
  return Math.min(cap, Math.max(floor, computed));
}

/**
 * UI / import race ceiling — must cover full OCR settlement (not just advisory timeout).
 * @param {number} [pageCount]
 */
export function pdfImportBarrierTimeoutMs(pageCount = 1) {
  const pages = Math.max(1, Number(pageCount) || 1);
  const extraction = pdfExtractionBudgetMs(pages);
  const envelope =
    typeof globalThis !== 'undefined' &&
    Number(globalThis.HIRELY_IMPORT_OCR_ENVELOPE_MS) > 0
      ? Number(globalThis.HIRELY_IMPORT_OCR_ENVELOPE_MS)
      : 20000;
  const cap =
    typeof globalThis !== 'undefined' &&
    Number(globalThis.HIRELY_PDF_EXTRACTION_HARD_CAP_MS) > 0
      ? Number(globalThis.HIRELY_PDF_EXTRACTION_HARD_CAP_MS)
      : 120000;
  return Math.min(cap, extraction + envelope);
}

/** Progressive import UX — measured from PDF upload / OCR start */
export const OCR_UX_PROGRESS_MS = 3000;
export const OCR_UX_PATIENCE_MS = 5000;
export const OCR_UX_EARLY_PASTE_MS = 8000;
export const OCR_UX_FULL_FALLBACK_MS = PDF_EXTRACTION_MAX_MS;

export const OCR_UX_PATIENCE_MSG = 'Cela peut prendre quelques secondes.';
export const OCR_UX_EARLY_PASTE_MSG = 'Analyse en cours...';

/** Hard OCR ceiling — full paste fallback; never block import past this budget. */
export const OCR_HARD_FALLBACK_MS = PDF_EXTRACTION_MAX_MS;

export const OCR_ANALYZING_MSG = 'Analyse du CV...';
export const OCR_PARTIAL_REVIEW_MSG =
  'Certaines sections devront être vérifiées.';

export const OCR_ROTATION_TRIAL_MAX_MS = 8000;
export const OCR_ROTATION_MAX = 4;

/** Shown after partial recovery — import continues; never a terminal block message. */
export const OCR_TIMEOUT_USER_MSG = OCR_PARTIAL_REVIEW_MSG;

/**
 * @param {number} [deadlineAt]
 */
export function remainingMs(deadlineAt) {
  if (!deadlineAt || !Number.isFinite(deadlineAt)) return PDF_EXTRACTION_MAX_MS;
  return Math.max(0, deadlineAt - Date.now());
}

/**
 * @param {Promise<unknown>} promise
 * @param {number} ms
 */
export function withRotationTrialTimeout(promise, ms) {
  const budget = Math.max(1, ms);
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            Object.assign(new Error('OCR_ROTATION_TRIAL_TIMEOUT'), {
              code: 'OCR_ROTATION_TRIAL_TIMEOUT',
            })
          ),
        budget
      )
    ),
  ]);
}

/**
 * @param {Promise<unknown>} promise
 * @param {number} ms
 * @param {string} [code]
 */
export function withExtractionTimeout(promise, ms, code = 'OCR_TIMEOUT') {
  const budget = Math.max(1, ms);
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            Object.assign(new Error('PDF_EXTRACTION_TIMEOUT'), {
              code,
              importStatus: 'PDF_OCR_TIMEOUT',
            })
          ),
        budget
      )
    ),
  ]);
}
