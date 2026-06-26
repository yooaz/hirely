#!/usr/bin/env node
/**
 * P0 — Strict identity extraction acceptance (name / email / phone).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  STRICT_IDENTITY_EXTRACTION_V1,
  IDENTITY_CONTACT_RULES,
  assessIdentityNameStrict,
  assessIdentityPhoneStrict,
  enforceIdentityContactStrictness,
} from '../core/validation/identity-contact-strictness.js';
import {
  rejectAsPersonName,
  extractLockedIdentity,
  isValidIdentityName,
} from '../core/parsing/identity-extraction.js';
import {
  applyIdentityLock,
  validateEmailIdentityLock,
  validatePersonNameStrict,
  validatePhoneIdentityLock,
} from '../core/validation/identity-lock.js';
import {
  assessEmailStrictness,
  emailLocalPartAddsLetters,
  enforceEmailStrictness,
} from '../core/validation/email-strictness.js';
import { phoneHasYearOrDatePollution } from '../core/parsing/phone-normalize.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { reviewQueueHasField } from '../core/validation/no-fake-data-policy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/strict-identity-extraction');
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

record('version', STRICT_IDENTITY_EXTRACTION_V1 === 'STRICT_IDENTITY_EXTRACTION_V1');
record('missing_better_than_wrong', IDENTITY_CONTACT_RULES.missingNameBetterThanWrong === true);

// Name — person-like only
record('reject_company', rejectAsPersonName('Lontac Impressions'));
record('reject_agency', rejectAsPersonName('McCann Agency'));
record('reject_school', rejectAsPersonName('CREAPOLE School'));
record('reject_client', rejectAsPersonName('Nike Client'));
record('reject_project', rejectAsPersonName('Brand Project'));
record('reject_profile', rejectAsPersonName('Professional Profile'));
record('reject_internship', rejectAsPersonName('Design Internship'));
record('reject_digits', rejectAsPersonName('Jean 42'));
record('reject_email_in_name', rejectAsPersonName('john@mail.com'));
record('reject_url_in_name', rejectAsPersonName('linkedin.com/in/john'));
record('accept_person', !rejectAsPersonName('Sophie Martin') && isValidIdentityName('Sophie Martin'));

// Email — exact source, no local-part mutation
record(
  'email_no_local_mutation',
  emailLocalPartAddsLetters('yoazg', 'yoaz') &&
    !emailLocalPartAddsLetters('yoaz', 'yoaz')
);
const yoazSrc = 'Yohann Azancot\nyoaz@hotmail.fr';
const yoazEmail = assessEmailStrictness('yoazg@hotmail.fr', yoazSrc);
record(
  'email_recover_exact',
  yoazEmail.accept && yoazEmail.display === 'yoaz@hotmail.fr',
  yoazEmail.display
);
record(
  'email_uncertain_empty',
  !enforceEmailStrictness({ email: 'ghost@fake.test' }, { sourceText: 'no email here' }).identity
    .email
);

// Phone — no year/page/postcode merge
record('phone_reject_year', !validatePhoneIdentityLock('+33 6 49 43 48 39 2011-2020').valid);
record('phone_reject_page', !validatePhoneIdentityLock('+33 6 12 34 56 78 Page 2 of 3').valid);
record('phone_year_detected', phoneHasYearOrDatePollution('+33649434839 2011-2020'));
record('phone_accept_valid', validatePhoneIdentityLock('+33 6 12 34 56 78').valid);
record('phone_reject_invented', !validatePhoneIdentityLock('+336434343830').valid);

// Low confidence → reviewQueue
const badName = enforceIdentityContactStrictness(
  { name: 'Lontac Impressions', email: 'yoaz@hotmail.fr', phone: '+336434343830' },
  { sourceText: yoazSrc, experiences: [{ company: 'Lontac Impressions' }] }
);
record('review_name_on_bad', badName.reviewItems.some((i) => i.field === 'identity.name'));
record('review_phone_on_bad', badName.reviewItems.some((i) => i.field === 'identity.phone'));
record('strip_company_name', badName.identity.name === '', `name=${badName.identity.name}`);
record('strip_fake_phone', !badName.identity.phone);

const locked = applyIdentityLock(
  { name: 'Lontac Impressions', email: 'yoaz@hotmail.fr', phone: '+33649434839 2011-2020' },
  { sourceText: yoazSrc, experiences: [{ company: 'Lontac Impressions' }] }
);
record('lock_clears_bad_fields', locked.identity.name === '' && locked.identity.phone === '');

async function pipelineCheck(raw, source) {
  const imported = await runHirelyImportFromText(raw, { source, extractionMethod: 'paste' });
  const sanitized = sanitizeResumeForDisplay(imported?.resumeData || {});
  const built = buildFinalResumeData(sanitized, {
    silent: true,
    rawText: raw,
    existingReview: imported?.reviewQueue || [],
  });
  return { fr: built.finalResumeData || sanitized, built };
}

const goodCv = [
  'Sophie Martin',
  'Graphic Designer',
  'sophie@studio.fr · +33 6 98 76 54 32',
  'Experience',
  'Designer — Studio Azur — 2019 – Present',
].join('\n');
const good = await pipelineCheck(goodCv, 'strict-good');
record('pipeline_keeps_good_name', /sophie\s+martin/i.test(good.fr?.identity?.name || ''));
record('pipeline_keeps_good_email', String(good.fr?.identity?.email || '').includes('@'));
record('pipeline_keeps_good_phone', /\+33/.test(String(good.fr?.identity?.phone || '')));

const companyCv = [
  'Lontac Impressions',
  'designer@email.com · +33 6 12 34 56 78',
  'Experience',
  'Designer — Lontac Impressions — 2019 – Present',
].join('\n');
const company = await pipelineCheck(companyCv, 'strict-company');
const companyName = String(company.fr?.identity?.name || '').trim();
record('pipeline_no_company_name', !/lontac|impressions/i.test(companyName), companyName || '(empty)');
record(
  'pipeline_company_review_or_empty',
  !companyName || reviewQueueHasField(company.built.reviewItems, 'identity.name')
);

const headerPick = extractLockedIdentity(
  ['Lontac Impressions', 'Sophie Martin', 'sophie@studio.fr', '+33698765432'],
  { experiences: [{ company: 'Lontac Impressions' }] }
);
record('extract_locked_skips_company', headerPick.name === 'Sophie Martin');

const emailLock = validateEmailIdentityLock('yoaz@hotmail.fr', yoazSrc);
record('email_lock_valid', emailLock.valid && emailLock.confidence >= 90);

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  version: STRICT_IDENTITY_EXTRACTION_V1,
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  acceptance: {
    no_company_as_name: checks.filter((c) => c.id.startsWith('reject_') && c.id !== 'reject_digits').every((c) => c.pass),
    no_corrupted_email: ['email_no_local_mutation', 'email_recover_exact', 'email_uncertain_empty', 'email_lock_valid'].every(
      (id) => checks.find((c) => c.id === id)?.pass
    ),
    no_fake_phone: ['phone_reject_year', 'phone_reject_page', 'phone_reject_invented', 'phone_accept_valid'].every(
      (id) => checks.find((c) => c.id === id)?.pass
    ),
    missing_better_than_wrong: ['strip_company_name', 'strip_fake_phone', 'lock_clears_bad_fields', 'pipeline_no_company_name'].every(
      (id) => checks.find((c) => c.id === id)?.pass
    ),
    low_confidence_review_queue: ['review_name_on_bad', 'review_phone_on_bad', 'pipeline_company_review_or_empty'].every(
      (id) => checks.find((c) => c.id === id)?.pass
    ),
  },
  rules: IDENTITY_CONTACT_RULES,
  summary: { total: checks.length, pass: checks.filter((c) => c.pass).length, fail: failed },
  checks,
};
fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

console.log(`\n═══ Strict Identity Extraction: ${report.summary.pass}/${report.summary.total} PASS ═══`);
process.exit(failed ? 1 : 0);
