/**
 * H15 — Real CV quality benchmark catalog (20 realistic cases).
 */

export const H15_BENCH_ENGINE = 'HIRELY_H15_REAL_CV_BENCH_V1';
export const H15_BENCH_COUNT = 20;

/**
 * @typedef {object} H15BenchFixture
 * @property {string} id
 * @property {string} label
 * @property {string} category clean-pdf|scanned-pdf|image-cv|two-column|portfolio|student|developer|marketing|freelance|executive
 * @property {string} [manifestId]
 * @property {string} [file]
 * @property {string} [fixtureKey] ground-truth key when manifestId differs
 * @property {string} extractionMethod
 * @property {boolean} [simulateOcr]
 * @property {number} [ocrSeed]
 */

/** @type {H15BenchFixture[]} */
export const H15_REAL_CV_BENCH = [
  { id: 'h15-01-clean-pdf', category: 'clean-pdf', label: 'Clean PDF — native text', manifestId: 'text-pdf', extractionMethod: 'pdf-text' },
  { id: 'h15-02-clean-docx', category: 'clean-pdf', label: 'Clean PDF — DOCX export', manifestId: 'docx', extractionMethod: 'docx' },
  { id: 'h15-03-scanned-pdf', category: 'scanned-pdf', label: 'Scanned PDF — OCR', manifestId: 'scanned-pdf', extractionMethod: 'pdf-ocr' },
  {
    id: 'h15-04-scanned-dev',
    category: 'scanned-pdf',
    label: 'Scanned PDF — developer OCR sim',
    manifestId: 'developer-cv',
    extractionMethod: 'pdf-ocr',
    simulateOcr: true,
    ocrSeed: 5,
  },
  { id: 'h15-05-image-cv', category: 'image-cv', label: 'Image CV — sparse layout', manifestId: 'image-cv', extractionMethod: 'paste' },
  {
    id: 'h15-06-image-yoaz',
    category: 'image-cv',
    label: 'Image CV — designer OCR sim',
    manifestId: 'yoaz-cv',
    extractionMethod: 'pdf-ocr',
    simulateOcr: true,
    ocrSeed: 3,
  },
  { id: 'h15-07-two-column', category: 'two-column', label: 'Two-column PDF layout', manifestId: 'two-column-cv', extractionMethod: 'pdf-text' },
  { id: 'h15-08-two-column-sales', category: 'two-column', label: 'Two-column — sales CV', manifestId: 'sales-cv', extractionMethod: 'paste' },
  { id: 'h15-09-portfolio-creative', category: 'portfolio', label: 'Designer portfolio — creative', manifestId: 'creative-cv', extractionMethod: 'paste' },
  { id: 'h15-10-portfolio-yoaz', category: 'portfolio', label: 'Designer portfolio — Yoaz', manifestId: 'yoaz-cv', extractionMethod: 'paste' },
  { id: 'h15-11-student', category: 'student', label: 'Student CV', manifestId: 'student-cv', extractionMethod: 'paste' },
  { id: 'h15-12-academic', category: 'student', label: 'Academic CV', manifestId: 'academic-cv', extractionMethod: 'paste' },
  { id: 'h15-13-developer', category: 'developer', label: 'Developer CV — clean', manifestId: 'developer-cv', extractionMethod: 'paste' },
  {
    id: 'h15-14-developer-ocr',
    category: 'developer',
    label: 'Developer CV — OCR sim',
    manifestId: 'developer-cv',
    extractionMethod: 'pdf-ocr',
    simulateOcr: true,
    ocrSeed: 7,
  },
  { id: 'h15-15-marketing', category: 'marketing', label: 'Marketing CV — clean', manifestId: 'marketing-cv', extractionMethod: 'paste' },
  {
    id: 'h15-16-marketing-ocr',
    category: 'marketing',
    label: 'Marketing CV — OCR sim',
    manifestId: 'marketing-cv',
    extractionMethod: 'pdf-ocr',
    simulateOcr: true,
    ocrSeed: 8,
  },
  {
    id: 'h15-17-freelance',
    category: 'freelance',
    label: 'Freelance developer CV',
    file: 'tests/cv-corpus/freelancer.txt',
    fixtureKey: 'freelancer',
    extractionMethod: 'paste',
  },
  { id: 'h15-18-freelance-designer', category: 'freelance', label: 'Freelance designer CV', manifestId: 'image-cv', extractionMethod: 'paste' },
  { id: 'h15-19-executive', category: 'executive', label: 'Executive CV — clean', manifestId: 'executive-cv', extractionMethod: 'paste' },
  {
    id: 'h15-20-executive-ocr',
    category: 'executive',
    label: 'Executive CV — OCR sim',
    manifestId: 'executive-cv',
    extractionMethod: 'pdf-ocr',
    simulateOcr: true,
    ocrSeed: 14,
  },
];

export const H15_CATEGORIES = [
  'clean-pdf',
  'scanned-pdf',
  'image-cv',
  'two-column',
  'portfolio',
  'student',
  'developer',
  'marketing',
  'freelance',
  'executive',
];
