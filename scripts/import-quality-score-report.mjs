#!/usr/bin/env node
/**
 * Generate IMPORT_QUALITY_SCORE_REPORT.md
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { computeImportQualityScore } from '../src/core/validation/import-quality-score.js';
import { computeRecruiterScoreV2 } from '../src/core/validation/recruiter-score-v2.js';
import { runExtractionPipeline } from '../src/core/parsing/pipeline.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gate = spawnSync('node', ['src/tests/qa-import-quality-score.mjs'], {
  cwd: root,
  encoding: 'utf8',
});
const gateOk = gate.status === 0;

const yoazCv = {
  name: 'Yohann Azancot',
  title: 'Graphic Designer & Illustrator',
  email: 'yoaz@hotmail.fr',
  phone: '+33 6 49 43 48 39',
  linkedin: 'https://linkedin.com/in/yoaz',
  location: 'Paris, France',
  portfolio: 'https://yoaz.studio',
  summary: 'Creative professional specializing in illustration and brand design.',
  experience: [
    'Freelance Illustrator — Independent · 2011–2022: Posters, packaging, logos.',
    'Designer — McCann G. Agency · 2011–2014: Campaign creative for global brands.',
  ],
  education: ['Créapole — Visual Communication · 2007–2009'],
  skills: ['Illustration', 'Graphic Design', 'Brand Identity', 'Art Direction', 'Packaging', 'Print'],
  tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma'],
  languages: ['French — native', 'English — fluent'],
};

const fixture = readFileSync(join(root, 'tests/fixtures/mvp-sample.txt'), 'utf8');
const pipe = await runExtractionPipeline(fixture, { extractionMethod: 'paste-text' });
const recruiter = computeRecruiterScoreV2(pipe.validatedCVData || yoazCv);
const sample = computeImportQualityScore({
  rawText: fixture,
  cleanedText: pipe.cleanedText,
  cvData: pipe.validatedCVData || yoazCv,
  structuredResume: pipe.structuredResume,
  audit: pipe.audit,
  pipeline: pipe,
  importQuality: pipe.importQuality,
  fieldCompleteness: pipe.audit?.fieldCompleteness,
  recruiterScore: recruiter,
});

const lines = [];
lines.push('# Import Quality Score Report');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString()}`);
lines.push(`**Engine:** ${sample?.version || 'IMPORT_QUALITY_SCORE_V1'}`);
lines.push(`**Result:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Problem');
lines.push('');
lines.push('A single opaque CV score (e.g. 79/100) hid whether extraction, parsing, or completeness drove the result.');
lines.push('');
lines.push('## Metrics (real signals, not static)');
lines.push('');
lines.push('| Metric | Source signals |');
lines.push('|--------|----------------|');
lines.push('| **Extraction Quality** | `assessImportQuality`, retention %, extraction stage score, readable/corrupt line ratios |');
lines.push('| **Parser Quality** | `assessFieldCompleteness` utilization %, section confidence, review queue, parser-fail flags |');
lines.push('| **CV Completeness** | `structuredCompleteness`, field checks, recruiter checklist coverage |');
lines.push('');
lines.push('## Sample (mvp-sample fixture)');
lines.push('');
lines.push('| Metric | Score |');
lines.push('|--------|-------|');
lines.push(`| Extraction | ${sample?.extraction ?? '—'}% |`);
lines.push(`| Parser | ${sample?.parser ?? '—'}% |`);
lines.push(`| CV Completeness | ${sample?.completeness ?? '—'}% |`);
lines.push(`| Weighted overall | ${sample?.overall ?? '—'}% |`);
lines.push(`| Recruiter score (separate) | ${recruiter?.total ?? '—'}/100 |`);
lines.push('');
lines.push('## Display');
lines.push('');
lines.push('After import, metrics panel shows:');
lines.push('');
lines.push('```');
lines.push(`Extraction ${sample?.extraction ?? '—'}%`);
lines.push(`Parser ${sample?.parser ?? '—'}%`);
lines.push(`Completeness ${sample?.completeness ?? '—'}%`);
lines.push('```');
lines.push('');
lines.push('## Pipeline hooks');
lines.push('');
lines.push('- `src/core/validation/import-quality-score.js` — compute + breakdown');
lines.push('- `src/core/pipeline/production-pipeline.js` — `audit.importQualityScore`');
lines.push('- `index.html` — metrics panel via `buildImportQualityMetricRows`');
lines.push('');
lines.push('## QA');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:import-quality-score');
lines.push('npm run import-quality-score-report');
lines.push('```');
lines.push('');
if (!gateOk) {
  lines.push('## Gate output');
  lines.push('');
  lines.push('```');
  lines.push((gate.stdout || gate.stderr || '').trim());
  lines.push('```');
}

writeFileSync(join(root, 'IMPORT_QUALITY_SCORE_REPORT.md'), `${lines.join('\n')}\n`);
console.log(`Wrote ${join(root, 'IMPORT_QUALITY_SCORE_REPORT.md')}`);
process.exit(gateOk ? 0 : 1);
