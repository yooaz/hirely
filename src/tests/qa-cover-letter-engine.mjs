#!/usr/bin/env node
/**
 * HIRELY P4 — Cover letter engine QA.
 */
import {
  COVER_LETTER_ENGINE,
  COVER_LETTER_TONES,
  LETTER_TONE_IDS,
  buildCoverLetterDraft,
  buildCoverLetterFromResumeData,
  buildCoverLetterFromFinalResumeData,
  resumeDataToLetterProfile,
  validateCoverLetterInputs,
  auditCoverLetterFacts,
  resolveCoverLetterTone,
} from '../core/export/cover-letter-engine.js';
import { renderCoverLetter, LETTER_TONES } from '../core/export/cover-letter-renderer.js';
import { validateLetterPdfExport } from '../core/export/letter-exporter.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const RESUME_DATA = {
  identity: {
    name: 'Yohann Azancot',
    title: 'Graphic Designer & Illustrator',
    email: 'yoaz@hotmail.fr',
  },
  summary:
    'Creative professional specializing in illustration, graphic design and visual storytelling.',
  experiences: [
    {
      role: 'Freelance Illustrator / Graphic Designer',
      company: 'Independent',
      dates: '2011–2022',
      bullets: ['Posters, packaging, logos for Nike, Louis Vuitton, Marvel.'],
    },
    {
      role: 'Designer',
      company: 'McCann G. Agency',
      dates: '2011–2014',
      bullets: ['Campaign creative for international clients.'],
    },
  ],
  skills: ['Illustration', 'Graphic Design', 'Visual Identity', 'Poster Design'],
  tools: ['Photoshop', 'Illustrator', 'InDesign'],
  clients: ['Nike', 'Louis Vuitton', 'Marvel'],
  education: ['Créapole — Visual Communication'],
  languages: ['French — native', 'English — fluent'],
  projects: [],
  unsorted: [],
  meta: {},
};

const FINAL_RESUME = {
  identity: RESUME_DATA.identity,
  summary: RESUME_DATA.summary,
  experiences: RESUME_DATA.experiences,
  skills: RESUME_DATA.skills,
  tools: RESUME_DATA.tools,
  clients: RESUME_DATA.clients,
  education: RESUME_DATA.education,
  languages: RESUME_DATA.languages,
  projects: [],
  suggestions: [],
  metaSafe: {},
};

const profile = resumeDataToLetterProfile(RESUME_DATA);
ok(profile?.experience?.length >= 1, 'resumeDataToLetterProfile preserves experience lines');

ok(LETTER_TONES.length === 3, 'three production tones');
ok(LETTER_TONE_IDS.length === 3, 'three tone ids');
ok(Object.keys(COVER_LETTER_TONES).length === 3, 'three tone definitions');

for (const tone of LETTER_TONES) {
  const fr = renderCoverLetter(profile, {
    jobTitle: 'Senior Graphic Designer',
    companyName: 'Adobe',
    lang: 'fr',
    tone,
  });
  const en = renderCoverLetter(profile, {
    jobTitle: 'Senior Graphic Designer',
    companyName: 'Adobe',
    lang: 'en',
    tone,
  });
  ok(fr?.text?.length > 80, `${tone} FR letter generated`);
  ok(en?.text?.length > 80, `${tone} EN letter generated`);
  ok(fr.text.includes('Senior Graphic Designer'), `${tone} FR mentions job title`);
  ok(fr.text.includes('Adobe'), `${tone} FR mentions company`);
  ok(fr.text.includes('Yohann Azancot'), `${tone} FR uses identity`);
  ok(fr.meta.engine === COVER_LETTER_ENGINE, `${tone} engine tag`);
  ok(fr.meta.tone === tone, `${tone} tone in meta`);
  ok(fr.html?.includes('coverLetterPreviewBody'), `${tone} HTML preview`);

  const audit = auditCoverLetterFacts(fr, profile);
  ok(audit.ok, `${tone} experience lines grounded in resume`);

  const pdfReady = validateLetterPdfExport(fr.text);
  ok(pdfReady.ok, `${tone} PDF export text ready (${pdfReady.charCount} chars)`);
}

const fromResume = buildCoverLetterFromResumeData(RESUME_DATA, {
  jobTitle: 'Art Director',
  companyName: 'Nike',
  tone: 'professional',
  lang: 'en',
});
ok(fromResume?.text?.length > 80, 'resumeData path generates letter');
ok(fromResume.text.includes('Nike'), 'resumeData letter mentions company');
ok(fromResume.text.includes('Art Director'), 'resumeData letter mentions job title');

const fromFinal = buildCoverLetterFromFinalResumeData(FINAL_RESUME, {
  jobTitle: 'Art Director',
  companyName: 'Nike',
  tone: 'executive',
  lang: 'en',
});
ok(fromFinal?.text?.length > 80, 'finalResumeData path generates letter');
ok(/leadership|strategic/i.test(fromFinal.text), 'executive tone uses leadership register');

const incomplete = validateCoverLetterInputs(
  { name: 'Test', title: '', experience: [], skills: [] },
  { jobTitle: '' }
);
ok(!incomplete.ok, 'incomplete profile fails validation');

const generic = buildCoverLetterDraft(profile, { tone: 'professional', lang: 'fr' });
ok(generic?.text?.length > 80, 'generic letter without job/company');
ok(/candidature spontanée/i.test(generic.text), 'generic FR opening');
ok(generic.meta.genericApplication === true, 'genericApplication flag');

const legacyFormal = renderCoverLetter(profile, {
  jobTitle: 'Designer',
  style: 'formal',
  lang: 'en',
});
ok(legacyFormal?.meta.tone === 'professional', 'formal alias → professional');

const legacyCorp = renderCoverLetter(profile, {
  jobTitle: 'Designer',
  style: 'corporate',
  lang: 'en',
});
ok(legacyCorp?.meta.tone === 'executive', 'corporate alias → executive');

ok(resolveCoverLetterTone('ats') === 'executive', 'ats alias → executive');

const creative = buildCoverLetterDraft(profile, {
  jobTitle: 'Senior Illustrator',
  companyName: 'Louis Vuitton',
  tone: 'creative',
  lang: 'en',
});
ok(creative.text.includes('Louis Vuitton'), 'creative mentions target company only');
ok(!/\bGoogle\b|\bMicrosoft\b/.test(creative.text), 'no invented employers');

if (failed) {
  process.exitCode = 1;
  console.error(`\n${failed} check(s) failed`);
} else {
  console.log('\nqa-cover-letter-engine: PASS');
}
