/**
 * P5 — Real World CV Hell benchmark catalog (50 layout variants).
 */

import { P5_LAYOUT_TYPES } from './p5-cv-hell-layouts.mjs';

export const P5_HELL_BENCH_ENGINE = 'HIRELY_P5_CV_HELL_BENCH_V1';
export const P5_HELL_BENCH_COUNT = 50;

/** @type {{ manifestId?: string, file?: string, fixtureKey?: string, archetype: string }[]} */
export const P5_BASE_SOURCES = [
  { manifestId: 'developer-cv', archetype: 'developer' },
  { manifestId: 'executive-cv', archetype: 'executive' },
  { manifestId: 'creative-cv', archetype: 'creative-portfolio' },
  { manifestId: 'marketing-cv', archetype: 'marketing' },
  { manifestId: 'consultant-cv', archetype: 'executive' },
  { manifestId: 'student-cv', archetype: 'student' },
  { manifestId: 'academic-cv', archetype: 'student' },
  { manifestId: 'recruiter-cv', archetype: 'recruiter' },
  { manifestId: 'sales-cv', archetype: 'marketing' },
  { manifestId: 'yoaz-cv', archetype: 'agency-designer' },
  { manifestId: 'two-column-cv', archetype: 'agency-designer' },
  { manifestId: 'image-cv', archetype: 'creative-portfolio' },
  { file: 'tests/cv-corpus/designer.txt', fixtureKey: 'designer', archetype: 'agency-designer' },
  { file: 'tests/cv-corpus/freelancer.txt', fixtureKey: 'freelancer', archetype: 'developer' },
  { manifestId: 'docx', archetype: 'developer' },
];

/** Layout slots — 50 total across real-world export types */
const LAYOUT_SLOTS = [
  ...Array(5).fill('canva'),
  ...Array(5).fill('indesign'),
  ...Array(5).fill('figma'),
  ...Array(5).fill('word'),
  ...Array(5).fill('pages'),
  ...Array(5).fill('linkedin'),
  ...Array(5).fill('europass'),
  ...Array(5).fill('creative-portfolio'),
  ...Array(3).fill('agency-designer'),
  ...Array(4).fill('developer'),
  ...Array(3).fill('executive'),
];

const OCR_LAYOUTS = new Set(['canva', 'figma', 'creative-portfolio']);

/**
 * @typedef {object} P5HellFixture
 * @property {string} id
 * @property {string} label
 * @property {string} layout
 * @property {string} archetype
 * @property {string} [manifestId]
 * @property {string} [file]
 * @property {string} [fixtureKey]
 * @property {string} extractionMethod
 * @property {boolean} [simulateOcr]
 * @property {number} [ocrSeed]
 */

/** @type {P5HellFixture[]} */
export const P5_CV_HELL_BENCH = LAYOUT_SLOTS.map((layout, i) => {
  const base = P5_BASE_SOURCES[i % P5_BASE_SOURCES.length];
  const idx = String(i + 1).padStart(2, '0');
  const simulateOcr = OCR_LAYOUTS.has(layout) && i % 2 === 0;
  return {
    id: `p5-hell-${idx}-${layout}`,
    label: `${layout} — ${base.archetype} (${base.manifestId || base.fixtureKey})`,
    layout,
    archetype: base.archetype,
    manifestId: base.manifestId,
    file: base.file,
    fixtureKey: base.fixtureKey || base.manifestId,
    extractionMethod: simulateOcr ? 'pdf-ocr' : 'paste',
    simulateOcr,
    ocrSeed: i + 1,
  };
});

export { P5_LAYOUT_TYPES };
