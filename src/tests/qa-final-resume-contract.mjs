#!/usr/bin/env node
/**
 * P0 gate — finalResumeData contract + UI wiring audit.
 * node src/tests/qa-final-resume-contract.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildFinalResumeData,
  validateFinalResumeContract,
  isFinalResumeRenderable,
  FINAL_RESUME_CONTRACT_VERSION,
  FINAL_RESUME_PIPELINE,
  FINAL_RESUME_DISPLAY_FIELDS,
} from '../core/validation/final-resume-contract.js';
import {
  normalizeResumeData,
  normalizeCvDataForTemplate,
  PARSER_LEAK_KEYS,
  STRICT_TEMPLATE_CV_KEYS,
} from '../core/resume-data.js';
import { FORBIDDEN_TEMPLATE_CV_KEYS } from '../core/pipeline/hirely-flow-lock.js';
import {
  validateResumeDataContract,
  validateConsumerDataSource,
} from '../core/validation/resume-data-contract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');

const errors = [];
const checks = [];

function pass(label) {
  checks.push({ label, ok: true });
  console.log(`OK ${label}`);
}

function fail(label, detail) {
  checks.push({ label, ok: false, detail });
  errors.push(`${label}: ${detail}`);
  console.error(`FAIL ${label}: ${detail}`);
}

// --- Core module ---
const sampleText = `Jane Doe
Graphic Designer
jane@example.com · +33 6 12 34 56 78
Paris

Experience
Acme — Senior Designer — 2020 – Present
Led brand systems and packaging.

Education
École ABC — BA Design — 2016 – 2020

Skills
Illustration · Branding · Figma`;

const rd = normalizeResumeData({
  identity: {
    name: 'Jane Doe',
    title: 'Graphic Designer',
    email: 'jane@example.com',
    phone: '+33 6 12 34 56 78',
    location: 'Paris',
  },
  summary: 'Brand and packaging designer.',
  experiences: [
    {
      role: 'Senior Designer',
      company: 'Acme',
      dates: '2020 – Present',
      bullets: ['Led brand systems and packaging.'],
    },
  ],
  education: ['École ABC — BA Design — 2016 – 2020'],
  skills: ['Illustration', 'Branding', 'Figma'],
  tools: [],
  languages: [],
  clients: [],
  projects: [],
  unsorted: [],
  meta: { cleanedText: sampleText, rawText: sampleText },
});
const built = buildFinalResumeData(rd);

if (!built.finalResumeData) fail('buildFinalResumeData', 'null finalResumeData for valid sample');
else pass('buildFinalResumeData produces finalResumeData');

if (!built.cvData) fail('buildFinalResumeData', 'null cvData for valid sample');
else pass('buildFinalResumeData produces cvData');

if (!isFinalResumeRenderable(built.contract)) {
  fail('contract renderable', built.contract?.reasons?.join(', ') || 'not renderable');
} else {
  pass('contract renderable for sample CV');
}

if (built.finalResumeData?.metaSafe?.rawText) fail('metaSafe rawText', 'forbidden key present');
else if (built.finalResumeData?.metaSafe?.cleanedText) fail('metaSafe cleanedText', 'forbidden key present');
else pass('metaSafe strips raw OCR fields');

if (built.finalResumeData?.meta?.rawText) fail('final meta rawText', 'legacy meta leaked');
else pass('finalResumeData has no meta.rawText');

for (const key of FINAL_RESUME_DISPLAY_FIELDS) {
  if (!(key in (built.finalResumeData || {}))) fail(`display field ${key}`, 'missing');
  else pass(`finalResumeData.${key}`);
}

const minimal = buildFinalResumeData(
  normalizeResumeData({
    identity: {
      name: 'Alex Martin',
      email: 'alex@example.com',
      phone: '',
      title: 'Designer',
    },
    summary: '',
    experiences: [{ role: 'Designer', company: 'Studio', dates: '2020–Present', bullets: ['Work.'] }],
    education: [],
    skills: ['Figma'],
    tools: [],
    languages: [],
    clients: [],
    projects: [],
    unsorted: [],
    meta: { rawText: 'secret ocr blob', cleanedText: 'secret cleaned blob' },
  })
);
if (!minimal.finalResumeData || !minimal.cvData) {
  fail('minimal CV without summary/projects', 'null output');
} else {
  pass('minimal CV without summary/projects renders');
}

const warnCheck = validateResumeDataContract(
  {
    identity: { name: 'Test', email: 't@x.com' },
    summary: '',
    experiences: [{ role: 'Dev', company: 'Co', dates: '2020', bullets: [] }],
    education: [],
    skills: ['JS'],
    tools: [],
    languages: [],
    clients: [],
    projects: [],
    unsorted: [],
    meta: { rawText: 'x', cleanedText: 'y' },
  },
  { silent: true, profile: 'final' }
);
const badWarns = warnCheck.warnings.filter(
  (w) =>
    /^CONTRACT_EMPTY_SECTION:(summary|projects)$/.test(w) ||
    /^CONTRACT_FORBIDDEN_ON_RESUME_DATA:meta\./.test(w)
);
if (badWarns.length) fail('no false contract warnings', badWarns.join(', '));
else pass('no false CONTRACT_EMPTY/FORBIDDEN meta warnings');

const invalid = validateFinalResumeContract(null);
if (invalid.ok) fail('validate null', 'expected invalid');
else pass('validate null rejects');

if (FINAL_RESUME_PIPELINE.length !== 7) {
  fail('pipeline stages', `expected 7, got ${FINAL_RESUME_PIPELINE.length}`);
} else {
  pass('pipeline has 7 stages');
}

if (FINAL_RESUME_CONTRACT_VERSION !== 'final-resume-v2') {
  fail('version', FINAL_RESUME_CONTRACT_VERSION);
} else {
  pass('contract version final-resume-v2');
}

const leaky = buildFinalResumeData({
  identity: { name: 'Leak Test', title: 'Designer', email: 'leak@test.com' },
  summary: 'Profile',
  experiences: [{ role: 'Designer', company: 'Co', dates: '2020', bullets: ['Work'] }],
  education: [],
  skills: ['Figma'],
  tools: [],
  languages: [],
  clients: [],
  projects: [],
  unsorted: ['orphan line'],
  unknownExperience: ['Freelance — Studio — 2019'],
  toClassify: [{ id: 'tc-1', text: 'review me', source: 'import', confidence: 40 }],
  _enterprise: { engine: 'test' },
  _parserReview: [{ line: 'x' }],
  _extractionReview: [{ line: 'y' }],
  meta: {},
});
const leakKeys = PARSER_LEAK_KEYS.filter((k) => k in (leaky.finalResumeData || {}));
if (leakKeys.length) fail('parser keys on finalResumeData', leakKeys.join(', '));
else pass('finalResumeData strips parser leak keys');

if (!(leaky.finalResumeData?.suggestions || []).some((s) => /orphan|review|Freelance/i.test(s))) {
  fail('fold parser lines', 'suggestions missing folded content');
} else {
  pass('parser lines folded into suggestions');
}

const leakyCv = normalizeCvDataForTemplate({
  name: 'Leak Test',
  title: 'Designer',
  email: 'leak@test.com',
  experience: ['Designer — Co — 2020'],
  skills: ['Figma'],
  unknownExperience: ['hidden'],
  toClassify: [{ text: 'hidden' }],
  unsorted: ['hidden'],
  _enterprise: { x: 1 },
  _parserReview: [],
  _extractionReview: [],
});
const consumer = validateConsumerDataSource(leakyCv, 'TEMPLATE_TEST', { silent: true });
const forbiddenCv = consumer.violations.filter((v) => /FORBIDDEN_CV_KEY/.test(v));
if (forbiddenCv.length) fail('TEMPLATE_FORBIDDEN_CV_KEY', forbiddenCv.join(', '));
else pass('no TEMPLATE_FORBIDDEN_CV_KEY warnings');

const builtCvKeys = Object.keys(built.cvData || {});
const leakedTemplateKeys = builtCvKeys.filter((k) => FORBIDDEN_TEMPLATE_CV_KEYS.includes(k));
if (leakedTemplateKeys.length) fail('built cvData forbidden keys', leakedTemplateKeys.join(', '));
else pass('built cvData has no forbidden template keys');

const extraCvKeys = builtCvKeys.filter((k) => !STRICT_TEMPLATE_CV_KEYS.includes(k));
if (extraCvKeys.length) fail('built cvData extra keys', extraCvKeys.join(', '));
else pass('built cvData whitelist only');

const sanitizationLeak = normalizeCvDataForTemplate({
  name: 'Sanitize Leak',
  title: 'Designer',
  email: 's@test.com',
  experience: ['Designer — Co — 2030–2035'],
  skills: ['Figma'],
});
const leakConsumer = validateConsumerDataSource(sanitizationLeak, 'TEMPLATE', { silent: true });
const sanitizationForbidden = leakConsumer.violations.filter((v) => /FORBIDDEN_CV_KEY/.test(v));
if (sanitizationForbidden.length) {
  fail('sanitization layer cvData leak', sanitizationForbidden.join(', '));
} else {
  pass('sanitization layer does not re-add forbidden cv keys');
}

// --- index.html UI wiring ---
const requiredFns = [
  'getFinalResumeData',
  'getFinalCvData',
  'isFinalResumeValid',
  'finalResumeData',
  'finalResumeContract',
  'buildFinalResumeData',
];

for (const sym of requiredFns) {
  if (!indexHtml.includes(sym)) fail(`index.html symbol ${sym}`, 'missing');
  else pass(`index.html has ${sym}`);
}

const uiConsumers = [
  { fn: 'renderCV', must: ['getFinalCvData', 'isFinalResumeValid'] },
  { fn: 'getCoverLetterCvData', must: ['getFinalResumeData', 'finalResumeDisplayToResumeData'] },
  { fn: 'getChecklistCvData', must: ['getFinalResumeData'] },
  { fn: 'buildStudioSuggestionsPayload', must: ['getFinalCvData'] },
  { fn: 'computeProductScoreReport', must: ['getFinalResumeData'] },
  { fn: 'commitResumeData', must: ['buildFinalResumeData'] },
];

for (const { fn, must } of uiConsumers) {
  const idx = indexHtml.indexOf(`function ${fn}`);
  if (idx < 0) {
    fail(`consumer ${fn}`, 'function not found');
    continue;
  }
  const chunk = indexHtml.slice(idx, idx + 2500);
  for (const m of must) {
    if (!chunk.includes(m)) fail(`${fn} uses ${m}`, 'not found in function body');
    else pass(`${fn} → ${m}`);
  }
}

// Round-trip removed from applyImportResult
if (indexHtml.includes('applyImportResult:resumeDataFromCvData')) {
  fail('applyImportResult round-trip', 'cvData round-trip still present');
} else {
  pass('applyImportResult has no cvData round-trip');
}

const report = {
  generatedAt: new Date().toISOString(),
  version: FINAL_RESUME_CONTRACT_VERSION,
  pipeline: [...FINAL_RESUME_PIPELINE],
  checks,
  errors,
  sample: {
    contractOk: built.contract?.ok,
    renderable: built.contract?.renderable,
    sections: built.contract?.sections,
    cvName: built.cvData?.name,
  },
  pass: errors.length === 0,
};

import { mkdirSync, writeFileSync } from 'node:fs';
const outDir = join(root, 'tests/output/final-resume-contract');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));

if (errors.length) {
  console.error(`\nqa-final-resume-contract FAILED (${errors.length})`);
  process.exit(1);
}

console.log('\nqa-final-resume-contract PASSED');
process.exit(0);
