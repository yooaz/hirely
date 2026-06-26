#!/usr/bin/env node
/**
 * Final rendered CV clean output — display sanitize only (no OCR/import).
 */
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function buildFixture() {
  return {
    identity: {
      name: 'Yohann Azancot',
      title: 'Graphic Designer & Illustrator',
      email: 'yoaz@hotmail.fr',
    },
    summary:
      'Creative professional specializing in illustration, graphic design, packaging, logos and visual identity.',
    experiences: [
      {
        role: 'Freelance Illustrator Graphic Designer packaging designer edition logos posters',
        company: '',
        dates: '2011–2022',
        startDate: '2011',
        endDate: '2022',
        bullets: ['packaging designer edition, logos...'],
      },
      {
        role: 'Designer',
        company: 'McCann G. Agency',
        dates: '2011–2014',
        startDate: '2011',
        endDate: '2014',
        bullets: ['Creative work for campaigns and brand assets.'],
      },
    ],
    education: [
      'LISAA — Web & Motion Design — 2011–2012',
      'Créapole — Visual Communication — 2008–2011',
      'LISAA Web and Motion Design 2011 2012 yoaz@hotmail.fr',
      'École supérieure — Visual Communication — observation maquette',
    ],
    skills: ['Illustration'],
    tools: ['Graphic Designer', 'Illustrator', 'Photoshop', 'InDesign', 'French', 'English', 'native'],
    languages: ['French — native', 'English — fluent'],
    clients: ['Nike'],
    unsorted: [],
  };
}

const out = sanitizeResumeForDisplay(buildFixture());
const freelance = out.experiences?.[0];
const mccann = out.experiences?.[1];

ok(freelance?.role === 'Freelance Illustrator / Graphic Designer', `freelance role (${freelance?.role})`);
ok(freelance?.company === 'Independent / Freelance', `freelance company (${freelance?.company})`);
ok(freelance?.dates === '2011–2022', `freelance dates (${freelance?.dates})`);
ok(
  /^posters,\s*packaging,\s*logos,\s*visual identity\.?$/i.test(
    freelance?.bullets?.[0] || freelance?.description || ''
  ),
  `freelance description (${freelance?.bullets?.[0] || freelance?.description})`
);
ok(!(freelance?.specialties || []).length, 'freelance specialties hidden from render');

ok(mccann?.role === 'Designer', `mccann role (${mccann?.role})`);
ok(/mccann/i.test(mccann?.company || ''), `mccann company (${mccann?.company})`);
ok(
  mccann?.bullets?.[0] === 'Creative work for campaigns and brand assets.',
  `mccann description (${mccann?.bullets?.[0] || mccann?.description})`
);

ok(out.education?.length === 2, `education deduped (${out.education?.length})`);
ok(
  out.education?.every((e) => !/@|observation|maquette/i.test(e)),
  `education clean (${out.education?.join(' | ')})`
);
ok(
  out.education?.some((e) => /LISAA.*Web.*Motion.*2011/i.test(e)),
  'LISAA row present'
);
ok(
  out.education?.some((e) => /Créapole.*Visual Communication.*2008/i.test(e)),
  'Créapole row present'
);

const skillSet = (out.skills || []).map((s) => s.toLowerCase());
ok(skillSet.includes('illustration'), 'skill Illustration');
ok(skillSet.includes('graphic design'), 'skill Graphic Design');
ok(skillSet.includes('packaging'), 'skill Packaging');
ok(skillSet.includes('logo design'), 'skill Logo Design');
ok(skillSet.includes('visual identity'), 'skill Visual Identity');
ok(skillSet.includes('editorial design'), 'skill Editorial Design');

const tools = (out.tools || []).map((t) => t.toLowerCase());
ok(!tools.some((t) => /graphic designer|freelance|designer$/.test(t) && !/indesign/.test(t)), `no roles in tools (${out.tools?.join(', ')})`);
ok(!tools.some((t) => /french|english|native|fluent/.test(t)), `no languages in tools (${out.tools?.join(', ')})`);
ok(tools.includes('adobe illustrator'), 'tool Adobe Illustrator');
ok(tools.includes('photoshop'), 'tool Photoshop');
ok(tools.includes('indesign'), 'tool InDesign');

ok(
  (out.languages || []).some((l) => /french.*native/i.test(l)),
  `French native (${out.languages?.join(', ')})`
);
ok(
  (out.languages || []).some((l) => /english.*fluent/i.test(l)),
  `English fluent (${out.languages?.join(', ')})`
);

if (failed) {
  console.error(`\nqa-final-cv-clean-output: ${failed} failure(s)\n`);
  process.exit(1);
}
console.log('\nqa-final-cv-clean-output: all passed\n');
