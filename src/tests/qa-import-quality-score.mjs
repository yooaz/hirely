#!/usr/bin/env node
/**
 * P1 — Import Quality Score: extraction / parser / completeness from real signals.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IMPORT_QUALITY_SCORE_V1,
  computeImportQualityScore,
} from '../core/validation/import-quality-score.js';
import { assessImportQuality } from '../core/validation/extraction-quality.js';
import { assessFieldCompleteness } from '../core/parsing/field-completeness-gate.js';
import { computeRecruiterScoreV2 } from '../core/validation/recruiter-score-v2.js';
import { runExtractionPipeline } from '../core/parsing/pipeline.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

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

const garbageOcr = `[body]
A>o N'$ak6.f Îô°
||| §§ @@
C e   F r e i   R e
2011-2022
???`;

function testVersionAndRange() {
  const report = computeImportQualityScore({
    rawText: 'Alex Martin\nDesigner',
    cleanedText: 'Alex Martin\nDesigner',
    cvData: { name: 'Alex Martin', title: 'Designer', experience: ['Designer — Studio'], education: [] },
  });
  ok(report?.version === IMPORT_QUALITY_SCORE_V1, 'engine version');
  for (const key of ['extraction', 'parser', 'completeness', 'overall']) {
    ok(report[key] >= 0 && report[key] <= 100, `${key} in 0–100 (${report[key]})`);
  }
  ok(report.breakdown.length === 3, 'three breakdown rows');
}

function testNotStatic() {
  const full = computeImportQualityScore({
    rawText: 'Marie Dupont\nProduct Designer\nyoaz@email.com',
    cleanedText: 'Marie Dupont\nProduct Designer\nyoaz@email.com',
    cvData: yoazCv,
    recruiterScore: computeRecruiterScoreV2(yoazCv),
  });
  const empty = computeImportQualityScore({
    rawText: '???',
    cleanedText: '???',
    cvData: { name: '', experience: [], education: [], skills: [] },
    importQuality: assessImportQuality({
      rawText: garbageOcr,
      cleanedText: garbageOcr,
      cvData: { name: '', experience: [], unsorted: ['???'] },
      extractionMethod: 'pdf-ocr',
    }),
    fieldCompleteness: assessFieldCompleteness({ name: '', experience: [] }, garbageOcr, garbageOcr),
  });
  ok(full.extraction > empty.extraction, `extraction varies (${full.extraction} > ${empty.extraction})`);
  ok(full.parser > empty.parser, `parser varies (${full.parser} > ${empty.parser})`);
  ok(full.completeness > empty.completeness, `completeness varies (${full.completeness} > ${empty.completeness})`);
  ok(full.overall > empty.overall, `overall varies (${full.overall} > ${empty.overall})`);
}

function testCompletenessDropsWhenStripped() {
  const base = computeImportQualityScore({
    rawText: 'CV text',
    cleanedText: 'CV text',
    cvData: yoazCv,
    recruiterScore: computeRecruiterScoreV2(yoazCv),
  });
  const stripped = computeImportQualityScore({
    rawText: 'CV text',
    cleanedText: 'CV text',
    cvData: { ...yoazCv, education: [], experience: [], skills: [], languages: [] },
    recruiterScore: computeRecruiterScoreV2({
      ...yoazCv,
      education: [],
      experience: [],
      skills: [],
      languages: [],
    }),
  });
  ok(stripped.completeness < base.completeness, 'completeness drops when sections removed');
}

function testPipelineBacked() {
  const fixture = readFileSync(join(root, 'tests/fixtures/mvp-sample.txt'), 'utf8');
  return runExtractionPipeline(fixture, { extractionMethod: 'paste-text' }).then((pipe) => {
    const report = computeImportQualityScore({
      rawText: fixture,
      cleanedText: pipe.cleanedText,
      cvData: pipe.validatedCVData,
      structuredResume: pipe.structuredResume,
      audit: pipe.audit,
      pipeline: pipe,
      importQuality: pipe.importQuality,
      fieldCompleteness: pipe.audit?.fieldCompleteness,
      recruiterScore: pipe.score,
    });
    ok(!!report, 'pipeline-backed report');
    ok(report.extraction >= 50, `pipeline extraction reasonable (${report.extraction})`);
    ok(report.parser >= 40, `pipeline parser reasonable (${report.parser})`);
    ok(report.completeness >= 30, `pipeline completeness reasonable (${report.completeness})`);
    ok(
      Math.abs(
        report.overall -
          (report.extraction * 0.35 + report.parser * 0.34 + report.completeness * 0.31)
      ) <= 1,
      'overall matches weighted sum'
    );
  });
}

function testDeterministic() {
  const input = {
    rawText: 'Test CV',
    cleanedText: 'Test CV',
    cvData: yoazCv,
    recruiterScore: computeRecruiterScoreV2(yoazCv),
  };
  const a = computeImportQualityScore(input);
  const b = computeImportQualityScore(input);
  ok(a.extraction === b.extraction, 'deterministic extraction');
  ok(a.parser === b.parser, 'deterministic parser');
  ok(a.completeness === b.completeness, 'deterministic completeness');
}

async function main() {
  testVersionAndRange();
  testNotStatic();
  testCompletenessDropsWhenStripped();
  testDeterministic();
  await testPipelineBacked();
  console.log('\nqa-import-quality-score PASSED');
}

main().catch((err) => {
  console.error('qa-import-quality-score FAILED', err.message);
  process.exit(1);
});
