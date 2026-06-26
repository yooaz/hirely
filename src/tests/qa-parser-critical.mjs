#!/usr/bin/env node
/**
 * Critical parser: minimal creative CV (no name header, French sections).
 */
import { loadHirelyParse } from './load-hirely-parse.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const MINIMAL_CREATIVE = `Graphic Designer & Illustrator

CLIENTS
Converse · Louis Vuitton · Cadillac

FORMATION
Créapole Creation School Management - Multisectoral Year2007 - 2009Visual Communication

COMPÉTENCES
Graphic Design · Digital Art.

OUTILS
Photoshop · Illustrator · InDesign · After Effects · Affinity Designer · Procreate

Freelance Graphic Designer & Illustrator
2011–Present
Worked across illustration, branding, editorial design and visual communication.`;

const Parse = await loadHirelyParse();
const pipe = await Parse.runExtractionPipeline(MINIMAL_CREATIVE, { extractionMethod: 'docx' });
const d = pipe.validatedCVData || {};

assert(d.experience?.length >= 1, `experience missing: ${JSON.stringify(d.experience)}`);
assert(/freelance|designer|illustrator/i.test((d.experience || []).join(' ')), 'experience role missing');
assert(!/Year2007/.test((d.education || []).join(' ')), `education glue: ${d.education}`);
assert((d.education || []).length >= 2, `education should be split: ${JSON.stringify(d.education)}`);
assert(/Créapole/i.test((d.education || []).join(' ')), 'school name missing');
assert(/2007/.test((d.education || []).join(' ')), 'education years missing');
assert(/designer|illustrator/i.test(d.title || MINIMAL_CREATIVE.split('\n')[0]), `bad title: ${d.title}`);
assert(
  (d.skills?.length || 0) + (d.tools?.length || 0) >= 2,
  'skills/tools too empty'
);
assert((d.clients?.length || 0) >= 1, 'clients missing');

const usedChars =
  JSON.stringify(d).length +
  (d.unsorted || []).join('').length;
assert(usedChars > 80, 'CV structurally empty');

console.log('OK parser critical', {
  name: d.name,
  title: d.title,
  exp: d.experience?.length,
  edu: d.education,
});
