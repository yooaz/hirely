#!/usr/bin/env node
/**
 * H5 recruiter quality audit — deterministic checks, no hallucination.
 */
import { auditRecruiterQuality, collectExperienceRows } from '../core/validation/recruiter-quality-audit.js';
import { runRecruiterAudit } from '../core/validation/recruiter-audit.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const goodCv = {
  name: 'Marie Dupont',
  title: 'Product Designer',
  email: 'marie@example.com',
  phone: '+33 6 12 34 56 78',
  linkedin: 'https://linkedin.com/in/marie',
  location: 'Paris',
  summary: 'Senior product designer with 8 years building B2B SaaS products for global teams.',
  experience: [
    'Lead Designer — Acme Corp · 2020–Present',
    'Increased checkout conversion by 24% through UX research',
    'Senior Designer — Beta Inc · 2017–2020',
    'Built design system adopted by 12 product teams',
  ],
  education: ['Master Design — ENSAD · 2014'],
  skills: ['Figma', 'Research', 'Prototyping', 'Accessibility'],
};

const weakCv = {
  name: 'Jean Test',
  email: '',
  phone: '',
  experience: ['Designer at Studio', 'Designer at Studio', 'Short line'],
  education: [],
  skills: [],
};

ok(auditRecruiterQuality(null).hallucinationSafe === true, 'null cvData safe');
ok(auditRecruiterQuality(goodCv).hallucinationSafe === true, 'hallucinationSafe flag');

const goodAudit = auditRecruiterQuality(goodCv);
ok(goodAudit.checks.length === 6, 'six quality checks');
ok(goodAudit.checks.find((c) => c.id === 'missing_contact')?.status === 'ok', 'good CV contact ok');
ok(goodAudit.checks.find((c) => c.id === 'ats_compatibility')?.status === 'ok', 'good CV ATS ok');

const weakAudit = auditRecruiterQuality(weakCv);
ok(weakAudit.checks.find((c) => c.id === 'missing_contact')?.status === 'fail', 'weak CV contact fail');
ok(weakAudit.checks.find((c) => c.id === 'missing_dates')?.status !== 'ok', 'undated experience flagged');
ok(weakAudit.checks.find((c) => c.id === 'duplicate_roles')?.count >= 1, 'duplicate roles detected');
ok(weakAudit.fixes.length >= 2, 'actionable fixes generated');

const rows = collectExperienceRows({
  experiences: [
    { role: 'PM', company: 'Acme', startDate: '2018', endDate: '2020' },
    { role: 'Lead', company: 'Beta', startDate: '2022', endDate: 'Present' },
  ],
});
ok(rows.length === 2, 'structured experiences collected');
const gapAudit = auditRecruiterQuality({ ...goodCv, experience: [], experiences: rows });
ok(gapAudit.checks.find((c) => c.id === 'timeline_gaps')?.count >= 1, 'timeline gap 2020→2022');

const merged = runRecruiterAudit(goodCv);
ok(merged.checks?.length === 6, 'runRecruiterAudit exposes checks');
ok(merged.fixes?.length >= 0, 'runRecruiterAudit exposes fixes');
ok(merged.hallucinationSafe === true, 'audit bundle hallucination safe');

const r1 = auditRecruiterQuality(goodCv);
const r2 = auditRecruiterQuality(goodCv);
ok(
  JSON.stringify(r1.checks.map((c) => c.status)) === JSON.stringify(r2.checks.map((c) => c.status)),
  'deterministic check statuses'
);

process.exit(failed ? 1 : 0);
