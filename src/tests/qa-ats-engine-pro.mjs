#!/usr/bin/env node
/**
 * ATS Engine Pro QA — dimensions, benchmarks, risks, recommendations.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ATS_ENGINE_PRO,
  ATS_PRO_DIMENSIONS,
  ATS_PLATFORM_BENCHMARKS,
  analyzeAtsPro,
} from '../core/validation/ats-engine-pro.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const STRONG_CV = {
  name: 'Yohann Azancot',
  title: 'Graphic Designer / Illustrator',
  email: 'yoaz@hotmail.fr',
  phone: '+33 6 49 43 48 39',
  linkedin: 'https://linkedin.com/in/yoaz',
  location: 'Paris',
  summary:
    'Illustrator and graphic designer with 10+ years creating brand identities, packaging, and editorial work for luxury clients.',
  experience: [
    'Freelance Illustrator / Graphic Designer — Independent — 2011–2022: Designed packaging and visual identity for international brands',
    'Designer — McCann Agency — 2011–2014: Led campaign visuals and brand rollouts',
  ],
  education: ['Créapole — Visual Communication — 2008–2011', 'LISAA — Web & Motion Design — 2011–2012'],
  skills: ['Illustration', 'Graphic Design', 'Packaging', 'Logo Design', 'Visual Identity', 'Editorial Design'],
  tools: ['Adobe Illustrator', 'Photoshop', 'InDesign', 'Figma'],
  languages: ['French — native', 'English — fluent'],
};

const WEAK_CV = {
  name: '',
  title: '',
  email: '',
  phone: '',
  experience: [],
  education: [],
  skills: [],
  tools: [],
  languages: [],
};

const JOB = 'Senior graphic designer with Adobe Illustrator, branding, packaging, and visual identity experience in Paris.';

function assertPro(result, label) {
  ok(result?.version === ATS_ENGINE_PRO, `${label} engine version`);
  ok(result?.ready === true, `${label} ready`);
  ok(result.score >= 0 && result.score <= 100, `${label} score 0–100 (${result.score})`);
  ok(result.atsScore === result.score, `${label} atsScore alias`);
  ok(result.confidence?.score >= 0, `${label} confidence`);
  ok(Array.isArray(result.dimensions) && result.dimensions.length === 7, `${label} seven dimensions`);
  ok(Array.isArray(result.risks), `${label} risks array`);
  ok(Array.isArray(result.recommendations) && result.recommendations.length >= 1, `${label} recommendations`);
  ok(result.benchmarks?.length === 4, `${label} four platform benchmarks`);
  for (const b of result.benchmarks || []) {
    ok(b.score >= 0 && b.score <= 100, `${label} ${b.id} platform score`);
    ok(ATS_PLATFORM_BENCHMARKS[b.id], `${label} known platform ${b.id}`);
  }
  const dimIds = result.dimensions.map((d) => d.id).sort().join(',');
  const expected = Object.keys(ATS_PRO_DIMENSIONS).sort().join(',');
  ok(dimIds === expected, `${label} dimension ids (${dimIds})`);
}

async function main() {
  ok(ATS_ENGINE_PRO === 'ATS_ENGINE_PRO_V1', 'engine constant');
  ok(Object.keys(ATS_PRO_DIMENSIONS).length === 7, 'seven dimension defs');
  ok(Object.keys(ATS_PLATFORM_BENCHMARKS).length === 4, 'four platform profiles');

  const empty = analyzeAtsPro(null);
  ok(!empty.ready && empty.score === 0, 'empty cv returns not ready');
  ok(empty.risks.length >= 1, 'empty cv has risks');

  const weak = analyzeAtsPro(WEAK_CV);
  ok(weak.ready, 'weak cv ready');
  ok(weak.score < 45, `weak cv low score (${weak.score})`);
  ok(weak.risks.some((r) => r.level === 'high'), 'weak cv high risks');
  assertPro(weak, 'weak');

  const strong = analyzeAtsPro(STRONG_CV, { jobDescription: JOB });
  ok(strong.ready, 'strong cv ready');
  ok(strong.score >= 65, `strong cv score >= 65 (${strong.score})`);
  ok(strong.dimensions.find((d) => d.id === 'contact')?.pct >= 70, 'strong contact dimension');
  ok(strong.dimensions.find((d) => d.id === 'experience')?.pct >= 60, 'strong experience dimension');
  assertPro(strong, 'strong');

  const withJob = analyzeAtsPro(STRONG_CV, { jobDescription: JOB });
  ok(
    withJob.analyses?.keywords?.jobMatched?.length >= 3,
    `job description matches keywords (${withJob.analyses?.keywords?.jobMatched?.length || 0})`
  );
  ok(withJob.analyses?.keywords?.passes?.some((p) => /job/i.test(p)), 'job alignment pass when aligned');

  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(index.includes('jobDescInput'), 'job description wired in HTML');
  ok(index.includes('recruiter-command-center.js'), 'RCC UI loaded');

  const rcc = fs.readFileSync(path.join(ROOT, 'src/core/validation/recruiter-command-center.js'), 'utf8');
  ok(rcc.includes('analyzeAtsPro'), 'RCC uses ATS Engine Pro');
  ok(rcc.includes('atsPro'), 'RCC exports atsPro');

  const ui = fs.readFileSync(path.join(ROOT, 'src/ui/studio/recruiter-command-center.js'), 'utf8');
  ok(ui.includes('atsProBenchmarks'), 'UI platform benchmarks');
  ok(ui.includes('atsProRisks'), 'UI ATS risks');

  for (const id of ['developer-cv', 'marketing-cv']) {
    const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures', id, 'fixture.txt'), 'utf8');
    const imp = await runHirelyImportFromText(raw, { source: id, extractionMethod: 'paste' });
    const cv = imp.cvData || imp.resumeData;
    const result = analyzeAtsPro(cv);
    ok(result.ready && result.score >= 40, `${id} import ATS pro score (${result.score})`);
    ok(result.benchmarks.every((b) => b.vendor), `${id} benchmark vendors`);
  }

  if (failed) {
    process.exitCode = 1;
    console.error(`\n${failed} ATS Engine Pro check(s) failed`);
  } else {
    console.log('\nAll ATS Engine Pro checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
