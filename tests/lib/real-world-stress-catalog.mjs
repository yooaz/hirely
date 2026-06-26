/**
 * P0 — Real-world stress test catalog (50 CVs × 10 roles × 6 formats).
 */

export const REAL_WORLD_STRESS_ENGINE = 'HIRELY_REAL_WORLD_STRESS_P0';
export const REAL_WORLD_STRESS_COUNT = 50;
export const REAL_WORLD_STRESS_GOAL_PCT = 95;

/** @typedef {'designer'|'developer'|'engineer'|'marketing'|'sales'|'student'|'executive'|'consultant'|'freelancer'|'artist'} StressRole */
/** @typedef {'TXT'|'PDF-text'|'PDF-scan'|'PDF-protected'|'DOCX'|'PNG'|'JPG'} StressFormat */

/**
 * @typedef {object} RealWorldStressFixture
 * @property {string} id
 * @property {string} label
 * @property {StressRole} role
 * @property {StressFormat} format
 * @property {string} [manifestId]
 * @property {string} [file]
 * @property {string} [fixtureKey]
 * @property {string} extractionMethod
 * @property {boolean} [simulateOcr]
 * @property {boolean} [simulateImageScan]
 * @property {number} [ocrSeed]
 */

const FMT = {
  TXT: { format: 'TXT', extractionMethod: 'paste' },
  'PDF-text': { format: 'PDF-text', extractionMethod: 'pdf-text' },
  'PDF-scan': { format: 'PDF-scan', extractionMethod: 'pdf-ocr', simulateOcr: true },
  'PDF-protected': { format: 'PDF-protected', extractionMethod: 'pdf-protected', simulateOcr: true },
  DOCX: { format: 'DOCX', extractionMethod: 'docx' },
  PNG: { format: 'PNG', extractionMethod: 'image-png', simulateOcr: true, simulateImageScan: true },
  JPG: { format: 'JPG', extractionMethod: 'image-jpg', simulateOcr: true, simulateImageScan: true },
};

/** Five format slots per role (TXT, PDF-text, PDF-scan, DOCX, PNG or JPG). */
const ROLE_MATRIX = [
  {
    role: 'designer',
    fixtures: [
      { manifestId: 'yoaz-cv', ...FMT.TXT },
      { manifestId: 'creative-cv', ...FMT['PDF-text'] },
      { manifestId: 'yoaz-cv', ...FMT['PDF-scan'], ocrSeed: 3 },
      { file: 'tests/cv-corpus/designer.txt', fixtureKey: 'designer', ...FMT.DOCX },
      { manifestId: 'image-cv', ...FMT['PDF-protected'], ocrSeed: 4 },
    ],
  },
  {
    role: 'engineer',
    fixtures: [
      { manifestId: 'developer-cv', ...FMT.TXT },
      { file: 'tests/cv-corpus/engineer.txt', fixtureKey: 'engineer', ...FMT['PDF-text'] },
      { manifestId: 'developer-cv', ...FMT['PDF-scan'], ocrSeed: 5 },
      { file: 'tests/cv-corpus/engineer.txt', fixtureKey: 'engineer', ...FMT.DOCX },
      { manifestId: 'developer-cv', ...FMT.JPG, ocrSeed: 6 },
    ],
  },
  {
    role: 'marketing',
    fixtures: [
      { manifestId: 'marketing-cv', ...FMT.TXT },
      { manifestId: 'marketing-cv', ...FMT['PDF-text'] },
      { manifestId: 'marketing-cv', ...FMT['PDF-scan'], ocrSeed: 8 },
      { file: 'tests/cv-corpus/marketing.txt', fixtureKey: 'marketing', ...FMT.DOCX },
      { manifestId: 'marketing-cv', ...FMT['PDF-protected'], ocrSeed: 9 },
    ],
  },
  {
    role: 'sales',
    fixtures: [
      { manifestId: 'sales-cv', ...FMT.TXT },
      { manifestId: 'two-column-cv', ...FMT['PDF-text'] },
      { manifestId: 'sales-cv', ...FMT['PDF-scan'], ocrSeed: 11 },
      { file: 'tests/cv-corpus/sales.txt', fixtureKey: 'sales', ...FMT.DOCX },
      { manifestId: 'sales-cv', ...FMT.JPG, ocrSeed: 12 },
    ],
  },
  {
    role: 'student',
    fixtures: [
      { manifestId: 'student-cv', ...FMT.TXT },
      { manifestId: 'academic-cv', ...FMT['PDF-text'] },
      { manifestId: 'student-cv', ...FMT['PDF-scan'], ocrSeed: 13 },
      { file: 'tests/cv-corpus/student.txt', fixtureKey: 'student', ...FMT.DOCX },
      { manifestId: 'student-cv', ...FMT['PDF-protected'], ocrSeed: 14 },
    ],
  },
  {
    role: 'executive',
    fixtures: [
      { manifestId: 'executive-cv', ...FMT.TXT },
      { manifestId: 'executive-cv', ...FMT['PDF-text'] },
      { manifestId: 'executive-cv', ...FMT['PDF-scan'], ocrSeed: 15 },
      { file: 'tests/cv-corpus/executive.txt', fixtureKey: 'executive', ...FMT.DOCX },
      { manifestId: 'executive-cv', ...FMT.JPG, ocrSeed: 16 },
    ],
  },
  {
    role: 'consultant',
    fixtures: [
      { manifestId: 'consultant-cv', ...FMT.TXT },
      { manifestId: 'consultant-cv', ...FMT['PDF-text'] },
      { manifestId: 'consultant-cv', ...FMT['PDF-scan'], ocrSeed: 17 },
      { file: 'tests/cv-corpus/consultant.txt', fixtureKey: 'consultant', ...FMT.DOCX },
      { manifestId: 'consultant-cv', ...FMT['PDF-protected'], ocrSeed: 18 },
    ],
  },
  {
    role: 'developer',
    fixtures: [
      { file: 'tests/cv-corpus/developer.txt', fixtureKey: 'developer', ...FMT.TXT },
      { manifestId: 'developer-cv', ...FMT['PDF-text'] },
      { file: 'tests/cv-corpus/developer.txt', fixtureKey: 'developer', ...FMT['PDF-scan'], ocrSeed: 19 },
      { manifestId: 'developer-cv', ...FMT.DOCX },
      { manifestId: 'developer-cv', ...FMT.JPG, ocrSeed: 20 },
    ],
  },
  {
    role: 'freelancer',
    fixtures: [
      { file: 'tests/cv-corpus/freelancer.txt', fixtureKey: 'freelancer', ...FMT.TXT },
      { manifestId: 'image-cv', ...FMT['PDF-text'] },
      { file: 'tests/cv-corpus/freelancer.txt', fixtureKey: 'freelancer', ...FMT['PDF-scan'], ocrSeed: 21 },
      { file: 'tests/cv-corpus/freelancer.txt', fixtureKey: 'freelancer', ...FMT.DOCX },
      { manifestId: 'image-cv', ...FMT['PDF-protected'], ocrSeed: 22 },
    ],
  },
  {
    role: 'artist',
    fixtures: [
      { file: 'tests/cv-corpus/artist.txt', fixtureKey: 'artist', ...FMT.TXT },
      { file: 'tests/cv-corpus/photographer.txt', fixtureKey: 'photographer', ...FMT['PDF-text'] },
      { file: 'tests/cv-corpus/artist.txt', fixtureKey: 'artist', ...FMT['PDF-scan'], ocrSeed: 23 },
      { manifestId: 'creative-cv', ...FMT.DOCX },
      { file: 'tests/cv-corpus/artist.txt', fixtureKey: 'artist', ...FMT.PNG, ocrSeed: 24 },
    ],
  },
];

let seq = 0;
/** @type {RealWorldStressFixture[]} */
export const REAL_WORLD_STRESS_FIXTURES = ROLE_MATRIX.flatMap(({ role, fixtures }) =>
  fixtures.map((fx) => {
    seq += 1;
    const id = `rw-${String(seq).padStart(2, '0')}-${role}-${fx.format.toLowerCase().replace(/[^a-z]/g, '')}`;
    return {
      id,
      label: `${role} — ${fx.format}`,
      role,
      format: fx.format,
      manifestId: fx.manifestId,
      file: fx.file,
      fixtureKey: fx.fixtureKey,
      extractionMethod: fx.extractionMethod,
      simulateOcr: !!fx.simulateOcr,
      simulateImageScan: !!fx.simulateImageScan,
      ocrSeed: fx.ocrSeed ?? seq,
    };
  })
);

export const REAL_WORLD_ROLES = [
  'designer',
  'developer',
  'engineer',
  'marketing',
  'sales',
  'student',
  'executive',
  'consultant',
  'freelancer',
  'artist',
];

export const REAL_WORLD_FORMATS = ['TXT', 'PDF-text', 'PDF-scan', 'PDF-protected', 'DOCX', 'PNG', 'JPG'];
