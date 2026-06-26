#!/usr/bin/env node
/**
 * P0 — Generate DEDUPE_ENGINE_REPORT.md
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  DEDUPE_ENGINE,
  DEDUPE_SIMILARITY_DEFAULT,
  dedupeEducationStrings,
  dedupeExperienceEntries,
  dedupeStringList,
  dedupeTextLinesBySimilarity,
  semanticSimilarity,
} from '../src/core/parsing/dedupe-engine.js';
import { dedupePlainText } from '../src/core/extraction/extraction-audit.js';
import { dedupeFinalResumeData, auditFinalResumeDuplicates } from '../src/core/validation/dedupe-final-resume.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const OUT_JSON = join(root, 'tests/output/dedupe-engine/report.json');

const gate = spawnSync('node', ['src/tests/qa-dedupe-engine.mjs'], {
  cwd: root,
  encoding: 'utf8',
});
const finalGate = spawnSync('node', ['src/tests/qa-dedupe-final-resume.mjs'], {
  cwd: root,
  encoding: 'utf8',
});
const gateOk = gate.status === 0 && finalGate.status === 0;

const eduSample = dedupeEducationStrings(['Créapole', 'Créapole', 'Creative School Management', 'Creative School Management']);
const expSample = dedupeExperienceEntries([
  { role: 'Freelance', company: '', dates: '', bullets: [] },
  { role: 'Freelance', company: '', dates: '', bullets: [] },
  { role: 'Designer', company: 'Nike', dates: '2019–Present', bullets: [] },
  { role: 'Designer', company: 'Nike', dates: '2019-Present', bullets: ['Campaigns'] },
]);
const entitySample = dedupeStringList(['Nike', 'Nike', 'McCann', 'McCann', 'Adobe Illustrator', 'Adobe Illustrator']);
const ocrSample = dedupeTextLinesBySimilarity([
  'Graphic Designer — Nike — 2019–Present',
  'Graphic Designer - Nike - 2019-Present',
  'Adobe Illustrator',
  'Adobe  Illustrator',
]);
const mergedText = dedupePlainText(
  ['Nike', 'Nike', 'McCann', 'McCann', 'Adobe Illustrator', 'Adobe Illustrator'].join('\n')
);
const frdSample = dedupeFinalResumeData({
  identity: { name: 'Test' },
  education: ['RISD', 'RISD'],
  experiences: [
    { role: 'Designer', company: 'McCann', dates: '2018–2020', bullets: [] },
    { role: 'Designer', company: 'McCann', dates: '2018-2020', bullets: ['Work'] },
  ],
  skills: ['Illustration', 'illustration'],
  tools: ['Adobe Illustrator', 'Adobe Illustrator'],
  languages: [],
  clients: ['Nike', 'Nike'],
  projects: [],
});
const dupAudit = auditFinalResumeDuplicates(frdSample);

mkdirSync(dirname(OUT_JSON), { recursive: true });
writeFileSync(
  OUT_JSON,
  JSON.stringify(
    {
      feature: 'DEDUPE_ENGINE',
      generatedAt: new Date().toISOString(),
      engine: DEDUPE_ENGINE,
      threshold: DEDUPE_SIMILARITY_DEFAULT,
      entitySample,
      ocrSample,
      dupAudit,
      pass: gateOk,
    },
    null,
    2
  )
);

const mccannSim = Math.round(semanticSimilarity('McCann G. Agency', 'McCann G Agency') * 100);

const lines = [];
lines.push('# HIRELY P0 — OCR + Text Dedup Engine');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString()}`);
lines.push(`**Engine:** ${DEDUPE_ENGINE}`);
lines.push(`**Result:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Problem');
lines.push('');
lines.push('`DUPLICATE_TEXT_DETECTED` — OCR text and selectable PDF text were merged, producing duplicate companies, experiences, schools, and skills inside `finalResumeData`.');
lines.push('');
lines.push('## Solution: `dedupeBySimilarity()`');
lines.push('');
lines.push('| Layer | Technique |');
lines.push('|-------|-----------|');
lines.push('| Normalize | trim, collapse spaces, lowercase, accent-fold, date keys |');
lines.push('| Fuzzy | Levenshtein ratio on normalized strings |');
lines.push('| Semantic | token Jaccard overlap + substring containment |');
lines.push('| Structured | experience role + company + dates similarity |');
lines.push('');
lines.push(`Default threshold: **${DEDUPE_SIMILARITY_DEFAULT}** (short tokens: **0.92**)`);
lines.push('');
lines.push('## Acceptance rules');
lines.push('');
lines.push('| Rule | Sample | Result |');
lines.push('|------|--------|--------|');
lines.push(`| Nike + Nike = 1 | clients | ${entitySample.filter((c) => /^nike$/i.test(c)).length} |`);
lines.push(`| McCann + McCann = 1 | clients | ${entitySample.filter((c) => /^mccann$/i.test(c)).length} |`);
lines.push(`| Adobe Illustrator + Adobe Illustrator = 1 | tools | ${entitySample.filter((c) => /adobe illustrator/i.test(c)).length} |`);
lines.push(`| OCR line variant merge | lines | ${ocrSample.length} (from 4) |`);
lines.push(`| Plain text merge | chars removed | ${mergedText.beforeChars - mergedText.afterChars} |`);
lines.push(`| McCann G. Agency ≈ McCann G Agency | similarity | ${mccannSim}% |`);
lines.push(`| No duplicate entities in finalResumeData | audit | ${dupAudit.ok ? 'PASS' : 'FAIL'} |`);
lines.push('');
lines.push('## Acceptance');
lines.push('');
lines.push('- No duplicate entities (clients, tools, skills)');
lines.push('- No duplicate experience rows');
lines.push('- No duplicate education rows');
lines.push('');
lines.push('## Pipeline hooks');
lines.push('');
lines.push('- `src/core/parsing/dedupe-engine.js` — `dedupeBySimilarity`, Levenshtein, semantic similarity');
lines.push('- `src/core/extraction/extraction-audit.js` — OCR/native line + plain-text dedupe');
lines.push('- `src/core/validation/dedupe-final-resume.js` — last-pass `finalResumeData` lock');
lines.push('- `src/core/validation/final-resume-contract.js` — build pipeline');
lines.push('- `src/core/validation/sanitize-resume-display.js` — display gate');
lines.push('');
lines.push('## Education / experience samples');
lines.push('');
lines.push('| Input | Output count |');
lines.push('|-------|--------------|');
lines.push(`| Créapole ×2 | ${eduSample.filter((l) => /créapole/i.test(l)).length} (expected 1) |`);
lines.push(
  `| Creative School Management ×2 | ${eduSample.filter((l) => /creative school management/i.test(l)).length} (expected 1) |`
);
lines.push(`| Freelance ×2 | ${expSample.filter((e) => /freelance/i.test(e.role)).length} (expected 1) |`);
lines.push(`| Nike experience ×2 | ${expSample.filter((e) => /nike/i.test(e.company)).length} (expected 1) |`);
lines.push('');
lines.push('## QA');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:dedupe-engine');
lines.push('npm run dedupe-engine-report');
lines.push('```');
lines.push('');
if (!gateOk) {
  lines.push('## Gate output');
  lines.push('');
  lines.push('```');
  lines.push((gate.stdout || gate.stderr || '').trim());
  lines.push((finalGate.stdout || finalGate.stderr || '').trim());
  lines.push('```');
}

writeFileSync(join(root, 'DEDUPE_ENGINE_REPORT.md'), `${lines.join('\n')}\n`);
console.log(`Wrote ${join(root, 'DEDUPE_ENGINE_REPORT.md')}`);
process.exit(gateOk ? 0 : 1);
