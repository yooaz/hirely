#!/usr/bin/env node
/**
 * P0 — No fake data policy acceptance checks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  NO_FAKE_DATA_POLICY_V1,
  NO_FAKE_FORBIDDEN,
  NO_FAKE_POLICY_RULES,
  auditNoFakeDataPolicy,
  isAcceptableDisplayName,
  isAcceptableDisplayPhone,
  enforceNoFakeExperiences,
  reviewQueueHasField,
} from '../core/validation/no-fake-data-policy.js';
import { UNDETECTED_INFORMATION_LABEL } from '../core/display/undetected-label.js';
import {
  NAME_UNCERTAIN_LABEL,
  PHONE_UNCERTAIN_LABEL,
} from '../core/parsing/parser-recovery.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { auditInventedExperience } from '../core/parsing/invented-experience-guard.js';
import { experienceRowHasForbiddenFutureDate } from '../core/validation/data-sanitization-layer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/no-fake-data-policy');
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

record('policy_version', NO_FAKE_DATA_POLICY_V1 === 'NO_FAKE_DATA_POLICY_V1');
record('missing_name_acceptable', NO_FAKE_POLICY_RULES.missingNameAcceptable === true);
record('undetected_label', NO_FAKE_POLICY_RULES.undetectedLabel === UNDETECTED_INFORMATION_LABEL);
record('uncertain_name_is_confirm_label', NAME_UNCERTAIN_LABEL === 'Nom à confirmer');

record('reject_fake_name_company', !isAcceptableDisplayName('Lontac Impressions'));
record('reject_fake_name_garbage', !isAcceptableDisplayName('wustrator snoutors'));
record('accept_valid_name', isAcceptableDisplayName('Yohann Azancot'));
record('accept_empty_name', isAcceptableDisplayName(''));
record('accept_uncertain_label', isAcceptableDisplayName(NAME_UNCERTAIN_LABEL));

record('reject_fake_phone_extra_digits', !isAcceptableDisplayPhone('+336434343830'));
record('reject_phone_date_pollution', !isAcceptableDisplayPhone('+33 6 49 43 48 39 2011-2020'));
record('accept_valid_phone', isAcceptableDisplayPhone('+33649434839'));

const invented = auditInventedExperience({
  role: '',
  company: 'Nike',
  bullets: ['Delivered creative work for seasonal campaigns.'],
});
record('reject_invented_experience_bullet', invented.invented === true);

const stripped = enforceNoFakeExperiences([
  { role: 'Designer', company: 'Acme Studio', dates: '2020 – Present' },
  { role: '', company: 'Nike', bullets: ['Delivered creative work for brand.'] },
]);
record(
  'strip_invented_client_experience',
  stripped.kept.length === 1 && stripped.rejected.length >= 1 && stripped.clients.includes('Nike')
);

record('reject_future_experience_date', experienceRowHasForbiddenFutureDate('Lead Designer — Studio — 2028 – 2099'));

const LONTAC_CV = [
  'Graphic Designer & Illustrator',
  'designer@email.com · +33 6 12 34 56 78 · Paris',
  'Experience',
  'Designer — Lontac Impressions — Paris — 2019 – Present',
].join('\n');

const BAD_PHONE_CV = [
  'Art Director',
  'yohann@test.com',
  '+336434343830',
  'Paris',
  'Experience',
  'Designer — Studio Azur — 2019 – Present',
].join('\n');

const NO_NAME_CV = [
  'Senior Illustrator',
  'contact@studio.fr',
  'Paris',
  'Experience',
  'Freelance Illustrator — 2018 – Present',
].join('\n');

async function runPipeline(raw, source) {
  const imported = await runHirelyImportFromText(raw, { source, extractionMethod: 'paste' });
  const sanitized = sanitizeResumeForDisplay(imported?.resumeData || {});
  const built = buildFinalResumeData(sanitized, {
    silent: true,
    rawText: raw,
    existingReview: imported?.reviewQueue || [],
  });
  return { imported, built, fr: built.finalResumeData || sanitized };
}

const lontac = await runPipeline(LONTAC_CV, 'qa-no-fake-lontac');
const lontacAudit = auditNoFakeDataPolicy({
  finalResumeData: lontac.fr,
  reviewQueue: lontac.built.reviewItems,
});
const lontacName = String(lontac.fr?.identity?.name || '').trim();
record(
  'pipeline_no_fake_company_name',
  !/lontac|impressions/i.test(lontacName),
  `displayName=${lontacName || '(empty)'}`
);
record(
  'pipeline_lontac_audit_pass',
  lontacAudit.pass,
  lontacAudit.violations.map((v) => v.detail).join('; ')
);
record(
  'pipeline_missing_name_ok',
  !lontacName || lontacName === NAME_UNCERTAIN_LABEL || isAcceptableDisplayName(lontacName),
  `name=${lontacName}`
);

const badPhone = await runPipeline(BAD_PHONE_CV, 'qa-no-fake-phone');
const badPhoneDisplay = String(badPhone.fr?.identity?.phone || '').trim();
const phoneReview =
  reviewQueueHasField(badPhone.built.reviewItems, 'identity.phone') ||
  (badPhone.fr?.meta?.contactReviewItems || []).some((i) => i?.field === 'identity.phone');
record(
  'pipeline_no_fake_phone_display',
  !badPhoneDisplay || badPhoneDisplay === PHONE_UNCERTAIN_LABEL,
  `phone=${badPhoneDisplay || '(empty)'}`
);
record(
  'pipeline_bad_phone_to_review',
  phoneReview || !badPhoneDisplay || badPhoneDisplay === PHONE_UNCERTAIN_LABEL,
  `review=${phoneReview}`
);
record(
  'pipeline_bad_phone_audit_pass',
  auditNoFakeDataPolicy({ finalResumeData: badPhone.fr, reviewQueue: badPhone.built.reviewItems }).pass
);

const noName = await runPipeline(NO_NAME_CV, 'qa-no-fake-noname');
const noNameDisplay = String(noName.fr?.identity?.name || '').trim();
record(
  'pipeline_no_name_acceptable',
  !noNameDisplay || noNameDisplay === NAME_UNCERTAIN_LABEL || isAcceptableDisplayName(noNameDisplay),
  `name=${noNameDisplay || '(empty)'}`
);
record(
  'pipeline_no_name_audit_pass',
  auditNoFakeDataPolicy({ finalResumeData: noName.fr }).pass,
  `violations=${auditNoFakeDataPolicy({ finalResumeData: noName.fr }).violations.length}`
);

const syntheticBad = auditNoFakeDataPolicy({
  finalResumeData: {
    identity: { name: 'Lontac Impressions', phone: '+336434343830' },
    experiences: [
      { role: '', company: 'Chanel', bullets: ['Delivered creative work for campaigns.'] },
      { role: 'Designer', company: 'Studio', dates: '2030 – 2040' },
    ],
  },
});
record('audit_catches_synthetic_violations', syntheticBad.violations.length >= 3);
record(
  'audit_forbidden_types',
  syntheticBad.violations.some((v) => v.type === NO_FAKE_FORBIDDEN.fakeName) &&
    syntheticBad.violations.some((v) => v.type === NO_FAKE_FORBIDDEN.fakePhone)
);

const pass = failed === 0;
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  REPORT_JSON,
  JSON.stringify(
    {
      pass,
      version: NO_FAKE_DATA_POLICY_V1,
      generatedAt: new Date().toISOString(),
      failed,
      checks,
      rules: NO_FAKE_POLICY_RULES,
      samples: {
        lontac: { name: lontacName || null, auditPass: lontacAudit.pass },
        badPhone: { phone: badPhoneDisplay || null, phoneReview },
        noName: { name: noNameDisplay || null },
      },
    },
    null,
    2
  )
);

console.log(`\n${pass ? 'PASS' : 'FAIL'} no-fake-data-policy (${checks.length - failed}/${checks.length})`);
process.exit(pass ? 0 : 1);
