#!/usr/bin/env node
/**
 * HIRELY Quality Validator QA — pre-export automated checks.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QUALITY_VALIDATOR_V1,
  QUALITY_CHECKS,
  runQualityValidation,
  isQualityExportAllowed,
} from '../core/validation/quality-validator.js';
import { validateExportLock } from '../core/export/export-lock.js';
import { A4_WIDTH_PX } from '../core/export/pdf-export-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const STRONG_CV = {
  name: 'Yohann Azancot',
  title: 'Graphic Designer',
  email: 'yoaz@hotmail.fr',
  phone: '+33 6 49 43 48 39',
  summary: 'Illustrator with 10+ years of brand and packaging work.',
  experience: [
    'Designer — McCann — 2011–2014: Campaign visuals',
    'Freelance Illustrator — Independent — 2015–2022: Packaging and visual identity',
  ],
  education: ['Créapole — Visual Communication — 2008–2011'],
  skills: ['Illustration', 'Graphic Design', 'Packaging'],
  tools: ['Adobe Illustrator', 'Photoshop'],
};

const WEAK_CV = {
  name: '',
  email: '',
  experience: [],
  education: [],
  skills: [],
};

const OVERLAP_CV = {
  ...STRONG_CV,
  experience: [
    'Designer — Agency A — 2018–2022',
    'Lead Designer — Agency B — 2020–2024',
  ],
};

const MISSING_DATES_CV = {
  ...STRONG_CV,
  experience: ['Designer — Agency — role without years'],
};

const CV_METRICS_OK = {
  className: 'cv cv-page cv--live',
  hasEmptyState: false,
  widthPx: A4_WIDTH_PX,
  textLength: 420,
  sectionCount: 4,
  scrollHeight: 1100,
  clientHeight: 900,
};

function assertChecks(report, label) {
  ok(report?.version === QUALITY_VALIDATOR_V1, `${label} version`);
  ok(Array.isArray(report.checks) && report.checks.length === 9, `${label} nine checks`);
  ok(report.confidence?.score >= 0, `${label} confidence score`);
  for (const id of Object.keys(QUALITY_CHECKS)) {
    ok(report.checks.some((c) => c.id === id), `${label} has check ${id}`);
  }
}

function main() {
  ok(QUALITY_VALIDATOR_V1 === 'QUALITY_VALIDATOR_V1', 'engine constant');
  ok(Object.keys(QUALITY_CHECKS).length === 9, 'nine check definitions');

  const strong = runQualityValidation({ cvData: STRONG_CV, cvMetrics: CV_METRICS_OK });
  assertChecks(strong, 'strong');
  ok(strong.exportAllowed, 'strong export allowed');
  ok(isQualityExportAllowed(strong), 'strong isQualityExportAllowed');
  ok(strong.checks.every((c) => c.ok), 'strong all checks pass');

  const weak = runQualityValidation({ cvData: WEAK_CV });
  assertChecks(weak, 'weak');
  ok(!weak.exportAllowed, 'weak export blocked');
  ok(weak.criticalIssues.length >= 4, `weak critical issues (${weak.criticalIssues.length})`);
  ok(!weak.checks.find((c) => c.id === 'name_exists')?.ok, 'weak name fails');
  ok(!weak.checks.find((c) => c.id === 'email_exists')?.ok, 'weak email fails');

  const overlap = runQualityValidation({ cvData: OVERLAP_CV });
  ok(!overlap.exportAllowed, 'overlap export blocked');
  ok(!overlap.checks.find((c) => c.id === 'no_overlap')?.ok, 'overlap detected');

  const missingDates = runQualityValidation({ cvData: MISSING_DATES_CV });
  ok(!missingDates.exportAllowed, 'missing dates blocked');
  ok(!missingDates.checks.find((c) => c.id === 'dates_valid')?.ok, 'dates_valid fails');

  const badPhoto = runQualityValidation({
    cvData: STRONG_CV,
    cvMetrics: CV_METRICS_OK,
    photoState: { photo: 'data:image/jpeg;base64,abc', includePhoto: true, photoCrop: { zoom: 1.4 } },
  });
  ok(!badPhoto.exportAllowed, 'bad photo zoom blocked');
  ok(!badPhoto.checks.find((c) => c.id === 'photo_valid')?.ok, 'photo_valid fails on zoom');

  const badRender = runQualityValidation({
    cvData: STRONG_CV,
    cvMetrics: { className: 'cv', hasEmptyState: true, textLength: 10, widthPx: 400, sectionCount: 0 },
  });
  ok(!badRender.exportAllowed, 'bad pdf render blocked');
  ok(!badRender.checks.find((c) => c.id === 'pdf_render_valid')?.ok, 'pdf_render_valid fails');

  const lock = validateExportLock({
    finalResumeData: {
      identity: { name: STRONG_CV.name, title: STRONG_CV.title, email: STRONG_CV.email },
      experiences: STRONG_CV.experience,
      education: STRONG_CV.education,
      skills: STRONG_CV.skills,
      tools: STRONG_CV.tools,
    },
    contract: { renderable: true },
    cvMetrics: CV_METRICS_OK,
    cvData: STRONG_CV,
    domText: `${STRONG_CV.name} ${STRONG_CV.experience[0]} ${STRONG_CV.education[0]} Illustrator`,
  });
  ok(lock.quality?.exportAllowed, 'export lock includes quality pass');
  ok(lock.ok, 'export lock ok for strong cv');

  const lockWeak = validateExportLock({
    finalResumeData: { identity: {}, experiences: [], education: [], skills: [] },
    contract: { renderable: true },
    cvData: WEAK_CV,
    domText: '',
    cvMetrics: CV_METRICS_OK,
  });
  ok(!lockWeak.quality?.exportAllowed, 'export lock quality blocked for weak');
  ok(!lockWeak.ok, 'export lock blocked for weak');

  ok(indexHtml.includes('quality-validator.js'), 'index imports quality-validator');
  ok(indexHtml.includes('getQualityValidationReport'), 'index has getQualityValidationReport');
  ok(indexHtml.includes('photoState:getPhotoStateForQuality'), 'validateLockedCvExport passes photoState');

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nQUALITY_VALIDATOR QA: PASS');
}

main();
