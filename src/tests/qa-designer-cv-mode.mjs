#!/usr/bin/env node
/**
 * P1 — DESIGNER_CV_MODE QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DESIGNER_CV_MODE,
  DESIGNER_MODE_TARGET_ROLES,
  DESIGNER_PRIORITY_SECTIONS,
  DESIGNER_SECTION_WEIGHTS,
  DESIGNER_ATS_ADJUSTMENTS,
  detectDesignerTriggerRoles,
  detectDesignerCvMode,
  applyDesignerSectionWeight,
  scoreDesignerCreativeSectionsH8,
  applyDesignerAtsAdjustments,
} from '../core/parsing/designer-cv-mode.js';
import { confidenceForSection } from '../core/parsing/section-sanity.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { buildResumeData, resumeDataToCvData } from '../core/resume-data.js';
import { computeAtsQualityH8 } from '../core/validation/ats-quality-h8.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const DESIGNER_FIXTURE = path.join(ROOT, 'tests/fixtures/designer-cv-rich.txt');
const CREATIVE_FIXTURE = path.join(ROOT, 'tests/fixtures/creative-cv/fixture.txt');
const DEV_FIXTURE = path.join(ROOT, 'tests/fixtures/developer-cv/fixture.txt');
const OUT = path.join(ROOT, 'tests/output/designer-cv-mode/report.json');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

for (const role of DESIGNER_MODE_TARGET_ROLES) {
  ok(detectDesignerTriggerRoles(`Senior ${role}`).includes(role), `detects role: ${role}`);
}

const designerText = fs.readFileSync(DESIGNER_FIXTURE, 'utf8');
const mode = detectDesignerCvMode(designerText);
ok(mode.active === true, 'designer fixture activates DESIGNER_CV_MODE');
ok(mode.mode === DESIGNER_CV_MODE, 'mode id');
ok(mode.triggerRoles.includes('Brand Designer') || mode.triggerRoles.includes('UI Designer'), 'brand/ui roles');
ok(mode.deemphasizeCorporateAts === true, 'deemphasize corporate ATS');
ok(DESIGNER_PRIORITY_SECTIONS.length === 5, 'five priority sections');

const baseClients = confidenceForSection('Nike, Adobe, Spotify', 'clients');
const boostedClients = confidenceForSection('Nike, Adobe, Spotify', 'clients', { designerMode: mode });
ok(boostedClients.confidence > baseClients.confidence, `clients weight boost ${baseClients.confidence}→${boostedClients.confidence}`);

const parsed = runSectionEngineV2(designerText, { rawText: designerText });
ok(parsed.designerMode?.active === true, 'section engine returns designerMode');
ok(Boolean(parsed.structured?.metadata?.designerCvMode), 'metadata designerCvMode present');
ok(parsed.structured?.metadata?.designerCvMode?.active === true, 'metadata designerCvMode active');
ok(parsed.structured?.metadata?.parseMode === DESIGNER_CV_MODE, 'parseMode is DESIGNER_CV_MODE');

const rd = buildResumeData({
  importResult: { resumeData: parsed.structured },
  structured: parsed.structured,
  rawText: designerText,
  cleanedText: designerText,
});
ok(rd.meta?.designerMode?.active === true, 'resumeData.meta.designerMode');
ok((rd.clients || []).length >= 2, `resumeData clients ${(rd.clients || []).length}`);
ok((rd.projects || []).length >= 1 || (rd.awards || []).length >= 1, 'creative sections populated');

const cv = resumeDataToCvData(rd);
const atsDesigner = computeAtsQualityH8(cv, { resumeData: rd });
ok(atsDesigner.archetype === 'designer', 'ATS archetype designer');
ok(atsDesigner.deemphasizeCorporateAts === true, 'ATS deemphasizeCorporateAts flag');
ok(atsDesigner.atsReadiness?.designerDampened === true, 'ATS readiness dampened');
ok(
  atsDesigner.atsReadiness.score <= 80,
  `dampened ats readiness ${atsDesigner.atsReadiness.score} (factor ${DESIGNER_ATS_ADJUSTMENTS.corporateReadinessFactor})`
);

const creativeText = fs.readFileSync(CREATIVE_FIXTURE, 'utf8');
const creativeParsed = runSectionEngineV2(creativeText, { rawText: creativeText });
ok(creativeParsed.designerMode?.active === true, 'creative-cv activates designer (Graphic Designer)');

const devText = fs.existsSync(DEV_FIXTURE) ? fs.readFileSync(DEV_FIXTURE, 'utf8') : '';
if (devText) {
  const devParsed = runSectionEngineV2(devText, { rawText: devText });
  ok(devParsed.designerMode?.active !== true, 'developer CV does not activate designer mode');
  const devRd = buildResumeData({
    importResult: { resumeData: devParsed.structured },
    structured: devParsed.structured,
    rawText: devText,
    cleanedText: devText,
  });
  const devCv = resumeDataToCvData(devRd);
  const atsDev = computeAtsQualityH8(devCv, { resumeData: devRd });
  ok(atsDev.archetype !== 'designer' || !devRd.meta?.designerMode?.active, 'developer not designer archetype');
  if (atsDesigner.atsReadiness && atsDev.atsReadiness) {
    ok(
      atsDesigner.atsReadiness.score < atsDev.atsReadiness.score,
      `designer ATS readiness (${atsDesigner.atsReadiness.score}) < corporate (${atsDev.atsReadiness.score})`
    );
  }
}

const normCv = {
  title: 'Brand Designer',
  clients: ['Nike', 'Adobe', 'Spotify'],
  projects: ['Campaign A', 'Campaign B'],
  portfolioLinks: ['Behance — https://behance.net/alex'],
  awards: ['D&AD Pencil'],
  exhibitions: ['Galerie Perrotin'],
  experience: [],
  education: [],
  skills: ['Branding', 'UI Design'],
};
const creativeScore = scoreDesignerCreativeSectionsH8(normCv, mode);
ok(creativeScore.points >= 6, `designer creative section score ${creativeScore.points}`);

const dummyAts = {
  score: 70,
  total: 70,
  breakdown: [
    { id: 'experience', points: 18, max: 24 },
    { id: 'education', points: 6, max: 10 },
    { id: 'skills', points: 8, max: 12 },
    { id: 'summary', points: 4, max: 8 },
  ],
  atsReadiness: { score: 85 },
  strengths: [],
  penalties: [],
};
const adjusted = applyDesignerAtsAdjustments(dummyAts, mode, normCv);
ok((adjusted.designerCreative?.points || 0) >= 6, 'designer creative bonus applied');
ok(adjusted.atsReadiness.score < dummyAts.atsReadiness.score, 'corporate readiness dampened');

ok(applyDesignerSectionWeight(80, 'clients', mode) === Math.min(98, Math.round(80 * DESIGNER_SECTION_WEIGHTS.clients)), 'section weight math');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      feature: 'DESIGNER_CV_MODE',
      generatedAt: new Date().toISOString(),
      mode: DESIGNER_CV_MODE,
      targetRoles: DESIGNER_MODE_TARGET_ROLES,
      prioritySections: DESIGNER_PRIORITY_SECTIONS,
      sectionWeights: DESIGNER_SECTION_WEIGHTS,
      atsAdjustments: DESIGNER_ATS_ADJUSTMENTS,
      designerMode: mode,
      atsDesigner: {
        score: atsDesigner.score,
        atsReadiness: atsDesigner.atsReadiness?.score,
        archetype: atsDesigner.archetype,
      },
      resumeClients: rd.clients,
      pipelineWired: Boolean(parsed.structured?.metadata?.designerCvMode),
      pass: failed === 0,
    },
    null,
    2
  )
);

console.log(failed ? '\nFAIL designer-cv-mode' : '\nPASS designer-cv-mode');
process.exit(failed ? 1 : 0);
