/**
 * A4 PDF export constants — shared by browser export and Playwright QA (P6 lock).
 */

export const PDF_EXPORT_ENGINE = 'PDF_EXPORT_P6';
export const PDF_EXPORT_ENGINE_V2 = 'PDF_EXPORT_V2';

/** A4 at 96 CSS px/in (matches Hirely #cvDoc preview width). */
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

/** A4 in millimetres (ISO). */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/** A4 in PDF points (72 pt/in). */
export const A4_WIDTH_PT = 595.28;
export const A4_HEIGHT_PT = 841.89;

export const PDF_PAGE_MARGIN_MM = { top: 12, right: 14, bottom: 12, left: 14 };

/** Selectors that must not be split across pages (widow/orphan blocks). */
export const PDF_PAGE_BREAK_AVOID_SELECTORS = [
  '.cvHead',
  '.cvSection',
  '.cvExpEntry',
  '.cvProjectEntry',
  '.cvMetaFooter',
  '.cvSide',
  '.cvSectionTitle',
];

export const PDF_EXPORT_BODY_CLASS = 'export-pdf';
export const PDF_EXPORT_CV_CLASS = 'cv--pdf-export';
