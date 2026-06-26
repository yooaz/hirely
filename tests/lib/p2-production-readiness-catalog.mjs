/**
 * HIRELY P2 — Production readiness catalog (80 CVs).
 * 20 corporate · 20 creative · 20 freelance · 20 executive
 */

export const P2_READINESS_ENGINE = 'HIRELY_P2_PRODUCTION_READINESS_V1';
export const P2_FIXTURE_COUNT = 80;
export const P2_PER_CATEGORY = 20;

/** PASS thresholds */
export const P2_GOALS = Object.freeze({
  contentPreservationMin: 95,
  blankTemplatesMax: 0,
  blankExportsMax: 0,
  parserCrashesMax: 0,
  dataLossMax: 0,
});

/**
 * @typedef {object} P2ReadinessFixture
 * @property {string} id
 * @property {string} label
 * @property {'corporate'|'creative'|'freelance'|'executive'} category
 * @property {string} [manifestId]
 * @property {string} [file]
 * @property {string} extractionMethod
 * @property {string} templateId
 * @property {boolean} [simulateOcr]
 * @property {number} [ocrSeed]
 */

/** @type {Omit<P2ReadinessFixture, 'id'|'label'|'category'>[]} */
const CORPORATE_BASES = [
  { manifestId: 'developer-cv', extractionMethod: 'paste', templateId: 'ats' },
  { manifestId: 'marketing-cv', extractionMethod: 'paste', templateId: 'minimal-swiss' },
  { manifestId: 'sales-cv', extractionMethod: 'paste', templateId: 'ats' },
  { manifestId: 'recruiter-cv', extractionMethod: 'paste', templateId: 'ats-executive' },
  { manifestId: 'consultant-cv', extractionMethod: 'paste', templateId: 'minimal-swiss' },
  { manifestId: 'student-cv', extractionMethod: 'paste', templateId: 'ats' },
  { manifestId: 'academic-cv', extractionMethod: 'paste', templateId: 'ats-executive' },
  { manifestId: 'text-pdf', extractionMethod: 'pdf-text', templateId: 'ats' },
  { manifestId: 'docx', extractionMethod: 'docx', templateId: 'minimal-swiss' },
  { manifestId: 'two-column-cv', extractionMethod: 'pdf-text', templateId: 'ats' },
  { file: 'tests/cv-corpus/engineer.txt', extractionMethod: 'paste', templateId: 'ats' },
  { file: 'tests/cv-corpus/marketing.txt', extractionMethod: 'paste', templateId: 'minimal-swiss' },
  { file: 'tests/cv-corpus/nurse.txt', extractionMethod: 'paste', templateId: 'ats' },
  { file: 'tests/cv-corpus/teacher.txt', extractionMethod: 'paste', templateId: 'ats-executive' },
  { file: 'tests/cv-corpus/consultant.txt', extractionMethod: 'paste', templateId: 'minimal-swiss' },
  { file: 'tests/cv-corpus/student.txt', extractionMethod: 'paste', templateId: 'ats' },
  { file: 'tests/cv-corpus/developer.txt', extractionMethod: 'paste', templateId: 'ats' },
  { manifestId: 'developer-cv', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 3, templateId: 'ats' },
  { manifestId: 'marketing-cv', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 7, templateId: 'minimal-swiss' },
  { manifestId: 'sales-cv', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 11, templateId: 'ats-executive' },
];

/** @type {Omit<P2ReadinessFixture, 'id'|'label'|'category'>[]} */
const CREATIVE_BASES = [
  { manifestId: 'creative-cv', extractionMethod: 'paste', templateId: 'portfolio-artist' },
  { manifestId: 'yoaz-cv', extractionMethod: 'paste', templateId: 'creative-director' },
  { manifestId: 'image-cv', extractionMethod: 'paste', templateId: 'behance-showcase' },
  { file: 'tests/fixtures/mvp-sample.txt', extractionMethod: 'paste', templateId: 'magazine-editorial' },
  { file: 'tests/cv-corpus/designer.txt', extractionMethod: 'paste', templateId: 'art-director' },
  { file: 'tests/fixtures/designer-cv-rich.txt', extractionMethod: 'paste', templateId: 'illustrator-portfolio' },
  { file: 'tests/fixtures/portfolio-links-rich.txt', extractionMethod: 'paste', templateId: 'luxury-fashion' },
  { file: 'tests/fixtures/projects-creative-rich.txt', extractionMethod: 'paste', templateId: 'agency-designer' },
  { file: 'tests/fixtures/creative-experience-rich.txt', extractionMethod: 'paste', templateId: 'visual-timeline' },
  { manifestId: 'creative-cv', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 2, templateId: 'portfolio-artist' },
  { manifestId: 'yoaz-cv', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 4, templateId: 'creative-director' },
  { manifestId: 'image-cv', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 6, templateId: 'behance-showcase' },
  { manifestId: 'creative-cv', extractionMethod: 'paste', templateId: 'minimal-swiss' },
  { manifestId: 'yoaz-cv', extractionMethod: 'paste', templateId: 'magazine-editorial' },
  { manifestId: 'image-cv', extractionMethod: 'paste', templateId: 'luxury-fashion' },
  { file: 'tests/cv-corpus/designer.txt', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 9, templateId: 'art-director' },
  { file: 'tests/fixtures/designer-cv-rich.txt', extractionMethod: 'paste', templateId: 'agency-designer' },
  { file: 'tests/fixtures/projects-creative-rich.txt', extractionMethod: 'paste', templateId: 'visual-timeline' },
  { manifestId: 'scanned-pdf', extractionMethod: 'pdf-ocr', templateId: 'portfolio-artist' },
  { manifestId: 'text-pdf', extractionMethod: 'pdf-text', templateId: 'creative-director' },
];

/** @type {Omit<P2ReadinessFixture, 'id'|'label'|'category'>[]} */
const FREELANCE_BASES = [
  { file: 'tests/cv-corpus/freelancer.txt', extractionMethod: 'paste', templateId: 'agency-designer' },
  { file: 'tests/cv-corpus/freelancer.txt', extractionMethod: 'paste', templateId: 'illustrator-portfolio' },
  { file: 'tests/cv-corpus/designer.txt', extractionMethod: 'paste', templateId: 'portfolio-artist' },
  { manifestId: 'image-cv', extractionMethod: 'paste', templateId: 'behance-showcase' },
  { manifestId: 'creative-cv', extractionMethod: 'paste', templateId: 'art-director' },
  { file: 'tests/fixtures/creative-experience-rich.txt', extractionMethod: 'paste', templateId: 'visual-timeline' },
  { file: 'tests/cv-corpus/freelancer.txt', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 5, templateId: 'minimal-swiss' },
  { file: 'tests/cv-corpus/designer.txt', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 8, templateId: 'creative-director' },
  { manifestId: 'image-cv', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 10, templateId: 'magazine-editorial' },
  { manifestId: 'creative-cv', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 12, templateId: 'luxury-fashion' },
  { file: 'tests/fixtures/mvp-sample.txt', extractionMethod: 'paste', templateId: 'agency-designer' },
  { file: 'tests/fixtures/portfolio-links-rich.txt', extractionMethod: 'paste', templateId: 'illustrator-portfolio' },
  { file: 'tests/fixtures/projects-creative-rich.txt', extractionMethod: 'paste', templateId: 'portfolio-artist' },
  { manifestId: 'yoaz-cv', extractionMethod: 'paste', templateId: 'behance-showcase' },
  { file: 'tests/cv-corpus/freelancer.txt', extractionMethod: 'paste', templateId: 'art-director' },
  { file: 'tests/cv-corpus/designer.txt', extractionMethod: 'paste', templateId: 'visual-timeline' },
  { manifestId: 'image-cv', extractionMethod: 'paste', templateId: 'minimal-swiss' },
  { file: 'tests/fixtures/creative-experience-rich.txt', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 14, templateId: 'creative-director' },
  { manifestId: 'creative-cv', extractionMethod: 'paste', templateId: 'magazine-editorial' },
  { manifestId: 'scanned-pdf', extractionMethod: 'pdf-ocr', templateId: 'agency-designer' },
];

/** @type {Omit<P2ReadinessFixture, 'id'|'label'|'category'>[]} */
const EXECUTIVE_BASES = [
  { manifestId: 'executive-cv', extractionMethod: 'paste', templateId: 'ats-executive' },
  { manifestId: 'consultant-cv', extractionMethod: 'paste', templateId: 'luxury-fashion' },
  { file: 'tests/cv-corpus/executive.txt', extractionMethod: 'paste', templateId: 'minimal-swiss' },
  { manifestId: 'academic-cv', extractionMethod: 'paste', templateId: 'ats-executive' },
  { manifestId: 'recruiter-cv', extractionMethod: 'paste', templateId: 'luxury-fashion' },
  { file: 'tests/cv-corpus/consultant.txt', extractionMethod: 'paste', templateId: 'ats-executive' },
  { manifestId: 'executive-cv', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 4, templateId: 'minimal-swiss' },
  { file: 'tests/cv-corpus/executive.txt', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 6, templateId: 'luxury-fashion' },
  { manifestId: 'consultant-cv', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 9, templateId: 'ats-executive' },
  { manifestId: 'executive-cv', extractionMethod: 'paste', templateId: 'creative-director' },
  { manifestId: 'executive-cv', extractionMethod: 'paste', templateId: 'agency-designer' },
  { file: 'tests/cv-corpus/executive.txt', extractionMethod: 'paste', templateId: 'visual-timeline' },
  { manifestId: 'academic-cv', extractionMethod: 'paste', templateId: 'minimal-swiss' },
  { manifestId: 'text-pdf', extractionMethod: 'pdf-text', templateId: 'ats-executive' },
  { manifestId: 'two-column-cv', extractionMethod: 'pdf-text', templateId: 'luxury-fashion' },
  { file: 'tests/cv-corpus/consultant.txt', extractionMethod: 'paste', templateId: 'minimal-swiss' },
  { manifestId: 'executive-cv', extractionMethod: 'pdf-ocr', simulateOcr: true, ocrSeed: 13, templateId: 'ats-executive' },
  { file: 'tests/cv-corpus/executive.txt', extractionMethod: 'paste', templateId: 'agency-designer' },
  { manifestId: 'consultant-cv', extractionMethod: 'paste', templateId: 'visual-timeline' },
  { manifestId: 'recruiter-cv', extractionMethod: 'paste', templateId: 'minimal-swiss' },
];

/**
 * @param {'corporate'|'creative'|'freelance'|'executive'} category
 * @param {Omit<P2ReadinessFixture, 'id'|'label'|'category'>[]} bases
 */
function buildCategory(category, bases) {
  return bases.slice(0, P2_PER_CATEGORY).map((base, i) => ({
    id: `p2-${category}-${String(i + 1).padStart(2, '0')}`,
    category,
    label: `${category} CV #${i + 1}`,
    ...base,
  }));
}

/** @type {P2ReadinessFixture[]} */
export const P2_READINESS_FIXTURES = [
  ...buildCategory('corporate', CORPORATE_BASES),
  ...buildCategory('creative', CREATIVE_BASES),
  ...buildCategory('freelance', FREELANCE_BASES),
  ...buildCategory('executive', EXECUTIVE_BASES),
];

export const P2_CATEGORIES = ['corporate', 'creative', 'freelance', 'executive'];
