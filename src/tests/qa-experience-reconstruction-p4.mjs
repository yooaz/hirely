#!/usr/bin/env node
/**
 * P4 — Experience Reconstruction Engine (confidence routing).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  EXPERIENCE_RECONSTRUCTION_CONFIDENCE_ROUTER,
  EXPERIENCE_CONFIDENCE_AUTO_MIN,
  EXPERIENCE_CONFIDENCE_REVIEW_MIN,
  classifyExperienceConfidenceTier,
  scanDocumentExperienceCandidates,
  routeExperienceCandidatesByConfidence,
  runExperienceReconstructionEngine,
  countExpectedExperiencesInDocument,
} from '../core/parsing/experience-reconstruction-confidence-router.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { normalizeResumeData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/experience-reconstruction-p4');
const OCR_FRAGMENTED = path.join(ROOT, 'tests/fixtures/yoaz-pdf-live/ocr-fragmented.txt');

const FIVE_JOBS = [
  'Freelance Illustrator — Independent / Freelance — 2011-2018',
  'Internship — Nike — Summer 2018',
  'Designer — McCann Paris — 2018-2020',
  'Senior Illustrator — Havas Paris — 2020-2022',
  'Creative Director — Studio Yoaz — 2022-Present',
];

let failed = 0;
const checks = [];

function ok(cond, id, detail = '') {
  checks.push({ id, pass: !!cond, detail });
  if (!cond) {
    failed++;
    console.error('FAIL', id, detail);
  } else console.log('OK', id, detail || '');
}

ok(EXPERIENCE_CONFIDENCE_AUTO_MIN === 80, 'auto-threshold-80');
ok(EXPERIENCE_CONFIDENCE_REVIEW_MIN === 40, 'review-threshold-40');
ok(classifyExperienceConfidenceTier(90) === 'auto', 'tier-auto');
ok(classifyExperienceConfidenceTier(80) === 'review', 'tier-80-review');
ok(classifyExperienceConfidenceTier(40) === 'review', 'tier-40-review');
ok(classifyExperienceConfidenceTier(25) === 'unsorted', 'tier-unsorted');

const tierRouted = routeExperienceCandidatesByConfidence([
  {
    role: 'Designer',
    company: 'Acme',
    startDate: '2020',
    dates: '2020–2022',
    confidence: 92,
    sourceLine: 'Designer — Acme — 2020-2022',
  },
  {
    role: 'Consultant',
    company: 'Beta',
    startDate: '2018',
    dates: '2018–2019',
    confidence: 55,
    sourceLine: 'Consultant — Beta — 2018-2019',
  },
  {
    role: 'Unknown',
    company: 'Gamma',
    startDate: '2015',
    dates: '2015–2016',
    confidence: 30,
    sourceLine: 'Unknown — Gamma — 2015-2016',
  },
]);

ok(tierRouted.experiences.length === 1, 'route-auto-count', String(tierRouted.experiences.length));
ok(tierRouted.reviewQueue.length === 1, 'route-review-count', String(tierRouted.reviewQueue.length));
ok(tierRouted.unsorted.length === 1, 'route-unsorted-count', String(tierRouted.unsorted.length));
ok(
  tierRouted.experiences[0].confidenceTier === 'auto',
  'auto-tier-flag',
  tierRouted.experiences[0].confidenceTier
);

const fiveRaw = FIVE_JOBS.join('\n');
const fiveResult = runExperienceReconstructionEngine(
  { experiences: [], reviewQueue: [], unsorted: [] },
  fiveRaw
);

ok(fiveResult.experiences.length === 5, 'five-jobs-preview-count', `count=${fiveResult.experiences.length}`);
ok(
  fiveResult.accountedCount >= 5,
  'five-jobs-accounted',
  `accounted=${fiveResult.accountedCount}`
);
ok(
  fiveResult.experiences.every((e) => (e.confidence || 0) > EXPERIENCE_CONFIDENCE_AUTO_MIN),
  'five-jobs-auto-confidence',
  fiveResult.experiences.map((e) => e.confidence).join(',')
);

const expectedFive = countExpectedExperiencesInDocument(fiveRaw);
ok(expectedFive >= 5, 'five-jobs-expected-anchors', `expected=${expectedFive}`);

const scan = scanDocumentExperienceCandidates(fiveRaw);
ok(scan.candidates.length >= 5, 'scan-candidates', String(scan.candidates.length));
ok(
  scan.candidates.every((c) => c.company || c.role),
  'candidates-have-company-or-role'
);

const built = buildFinalResumeData(
  normalizeResumeData({
    identity: { name: 'Jane Doe', title: 'Creative Director' },
    experiences: fiveResult.experiences,
    education: [],
    skills: [],
  }),
  { rawText: fiveRaw, cleanedText: fiveRaw, silent: true }
);
ok(
  (built.finalResumeData?.experiences || []).length >= 4 && fiveResult.experiences.length === 5,
  'final-resume-preserves-experiences',
  `final=${built.finalResumeData?.experiences?.length} engine=${fiveResult.experiences.length}`
);

if (fs.existsSync(OCR_FRAGMENTED)) {
  const ocrRaw = fs.readFileSync(OCR_FRAGMENTED, 'utf8');
  const ocrResult = runExperienceReconstructionEngine(
    { experiences: [], reviewQueue: [], unsorted: [] },
    ocrRaw
  );
  ok(ocrResult.experiences.length >= 5, 'yoaz-ocr-auto-count', `auto=${ocrResult.experiences.length}`);
  ok(ocrResult.accountedCount >= ocrResult.experiences.length, 'yoaz-never-discard', `accounted=${ocrResult.accountedCount}`);

  const section = runSectionEngineV2(ocrRaw, { rawText: ocrRaw, extractionMethod: 'ocr' });
  const wired =
    section.structured?.metadata?.experienceReconstructionP4?.engine ===
    EXPERIENCE_RECONSTRUCTION_CONFIDENCE_ROUTER;
  ok(wired, 'section-engine-p4-wired');
  ok((section.structured?.experiences?.length || 0) >= 1, 'section-engine-experiences');
} else {
  ok(false, 'yoaz-fixture-missing', 'ocr-fragmented.txt not found');
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, 'report.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      engine: EXPERIENCE_RECONSTRUCTION_CONFIDENCE_ROUTER,
      fiveJobs: {
        auto: fiveResult.experiences.length,
        accounted: fiveResult.accountedCount,
        expected: expectedFive,
      },
      checks,
      pass: failed === 0,
    },
    null,
    2
  )
);

console.log(`\nP4 experience reconstruction: ${failed === 0 ? 'PASS' : 'FAIL'} (${checks.filter((c) => c.pass).length}/${checks.length})`);
process.exit(failed ? 1 : 0);
