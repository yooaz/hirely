#!/usr/bin/env node
/**
 * P0 — Identity & contact strictness acceptance tests.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  IDENTITY_CONTACT_STRICTNESS_V1,
  IDENTITY_CONTACT_RULES,
  assessIdentityNameStrict,
  assessIdentityPhoneStrict,
  enforceIdentityContactStrictness,
  buildNameReviewItem,
} from '../core/validation/identity-contact-strictness.js';
import { phoneHasYearOrDatePollution } from '../core/parsing/phone-normalize.js';
import { UNDETECTED_INFORMATION_LABEL } from '../core/display/undetected-label.js';
import { IDENTITY_NEEDS_REVIEW_LABEL } from '../core/display/identity-labels.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { reviewQueueHasField } from '../core/validation/no-fake-data-policy.js';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import { resumeDataToCvData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/identity-contact-strictness');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

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

record('policy_version', IDENTITY_CONTACT_STRICTNESS_V1 === 'IDENTITY_CONTACT_STRICTNESS_V1');
record('rules_missing_name_ok', IDENTITY_CONTACT_RULES.missingNameBetterThanWrong === true);
record('rules_missing_phone_ok', IDENTITY_CONTACT_RULES.missingPhoneBetterThanFake === true);
record('rules_review_queue', IDENTITY_CONTACT_RULES.lowConfidenceToReviewQueue === true);

// Rule 1 — never company as person name
const companyName = assessIdentityNameStrict('Lontac Impressions', [
  { company: 'Lontac Impressions', role: 'Designer' },
]);
record('reject_company_as_name', !companyName.accept, companyName.reason);
record(
  'company_name_review_item',
  buildNameReviewItem('Lontac Impressions')?.field === 'identity.name'
);

// Rule 2 — never invent phone digits
const invented = assessIdentityPhoneStrict('+336434343830');
record('reject_invented_phone_digits', !invented.accept, invented.reason);

// Rule 3 — no year/page merge
record(
  'reject_phone_year_merge',
  !assessIdentityPhoneStrict('+33 6 49 43 48 39 2011-2020').accept
);
record('phone_year_pollution_detected', phoneHasYearOrDatePollution('+33649434839 2011-2020'));
record(
  'reject_phone_page_merge',
  !assessIdentityPhoneStrict('+33 6 12 34 56 78 Page 2 of 3').accept
);
record(
  'phone_page_pollution_detected',
  phoneHasYearOrDatePollution('+33 6 12 34 56 78 Page 2 of 3')
);
record('reject_phone_page_fraction', !assessIdentityPhoneStrict('0612345678 2/3').accept);

// Rule 4–6 — valid accept; missing better than wrong
record('accept_valid_name', assessIdentityNameStrict('Sophie Martin').accept);
record('accept_valid_phone', assessIdentityPhoneStrict('+33 6 12 34 56 78').accept);
record('empty_name_not_accepted', !assessIdentityNameStrict('').accept);
record(
  'uncertain_label_not_wrong_name',
  assessIdentityNameStrict('').display === '' ||
    assessIdentityNameStrict('Lontac Impressions').display === IDENTITY_NEEDS_REVIEW_LABEL
);

const enforced = enforceIdentityContactStrictness(
  { name: 'McCann Agency', phone: '+336434343830' },
  { experiences: [{ company: 'McCann Agency' }] }
);
record(
  'enforce_strips_bad_identity',
  enforced.identity.name !== 'McCann Agency' && !enforced.identity.phone,
  `name=${enforced.identity.name}`
);
record(
  'enforce_emits_name_review',
  enforced.reviewItems.some((i) => i.field === 'identity.name')
);
record(
  'enforce_emits_phone_review',
  enforced.reviewItems.some((i) => i.field === 'identity.phone')
);

const LONTAC_CV = [
  'Graphic Designer & Illustrator',
  'designer@email.com · +33 6 12 34 56 78 · Paris',
  'Experience',
  'Designer — Lontac Impressions — Paris — 2019 – Present',
].join('\n');

const BAD_CONTACT_CV = [
  'Art Director',
  'yohann@test.com',
  '+336434343830',
  'Paris',
  'Experience',
  'Designer — Studio Azur — 2019 – Present',
].join('\n');

const PAGE_PHONE_CV = [
  'Sophie Martin',
  'sophie@test.com',
  '+33 6 12 34 56 78 Page 2 of 3',
  'Paris',
  'Experience',
  'Designer — Studio — 2019 – Present',
].join('\n');

async function runPipeline(raw, source) {
  const imported = await runHirelyImportFromText(raw, { source, extractionMethod: 'paste' });
  const sanitized = sanitizeResumeForDisplay(imported?.resumeData || {});
  const built = buildFinalResumeData(sanitized, {
    silent: true,
    rawText: raw,
    existingReview: imported?.reviewQueue || [],
  });
  return { imported, built, fr: built.finalResumeData || sanitized, rd: sanitized };
}

const lontac = await runPipeline(LONTAC_CV, 'qa-strict-lontac');
const lontacName = String(lontac.fr?.identity?.name || '').trim();
record(
  'pipeline_no_company_name',
  !/lontac|impressions|mccann/i.test(lontacName),
  `name=${lontacName || '(empty)'}`
);
record(
  'pipeline_missing_name_ok',
  !lontacName ||
    lontacName === UNDETECTED_INFORMATION_LABEL ||
    lontacName === IDENTITY_NEEDS_REVIEW_LABEL,
  `name=${lontacName}`
);
record(
  'pipeline_name_review_or_empty',
  !lontacName ||
    reviewQueueHasField(lontac.built.reviewItems, 'identity.name') ||
    lontacName === UNDETECTED_INFORMATION_LABEL ||
    lontacName === IDENTITY_NEEDS_REVIEW_LABEL
);

const badPhone = await runPipeline(BAD_CONTACT_CV, 'qa-strict-bad-phone');
const badPhoneDisplay = String(badPhone.fr?.identity?.phone || '').trim();
record('pipeline_no_fake_phone', !badPhoneDisplay, `phone=${badPhoneDisplay || '(empty)'}`);
record(
  'pipeline_phone_review_queue',
  reviewQueueHasField(badPhone.built.reviewItems, 'identity.phone') || !badPhoneDisplay
);

const pagePhone = await runPipeline(PAGE_PHONE_CV, 'qa-strict-page-phone');
const pagePhoneDisplay = String(pagePhone.fr?.identity?.phone || '').trim();
record('pipeline_no_page_merged_phone', !/page\s+\d/i.test(pagePhoneDisplay), `phone=${pagePhoneDisplay}`);
record(
  'pipeline_page_phone_clean_or_empty',
  !pagePhoneDisplay || !/page\s+\d|\/\d/.test(pagePhoneDisplay),
  `phone=${pagePhoneDisplay || '(empty)'}`
);

const good = await runPipeline(
  [
    'Sophie Martin',
    'Graphic Designer',
    'sophie@studio.fr · +33 6 98 76 54 32',
    'Experience',
    'Designer — Studio Azur — 2019 – Present',
  ].join('\n'),
  'qa-strict-good'
);
const goodName = String(good.fr?.identity?.name || '');
const goodPhone = String(good.fr?.identity?.phone || '');
record('pipeline_good_name_kept', /sophie\s+martin/i.test(goodName), `name=${goodName}`);
record('pipeline_good_phone_kept', /\+33/.test(goodPhone), `phone=${goodPhone}`);

const cvData = resumeDataToCvData(good.rd);
const T = loadHirelyTemplates();
const html = String(T.render(cvData, 'ats') || '');
record('render_no_company_in_cvname', !/lontac|impressions/i.test(html));

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  version: IDENTITY_CONTACT_STRICTNESS_V1,
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  rules: IDENTITY_CONTACT_RULES,
  summary: { total: checks.length, pass: checks.filter((c) => c.pass).length, fail: failed },
  checks,
  samples: {
    lontac: { name: lontacName || null },
    badPhone: { phone: badPhoneDisplay || null },
    pagePhone: { phone: pagePhoneDisplay || null },
    good: { name: goodName, phone: goodPhone },
  },
};
fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

console.log(`\n═══ Identity Contact Strictness: ${report.summary.pass}/${report.summary.total} PASS ═══`);
process.exit(failed ? 1 : 0);
