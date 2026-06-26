#!/usr/bin/env node
/**
 * P0 — contact phone extraction accuracy (strict mode, confidence gate 85).
 */
import {
  normalizeContactPhone,
  extractPhoneCandidate,
  validatePhoneStrict,
  phoneHasYearOrDatePollution,
  PHONE_DISPLAY_CONFIDENCE_MIN,
} from '../core/parsing/phone-normalize.js';
import { normalizePhone } from '../core/parsing/line-cleaner.js';
import { detectContactInfo } from '../core/parsing/rich-parser.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';

const checks = [];
const ok = (name, pass, detail = '') => checks.push({ name, pass, detail });
const fail = (name, detail) => ok(name, false, detail);

const polluted = '+33649434839 20';
const norm = normalizeContactPhone(polluted);
ok('polluted not displayed', !norm.phone, `got ${norm.phone}`);
ok('polluted flagged review', norm.reviewRequired === true);
ok('polluted low confidence', norm.confidence < PHONE_DISPLAY_CONFIDENCE_MIN);

const yearRange = '+33649434839 2011-2020';
const normRange = normalizeContactPhone(yearRange);
ok('year range not displayed', !normRange.phone, `got ${normRange.phone}`);

ok('reject bare year range as phone', !validatePhoneStrict('2011-2020'));
ok('email stays separate', !extractPhoneCandidate('john@example.com +33649434839 20')?.includes('@'));

const blob = 'Yohann Azancot\nyohann@example.com\n+33649434839\nParis';
const contact = detectContactInfo(blob, blob.split('\n'), {});
ok('detectContactInfo clean phone', contact.phone === '+33649434839', `got ${contact.phone}`);
ok('detectContactInfo keeps email', contact.email === 'yohann@example.com');

const built = buildFinalResumeData(
  {
    identity: { name: 'Test User', phone: polluted, email: 'a@b.fr' },
    summary: 'Product designer with ten years of experience building B2B SaaS products across Europe.',
    experiences: [{ role: 'Designer', company: 'Acme', startDate: '2020', endDate: 'Present', bullets: ['Led brand'] }],
    education: ['School — Design — 2015'],
    skills: ['Branding'],
    tools: [],
    languages: [],
    unsorted: [],
    meta: {},
  },
  {}
);
ok(
  'polluted phone hidden from CV',
  !built.finalResumeData?.identity?.phone,
  `got ${built.finalResumeData?.identity?.phone}`
);
const hasReview = (built.reviewItems || []).some((r) => r.field === 'identity.phone' || r.section === 'contact');
ok('uncertain phone → reviewQueue', hasReview, `review count ${(built.reviewItems || []).length}`);

const cleanBuilt = buildFinalResumeData(
  {
    identity: { name: 'Test User', phone: '+33649434839', email: 'a@b.fr' },
    summary: 'Product designer with ten years of experience building B2B SaaS products across Europe.',
    experiences: [{ role: 'Designer', company: 'Acme', startDate: '2020', endDate: 'Present', bullets: ['Led brand'] }],
    education: ['School — Design — 2015'],
    skills: ['Branding'],
    tools: [],
    languages: [],
    unsorted: [],
    meta: {},
  },
  {}
);
ok('clean phone displayed', cleanBuilt.finalResumeData?.identity?.phone === '+33649434839');

ok('normalizePhone helper', normalizePhone('+33649434839') === '+33649434839');
ok('reject corrupt ocr phone', !validatePhoneStrict('+336434343830'));

const pass = checks.every((c) => c.pass);
for (const c of checks) {
  console.log(`${c.pass ? 'OK' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
}
console.log(pass ? '\nCONTACT_PHONE_ACCURACY_PASS' : '\nCONTACT_PHONE_ACCURACY_FAIL');
process.exit(pass ? 0 : 1);
