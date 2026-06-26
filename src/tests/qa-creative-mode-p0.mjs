#!/usr/bin/env node
/**
 * Creative mode on P0 block pipeline — first-class sections, no client leak to experience.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runP0Pipeline } from '../core/pipeline/p0-pipeline.js';
import { buildResumeData, resumeDataToCvData } from '../core/resume-data.js';
import {
  CREATIVE_MODE_TARGET_ROLES,
  CREATIVE_FIRST_CLASS_SECTIONS,
  detectTargetCreativeRoles,
} from '../core/parsing/creative-parsing-mode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const CREATIVE_CV = `ALEX MARTIN
Art Director · Motion Designer

SUMMARY
Brand and motion work for global clients.

EXPERIENCE
2020 – Present · Nike — Lead Designer
Campaign systems in Illustrator

CLIENTS
Adobe
Nike
Marvel

PROJECTS
Nike Air Max — motion campaign
Marvel key art — illustration series

AWARDS
D&AD Pencil 2022

EXHIBITIONS
Saatchi Gallery — Group Show 2021

PUBLICATIONS
Featured in Communication Arts

EDUCATION
LISAA — Bachelor Design
`;

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

for (const role of CREATIVE_MODE_TARGET_ROLES) {
  ok(detectTargetCreativeRoles(role).includes(role), `detects role: ${role}`);
}

const result = runP0Pipeline({ rawText: CREATIVE_CV, source: 'paste' });
const mode = result.classifiedBlocks?._creativeMode;
ok(mode?.active === true, 'creative mode active on P0');
ok(mode?.targetRolesDetected?.length >= 1, 'target creative roles detected');

const rd = buildResumeData({
  structured: result.structuredResume,
  rawText: CREATIVE_CV,
  cleanedText: '',
});
const productCv = resumeDataToCvData(rd);
ok(productCv.clients?.length >= 2, 'clients section populated');
ok(productCv.awards?.length >= 1, 'awards section populated (product SSOT)');
ok(productCv.exhibitions?.length >= 1, 'exhibitions section populated (product SSOT)');
ok(productCv.publications?.length >= 1, 'publications section populated (product SSOT)');
ok(productCv.projects?.length >= 1, 'projects section populated');

const expJoined = (productCv.experience || []).join('\n');
ok(!/\bAdobe\b/.test(expJoined) || /Lead Designer/i.test(expJoined), 'Adobe not standalone in experience');
ok(productCv.experience?.some((e) => /Nike/i.test(e) && /Designer/i.test(e)), 'real Nike job kept in experience');

for (const section of CREATIVE_FIRST_CLASS_SECTIONS) {
  ok(Array.isArray(productCv[section]), `cvData has first-class section: ${section}`);
}

const fixturePath = path.join(root, 'tests/fixtures/creative-cv/fixture.txt');
const yoaz = readFileSync(fixturePath, 'utf8');
const yoazResult = runP0Pipeline({ rawText: yoaz, source: 'paste' });
ok(yoazResult.classifiedBlocks?._creativeMode?.active === true, 'yoaz fixture triggers creative mode');
const yoazRd = buildResumeData({
  structured: yoazResult.structuredResume,
  rawText: yoaz,
  cleanedText: '',
});
const yoazCv = resumeDataToCvData(yoazRd);
ok(
  detectTargetCreativeRoles(yoaz).some((r) => /Graphic Designer|Illustrator/i.test(r)),
  'yoaz fixture roles detected'
);
ok((yoazCv.experience || []).length >= 1, 'yoaz keeps freelance experience');

console.log(
  failed
    ? `\n${failed} FAILED`
    : '\nqa-creative-mode-p0: PASS',
  {
    targetRoles: mode?.targetRolesDetected,
    clients: productCv.clients?.length,
    projects: productCv.projects?.length,
    awards: productCv.awards?.length,
  }
);
process.exit(failed ? 1 : 0);
