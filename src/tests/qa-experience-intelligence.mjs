#!/usr/bin/env node
/**
 * experienceNormalizer — unit + recall ≥ 90%.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  experienceNormalizer,
  detectExperienceRole,
  detectExperienceCompany,
  detectExperienceDates,
  detectFreelanceMission,
  mergeFragmentedExperienceEntries,
  EXPERIENCE_INTELLIGENCE_RECALL_GOAL,
} from '../core/parsing/experience-intelligence.js';
import { mergeFragmentedExperienceBlocks } from '../core/parsing/experience-block-merge.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { groundTruthForFixture } from '../../tests/lib/section-ground-truth.mjs';
import {
  computeSectionMetrics,
  extractDetectedSections,
} from '../../tests/lib/section-accuracy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function block(id, type, text) {
  return { id, type, bucket: type, text, confidence: 85, accepted: true, needsReview: false };
}

// McCann example
const mccannBlocks = [
  block('b1', 'unknown', 'Designer'),
  block('b2', 'unknown', 'McCann G Agency'),
  block('b3', 'unknown', '2011-2014'),
];
const mccann = experienceNormalizer({ blocks: mccannBlocks });
ok(mccann.experiences.length >= 1, 'McCann fragmented blocks → one experience');
ok(
  mccann.experiences.some((e) => /designer/i.test(e.role || '') && /mccann/i.test(e.company || '')),
  'McCann role + company detected'
);
ok(
  mccann.experiences.some((e) => /2011/.test(e.dates || e.startDate || '')),
  'McCann dates detected'
);

// Freelance example
const freelanceBlocks = [
  block('f1', 'experience', 'Freelance Illustrator'),
  block('f2', 'identity', 'Graphic Designer'),
  block('f3', 'unknown', 'Independent'),
  block('f4', 'unknown', '2011-2022'),
];
const freelance = experienceNormalizer({ blocks: freelanceBlocks });
ok(freelance.experiences.length >= 1, 'Freelance fragmented blocks → one experience');
ok(
  freelance.experiences.some(
    (e) =>
      /freelance|illustrator/i.test(e.role || '') &&
      (/independent|freelance/i.test(e.company || '') || e.isFreelance)
  ),
  'Freelance mission detected'
);
ok(
  freelance.experiences.some((e) => /2011/.test(e.dates || e.startDate || '')),
  'Freelance dates detected'
);

// Field detectors
ok(detectExperienceRole(['Designer']) === 'Designer', 'detectExperienceRole: Designer');
ok(/mccann/i.test(detectExperienceCompany(['McCann G Agency'], 'Designer')), 'detectExperienceCompany: McCann');
ok(detectExperienceDates(['2011-2014']).startDate === '2011', 'detectExperienceDates: 2011-2014');
ok(detectFreelanceMission({ role: 'Freelance Illustrator', company: 'Independent' }), 'detectFreelanceMission');

// Sparse row merge
const sparse = mergeFragmentedExperienceEntries([
  { role: 'Designer', company: '', dates: '' },
  { role: '', company: 'McCann G Agency', dates: '' },
  { role: '', company: '', dates: '2011-2014', startDate: '2011', endDate: '2014' },
]);
ok(sparse.length === 1, 'mergeFragmentedExperienceEntries: 3 sparse rows → 1');
ok(/mccann/i.test(sparse[0].company || ''), 'sparse merge preserves company');

const ACCEPTANCE_FIXTURES = [
  { id: 'developer-cv', label: 'Developer CV' },
  { id: 'creative-cv', label: 'Creative CV' },
  { id: 'marketing-cv', label: 'Marketing CV' },
  { id: 'consultant-cv', label: 'Consultant CV' },
];

async function evaluateFixture(entry) {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures', entry.id, 'fixture.txt'), 'utf8');
  const imp = await runHirelyImportFromText(raw, { source: entry.id, extractionMethod: 'paste' });
  const sanitized = sanitizeResumeForDisplay(imp.resumeData);
  const detected = extractDetectedSections(sanitized);
  const gt = groundTruthForFixture(entry.id, raw);
  const metrics = computeSectionMetrics(gt.experience, detected.experience, 'experience');
  return { ...entry, metrics };
}

async function main() {
  let totalExpected = 0;
  let totalTp = 0;

  for (const entry of ACCEPTANCE_FIXTURES) {
    const result = await evaluateFixture(entry);
    totalExpected += result.metrics.expected;
    totalTp += result.metrics.tp;
    ok(
      result.metrics.recall >= EXPERIENCE_INTELLIGENCE_RECALL_GOAL * 100,
      `${entry.label} experience recall ${result.metrics.recall}% (goal ≥ ${EXPERIENCE_INTELLIGENCE_RECALL_GOAL * 100}%)`
    );
    if (result.metrics.falseNegatives.length) {
      console.log('  FN:', result.metrics.falseNegatives.join(' | '));
    }
  }

  const ocrPath = path.join(ROOT, 'tests/fixtures/yoaz-pdf-live/ocr-fragmented.txt');
  if (fs.existsSync(ocrPath)) {
    const raw = fs.readFileSync(ocrPath, 'utf8');
    const imp = await runHirelyImportFromText(raw, {
      source: 'yoaz-pdf-live-fragmented',
      extractionMethod: 'ocr',
    });
    const sanitized = sanitizeResumeForDisplay(imp.resumeData);
    const detected = extractDetectedSections(sanitized);
    const gt = [
      'Freelance Illustrator — Independent / Freelance — 2011 — 2022',
      'Lead Illustrator — McCann Paris — 2011 — 2014',
      'Art Director Illustration — Publicis Conseil — 2014 — 2016',
      'Senior Illustrator — Havas Paris — 2016 — 2018',
      'Freelance Senior Art Director — Independent — 2018 — 2020',
      'Illustrator / Designer — BETC — 2020 — 2021',
      'Visual Designer — DDB Paris — 2021 — 2022',
      'Lead Visual Designer — AKQA Paris — 2022 — 2023',
      'Creative Director — Studio Yoaz — 2023 — Present',
    ];
    const metrics = computeSectionMetrics(gt, detected.experience, 'experience');
    totalExpected += metrics.expected;
    totalTp += metrics.tp;
    ok(
      metrics.recall >= EXPERIENCE_INTELLIGENCE_RECALL_GOAL * 100,
      `Fragmented OCR recall ${metrics.recall}% (goal ≥ ${EXPERIENCE_INTELLIGENCE_RECALL_GOAL * 100}%)`
    );
  }

  const aggregateRecall = totalExpected ? Math.round((totalTp / totalExpected) * 1000) / 10 : 100;
  ok(
    aggregateRecall >= EXPERIENCE_INTELLIGENCE_RECALL_GOAL * 100,
    `Aggregate experience recall ${aggregateRecall}%`
  );

  if (failed) {
    process.exitCode = 1;
    console.error(`\n${failed} check(s) failed`);
  } else {
    console.log(`\nqa-experience-intelligence: all passed (aggregate recall ${aggregateRecall}%)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
