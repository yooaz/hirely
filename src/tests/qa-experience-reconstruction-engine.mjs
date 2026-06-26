#!/usr/bin/env node
/**
 * P2 — Experience Reconstruction Engine QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeCvData } from '../core/parsing/rich-parser.js';
import { experienceNormalizer } from '../core/parsing/experience-intelligence.js';
import {
  reconstructExperienceEntries,
  mustNeverMergeExperiences,
  classifyEmploymentKind,
  EMPLOYMENT_KIND,
  EXPERIENCE_RECONSTRUCTION_ENGINE,
} from '../core/parsing/experience-reconstruction-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../../tests/output/experience-reconstruction-engine');
const JSON_PATH = path.join(OUT_DIR, 'report.json');

const FIVE_JOBS = [
  'Freelance Illustrator — Independent / Freelance — 2011-2018',
  'Internship — Nike — Summer 2018',
  'Designer — McCann Paris — 2018-2020',
  'Senior Illustrator — Havas Paris — 2020-2022',
  'Creative Director — Studio Yoaz — 2022-Present',
];

const MERGED_BLOB = [
  'Freelance Illustrator — Independent — 2011-2018 — Editorial campaigns',
  'Internship — Nike — Summer 2018 — Brand assets',
  'Designer — McCann Paris — 2018-2020',
  'Senior Illustrator — Havas Paris — 2020-2022',
  'Creative Director — Studio Yoaz — 2022-Present',
].join(' Internship — ');

const results = [];

function check(id, label, pass, detail = '') {
  results.push({ id, label, pass, detail });
  console.log(pass ? 'OK' : 'FAIL', label, detail ? `— ${detail}` : '');
}

function run() {
  const direct = reconstructExperienceEntries(FIVE_JOBS);
  check(
    'five-jobs-direct',
    'Five distinct jobs reconstruct to five entries',
    direct.count === 5,
    `count=${direct.count}`
  );

  check(
    'confidence-scored',
    'Each experience has confidence score',
    direct.entries.every((e) => typeof e.confidence === 'number' && e.confidence >= 55),
    direct.entries.map((e) => e.confidence).join(',')
  );

  check(
    'fields-detected',
    'Role, company, and dates detected',
    direct.entries.every((e) => e.role && (e.company || e.dates || e.startDate)),
    direct.entries.map((e) => `${e.role}|${e.company}|${e.dates}`).join(' // ')
  );

  const kinds = new Set(direct.entries.map((e) => e.employmentKind));
  check(
    'employment-kinds',
    'Freelance and internship kept separate from agency/permanent',
    kinds.has(EMPLOYMENT_KIND.FREELANCE) && kinds.has(EMPLOYMENT_KIND.INTERNSHIP),
    [...kinds].join(',')
  );

  const freelance = direct.entries.find((e) => classifyEmploymentKind(e) === EMPLOYMENT_KIND.FREELANCE);
  const intern = direct.entries.find((e) => classifyEmploymentKind(e) === EMPLOYMENT_KIND.INTERNSHIP);
  check(
    'never-merge-freelance-intern',
    'Freelance and internship must never merge',
    mustNeverMergeExperiences(freelance, intern),
    ''
  );

  const merged = reconstructExperienceEntries([MERGED_BLOB]);
  check(
    'split-merged-blob',
    'Merged OCR blob splits into multiple experiences',
    merged.count >= 3,
    `count=${merged.count}`
  );

  const normalized = normalizeCvData({
    name: 'Jane Doe',
    title: 'Creative Director',
    experience: FIVE_JOBS,
    education: [],
    skills: [],
  });
  check(
    'five-jobs-normalize',
    'normalizeCvData preserves five experience lines',
    (normalized.experience || []).length === 5,
    JSON.stringify(normalized.experience)
  );

  check(
    'normalize-meta',
    'normalizeCvData attaches reconstruction metadata',
    normalized._experienceReconstruction === EXPERIENCE_RECONSTRUCTION_ENGINE &&
      (normalized._experienceMeta || []).length === 5,
    normalized._experienceReconstruction
  );

  const intel = experienceNormalizer({
    experiences: FIVE_JOBS.map((line) => {
      const [role, company, dates] = line.split(' — ');
      return { role, company, dates };
    }),
    cleanText: FIVE_JOBS.join('\n'),
  });
  check(
    'five-jobs-intelligence',
    'experienceNormalizer outputs five structured experiences',
    (intel.experiences || []).length === 5,
    `count=${intel.experiences?.length}`
  );

  check(
    'intel-confidence',
    'experienceNormalizer keeps per-entry confidence',
    (intel.experiences || []).every((e) => typeof e.confidence === 'number'),
    (intel.experiences || []).map((e) => e.confidence).join(',')
  );

  const collapsedInput = [
    {
      role: 'Freelance Illustrator / Graphic Designer',
      company: 'Independent / Freelance',
      dates: '2011-2022',
      bullets: ['Posters, packaging, logos'],
    },
    {
      role: 'Designer',
      company: 'McCann G. Agency',
      dates: '2011-2014',
      bullets: ['Campaign work'],
    },
    {
      role: 'Art Director',
      company: 'Publicis Conseil',
      dates: '2014-2016',
    },
    {
      role: 'Senior Illustrator',
      company: 'Havas Paris',
      dates: '2016-2018',
    },
    {
      role: 'Creative Director',
      company: 'Studio Yoaz',
      dates: '2023-Present',
    },
  ];
  const rebuilt = reconstructExperienceEntries(collapsedInput);
  check(
    'no-collapse-five',
    'Structured list with five employers stays at five entries',
    rebuilt.count === 5,
    `count=${rebuilt.count}`
  );
}

run();

const passed = results.filter((r) => r.pass).length;
const pass = passed === results.length;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  JSON_PATH,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      pass,
      passed,
      total: results.length,
      results,
    },
    null,
    2
  )
);

console.log(`\n${passed}/${results.length} checks — ${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
