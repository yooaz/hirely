#!/usr/bin/env node
/**
 * P1 — finalResumeData cleanup gate (duplicates + parser garbage).
 */
import {
  applyFinalResumeDataCleanup,
  isParserGarbage,
  sanitizeFinalResumeText,
} from '../core/validation/final-resume-data-cleanup.js';
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

ok(isParserGarbage('id="foo" href="bar"'), 'detects id=/href=');
ok(isParserGarbage('https://instagram.com/yoaz'), 'detects instagram url');
ok(isParserGarbage('utm_source=linkedin'), 'detects tracking param');
ok(sanitizeFinalResumeText('Clean skill') === 'Clean skill', 'keeps clean text');
ok(sanitizeFinalResumeText('href="https://x.com"') === '', 'strips href garbage');

const dirty = normalizeResumeData({
  identity: {
    name: 'Yohann Azancot',
    title: 'Graphic Designer / Illustrator',
    email: 'yoaz@hotmail.fr',
    location: 'Paris',
  },
  summary: 'Designer id=123 href="https://track.example?utm=1"',
  experiences: [
    {
      role: 'Freelance - Independent / Freelance - Independent / Freelance',
      company: '',
      dates: '2011–2022',
      bullets: ['Posters', 'href=https://instagram.com/yoaz'],
    },
    {
      role: 'Freelance',
      company: 'Independent / Freelance',
      dates: '2011–2022',
      bullets: [],
    },
    {
      role: 'Designer',
      company: 'McCann G. Agency',
      dates: '2011–2014',
      bullets: ['Campaigns'],
    },
  ],
  education: [
    'Créapole — Visual Communication — 2008–2011',
    'Créapole - Visual Communication 2008-2011',
    'LISAA — Web & Motion Design — 2011–2012',
    'instagram.com/school href=bad',
    'Creative School Management id=ocr_99',
  ],
  skills: ['Illustration', 'Illustration', 'id=skill'],
  tools: ['Adobe Illustrator', 'utm_campaign=adobe'],
  languages: ['French — native'],
  clients: ['Nike'],
  projects: [],
  unsorted: ['orphan'],
  unknownExperience: ['ghost'],
  _enterprise: { x: 1 },
  meta: {},
});

const built = buildFinalResumeData(dirty);
const fr = built.finalResumeData;

ok(!!fr, 'finalResumeData built');
ok(fr.metaSafe?.finalResumeDataCleanup === 'FINAL_RESUME_DATA_CLEANUP_V1', 'cleanup marker set');

const freelance = (fr.experiences || []).find((e) => /freelance/i.test(e.role));
ok(!!freelance, 'single freelance experience');
ok(freelance?.role === 'Freelance Illustrator / Graphic Designer', 'freelance role canonical');
ok(
  (fr.experiences || []).filter((e) => /freelance|independent/i.test(`${e.role} ${e.company}`)).length === 1,
  'no duplicate freelance rows'
);

const creapole = (fr.education || []).filter(
  (l) => /cr[ée]apole/i.test(l) && /visual communication/i.test(l)
);
ok(creapole.length === 1, 'duplicate education collapsed (school+title+years)');

const eduGarbage = (fr.education || []).some(
  (l) => /instagram|href=|id=|utm_|https?:\/\//i.test(l)
);
ok(!eduGarbage, 'no URLs or parser garbage in education');

const allText = JSON.stringify(fr);
ok(!/instagram\.com/i.test(allText), 'no instagram urls in finalResumeData');
ok(!/\bid\s*=/i.test(allText), 'no id= in finalResumeData');
ok(!/\bhref\s*=/i.test(allText), 'no href= in finalResumeData');
ok(!/\butm_/i.test(allText), 'no tracking params in finalResumeData');
ok(!fr._enterprise, 'no _enterprise leak');
ok(!fr.unknownExperience, 'no unknownExperience leak');

const direct = applyFinalResumeDataCleanup({
  identity: { name: 'Test' },
  summary: '',
  experiences: [
    { role: 'Freelance - Independent / Freelance - Independent', company: '', dates: '2011–2022', bullets: [] },
    { role: 'Freelance', company: 'Independent / Freelance', dates: '2011–2022', bullets: [] },
  ],
  education: [
    'School A — Design — 2010–2012',
    'School A - Design 2010-2012',
  ],
  skills: [],
  tools: [],
  languages: [],
});
ok(direct.experiences.length === 1, 'direct cleanup collapses experience');
ok(direct.education.length === 1, 'direct cleanup collapses education');

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nPASS finalResumeData cleanup gate');
