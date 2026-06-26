#!/usr/bin/env node
/**
 * P3 — LinkedIn optimizer gate (finalResumeData only, no fake AI).
 */
import {
  LINKEDIN_OPTIMIZER,
  buildLinkedInOptimization,
  formatLinkedInOptimizationText,
  isFinalResumeDataInput,
} from '../core/export/linkedin-optimizer.js';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const yoaz = {
  identity: {
    name: 'Yohann Azancot',
    title: 'Graphic Designer / Illustrator',
    email: 'yoaz@hotmail.fr',
    phone: '+33 6 49 43 48 39',
    linkedin: 'https://linkedin.com/in/yoaz',
    location: 'Paris',
  },
  summary:
    'Illustrator and graphic designer with 10+ years creating brand identities, packaging, and editorial work for lifestyle clients.',
  experiences: [
    {
      role: 'Freelance Illustrator / Graphic Designer',
      company: 'Independent / Freelance',
      dates: '2011–2022',
      bullets: ['Posters, packaging, and logos for international brands'],
    },
    {
      role: 'Designer',
      company: 'McCann G. Agency',
      dates: '2011–2014',
      bullets: ['Campaign visuals and brand rollouts'],
    },
  ],
  education: ['Créapole — Visual Communication — 2008–2011', 'LISAA — Web & Motion Design — 2011–2012'],
  skills: ['Illustration', 'Graphic Design', 'Packaging', 'Logo Design', 'Visual Identity', 'Editorial Design'],
  tools: ['Adobe Illustrator', 'Photoshop', 'InDesign'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Nike'],
  quality: {},
  metaSafe: {},
};

const thin = {
  identity: { name: 'Alex Martin', title: 'Coordinator', email: 'alex@example.com' },
  summary: 'Marketing coordinator.',
  experiences: [],
  education: [],
  skills: ['Social media'],
  tools: [],
  languages: [],
  quality: {},
  metaSafe: {},
};

ok(isFinalResumeDataInput(yoaz), 'accepts finalResumeData');
ok(!isFinalResumeDataInput(null), 'rejects null');
ok(!isFinalResumeDataInput({ name: 'Raw', experience: ['x'] }), 'rejects cvData shape');
ok(!isFinalResumeDataInput({ identity: {}, meta: { rawText: 'ocr leak' } }), 'rejects raw OCR meta');

const opt = buildLinkedInOptimization(yoaz);
ok(!!opt, 'builds optimization');
ok(opt.version === LINKEDIN_OPTIMIZER, 'version tag');
ok(opt.source === 'finalResumeData', 'source is finalResumeData');
ok(/Graphic Designer/i.test(opt.headline), 'headline uses CV title');
ok(opt.headline.length <= 220, 'headline within LinkedIn limit');
ok(opt.about.includes(yoaz.summary.slice(0, 24)), 'about derived from summary');
ok(!/lorem ipsum|as an ai|chatgpt|placeholder/i.test(opt.about), 'no fake AI about text');
ok(opt.topSkills.length >= 3, 'top skills populated');
ok(opt.topSkills.every((s) => [...yoaz.skills, ...yoaz.tools].includes(s)), 'top skills from CV only');
ok(opt.recruiterKeywords.length >= 3, 'recruiter keywords extracted');
ok(opt.strength.score >= 60 && opt.strength.score <= 100, `strength score realistic (${opt.strength.score})`);
ok(Array.isArray(opt.missingKeywords), 'missing keywords list');
ok(Array.isArray(opt.suggestions) && opt.suggestions.length >= 1, 'suggestions present');
ok(opt.suggestions.every((s) => s.text && !/as an ai/i.test(s.text)), 'suggestions are rule-based');

const corpus = JSON.stringify(yoaz).toLowerCase();
for (const kw of opt.recruiterKeywords) {
  const hit =
    corpus.includes(kw.toLowerCase()) ||
    ROLE_KEYWORD_ALLOWED(kw, yoaz);
  ok(hit, `keyword grounded in CV (${kw})`);
}

const thinOpt = buildLinkedInOptimization(thin);
ok(thinOpt.strength.score < opt.strength.score, 'thin profile scores lower');
ok(thinOpt.suggestions.length >= 2, 'thin profile gets suggestions');
ok(thinOpt.missingKeywords.length >= thinOpt.recruiterKeywords.length - 1, 'thin profile shows missing keywords');

const text = formatLinkedInOptimizationText(opt);
ok(/CURRENT STRENGTH:/i.test(text), 'formatted output shows strength');
ok(/MISSING KEYWORDS/i.test(text), 'formatted output shows missing keywords');
ok(/OPTIMIZATION SUGGESTIONS/i.test(text), 'formatted output shows suggestions');

const r1 = buildLinkedInOptimization(yoaz);
const r2 = buildLinkedInOptimization(yoaz);
ok(r1.headline === r2.headline && r1.about === r2.about, 'deterministic output');

function ROLE_KEYWORD_ALLOWED(kw, data) {
  const title = (data.identity?.title || '').toLowerCase();
  const allowed = ['designer', 'illustrator', 'graphic', 'illustration', 'creative', 'coordinator'];
  return allowed.some((a) => kw.toLowerCase().includes(a) || title.includes(a));
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nPASS LinkedIn optimizer gate');
