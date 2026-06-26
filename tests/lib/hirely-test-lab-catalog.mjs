/**
 * Hirely Test Lab — 50 CV catalog with country, language, layout, role taxonomy.
 */

import { REAL_WORLD_STRESS_FIXTURES } from './real-world-stress-catalog.mjs';

export const HIRELY_TEST_LAB_ENGINE = 'HIRELY_TEST_LAB_V1';
export const HIRELY_TEST_LAB_COUNT = 50;

/** @typedef {'developer'|'graphic-designer'|'executive'|'student'|'academic'|'marketing'|'sales'|'consultant'|'creative'|'linkedin'} TestLabCategory */

export const ROLE_TEMPLATE_MAP = Object.freeze({
  developer: 'senior-engineer',
  engineer: 'senior-engineer',
  executive: 'executive-board',
  consultant: 'consulting-elite',
  designer: 'creative-director',
  artist: 'luxury-editorial',
  student: 'academic',
  academic: 'academic',
  marketing: 'startup-founder',
  sales: 'google-style',
  recruiter: 'minimal-ats',
  freelancer: 'apple-style',
  default: 'apple-style',
});

const ROLE_META = {
  designer: { country: 'FR', language: 'fr', category: 'graphic-designer' },
  developer: { country: 'US', language: 'en', category: 'developer' },
  engineer: { country: 'DE', language: 'de', category: 'developer' },
  marketing: { country: 'US', language: 'en', category: 'marketing' },
  sales: { country: 'UK', language: 'en', category: 'sales' },
  student: { country: 'NL', language: 'nl', category: 'student' },
  executive: { country: 'CH', language: 'en', category: 'executive' },
  consultant: { country: 'UK', language: 'en', category: 'consultant' },
  freelancer: { country: 'CA', language: 'en', category: 'developer' },
  artist: { country: 'ES', language: 'es', category: 'graphic-designer' },
};

const FORMAT_LAYOUT = {
  TXT: 'word',
  'PDF-text': 'pages',
  'PDF-scan': 'canva',
  'PDF-protected': 'indesign',
  DOCX: 'word',
  PNG: 'figma',
  JPG: 'creative-portfolio',
};

/** LinkedIn-specific cases (replace last 5 stress slots). */
export const LINKEDIN_LAB_FIXTURES = [
  {
    id: 'lab-46-linkedin-pdf-fr',
    label: 'LinkedIn PDF — FR designer',
    role: 'designer',
    country: 'FR',
    language: 'fr',
    category: 'linkedin',
    layout: 'linkedin',
    format: 'LinkedIn-PDF',
    sourceType: 'linkedin-pdf',
    manifestId: 'yoaz-cv',
    extractionMethod: 'linkedin-pdf',
    linkedinText: `
Yohann Azancot
Directeur artistique
Paris, France
linkedin.com/in/yoaz
Contact
Compétences
Figma · Direction artistique
Expérience
McCann Paris
Directeur artistique
2018 – Présent
`,
  },
  {
    id: 'lab-47-linkedin-export-en',
    label: 'LinkedIn export — US PM',
    role: 'marketing',
    country: 'US',
    language: 'en',
    category: 'linkedin',
    layout: 'linkedin',
    format: 'LinkedIn-JSON',
    sourceType: 'linkedin-export',
    manifestId: 'marketing-cv',
    extractionMethod: 'linkedin-export',
    linkedinExport: {
      profile: `[{"First Name":"Alex","Last Name":"Morgan","Headline":"Senior Product Manager","Email Address":"alex@hirely.test","Location":"San Francisco, CA"}]`,
      positions: `[{"Company Name":"Northline","Title":"Head of Product","Started On":"2021","Finished On":"Present"}]`,
      skills: `[{"Name":"Product strategy"},{"Name":"SQL"}]`,
    },
  },
  {
    id: 'lab-48-linkedin-merge',
    label: 'LinkedIn merge — PDF + resume',
    role: 'executive',
    country: 'US',
    language: 'en',
    category: 'linkedin',
    layout: 'linkedin',
    format: 'LinkedIn-merge',
    sourceType: 'linkedin-merge',
    manifestId: 'executive-cv',
    extractionMethod: 'linkedin-merge',
  },
  {
    id: 'lab-49-linkedin-de-engineer',
    label: 'LinkedIn PDF — DE engineer',
    role: 'engineer',
    country: 'DE',
    language: 'de',
    category: 'linkedin',
    layout: 'linkedin',
    format: 'LinkedIn-PDF',
    sourceType: 'linkedin-pdf',
    file: 'tests/cv-corpus/engineer.txt',
    fixtureKey: 'engineer',
    extractionMethod: 'linkedin-pdf',
  },
  {
    id: 'lab-50-linkedin-uk-consultant',
    label: 'LinkedIn export — UK consultant',
    role: 'consultant',
    country: 'UK',
    language: 'en',
    category: 'linkedin',
    layout: 'linkedin',
    format: 'LinkedIn-PDF',
    sourceType: 'linkedin-pdf',
    manifestId: 'consultant-cv',
    extractionMethod: 'linkedin-pdf',
  },
];

/** @type {import('./hirely-test-lab-catalog.mjs').TestLabFixture[]} */
const STRESS_ENRICHED = REAL_WORLD_STRESS_FIXTURES.slice(0, 45).map((fx) => {
  const meta = ROLE_META[fx.role] || { country: 'US', language: 'en', category: fx.role };
  return {
    ...fx,
    id: fx.id.replace(/^rw-/, 'lab-'),
    country: meta.country,
    language: meta.language,
    category: meta.category,
    layout: FORMAT_LAYOUT[fx.format] || 'word',
    sourceType: fx.simulateOcr ? 'scanned-pdf' : fx.format === 'DOCX' ? 'docx' : 'text',
    templateId: ROLE_TEMPLATE_MAP[fx.role] || ROLE_TEMPLATE_MAP.default,
  };
});

/** @typedef {object} TestLabFixture
 * @property {string} id
 * @property {string} label
 * @property {string} role
 * @property {string} country
 * @property {string} language
 * @property {string} category
 * @property {string} layout
 * @property {string} format
 * @property {string} sourceType
 * @property {string} templateId
 * @property {string} [manifestId]
 * @property {string} [file]
 * @property {string} [fixtureKey]
 * @property {string} extractionMethod
 * @property {boolean} [simulateOcr]
 * @property {boolean} [simulateImageScan]
 * @property {number} [ocrSeed]
 * @property {string} [linkedinText]
 * @property {object} [linkedinExport]
 */

/** @type {TestLabFixture[]} */
export const HIRELY_TEST_LAB_CATALOG = [
  ...STRESS_ENRICHED,
  ...LINKEDIN_LAB_FIXTURES.map((fx) => ({
    ...fx,
    templateId: ROLE_TEMPLATE_MAP[fx.role] || ROLE_TEMPLATE_MAP.default,
    simulateOcr: false,
  })),
];

export const TEST_LAB_CATEGORIES = Object.freeze([
  'developer',
  'graphic-designer',
  'executive',
  'student',
  'marketing',
  'consultant',
  'creative',
  'linkedin',
  'scanned-pdf',
]);

export const TEST_LAB_COUNTRIES = Object.freeze([
  'US',
  'UK',
  'FR',
  'DE',
  'CH',
  'NL',
  'ES',
  'CA',
]);

export const TEST_LAB_LANGUAGES = Object.freeze(['en', 'fr', 'de', 'es', 'nl']);

export const TEST_LAB_GOALS = Object.freeze({
  extractionAccuracy: 80,
  templateQuality: 70,
  atsScoreAccuracy: 75,
  pdfQuality: 85,
  importSuccess: 90,
});
