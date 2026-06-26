#!/usr/bin/env node
/**
 * Generate FINAL_RESUME_CONTRACT_REPORT.md
 * node scripts/final-resume-contract-report.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  FINAL_RESUME_CONTRACT_VERSION,
  FINAL_RESUME_PIPELINE,
  buildFinalResumeData,
} from '../src/core/validation/final-resume-contract.js';
import { normalizeResumeData } from '../src/core/resume-data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gate = spawnSync('node', ['src/tests/qa-final-resume-contract.mjs'], {
  cwd: root,
  encoding: 'utf8',
});
const gateOk = gate.status === 0;

let gateReport = {};
try {
  gateReport = JSON.parse(
    readFileSync(join(root, 'tests/output/final-resume-contract/report.json'), 'utf8')
  );
} catch {
  gateReport = { pass: false, errors: ['report.json missing'] };
}

const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');

const uiSurfaces = [
  { name: 'CV preview', fn: 'renderCV', source: 'getFinalCvData() + isFinalResumeValid()' },
  { name: 'Suggestions / Smart Repair', fn: 'buildStudioSuggestionsPayload', source: 'getFinalCvData() + finalResumeData.unsorted' },
  { name: 'ATS score', fn: 'computeProductScoreReport', source: 'getChecklistCvData() ← getFinalResumeData()' },
  { name: 'Cover letter', fn: 'getCoverLetterCvData', source: 'getFinalCvData()' },
  { name: 'PDF export', fn: 'downloadPDF', source: 'renderCV() ← getFinalCvData()' },
  { name: 'Recruiter review', fn: 'renderRecruiterReview', source: 'getChecklistCvData() ← finalResumeData' },
];

function fnUses(html, fnName, needle) {
  const idx = html.indexOf(`function ${fnName}`);
  if (idx < 0) return false;
  return html.slice(idx, idx + 3000).includes(needle);
}

const surfaceRows = uiSurfaces.map((s) => {
  const wired =
    fnUses(indexHtml, s.fn, 'getFinalCvData') ||
    fnUses(indexHtml, s.fn, 'getFinalResumeData') ||
    fnUses(indexHtml, s.fn, 'getChecklistCvData') ||
    fnUses(indexHtml, s.fn, 'isFinalResumeValid');
  return { ...s, wired };
});

const sampleText = `Alex Martin
Product Designer
alex@hirely.test · +41 79 000 00 00
Zürich

Experience
Studio X — Lead Designer — 2019 – Present
Shipped design systems.

Education
ZHdK — MA Design — 2015 – 2017

Skills
Figma · Prototyping · Research`;
const built = buildFinalResumeData(
  normalizeResumeData({
    identity: {
      name: 'Alex Martin',
      title: 'Product Designer',
      email: 'alex@hirely.test',
      phone: '+41 79 000 00 00',
      location: 'Zürich',
    },
    summary: 'Product designer shipping design systems.',
    experiences: [
      {
        role: 'Lead Designer',
        company: 'Studio X',
        dates: '2019 – Present',
        bullets: ['Shipped design systems.'],
      },
    ],
    education: ['ZHdK — MA Design — 2015 – 2017'],
    skills: ['Figma', 'Prototyping', 'Research'],
    tools: [],
    languages: [],
    clients: [],
    projects: [],
    unsorted: [],
    meta: { cleanedText: sampleText, rawText: sampleText },
  })
);

const lines = [];
lines.push('# FINAL RESUME CONTRACT REPORT');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Contract version: **${FINAL_RESUME_CONTRACT_VERSION}**`);
lines.push(`Gate status: **${gateOk ? 'PASS' : 'FAIL'}**`);
lines.push('');
lines.push('## Mission');
lines.push('');
lines.push('Single UI read surface: `finalResumeData`. No visible section reads raw OCR, raw extraction, debug graph, or parser internals directly.');
lines.push('');
lines.push('### P1 strict sections');
lines.push('');
lines.push('Allowed on final display: `identity`, `summary`, `experiences`, `education`, `skills`, `tools`, `languages`, `clients`, `projects`.');
lines.push('');
lines.push('Stripped before render: `unknownExperience`, `toClassify`, `unsorted`, `_enterprise`, `_parserReview`, `_extractionReview`.');
lines.push('');
lines.push('## Pipeline');
lines.push('');
lines.push('```');
lines.push(FINAL_RESUME_PIPELINE.join('\n→ '));
lines.push('```');
lines.push('');
lines.push('## Contract validation');
lines.push('');
lines.push('- `buildFinalResumeData(resumeData)` — normalize → sanitize → lock → validate');
lines.push('- `validateFinalResumeContract(finalResumeData)` — section contract + consumer guard + renderability');
lines.push('- Invalid contract → empty CV preview fallback (no partial garbage)');
lines.push('');
lines.push('## UI surfaces');
lines.push('');
lines.push('| Surface | Entry | Data source | Wired |');
lines.push('|---------|-------|-------------|-------|');
for (const row of surfaceRows) {
  lines.push(`| ${row.name} | \`${row.fn}\` | ${row.source} | ${row.wired ? '✓' : '✗'} |`);
}
lines.push('');
lines.push('## Forbidden UI reads (product mode)');
lines.push('');
lines.push('| Source | Status |');
lines.push('|--------|--------|');
const forbidden = [
  { key: 'state.rawText in renderCV', ok: !fnUses(indexHtml, 'renderCV', 'state.rawText') || indexHtml.includes('DEBUG_MODE?String(state.rawText') },
  { key: 'state.structuredResume in renderCV', ok: !fnUses(indexHtml, 'renderCV', 'state.structuredResume') },
  { key: 'resumeDataFromCvData round-trip in applyImportResult', ok: !indexHtml.includes('applyImportResult:resumeDataFromCvData') },
  { key: 'getToClassifyItems reads finalResumeData.unsorted', ok: fnUses(indexHtml, 'getToClassifyItems', 'getFinalResumeData') },
  { key: 'commitResumeData builds finalResumeData', ok: fnUses(indexHtml, 'commitResumeData', 'buildFinalResumeData') },
];
for (const f of forbidden) {
  lines.push(`| ${f.key} | ${f.ok ? 'enforced' : '**violation**'} |`);
}
lines.push('');
lines.push('## Sample build');
lines.push('');
lines.push('```json');
lines.push(
  JSON.stringify(
    {
      contractOk: built.contract?.ok,
      renderable: built.contract?.renderable,
      reasons: built.contract?.reasons,
      cvName: built.cvData?.name,
      sections: built.contract?.sections,
    },
    null,
    2
  )
);
lines.push('```');
lines.push('');
lines.push('## Gate checks');
lines.push('');
if (gateReport.checks?.length) {
  const failed = gateReport.checks.filter((c) => !c.ok);
  lines.push(`- Total checks: ${gateReport.checks.length}`);
  lines.push(`- Passed: ${gateReport.checks.length - failed.length}`);
  lines.push(`- Failed: ${failed.length}`);
  if (failed.length) {
    lines.push('');
    lines.push('Failures:');
    for (const f of failed) lines.push(`- ${f.label}: ${f.detail || ''}`);
  }
} else {
  lines.push('- Gate report unavailable');
}
lines.push('');
lines.push('## Acceptance');
lines.push('');
const allWired = surfaceRows.every((r) => r.wired);
const acceptance = gateOk && allWired && built.contract?.ok;
lines.push(`**${acceptance ? 'PASS' : 'FAIL'}** — All visible sections use \`finalResumeData\` (via \`getFinalResumeData\` / \`getFinalCvData\`).`);
lines.push('');
lines.push('## Files');
lines.push('');
lines.push('- `src/core/validation/final-resume-contract.js` — contract builder + validator (v2 strict strip)');
lines.push('- `src/core/resume-data.js` — `foldParserLeakFields`, `normalizeCvDataForTemplate`');
lines.push('- `index.html` — `commitResumeData`, `getFinalResumeData`, `getFinalCvData`, UI consumers');
lines.push('- `src/tests/qa-final-resume-contract.mjs` — automated gate');
lines.push('- `tests/output/final-resume-contract/report.json` — machine-readable output');

const outPath = join(root, 'FINAL_RESUME_CONTRACT_REPORT.md');
writeFileSync(outPath, lines.join('\n'));
console.log(`Wrote ${outPath}`);
console.log(`Acceptance: ${acceptance ? 'PASS' : 'FAIL'}`);
process.exit(acceptance ? 0 : 1);
