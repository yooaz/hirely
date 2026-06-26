#!/usr/bin/env node
/**
 * P1 — final CV human readability gate (finalResumeData only).
 */
import {
  FINAL_CV_READABILITY,
  applyFinalCvReadabilityPass,
} from '../core/validation/final-cv-readability.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { normalizeResumeData } from '../core/resume-data.js';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

ok(FINAL_CV_READABILITY === 'FINAL_CV_READABILITY_V1', 'engine version');

const messy = applyFinalCvReadabilityPass({
  identity: {
    name: 'Yohann Zancot EDUCATION',
    title: 'Graphic Designer Illustrator',
    email: 'y@test.com',
    phone: '+33 6 12 34 56 78',
    location: 'Paris',
  },
  summary: 'Creative profile wustrator and packaging.',
  experiences: [
    {
      role: 'Freelance Illustrator and Graphic',
      company: 'Independent / Freelance — Independent / Freelance',
      dates: '2011–2022 — 2011–2022',
      bullets: ['Posters, packaging, logos'],
    },
    {
      role: 'Designer — McCann G. Agency — 2011–2014',
      company: '',
      dates: '',
      bullets: [],
    },
    {
      role: 'Designer',
      company: 'McCann',
      dates: '2011-2014',
      bullets: ['Campaigns'],
    },
  ],
  education: [
    'Creative School Management',
    'Creative School Management observation maquette',
    'LISAA web motion 2011 2012',
    'Créapole',
    'Créapole — Visual Communication — 2008–2011',
    'Créapole — Visual Communication — 2008/2011',
  ],
  skills: ['Illustration', 'packaging', 'wustrator', 'Logo Design', 'Graphic Design'],
  tools: ['Adobe Illustrator', 'photoshop', 'InDesign me]', 'mustrator'],
  languages: ['French native', 'english fluent'],
  clients: ['McCann', 'Random Agency XYZ', 'Nike'],
  projects: [],
  suggestions: ['EDUCATION', 'v3 2 gradric'],
  quality: {},
  metaSafe: {},
});

ok(!/education/i.test(messy.identity?.name || ''), 'no section label in header name');
ok(!messy.education.some((l) => /creative school management/i.test(l)), 'Creative School Management dropped without degree');
ok(messy.education.some((l) => /lisaa/i.test(l) && /web\s*&\s*motion/i.test(l)), 'LISAA formatted');
ok(messy.education.some((l) => /créapole/i.test(l) && /visual communication/i.test(l)), 'Créapole formatted');
ok(
  messy.education.filter((l) => /créapole/i.test(l) && /visual communication/i.test(l)).length === 1,
  'no duplicate Créapole date ranges'
);

const freelance = messy.experiences.find((e) => /freelance/i.test(e.role));
const mccann = messy.experiences.find((e) => /mccann/i.test(e.company));
ok(!!freelance, 'freelance experience kept');
ok(freelance?.role === 'Freelance Illustrator / Graphic Designer', 'freelance role readable');
ok(freelance?.company === 'Independent / Freelance', 'freelance company readable');
ok(freelance?.dates === '2011–2022', 'freelance dates single range');
ok(
  (freelance?.bullets || []).some((b) => /posters|packaging|logos/i.test(b)),
  'freelance bullets preserved from source'
);
ok(!!mccann, 'mccann experience kept');
ok(mccann?.role === 'Designer', 'mccann role readable');
ok(mccann?.company === 'McCann G. Agency', 'mccann company readable');
ok(!/—.*—.*—/.test(`${mccann?.role} ${mccann?.dates}`), 'no duplicate date ranges in experience');

ok(
  messy.skills.join('|').includes('Illustration') &&
    messy.skills.join('|').includes('Graphic Design') &&
    messy.skills.join('|').includes('Packaging'),
  'skills canonical'
);
ok(!messy.skills.some((s) => /wustrator/i.test(s)), 'no OCR in skills');

ok(
  messy.tools.includes('Adobe Illustrator') &&
    messy.tools.includes('Photoshop') &&
    messy.tools.includes('InDesign'),
  'tools canonical'
);
ok(!messy.tools.some((t) => /mustrator|me\]/i.test(t)), 'no OCR in tools');

ok(
  messy.languages.some((l) => /^French — native$/i.test(l)) &&
    messy.languages.some((l) => /^English — fluent$/i.test(l)),
  'languages readable'
);

ok(!messy.clients.some((c) => /random agency/i.test(c)), 'no hallucinated client');
ok(!messy.clients.some((c) => /^mccann$/i.test(c)), 'employer not listed as client');

const built = buildFinalResumeData(
  normalizeResumeData({
    identity: {
      name: 'Yohann Zancot',
      title: 'Graphic Designer / Illustrator',
      email: 'y@test.com',
      phone: '+33 6 12 34 56 78',
      location: 'Paris',
    },
    summary: 'Illustrator and graphic designer.',
    experiences: [
      {
        role: 'Freelance Illustrator and Graphic',
        company: 'Independent',
        dates: '2011–2022',
        bullets: ['Posters, packaging, logos, editorial illustration'],
      },
      { role: 'Designer', company: 'McCann G. Agency', dates: '2011–2014', bullets: ['Campaigns'] },
    ],
    education: [
      'Creative School Management',
      'LISAA — Web & Motion Design — 2011–2012',
      'Créapole — Visual Communication — 2008–2011',
    ],
    skills: ['Illustration', 'Graphic Design', 'Packaging', 'Logo Design', 'Visual Identity', 'Editorial Design'],
    tools: ['Adobe Illustrator', 'Photoshop', 'InDesign'],
    languages: ['French — native', 'English — fluent'],
    clients: ['Nike'],
    projects: [],
    unsorted: [],
    meta: {},
  })
);

const fr = built.finalResumeData;
ok(!!fr, 'buildFinalResumeData produces finalResumeData');
ok(fr?.metaSafe?.finalCvReadability === FINAL_CV_READABILITY, 'readability stamp on metaSafe');
ok(built.contract?.renderable, 'CV still renderable after readability pass');

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll final CV readability checks passed.');
