#!/usr/bin/env node
/**
 * P0 — no SANITIZED_COUNTS spam + recruiter-ready Yoaz OCR display.
 * node src/tests/qa-render-loop-final-cv.mjs
 */
import { readFileSync } from 'fs';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { resumeDataToCvData } from '../core/resume-data.js';
import { computeProductScore } from '../core/validation/product-score.js';
import {
  resetRenderPipelineTrace,
  logRenderPipelineCounts,
  getRenderPipelineLogCount,
} from '../core/runtime/render-pipeline-trace.js';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const text = readFileSync('tests/fixtures/yoaz-pdf-live/ocr-fragmented.txt', 'utf8');
resetRenderPipelineTrace(1);
const imp = await runHirelyImportFromText(text, { source: 'paste', trusted: true, forceContinue: true });
const before = {
  experiences: imp.resumeData?.experiences?.length || 0,
  education: imp.resumeData?.education?.length || 0,
  skills: imp.resumeData?.skills?.length || 0,
  tools: imp.resumeData?.tools?.length || 0,
};
console.log('BEFORE_COUNTS', before);

resetRenderPipelineTrace(2);
const built = buildFinalResumeData(imp.resumeData);
const sanitizedOnce = getRenderPipelineLogCount('SANITIZED_COUNTS');
for (let i = 0; i < 5; i++) {
  resumeDataToCvData(built.finalResumeData, { skipNormalize: true });
  logRenderPipelineCounts('TEMPLATE_COUNTS', built.cvData);
}
ok(sanitizedOnce <= 1, `SANITIZED_COUNTS max once per import (got ${sanitizedOnce})`);
ok(
  getRenderPipelineLogCount('TEMPLATE_COUNTS') <= 1,
  `TEMPLATE_COUNTS max once per session (got ${getRenderPipelineLogCount('TEMPLATE_COUNTS')})`
);

const rd = built.finalResumeData;
const after = {
  experiences: rd?.experiences?.length || 0,
  education: rd?.education?.length || 0,
  skills: rd?.skills?.length || 0,
  tools: rd?.tools?.length || 0,
};
console.log('AFTER_COUNTS', after);

const freelance = rd?.experiences?.[0];
const mccann = rd?.experiences?.[1];
ok(after.experiences === 2, `2 experiences (got ${after.experiences})`);
ok(
  freelance?.role === 'Freelance Illustrator / Graphic Designer',
  `freelance role (${freelance?.role})`
);
ok(freelance?.company === 'Independent / Freelance', `freelance company (${freelance?.company})`);
ok(/2011.*2022/.test(freelance?.dates || ''), `freelance dates (${freelance?.dates})`);
ok(
  /^posters,\s*packaging,\s*logos,\s*visual identity\.?$/i.test(freelance?.bullets?.[0] || ''),
  `freelance bullets (${freelance?.bullets?.[0]})`
);
ok(mccann?.role === 'Designer', `mccann role (${mccann?.role})`);
ok(/mccann/i.test(mccann?.company || ''), `mccann company (${mccann?.company})`);

ok(after.education <= 2, `education max 2 (got ${after.education})`);
ok(
  (rd?.education || []).every((e) => !/observation|maquette|school management/i.test(e)),
  `education clean (${(rd?.education || []).join(' | ')})`
);

const skillSet = (rd?.skills || []).map((s) => s.toLowerCase());
ok(skillSet.includes('illustration'), 'skill illustration');
ok(skillSet.includes('graphic design'), 'skill graphic design');
ok(!skillSet.some((s) => /photograph|movies/.test(s)), 'no photograph skill');

const tools = (rd?.tools || []).map((t) => t.toLowerCase());
ok(tools.includes('adobe illustrator') && tools.includes('photoshop') && tools.includes('indesign'), `tools (${rd?.tools?.join(', ')})`);
ok(!tools.some((t) => /french|english|native|designer$/.test(t) && !/indesign/.test(t)), 'tools clean');

const score = computeProductScore(built.cvData, { finalResumeData: rd });
const total = Number(score?.total || score?.score || 0);
ok(total >= 90, `score >= 90 (got ${total})`);

if (failed) {
  console.error(`\nqa-render-loop-final-cv: ${failed} failure(s)\n`);
  process.exit(1);
}
console.log('\nqa-render-loop-final-cv: PASS\n');
