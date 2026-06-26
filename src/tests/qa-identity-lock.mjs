#!/usr/bin/env node
/**
 * P0 — Identity lock acceptance tests.
 */
import {
  IDENTITY_LOCK_V1,
  IDENTITY_LOCK_CONFIDENCE_MIN,
  IDENTITY_NEEDS_REVIEW_LABEL,
  validatePersonNameStrict,
  validatePhoneIdentityLock,
  validateEmailIdentityLock,
  applyIdentityLock,
  identityLockDisplayValue,
} from '../core/validation/identity-lock.js';
import {
  rejectAsPersonName,
  extractLockedIdentity,
} from '../core/parsing/identity-extraction.js';
import {
  sanitizeEmailOcrArtifacts,
  validateEmailRfcStrict,
} from '../core/validation/email-strictness.js';
import {
  assessIdentityNameStrict,
  enforceIdentityContactStrictness,
  IDENTITY_CONTACT_RULES,
} from '../core/validation/identity-contact-strictness.js';
import { phoneHasYearOrDatePollution } from '../core/parsing/phone-normalize.js';
import { isUncertainIdentityName } from '../core/display/undetected-label.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('PASS', msg);
}

ok(IDENTITY_LOCK_V1 === 'IDENTITY_LOCK_V1', 'version');
ok(IDENTITY_LOCK_CONFIDENCE_MIN === 90, 'confidence min 90');
ok(IDENTITY_NEEDS_REVIEW_LABEL === 'Identity needs review', 'review label');
ok(IDENTITY_CONTACT_RULES.nameConfidenceMin === 90, 'strictness uses 90');
ok(IDENTITY_CONTACT_RULES.identityReviewLabel === IDENTITY_NEEDS_REVIEW_LABEL, 'rules label');

ok(rejectAsPersonName('Lontac Impressions'), 'reject company');
ok(rejectAsPersonName('Marketing Internship'), 'reject internship');
ok(rejectAsPersonName('2010-2013'), 'reject years');
ok(rejectAsPersonName('Jean 42'), 'reject digits');
ok(!rejectAsPersonName('Yohann Azancot'), 'accept real name');

const yoaz = validatePersonNameStrict('Yohann Azancot');
ok(yoaz.valid && yoaz.confidence >= 90, 'yoaz name valid');

const company = validatePersonNameStrict('Lontac Impressions');
ok(!company.valid && company.reason === 'company_or_agency', 'company blocked');

const internship = validatePersonNameStrict('Summer Internship');
ok(!internship.valid, 'internship blocked');

const phoneGood = validatePhoneIdentityLock('+33649434839');
ok(phoneGood.valid && phoneGood.display === '+33649434839', 'phone good');

const phoneYear = validatePhoneIdentityLock('+33649434839 2011-2020');
ok(!phoneYear.valid && phoneHasYearOrDatePollution('+33649434839 2011-2020'), 'phone year pollution');

const phonePage = validatePhoneIdentityLock('+33649434839 Page 2 of 3');
ok(!phonePage.valid, 'phone page pollution');

ok(sanitizeEmailOcrArtifacts('yoaz@@hotmail..fr') === 'yoaz@hotmail.fr', 'email OCR cleanup');
ok(validateEmailRfcStrict('yoaz@hotmail.fr'), 'email RFC valid');
ok(!validateEmailRfcStrict('yoaz@hotmail'), 'email RFC invalid TLD');

const emailGood = validateEmailIdentityLock('yoaz@hotmail.fr', 'Contact: yoaz@hotmail.fr');
ok(emailGood.valid && emailGood.confidence >= 90, 'email grounded');

ok(
  identityLockDisplayValue('Maybe Name', 72, false) === '',
  'low conf clears display (review queue only)'
);
ok(identityLockDisplayValue('Yohann Azancot', 96, true) === 'Yohann Azancot', 'high conf shows value');

const lowName = assessIdentityNameStrict('Lontac Impressions', [{ company: 'Lontac Impressions' }]);
ok(lowName.display === '', 'assess bad name clears CV display');

const locked = applyIdentityLock(
  { name: 'Lontac Impressions', email: 'bad@@mail', phone: '+33649434839 2011-2020' },
  { sourceText: 'yoaz@hotmail.fr\n+33649434839' }
);
ok(locked.needsReview, 'applyIdentityLock needs review');
ok(locked.identity.name === '', 'company name cleared from CV');
ok(locked.identity.phone === '', 'polluted phone cleared');

const headerCv = extractLockedIdentity(
  ['Lontac Impressions', 'Yohann Azancot', 'yoaz@hotmail.fr', '+33649434839'].map((l) => l),
  { experiences: [{ company: 'Lontac Impressions' }] }
);
ok(headerCv.name === 'Yohann Azancot', 'header still picks person name');

const enforced = enforceIdentityContactStrictness(
  { name: 'Lontac Impressions', phone: '+33649434839 2011-2020', email: 'yoaz@hotmail.fr' },
  { sourceText: 'yoaz@hotmail.fr', experiences: [{ company: 'Lontac Impressions' }] }
);
ok(enforced.identity.name === '', 'enforce company clears CV name');
ok(enforced.identity.phone === '', 'enforce strips bad phone');
ok(enforced.reviewItems.length >= 1, 'enforce emits review items');
ok(isUncertainIdentityName(IDENTITY_NEEDS_REVIEW_LABEL), 'review label uncertain');

console.log(`\n═══ Identity Lock: ${failed ? 'FAIL' : 'PASS'} ═══`);
process.exit(failed ? 1 : 0);
