#!/usr/bin/env node
/**
 * P0 — Strict phone extraction (no digit rewrite, confidence gate 85).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractPhoneCandidate,
  normalizeContactPhone,
  validatePhoneStrict,
  scorePhoneExtraction,
  PHONE_DISPLAY_CONFIDENCE_MIN,
  phoneHasYearOrDatePollution,
} from '../core/parsing/phone-normalize.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { resumeDataToCvData } from '../core/resume-data.js';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/phone-strict-extraction');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

const CORRUPT = '+336434343830';
const CLEAN = '+33649434839';
const POLLUTED = '+33649434839 20';
const YEAR_RANGE = '2011-2020';
const PAGE_GLUE = '+33649434839 83';

let failed = 0;
const checks = [];

function record(id, pass, detail = '') {
  checks.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}`);
  }
}

record('confidence_min_95', PHONE_DISPLAY_CONFIDENCE_MIN === 95);
record('reject_corrupt_extract', !extractPhoneCandidate(CORRUPT), `got ${extractPhoneCandidate(CORRUPT)}`);
record('reject_corrupt_validate', !validatePhoneStrict(CORRUPT));
record('accept_clean_extract', extractPhoneCandidate(CLEAN) === CLEAN, `got ${extractPhoneCandidate(CLEAN)}`);
record('accept_clean_validate', validatePhoneStrict(CLEAN));
record('clean_score_high', scorePhoneExtraction(CLEAN, CLEAN) >= PHONE_DISPLAY_CONFIDENCE_MIN);

const pollutedNorm = normalizeContactPhone(POLLUTED);
record('polluted_not_displayed', !pollutedNorm.phone, `phone=${pollutedNorm.phone}`);
record('polluted_review', pollutedNorm.reviewRequired === true);
record('polluted_low_confidence', pollutedNorm.confidence < PHONE_DISPLAY_CONFIDENCE_MIN);

record('reject_year_range', !validatePhoneStrict(YEAR_RANGE));
const pageGlueNorm = normalizeContactPhone(PAGE_GLUE);
record('page_glue_not_displayed', !pageGlueNorm.phone, `phone=${pageGlueNorm.phone}`);
record('page_glue_review', pageGlueNorm.reviewRequired === true);
record('pollution_detected', phoneHasYearOrDatePollution(POLLUTED));

const CV = [
  'Sophie Martin',
  'Graphic Designer',
  'sophie@email.com',
  CORRUPT,
  'Paris',
  '',
  'Experience',
  'Designer — Studio Azur — 2019 – Present',
].join('\n');

const imported = await runHirelyImportFromText(CV, {
  source: 'qa-phone-strict',
  extractionMethod: 'paste',
});
const rd = sanitizeResumeForDisplay(imported?.resumeData || {});
const built = buildFinalResumeData(rd, { existingReview: imported?.reviewQueue || [] });
const displayPhone = String(built.finalResumeData?.identity?.phone || rd.identity?.phone || '').trim();
record('pipeline_no_corrupt_phone', !displayPhone.includes('643434383'), `phone=${displayPhone || '(empty)'}`);
record(
  'pipeline_review_or_empty',
  !displayPhone || (built.reviewItems || []).some((r) => r.field === 'identity.phone'),
  `review=${(built.reviewItems || []).length}`
);

const cvData = resumeDataToCvData(built.finalResumeData || rd);
record('cvdata_phone_absent', !cvData.phone || validatePhoneStrict(cvData.phone), `cvPhone=${cvData.phone || '(empty)'}`);

const T = loadHirelyTemplates();
const html = String(T.render(cvData, 'ats') || '');
const corruptInHeader = /\b6434343830\b/.test(html.slice(0, 1500));
record('render_no_corrupt_header', !corruptInHeader);

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  version: 'PHONE_STRICT_EXTRACTION_V1',
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  summary: { total: checks.length, pass: checks.filter((c) => c.pass).length, fail: failed },
  checks,
  corruptCase: { corruptInput: CORRUPT, displayPhone, reviewCount: (built.reviewItems || []).length },
};
fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

console.log(`\n═══ Phone Strict Extraction: ${report.summary.pass}/${report.summary.total} PASS ═══`);
process.exit(failed ? 1 : 0);
