/**
 * P0 — Real CV benchmark pack catalog (18 messy real-world layout slots).
 * Uses diverse cv-corpus text + layout transforms — not single-fixture Yoaz-only paths.
 */

export const REAL_CV_BENCHMARK_PACK_V1 = 'REAL_CV_BENCHMARK_PACK_V1';

/**
 * @typedef {object} BenchmarkSlot
 * @property {string} id
 * @property {string} category
 * @property {string} label
 * @property {string} fileName
 * @property {'pdf'|'docx'|'image'} pack
 * @property {string} [corpusKey]
 * @property {string} [layout]
 * @property {string} [corpusOverride]
 */

/** @type {BenchmarkSlot[]} */
export const BENCHMARK_PDF_SLOTS = [
  {
    id: 'pdf_selectable',
    category: 'pdf_selectable',
    label: 'Selectable PDF',
    fileName: 'benchmark-selectable-developer.pdf',
    pack: 'pdf',
    corpusKey: 'developer',
    layout: 'developer',
  },
  {
    id: 'pdf_scanned',
    category: 'pdf_scanned',
    label: 'Scanned PDF',
    fileName: 'benchmark-scanned-nurse.pdf',
    pack: 'pdf',
    corpusKey: 'nurse',
    layout: 'scanned_image',
  },
  {
    id: 'pdf_canva',
    category: 'pdf_canva',
    label: 'Canva PDF',
    fileName: 'benchmark-canva-marketing.pdf',
    pack: 'pdf',
    corpusKey: 'marketing',
    layout: 'canva',
  },
  {
    id: 'pdf_indesign',
    category: 'pdf_indesign',
    label: 'InDesign PDF',
    fileName: 'benchmark-indesign-designer.pdf',
    pack: 'pdf',
    corpusKey: 'designer',
    layout: 'indesign',
  },
  {
    id: 'pdf_protected',
    category: 'pdf_protected',
    label: 'Protected PDF',
    fileName: 'benchmark-protected.pdf',
    pack: 'pdf',
    corpusKey: 'consultant',
    layout: 'protected',
  },
  {
    id: 'pdf_two_column',
    category: 'pdf_two_column',
    label: 'Two-column PDF',
    fileName: 'benchmark-two-column.pdf',
    pack: 'pdf',
    corpusKey: 'twoColumn',
    layout: 'two_column_pdf',
  },
  {
    id: 'pdf_image_heavy',
    category: 'pdf_image_heavy',
    label: 'Image-heavy PDF',
    fileName: 'benchmark-image-heavy.pdf',
    pack: 'pdf',
    corpusKey: 'creative',
    layout: 'image_heavy',
  },
  {
    id: 'pdf_creative_portfolio',
    category: 'pdf_creative_portfolio',
    label: 'Creative portfolio PDF',
    fileName: 'benchmark-creative-portfolio.pdf',
    pack: 'pdf',
    corpusKey: 'creative',
    layout: 'creative-portfolio',
  },
  {
    id: 'pdf_corporate',
    category: 'pdf_corporate',
    label: 'Corporate PDF',
    fileName: 'benchmark-corporate-executive.pdf',
    pack: 'pdf',
    corpusKey: 'executive',
    layout: 'executive',
  },
  {
    id: 'pdf_old_export',
    category: 'pdf_old_export',
    label: 'Old exported PDF',
    fileName: 'benchmark-old-word-export.pdf',
    pack: 'pdf',
    corpusKey: 'consultant',
    layout: 'word',
  },
];

/** @type {BenchmarkSlot[]} */
export const BENCHMARK_DOCX_SLOTS = [
  {
    id: 'docx_simple',
    category: 'docx_simple',
    label: 'Simple Word CV',
    fileName: 'benchmark-simple-word.docx',
    pack: 'docx',
    corpusKey: 'developer',
    layout: 'simple',
  },
  {
    id: 'docx_table',
    category: 'docx_table',
    label: 'Table layout DOCX',
    fileName: 'benchmark-table-layout.docx',
    pack: 'docx',
    corpusKey: 'marketing',
    layout: 'table',
  },
  {
    id: 'docx_two_column',
    category: 'docx_two_column',
    label: 'Two-column Word CV',
    fileName: 'benchmark-two-column-word.docx',
    pack: 'docx',
    corpusKey: 'twoColumn',
    layout: 'two_column',
  },
  {
    id: 'docx_header_footer',
    category: 'docx_header_footer',
    label: 'Header/footer contact DOCX',
    fileName: 'benchmark-header-footer.docx',
    pack: 'docx',
    corpusKey: 'executive',
    layout: 'header_footer',
  },
  {
    id: 'docx_creative',
    category: 'docx_creative',
    label: 'Creative Word CV',
    fileName: 'benchmark-creative-word.docx',
    pack: 'docx',
    corpusKey: 'creative',
    layout: 'canva',
  },
];

/** @type {BenchmarkSlot[]} */
export const BENCHMARK_IMAGE_SLOTS = [
  {
    id: 'img_png',
    category: 'img_png',
    label: 'PNG CV',
    fileName: 'benchmark-cv.png',
    pack: 'image',
    corpusKey: 'freelancer',
    layout: 'png',
  },
  {
    id: 'img_jpg',
    category: 'img_jpg',
    label: 'JPG CV',
    fileName: 'benchmark-cv.jpg',
    pack: 'image',
    corpusKey: 'designer',
    layout: 'jpg',
  },
  {
    id: 'img_screenshot',
    category: 'img_screenshot',
    label: 'Screenshot CV',
    fileName: 'benchmark-cv-screenshot.png',
    pack: 'image',
    corpusKey: 'consultant',
    layout: 'screenshot',
  },
];

export const BENCHMARK_ALL_SLOTS = [
  ...BENCHMARK_PDF_SLOTS,
  ...BENCHMARK_DOCX_SLOTS,
  ...BENCHMARK_IMAGE_SLOTS,
];
