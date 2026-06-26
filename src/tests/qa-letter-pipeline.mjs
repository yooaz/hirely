/**
 * Cover letter pipeline — engine, renderer, exporter.
 */
import {
  buildCoverLetterDraft,
  validateCoverLetterInputs,
} from '../core/export/cover-letter-engine.js';
import { renderCoverLetter, LETTER_MODES } from '../core/export/cover-letter-renderer.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('  ✓', msg);
};

const cv = {
  name: 'Yohann Azancot',
  title: 'Graphic Designer & Illustrator',
  email: 'yoaz@hotmail.fr',
  summary:
    'Creative professional specializing in illustration, graphic design and visual storytelling.',
  experience: [
    'Freelance Illustrator / Graphic Designer — Independent · 2011 — Present',
    'Created high-impact illustration work for Nike, Louis Vuitton, Marvel and Adobe.',
  ],
  skills: ['Illustration', 'Graphic Design', 'Visual Identity', 'Poster Design'],
  tools: ['Photoshop', 'Illustrator', 'InDesign'],
  clients: ['Nike', 'Louis Vuitton', 'Marvel'],
};

function testStyles() {
  ok(LETTER_MODES.length === 3, '3 production letter tones');
  for (const mode of LETTER_MODES) {
    const fr = renderCoverLetter(cv, {
      jobTitle: 'Senior Graphic Designer',
      companyName: 'Adobe',
      lang: 'fr',
      mode,
    });
    const en = renderCoverLetter(cv, {
      jobTitle: 'Senior Graphic Designer',
      companyName: 'Adobe',
      lang: 'en',
      mode,
    });
    ok(fr?.text?.length > 80, `${mode} FR letter generated`);
    ok(en?.text?.length > 80, `${mode} EN letter generated`);
    ok(fr.text.includes('Senior Graphic Designer'), `${mode} FR mentions job title`);
    ok(en.text.includes('Senior Graphic Designer'), `${mode} EN mentions job title`);
    ok(fr.text.includes('Yohann Azancot'), `${mode} FR uses CV identity`);
    ok(en.text.includes('Yohann Azancot'), `${mode} EN uses CV identity`);
  }
}

function testDataDriven() {
  const full = buildCoverLetterDraft(cv, {
    jobTitle: 'Art Director',
    companyName: 'Nike',
    lang: 'en',
    tone: 'professional',
  });
  ok(full?.text?.length > 80, 'full CV letter generated');
  ok(full.meta.source === 'cover-letter-engine', 'engine metadata present');
}

function testValidationBlocksHallucination() {
  const incomplete = { name: 'Test', title: '', experience: [], skills: [] };
  const v = validateCoverLetterInputs(incomplete, { targetRole: '', lang: 'fr' });
  ok(!v.ok, 'incomplete CV fails validation');
  ok(v.missing.includes('title'), 'missing title flagged');
  ok(v.missing.includes('experience'), 'missing experience flagged');
  ok(v.missing.includes('skills'), 'missing skills flagged');
  const draft = buildCoverLetterDraft(incomplete, { targetRole: 'Designer', lang: 'en' });
  ok(draft === null, 'engine returns null when validation fails');
  const complete = validateCoverLetterInputs(cv, { targetRole: 'Senior Graphic Designer', lang: 'fr' });
  ok(complete.ok, 'complete CV passes validation');
}

function main() {
  console.log('qa-letter-pipeline');
  testStyles();
  testDataDriven();
  testValidationBlocksHallucination();
  console.log('qa-letter-pipeline: passed');
}

main();
