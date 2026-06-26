#!/usr/bin/env node
/**
 * P2 — ATS Score V2 realism gate (tier bands + five composite scores).
 */
import { computeRecruiterScoreV2, SCORE_V2_CATEGORIES } from '../core/validation/recruiter-score-v2.js';
import { buildRecruiterPanelMetrics } from '../core/validation/ats-engine.js';
import { resolveChecklistProfile } from '../core/validation/recruiter-checklist-source.js';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const maxSum = Object.values(SCORE_V2_CATEGORIES).reduce((s, c) => s + c.max, 0);
ok(maxSum === 100, `category weights sum to 100 (${maxSum})`);
ok(Object.keys(SCORE_V2_CATEGORIES).length === 9, 'nine V2 categories');

const realCv = {
  name: 'Yohann Azancot',
  title: 'Graphic Designer / Illustrator',
  email: 'yoaz@hotmail.fr',
  phone: '+33 6 49 43 48 39',
  linkedin: 'https://linkedin.com/in/yoaz',
  location: 'Paris',
  summary:
    'Illustrator and graphic designer with 10+ years creating brand identities, packaging, and editorial work for luxury and lifestyle clients.',
  experience: [
    'Freelance Illustrator / Graphic Designer — Independent / Freelance — 2011–2022',
    'Designed posters, packaging, and logos for international brands',
    'Designer — McCann G. Agency — 2011–2014',
    'Led campaign visuals and brand rollouts',
  ],
  education: [
    'Créapole — Visual Communication — 2008–2011',
    'LISAA — Web & Motion Design — 2011–2012',
  ],
  skills: ['Illustration', 'Graphic Design', 'Packaging', 'Logo Design', 'Visual Identity', 'Editorial Design'],
  tools: ['Adobe Illustrator', 'Photoshop', 'InDesign'],
  languages: ['French — native', 'English — fluent'],
};

const averageCv = {
  name: 'Alex Martin',
  title: 'Marketing Coordinator',
  email: 'alex@example.com',
  phone: '',
  location: 'Lyon',
  summary: 'Marketing professional with campaign and social experience.',
  experience: ['Marketing Assistant — Local Agency — 2019–2021', 'Supported email campaigns and events'],
  education: ['Bachelor Marketing — 2019'],
  skills: ['Social media', 'Email marketing', 'Copywriting'],
  tools: ['Canva'],
  languages: [],
};

const poorCv = {
  name: '',
  title: '',
  email: '',
  phone: '',
  experience: [],
  education: [],
  skills: [],
  tools: [],
  languages: [],
};

function assertFiveScores(result, label) {
  const panel = buildRecruiterPanelMetrics(result);
  ok(panel.overall >= 0 && panel.overall <= 100, `${label} overall 0–100 (${panel.overall})`);
  ok(panel.content >= 0 && panel.content <= 100, `${label} content 0–100 (${panel.content})`);
  ok(panel.experience >= 0 && panel.experience <= 100, `${label} experience 0–100 (${panel.experience})`);
  ok(panel.readability >= 0 && panel.readability <= 100, `${label} readability 0–100 (${panel.readability})`);
  ok(panel.ats >= 0 && panel.ats <= 100, `${label} ats 0–100 (${panel.ats})`);
  ok(result.scores?.overall === result.total, `${label} scores.overall matches total`);
}

const real = computeRecruiterScoreV2(realCv);
const avg = computeRecruiterScoreV2(averageCv);
const poor = computeRecruiterScoreV2(poorCv);

assertFiveScores(real, 'real');
assertFiveScores(avg, 'average');
assertFiveScores(poor, 'poor');

ok(real.total >= 80 && real.total <= 95, `real CV band 80–95 (${real.total})`);
ok(avg.total >= 60 && avg.total <= 80, `average CV band 60–80 (${avg.total})`);
ok(poor.total < 60, `poor CV below 60 (${poor.total})`);

ok(real.total > avg.total, `real > average (${real.total} > ${avg.total})`);
ok(avg.total > poor.total, `average > poor (${avg.total} > ${poor.total})`);

ok(real.checks.email && real.checks.phone && real.checks.linkedin, 'real CV rewards contact');
ok(real.checks.summary, 'real CV rewards summary');
ok(poor.penalties?.length >= 2, 'poor CV has penalties');

const messy = computeRecruiterScoreV2({
  ...realCv,
  experience: [
    'Freelance - Independent / Freelance - Independent / Freelance — 2011–2022',
    'Freelance - Independent / Freelance - Independent / Freelance — 2011–2022',
  ],
});
ok(messy.total < real.total, `duplicate content penalized (${messy.total} < ${real.total})`);

const noDates = computeRecruiterScoreV2({
  ...averageCv,
  experience: ['Marketing Assistant — Local Agency', 'Supported email campaigns'],
});
ok(noDates.total <= avg.total, `missing dates penalized (${noDates.total} <= ${avg.total})`);

const yoazProfile = resolveChecklistProfile({
  finalResumeData: {
    identity: {
      name: 'Yohann Azancot',
      title: 'Graphic Designer / Illustrator',
      email: 'yoaz@hotmail.fr',
      phone: '+33 6 49 43 48 39',
      location: 'Paris',
    },
    summary:
      'Illustrator and graphic designer specializing in brand identity, packaging, and editorial design for lifestyle clients.',
    experiences: [
      {
        role: 'Freelance Illustrator / Graphic Designer',
        company: 'Independent / Freelance',
        dates: '2011–2022',
        bullets: ['Posters, packaging, logos'],
      },
      { role: 'Designer', company: 'McCann G. Agency', dates: '2011–2014', bullets: ['Campaigns'] },
    ],
    education: ['Créapole — Visual Communication — 2008–2011', 'LISAA — Web & Motion Design — 2011–2012'],
    skills: ['Illustration', 'Graphic Design', 'Packaging', 'Logo Design', 'Visual Identity', 'Editorial Design'],
    tools: ['Adobe Illustrator', 'Photoshop', 'InDesign'],
    languages: ['French — native', 'English — fluent'],
    quality: {},
    metaSafe: {},
  },
});
const yoazScore = computeRecruiterScoreV2(yoazProfile);
ok(yoazScore.total >= 80 && yoazScore.total <= 95, `checklist profile real CV band (${yoazScore.total})`);
ok((yoazProfile.experience || []).length >= 1, 'checklist profile keeps experience lines for ATS');

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nPASS ATS Score V2 realism gate');
