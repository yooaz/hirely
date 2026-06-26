#!/usr/bin/env node
/**
 * P0 — Name & phone extraction rewrite acceptance tests.
 */
import {
  NAME_PHONE_REWRITE_V1,
  IDENTITY_CONFIDENCE_MIN,
  rejectAsPersonName,
  isAcceptablePersonName,
  extractLockedIdentity,
} from '../core/parsing/identity-extraction.js';
import {
  PHONE_DISPLAY_CONFIDENCE_MIN,
  normalizeContactPhone,
  validatePhoneStrict,
  phoneHasYearOrDatePollution,
  extractPhoneCandidate,
} from '../core/parsing/phone-normalize.js';

function extractNameAndPhoneV2(allLines = [], opts = {}) {
  const lines = (allLines || []).map((l) => String(l || '').trim()).filter(Boolean);
  const nameResult = extractLockedIdentity(lines, opts);
  let phoneRaw = String(opts.contact?.phone || '').trim();
  if (!phoneRaw) {
    for (const line of lines.slice(0, 30)) {
      const cand = extractPhoneCandidate(line);
      if (cand) {
        phoneRaw = line;
        break;
      }
    }
  }
  const phoneNorm = normalizeContactPhone(phoneRaw);
  return {
    name: nameResult.name,
    nameConfidence: nameResult.nameConfidence,
    nameSource: nameResult.nameSource,
    nameCandidates: nameResult.nameCandidates,
    phone: phoneNorm.phone,
    phoneConfidence: phoneNorm.confidence,
    reviewItems: [],
    version: 'NAME_PHONE_REWRITE_V1',
  };
}
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { reviewQueueHasField } from '../core/validation/no-fake-data-policy.js';

const YOAZ_CV = [
  'Yohann Azancot',
  'Graphic Designer',
  'yoaz@hotmail.fr',
  '+33649434839',
  'Paris',
  '',
  'Experience',
  'Designer — Lontac Impressions — 2019 – Present',
].join('\n');

const LONTAC_HEADER_CV = [
  'Lontac Impressions',
  'Yohann Azancot',
  'yoaz@hotmail.fr',
  '+33649434839',
].join('\n');

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

record('rewrite_version', NAME_PHONE_REWRITE_V1 === 'NAME_PHONE_REWRITE_V1');
record('name_confidence_min_85', IDENTITY_CONFIDENCE_MIN === 85);
record('phone_confidence_min_95', PHONE_DISPLAY_CONFIDENCE_MIN === 95);

record('reject_lontac_impressions', rejectAsPersonName('Lontac Impressions'));
record('reject_38_impressions', rejectAsPersonName('38 impressions'));
record('reject_year_range_name', rejectAsPersonName('2010-2013'));
record('accept_yohann_azancot', isAcceptablePersonName('Yohann Azancot'));

const yoazLocked = extractLockedIdentity(YOAZ_CV.split('\n'), {
  experiences: [{ company: 'Lontac Impressions', role: 'Designer' }],
});
record('yoaz_name_extracted', yoazLocked.name === 'Yohann Azancot', `got ${yoazLocked.name}`);
record('yoaz_name_confidence', yoazLocked.nameConfidence >= 85, `conf=${yoazLocked.nameConfidence}`);
record('yoaz_not_company', yoazLocked.name !== 'Lontac Impressions');

const lontacFirst = extractLockedIdentity(LONTAC_HEADER_CV.split('\n'));
record('company_first_line_rejected', lontacFirst.name === 'Yohann Azancot', `got ${lontacFirst.name}`);

const yoazCombo = extractNameAndPhoneV2(YOAZ_CV.split('\n'));
record('combo_yoaz_phone', yoazCombo.phone === '+33649434839', `got ${yoazCombo.phone}`);
record('combo_yoaz_name', yoazCombo.name === 'Yohann Azancot');

record('phone_clean_accept', validatePhoneStrict('+33649434839'));
record('phone_clean_norm', normalizeContactPhone('+33649434839').phone === '+33649434839');
record('phone_year_pollution', phoneHasYearOrDatePollution('2010-2013'));
record('phone_postal_pollution', phoneHasYearOrDatePollution('75011'));
record('phone_impressions_pollution', phoneHasYearOrDatePollution('38 impressions'));
record('phone_spaced_years', phoneHasYearOrDatePollution('2011 2014'));
record('reject_polluted_phone', !normalizeContactPhone('+33649434839 2011-2020').phone);
record('reject_corrupt_phone', !validatePhoneStrict('+336434343830'));

const imported = await runHirelyImportFromText(YOAZ_CV, { source: 'qa-name-phone-rewrite' });
const importSource = {
  rawText: imported?.rawText || '',
  cleanedText: imported?.cleanedText || imported?.rawText || '',
};
const rd = sanitizeResumeForDisplay(imported?.resumeData || {}, importSource);
const built = buildFinalResumeData(rd, {
  existingReview: imported?.reviewQueue || [],
  ...importSource,
});
const finalName = built.finalResumeData?.identity?.name || rd.identity?.name || '';
const finalPhone = built.finalResumeData?.identity?.phone || rd.identity?.phone || '';

record('pipeline_yoaz_name', finalName === 'Yohann Azancot', `name=${finalName}`);
record('pipeline_yoaz_phone', finalPhone === '+33649434839', `phone=${finalPhone}`);
record('pipeline_no_lontac_name', !/lontac|impressions/i.test(finalName), `name=${finalName}`);

const pollutedImport = await runHirelyImportFromText(
  ['Test User', '+33649434839 2011-2020', 'a@b.fr'].join('\n'),
  { source: 'qa-name-phone-polluted' }
);
const pollutedSource = {
  rawText: pollutedImport?.rawText || '',
  cleanedText: pollutedImport?.cleanedText || pollutedImport?.rawText || '',
};
const pollutedBuilt = buildFinalResumeData(
  sanitizeResumeForDisplay(pollutedImport?.resumeData || {}, pollutedSource),
  {
    existingReview: pollutedImport?.reviewQueue || [],
    ...pollutedSource,
  }
);
record(
  'polluted_phone_review',
  reviewQueueHasField(pollutedBuilt.reviewItems, 'identity.phone') ||
    !pollutedBuilt.finalResumeData?.identity?.phone
);

record('extract_candidate_yoaz', extractPhoneCandidate('+33649434839') === '+33649434839');

console.log(`\n═══ Name Phone Rewrite: ${checks.filter((c) => c.pass).length}/${checks.length} PASS ═══`);
process.exit(failed ? 1 : 0);
