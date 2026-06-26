#!/usr/bin/env node
/**
 * P0 — all visible UI reads finalResumeData only.
 * node src/tests/qa-final-data-source.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { normalizeResumeData } from '../core/resume-data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');

const errors = [];
function pass(msg) {
  console.log('OK', msg);
}
function fail(msg) {
  errors.push(msg);
  console.error('FAIL', msg);
}

function fnBody(html, fnName) {
  const idx = html.indexOf(`function ${fnName}`);
  if (idx < 0) return '';
  const rest = html.slice(idx);
  const next = rest.indexOf('\nfunction ', 1);
  const body = next > 0 ? rest.slice(0, next) : rest;
  return body
    .split('\n')
    .filter((line) => !line.includes('DEBUG_MODE') && !line.includes('never state.'))
    .join('\n');
}

const UI_SURFACES = [
  'renderCVInner',
  'getFinalCvData',
  'getChecklistCvData',
  'buildStudioSuggestionsPayload',
  'collectProductSuggestions',
  'renderSuggestionsPanel',
  'computeProductScoreReport',
  'getCoverLetterCvData',
  'renderOutputs',
  'prepareLockedCvExport',
  'downloadPDF',
  'downloadTXT',
  'emailCV',
  'renderRecruiterReview',
  'renderSimpleIssues',
  'renderVerifyStatusAside',
  'getToClassifyItems',
  'isWorkspaceReady',
];

const FORBIDDEN_IN_UI = [
  { re: /\bstate\.rawText\b/, label: 'state.rawText' },
  { re: /\bstate\.cleanText\b/, label: 'state.cleanText' },
  { re: /\bstate\.structuredResume\b/, label: 'state.structuredResume' },
  { re: /\bstate\.cvData\b/, label: 'state.cvData' },
  { re: /\bstate\.resumeData\b/, label: 'state.resumeData' },
  { re: /\.unsorted\b/, label: 'unsorted direct' },
];

for (const fn of UI_SURFACES) {
  const body = fnBody(indexHtml, fn);
  if (!body) {
    fail(`missing UI function ${fn}`);
    continue;
  }
  pass(`surface ${fn}`);
  for (const rule of FORBIDDEN_IN_UI) {
    if (rule.re.test(body)) {
      fail(`${fn} reads forbidden ${rule.label}`);
    } else {
      pass(`${fn} no ${rule.label}`);
    }
  }
}

if (!indexHtml.includes('function finalResumeDisplayToResumeData')) {
  fail('finalResumeDisplayToResumeData missing');
} else pass('finalResumeDisplayToResumeData helper');

const getFinalChunk = fnBody(indexHtml, 'getFinalCvData');
if (!getFinalChunk.includes('getFinalResumeData()')) {
  fail('getFinalCvData must read getFinalResumeData()');
} else pass('getFinalCvData derives from finalResumeData');

const classifyChunk = fnBody(indexHtml, 'getToClassifyItems');
if (!/\.suggestions/.test(classifyChunk) || /\.unsorted/.test(classifyChunk)) {
  fail('getToClassifyItems must use finalResumeData.suggestions only');
} else pass('getToClassifyItems uses suggestions');

const built = buildFinalResumeData(
  normalizeResumeData({
    identity: { name: 'Alex', title: 'Designer', email: 'a@b.com', phone: '', location: '' },
    summary: 'Designer.',
    experiences: [{ role: 'Designer', company: 'Studio', dates: '2020', bullets: ['Work.'] }],
    education: ['School — Design — 2018'],
    skills: ['Figma'],
    tools: ['Photoshop'],
    languages: [],
    clients: [],
    projects: [],
    unsorted: ['orphan line'],
    meta: { rawText: 'secret', cleanedText: 'secret' },
  })
);

if (!built.finalResumeData?.suggestions?.length && built.finalResumeData?.unsorted) {
  fail('finalResumeData should expose suggestions not unsorted');
} else pass('finalResumeData uses suggestions field');

if (built.finalResumeData?.meta?.rawText) fail('finalResumeData leaked meta.rawText');
else pass('finalResumeData has no meta.rawText');

if (errors.length) {
  console.error(`\nqa-final-data-source FAILED (${errors.length})`);
  process.exit(1);
}
console.log('\nqa-final-data-source PASSED');
