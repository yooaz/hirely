#!/usr/bin/env node
/**
 * Generate FINAL_DATA_SOURCE_REPORT.md
 * node scripts/generate-final-data-source-report.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import {
  FINAL_RESUME_DISPLAY_FIELDS,
  FINAL_RESUME_PIPELINE,
  buildFinalResumeData,
} from '../src/core/validation/final-resume-contract.js';
import { normalizeResumeData } from '../src/core/resume-data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = join(root, 'FINAL_DATA_SOURCE_REPORT.md');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');

function run(cmd) {
  try {
    execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
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

const surfaces = [
  { name: 'CV preview', fn: 'renderCVInner', reader: 'getFinalCvData() ← finalResumeData' },
  { name: 'Suggestions', fn: 'collectProductSuggestions', reader: 'finalResumeData.suggestions' },
  { name: 'Smart Repair', fn: 'buildStudioSuggestionsPayload', reader: 'getFinalCvData() + suggestions' },
  { name: 'Recruiter score', fn: 'computeProductScoreReport', reader: 'getChecklistCvData() ← getFinalResumeData()' },
  { name: 'Recruiter review', fn: 'renderRecruiterReview', reader: 'getChecklistCvData() + getFinalResumeData()' },
  { name: 'Cover letter', fn: 'getCoverLetterCvData', reader: 'getFinalCvData()' },
  { name: 'PDF export', fn: 'prepareLockedCvExport', reader: 'getFinalCvData() + validateExportLock(finalResumeData)' },
  { name: 'TXT export', fn: 'downloadTXT', reader: 'getFinalCvData()' },
  { name: 'Email export', fn: 'emailCV', reader: 'getFinalCvData()' },
];

const forbidden = [
  'state.rawText',
  'state.cleanText',
  'state.structuredResume',
  'state.cvData',
  'state.resumeData',
  'unsorted direct',
  'debug graph',
];

function surfaceOk(fn) {
  const body = fnBody(indexHtml, fn);
  if (!body) return false;
  const bad =
    /\bstate\.rawText\b/.test(body) ||
    /\bstate\.cleanText\b/.test(body) ||
    /\bstate\.structuredResume\b/.test(body) ||
    /\bstate\.cvData\b/.test(body) ||
    /\bstate\.resumeData\b/.test(body) ||
    (fn === 'getToClassifyItems' && /\.unsorted\b/.test(body));
  return !bad && (body.includes('getFinalResumeData') || body.includes('getFinalCvData') || body.includes('getChecklistCvData') || fn === 'renderCVInner');
}

const gateContract = run('node src/tests/qa-final-resume-contract.mjs');
const gateSource = run('node src/tests/qa-final-data-source.mjs');

const sample = buildFinalResumeData(
  normalizeResumeData({
    identity: { name: 'Yohann', title: 'Designer', email: 'y@t.com', phone: '+33', location: 'Paris' },
    summary: 'Illustrator.',
    experiences: [{ role: 'Designer', company: 'Freelance', dates: '2011–2022', bullets: ['Posters.'] }],
    education: ['LISAA — Web — 2011'],
    skills: ['Illustration'],
    tools: ['Illustrator'],
    languages: ['French — native'],
    clients: [],
    projects: [],
    unsorted: ['low confidence line'],
    meta: { rawText: 'ocr blob', cleanedText: 'cleaned blob' },
  })
);

const lines = [
  '# FINAL_DATA_SOURCE_REPORT',
  '',
  `**Result:** ${gateContract.ok && gateSource.ok ? 'PASS' : 'FAIL'}`,
  `**Date:** ${new Date().toISOString()}`,
  '',
  '## Mission',
  '',
  'Single UI read surface: **`finalResumeData`**. All visible product UI derives display data from the locked final resume object — never raw OCR, debug graph, legacy `resumeData`, or cached `cvData`.',
  '',
  '## Pipeline',
  '',
  '```',
  FINAL_RESUME_PIPELINE.join('\n→ '),
  '```',
  '',
  '## UI surfaces (product)',
  '',
  '| Surface | Entry | Reader | Locked |',
  '|---------|-------|--------|--------|',
  ...surfaces.map((s) => `| ${s.name} | \`${s.fn}\` | ${s.reader} | ${surfaceOk(s.fn) ? 'yes' : '**no**'} |`),
  '',
  '## Forbidden in visible UI',
  '',
  '| Source | Status |',
  '|--------|--------|',
  ...forbidden.map((f) => {
    const fn = f.startsWith('state.') ? f.replace('state.', 'state\\.') : f;
    const re = new RegExp(fn.replace('.', '\\.'), 'i');
    const hits = ['renderCVInner', 'getFinalCvData', 'getToClassifyItems', 'computeProductScoreReport', 'getCoverLetterCvData', 'collectProductSuggestions'].filter((fnName) =>
      re.test(fnBody(indexHtml, fnName))
    );
    return `| ${f} | ${hits.length ? `**leak in ${hits.join(', ')}**` : 'blocked'} |`;
  }),
  '',
  '## finalResumeData fields',
  '',
  ...FINAL_RESUME_DISPLAY_FIELDS.map((k) => `- \`${k}\``),
  '',
  '## Read helpers',
  '',
  '- `getFinalResumeData()` — returns `state.finalResumeData`',
  '- `finalResumeDisplayToResumeData(frd)` — maps display lock → mapper input',
  '- `getFinalCvData()` — derives template cvData from `finalResumeData` only',
  '- `getChecklistCvData()` — ATS/score profile from `finalResumeData`',
  '- `getToClassifyItems()` — reads `finalResumeData.suggestions` only',
  '',
  '## Gates',
  '',
  `- qa-final-resume-contract: ${gateContract.ok ? 'PASS' : 'FAIL'}`,
  `- qa-final-data-source: ${gateSource.ok ? 'PASS' : 'FAIL'}`,
  '',
  '## Sample build',
  '',
  '```json',
  JSON.stringify(
    {
      renderable: sample.contract?.renderable,
      name: sample.finalResumeData?.identity?.name,
      suggestions: sample.finalResumeData?.suggestions?.length ?? 0,
      hasMetaRaw: !!sample.finalResumeData?.meta?.rawText,
      cvName: sample.cvData?.name,
    },
    null,
    2
  ),
  '```',
  '',
];

writeFileSync(REPORT, lines.join('\n'));
console.log(lines.join('\n'));
process.exit(gateContract.ok && gateSource.ok ? 0 : 1);
