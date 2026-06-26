#!/usr/bin/env node
/**
 * P0 — Person vs company disambiguation QA.
 */
import {
  ENTITY_TYPE,
  PERSON_COMPANY_DISAMBIG_V1,
  classifyEntityType,
  valueMayPopulateIdentityField,
  applyPersonCompanyDisambiguation,
  isCompanyEntity,
} from '../core/parsing/person-company-disambiguation.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { NAME_CONFIRM_LABEL } from '../core/display/identity-labels.js';

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

record('version', PERSON_COMPANY_DISAMBIG_V1 === 'PERSON_COMPANY_DISAMBIGUATION_V1');

const ENTITY_SAMPLES = [
  ['Yohann Azancot', ENTITY_TYPE.PERSON],
  ['Sophie Martin', ENTITY_TYPE.PERSON],
  ['Lontac Impressions', ENTITY_TYPE.COMPANY],
  ['Studio Azur', ENTITY_TYPE.COMPANY],
  ['McCann Agency', ENTITY_TYPE.COMPANY],
  ['LISAA', ENTITY_TYPE.SCHOOL],
  ['Créapole', ENTITY_TYPE.SCHOOL],
  ['Nike', ENTITY_TYPE.CLIENT],
  ['Adobe', ENTITY_TYPE.CLIENT],
  ['Photoshop', ENTITY_TYPE.SKILL],
  ['Illustrator', ENTITY_TYPE.SKILL],
];

for (const [text, expected] of ENTITY_SAMPLES) {
  const c = classifyEntityType(text);
  record(`classify:${text}`, c.type === expected, `got=${c.type}`);
}

record('company_blocks_fullName', !valueMayPopulateIdentityField('Lontac Impressions', 'name'));
record('company_blocks_headline', !valueMayPopulateIdentityField('Lontac Impressions', 'title'));
record('company_blocks_email', !valueMayPopulateIdentityField('Lontac Impressions', 'email'));
record('company_blocks_phone', !valueMayPopulateIdentityField('38 impressions', 'phone'));
record('person_allows_fullName', valueMayPopulateIdentityField('Yohann Azancot', 'name'));
record('client_blocks_fullName', !valueMayPopulateIdentityField('Nike', 'name'));
record('school_blocks_fullName', !valueMayPopulateIdentityField('LISAA', 'name'));
record('skill_blocks_fullName', !valueMayPopulateIdentityField('Photoshop', 'name'));
record('valid_email_allowed', valueMayPopulateIdentityField('yoaz@hotmail.fr', 'email'));
record('valid_phone_allowed', valueMayPopulateIdentityField('+33649434839', 'phone'));

const polluted = applyPersonCompanyDisambiguation({
  identity: {
    name: 'Lontac Impressions',
    title: 'McCann Agency',
    email: 'Studio Yoaz',
    phone: '38 impressions',
  },
  experiences: [{ company: 'Lontac Impressions', role: 'Designer' }],
  meta: {},
});
record(
  'guard_strips_company_name',
  polluted.resumeData.identity.name !== 'Lontac Impressions' &&
    (polluted.resumeData.identity.name === '' || polluted.resumeData.identity.name === NAME_CONFIRM_LABEL),
  `name=${polluted.resumeData.identity.name}`
);
record('guard_strips_company_title', !polluted.resumeData.identity.title);
record('guard_strips_company_email', !polluted.resumeData.identity.email);
record('guard_strips_company_phone', !polluted.resumeData.identity.phone);
record('guard_review_items', polluted.reviewItems.length >= 3);

const LONTAC_CV = [
  'Lontac Impressions',
  'Graphic Designer',
  'designer@email.com',
  '+33612345678',
  'Paris',
  '',
  'Experience',
  'Designer — Lontac Impressions — 2019 – Present',
].join('\n');

const imported = await runHirelyImportFromText(LONTAC_CV, { source: 'qa-person-company-disambig' });
const source = {
  rawText: imported?.rawText || LONTAC_CV,
  cleanedText: imported?.cleanedText || LONTAC_CV,
};
const sanitized = sanitizeResumeForDisplay(imported?.resumeData || {}, source);
const built = buildFinalResumeData(sanitized, {
  existingReview: imported?.reviewQueue || [],
  ...source,
});
const finalName = built.finalResumeData?.identity?.name || sanitized.identity?.name || '';
record('pipeline_no_company_name', !isCompanyEntity(finalName) && !/lontac|impressions/i.test(finalName), `name=${finalName}`);

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

const yoazImport = await runHirelyImportFromText(YOAZ_CV, { source: 'qa-person-company-yoaz' });
const yoazSource = {
  rawText: yoazImport?.rawText || YOAZ_CV,
  cleanedText: yoazImport?.cleanedText || YOAZ_CV,
};
const yoazSan = sanitizeResumeForDisplay(yoazImport?.resumeData || {}, yoazSource);
const yoazBuilt = buildFinalResumeData(yoazSan, {
  existingReview: yoazImport?.reviewQueue || [],
  ...yoazSource,
});
const yoazName = yoazBuilt.finalResumeData?.identity?.name || yoazSan.identity?.name || '';
record('pipeline_keeps_person_name', yoazName === 'Yohann Azancot', `name=${yoazName}`);

console.log(`\n═══ Person Company Disambiguation: ${checks.filter((c) => c.pass).length}/${checks.length} PASS ═══`);
process.exit(failed ? 1 : 0);
