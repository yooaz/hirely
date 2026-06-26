/**
 * HIRELY P7 — 20 CV stress catalog (archetypes × formats).
 */

export const P7_STRESS_ENGINE = 'HIRELY_P7_STRESS_V1';
export const P7_FIXTURE_COUNT = 20;

/** Minimum gate success rates (%) for QA exit 0 */
export const P7_GOALS = Object.freeze({
  import: 95,
  parser: 85,
  review: 90,
  ats: 95,
  pdf: 95,
  fullPipeline: 80,
});

/** Parser recall floor (H6 overall %) */
export const P7_PARSER_RECALL_MIN = 70;

/** ATS engine must return a finite score (quality tracked separately in report) */
export const P7_ATS_SCORE_MIN = 0;

/**
 * @typedef {object} P7StressFixture
 * @property {string} id
 * @property {string} label
 * @property {string} archetype designer|developer|marketing|sales|student|executive|academic|consultant|recruiter|layout|product
 * @property {string} [manifestId]
 * @property {string} [file]
 * @property {string} extractionMethod
 * @property {string} templateId ats|creative|executive-minimal
 * @property {boolean} [simulateOcr]
 * @property {number} [ocrSeed]
 */

/** @type {P7StressFixture[]} */
export const P7_CV_FIXTURES = [
  { id: 'creative-cv', label: 'Designer CV (creative)', archetype: 'designer', manifestId: 'creative-cv', extractionMethod: 'paste', templateId: 'creative' },
  { id: 'yoaz-cv', label: 'Designer CV (Yoaz)', archetype: 'designer', manifestId: 'yoaz-cv', extractionMethod: 'paste', templateId: 'creative' },
  { id: 'image-cv', label: 'Designer CV (image layout)', archetype: 'designer', manifestId: 'image-cv', extractionMethod: 'paste', templateId: 'creative' },
  { id: 'mvp-sample', label: 'Designer CV (plain TXT)', archetype: 'designer', file: 'tests/fixtures/mvp-sample.txt', extractionMethod: 'paste', templateId: 'creative' },
  { id: 'developer-cv', label: 'Developer CV', archetype: 'developer', manifestId: 'developer-cv', extractionMethod: 'paste', templateId: 'ats' },
  { id: 'developer-cv-ocr', label: 'Developer CV (OCR sim)', archetype: 'developer', manifestId: 'developer-cv', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 5, templateId: 'ats' },
  { id: 'marketing-cv', label: 'Marketing CV', archetype: 'marketing', manifestId: 'marketing-cv', extractionMethod: 'paste', templateId: 'ats' },
  { id: 'marketing-cv-ocr', label: 'Marketing CV (OCR sim)', archetype: 'marketing', manifestId: 'marketing-cv', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 8, templateId: 'ats' },
  { id: 'sales-cv', label: 'Sales CV', archetype: 'sales', manifestId: 'sales-cv', extractionMethod: 'paste', templateId: 'ats' },
  { id: 'student-cv', label: 'Student CV', archetype: 'student', manifestId: 'student-cv', extractionMethod: 'paste', templateId: 'ats' },
  { id: 'executive-cv', label: 'Executive CV', archetype: 'executive', manifestId: 'executive-cv', extractionMethod: 'paste', templateId: 'executive-minimal' },
  { id: 'academic-cv', label: 'Academic CV', archetype: 'academic', manifestId: 'academic-cv', extractionMethod: 'paste', templateId: 'executive-minimal' },
  { id: 'recruiter-cv', label: 'Recruiter CV', archetype: 'recruiter', manifestId: 'recruiter-cv', extractionMethod: 'paste', templateId: 'ats' },
  { id: 'consultant-cv', label: 'Consultant CV', archetype: 'consultant', manifestId: 'consultant-cv', extractionMethod: 'paste', templateId: 'executive-minimal' },
  { id: 'two-column-cv', label: 'Two-column layout CV', archetype: 'layout', manifestId: 'two-column-cv', extractionMethod: 'pdf-text', templateId: 'ats' },
  { id: 'text-pdf', label: 'Native PDF text CV', archetype: 'product', manifestId: 'text-pdf', extractionMethod: 'pdf-text', templateId: 'ats' },
  { id: 'scanned-pdf', label: 'Scanned PDF (OCR)', archetype: 'product', manifestId: 'scanned-pdf', extractionMethod: 'pdf-ocr', templateId: 'ats' },
  { id: 'docx', label: 'DOCX export CV', archetype: 'product', manifestId: 'docx', extractionMethod: 'docx', templateId: 'ats' },
  { id: 'sales-cv-ocr', label: 'Sales CV (OCR sim)', archetype: 'sales', manifestId: 'sales-cv', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 11, templateId: 'ats' },
  { id: 'executive-cv-ocr', label: 'Executive CV (OCR sim)', archetype: 'executive', manifestId: 'executive-cv', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 14, templateId: 'executive-minimal' },
];

export const P7_CORE_ARCHETYPES = [
  'designer',
  'developer',
  'marketing',
  'sales',
  'student',
  'executive',
];

export const P7_PIPELINE_GATES = ['import', 'parser', 'review', 'ats', 'pdf'];
