#!/usr/bin/env node
/**
 * UNIVERSAL_SAFETY_GATE — resumeData validated before render.
 */
import {
  applyUniversalSafetyGate,
  assertUniversalSafetyGate,
  UNIVERSAL_SAFETY_GATE,
} from '../core/validation/universal-safety-gate.js';
import { normalizeResumeData } from '../core/resume-data.js';
import {
  NAME_UNCERTAIN_LABEL,
  TITLE_UNCERTAIN_LABEL,
} from '../core/parsing/parser-recovery.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const dirty = {
  identity: {
    name: 'Print Logo Vector Art Reading',
    title: 'Music, Movies, Nature',
    phone: '2011-2022',
    email: 'test@example.com',
  },
  experiences: [
    { role: '30-year old Illustrator And Graphic', company: '', startDate: '2011', endDate: '2022', dates: '2011–2022', bullets: [] },
    { role: 'Music', company: '', startDate: '2010', endDate: '2011', dates: '2010–2011', bullets: [] },
    { role: 'Designer', company: 'Créapole', startDate: '2008', endDate: '2010', dates: '2008–2010', bullets: [] },
    { role: 'Freelance Illustrator', company: 'Independent / Freelance', startDate: '2011', endDate: '2022', dates: '2011–2022', bullets: [] },
  ],
  education: ['Music, Movies, Nature', 'Créapole — Visual Communication / Product Design'],
  unsorted: [],
};

const gated = applyUniversalSafetyGate(dirty);
ok(gated.identity.name === NAME_UNCERTAIN_LABEL, 'fake name → Nom à confirmer');
ok(gated.identity.title === TITLE_UNCERTAIN_LABEL, 'invalid title → Poste à compléter');
ok(gated.identity.phone === '', 'date range removed from phone');
ok(
  !gated.experiences.some((e) => /year old|music|créapole/i.test(`${e.role} ${e.company}`)),
  'no garbage experiences'
);
ok(gated.experiences.length === 1, 'valid freelance experience kept');
ok(/freelanc/i.test(gated.experiences[0].role), 'freelance role preserved');
ok(gated.unsorted.length >= 4, 'invalid content moved to unsorted');
ok(gated.education.some((e) => /créapole/i.test(e)), 'valid education kept');
ok(!gated.education.some((e) => /^music/i.test(e)), 'skills not in education');

const check = assertUniversalSafetyGate(gated);
ok(check.ok, `safety gate clean (${check.failures.join(', ') || 'none'})`);

const normalized = normalizeResumeData(dirty);
ok(normalized.meta?.safetyGate === UNIVERSAL_SAFETY_GATE, 'normalizeResumeData applies safety gate');
ok(normalized.identity.name === NAME_UNCERTAIN_LABEL, 'normalize path fixes name');

const fakePhoneCases = ['2007 2009', '2011-2022', '2011 — 2022'];
for (const phone of fakePhoneCases) {
  const r = applyUniversalSafetyGate({ identity: { phone }, experiences: [], education: [], unsorted: [] }, { silent: true });
  ok(!r.identity.phone, `fake phone removed: ${phone}`);
}

const engineSample = `
30-year old Illustrator and Graphic Designer
2011-2022
Freelancer Illustrator
Independent / Freelance
Music
Créapole
Product Design
`;
const engine = runSectionEngineV2(engineSample, { rawText: engineSample });
const rd = normalizeResumeData({
  identity: {
    name: engine.structured?.identity?.name || 'Print Logo Vector Art Reading',
    title: engine.structured?.identity?.title || 'Music',
    phone: '2011-2022',
  },
  experiences: engine.structured?.experiences || [],
  education: engine.structured?.education || [],
  unsorted: engine.structured?.unsorted || [],
});
ok(!/year old|^\s*music\s*$/i.test(rd.identity.name), 'engine path: no fake name');
ok(!rd.identity.phone, 'engine path: no date as phone');
ok(
  !rd.experiences.some((e) => /music|créapole|product design|year old/i.test(`${e.role} ${e.company}`)),
  'engine path: no skill/school as experience'
);

console.log('\nUNIVERSAL_SAFETY_GATE QA OK', {
  experiences: gated.experiences.length,
  unsorted: gated.unsorted.length,
  education: gated.education.length,
});
