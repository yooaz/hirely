#!/usr/bin/env node
/**
 * P0 — Experience & education reliability acceptance.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  EXPERIENCE_EDUCATION_RELIABILITY_V1,
  auditExperienceReliability,
  auditEducationReliability,
  enforceExperienceEducationReliability,
  experienceHasExplicitDateOrCurrent,
} from '../core/validation/experience-education-reliability.js';
import { auditFakeExperience } from '../core/validation/fake-experience-gate.js';
import { parseInternshipLine } from '../core/parsing/classification-fixes.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import { resumeDataToCvData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/experience-education-reliability');
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

record('version', EXPERIENCE_EDUCATION_RELIABILITY_V1 === 'EXPERIENCE_EDUCATION_RELIABILITY_V1');

const acceptanceCases = [
  {
    id: 'fake_internship_present',
    exp: { role: 'Designer', company: 'Internship', dates: '2010–Present', endDate: 'Present' },
    reject: true,
  },
  { id: 'fake_profil', exp: { role: 'Profil!', company: 'X', dates: '2011–2023' }, reject: true },
  { id: 'fake_brace_internship', exp: { role: '{Internship}', company: 'Nike', dates: '2018' }, reject: true },
  {
    id: 'fake_company_only',
    exp: { role: '', company: 'Nike', bullets: [] },
    reject: true,
  },
  {
    id: 'valid_freelance',
    exp: {
      role: 'Freelance Illustrator',
      company: 'Independent',
      dates: '2011–2022',
      startDate: '2011',
      endDate: '2022',
    },
    reject: false,
  },
];

for (const c of acceptanceCases) {
  const src = [c.exp.role, c.exp.company, c.exp.dates].filter(Boolean).join(' — ');
  const audit = auditExperienceReliability(c.exp, src);
  record(c.id, audit.fake === c.reject, audit.reason || 'ok');
}

record(
  'parse_internship_no_guessed_present',
  parseInternshipLine('Designer — Internship — 2010-Present') === null
);
record(
  'parse_internship_requires_real_company',
  parseInternshipLine('Internship at Nike 2018-2019')?.company !== 'Internship'
);

const dupGate = enforceExperienceEducationReliability({
  experiences: [
    {
      role: 'Lead Brand Designer',
      company: 'Studio A',
      dates: '2018–2020',
      startDate: '2018',
      endDate: '2020',
      confidence: 90,
    },
    {
      role: 'Senior Motion Illustrator',
      company: 'Studio B',
      dates: '2018–2020',
      startDate: '2018',
      endDate: '2020',
      confidence: 90,
    },
  ],
  education: [],
});
record(
  'reject_duplicate_dates',
  dupGate.resumeData.experiences.length === 1 && dupGate.review.length >= 1
);

record('education_requires_school_or_degree', !auditEducationReliability('random hobby line').accept);
record('education_accepts_school', auditEducationReliability('CREAPOLE — Graphic Design — 2018').accept);

record(
  'explicit_date_requires_source',
  !experienceHasExplicitDateOrCurrent(
    { dates: '2010–Present', endDate: 'Present' },
    'Designer at Studio'
  )
);

async function pipeline(raw, source) {
  const imported = await runHirelyImportFromText(raw, { source, extractionMethod: 'paste' });
  const sanitized = sanitizeResumeForDisplay(imported?.resumeData || {});
  const built = buildFinalResumeData(sanitized, {
    silent: true,
    rawText: raw,
    existingReview: imported?.reviewQueue || [],
  });
  return { built, fr: built.finalResumeData || sanitized };
}

const profilCv = await pipeline(
  ['Profil!', 'Graphic Designer', 'designer@test.com', 'Experience', 'Profil! — summary line'].join('\n'),
  'qa-exp-edu-profil'
);
const expText = (profilCv.fr?.experiences || [])
  .map((e) => [e.role, e.company, e.dates].filter(Boolean).join(' — '))
  .join(' | ');
record('pipeline_no_profil_job', !/profil!?/i.test(expText), expText || '(none)');

const clientCv = await pipeline(
  [
    'Sophie Martin',
    'sophie@test.com',
    'Experience',
    'Nike',
    'Delivered creative work for seasonal campaigns.',
  ].join('\n'),
  'qa-exp-edu-client-only'
);
const clientExp = (clientCv.fr?.experiences || []).map((e) => e.company).join(',');
record('pipeline_no_client_only_job', !/^nike$/i.test(clientExp.trim()), clientExp || '(none)');

const goodCv = await pipeline(
  [
    'Sophie Martin',
    'Graphic Designer',
    'sophie@studio.fr',
    'Experience',
    'Designer — Studio Azur — Paris — 2019 – Present',
    'Led brand campaigns for retail clients.',
    'Education',
    'CREAPOLE — Graphic Design — 2015 – 2018',
  ].join('\n'),
  'qa-exp-edu-good'
);
record(
  'pipeline_keeps_real_job',
  (goodCv.fr?.experiences || []).some((e) => /designer/i.test(e.role || '') && /studio/i.test(e.company || ''))
);
record(
  'pipeline_keeps_education',
  (goodCv.fr?.education || []).some((e) => /cr[eéèêë]apole/i.test(String(e)))
);

const T = loadHirelyTemplates();
const html = String(T.render(resumeDataToCvData(goodCv.fr), 'ats') || '');
record('render_no_fake_internship', !/\{Internship\}|Internship\s*—\s*2010/i.test(html));
record('render_no_profil_experience', !/profil!/i.test(html));

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  version: EXPERIENCE_EDUCATION_RELIABILITY_V1,
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  acceptance: {
    no_fake_internship_present: checks.find((c) => c.id === 'fake_internship_present')?.pass,
    no_profil_in_preview: checks.find((c) => c.id === 'pipeline_no_profil_job')?.pass,
    no_brace_internship: checks.find((c) => c.id === 'fake_brace_internship')?.pass,
    no_company_promoted: checks.find((c) => c.id === 'pipeline_no_client_only_job')?.pass,
    real_jobs_kept: checks.find((c) => c.id === 'pipeline_keeps_real_job')?.pass,
  },
  summary: { total: checks.length, pass: checks.filter((c) => c.pass).length, fail: failed },
  checks,
};
fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

console.log(`\n═══ Experience Education Reliability: ${report.summary.pass}/${report.summary.total} PASS ═══`);
process.exit(failed ? 1 : 0);
