#!/usr/bin/env node
/**
 * HIRELY H8 — ATS quality upgrade acceptance.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { computeAtsScore, ATS_QUALITY_H8 } from '../core/validation/ats-engine.js';
import { P7_CV_FIXTURES } from '../../tests/lib/p7-stress-catalog.mjs';
import { resolveFixtureText } from '../../tests/lib/stress-catalog.mjs';
import { simulateOcrScan } from '../../tests/lib/h8-ocr-simulate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const fullCv = {
  name: 'Marie Dupont',
  title: 'Product Designer',
  email: 'marie@example.com',
  phone: '+33 6 12 34 56 78',
  summary: 'Senior product designer with 8 years building B2B SaaS products and design systems.',
  experience: [
    'Lead Designer — Acme Corp · 2020–Present',
    'Increased checkout conversion by 24% through UX research',
    'Senior Designer — Beta Inc · 2017–2020',
  ],
  education: ['Master Design — ENSAD Paris · 2014'],
  skills: ['Figma', 'Design systems', 'User research', 'Prototyping', 'Accessibility', 'Workshops'],
  tools: ['Sketch', 'Principle'],
  languages: ['French — native', 'English — fluent'],
};

const emptyCv = { name: '', email: '', experience: [], education: [], skills: [], languages: [] };

const full = computeAtsScore(fullCv);
const empty = computeAtsScore(emptyCv);

ok(full?.version === ATS_QUALITY_H8, 'H8 engine version');
ok(full.total >= 80 && full.total <= 95, `good CV band 80–95 (${full.total})`);
ok(empty.total < 60, `weak/empty CV below 60 (${empty.total})`);
ok(Array.isArray(full.strengths) && full.strengths.length >= 1, 'strengths returned');
ok(Array.isArray(full.missingFields), 'missingFields returned');
ok(Array.isArray(full.nextActions) && full.nextActions.length === 3, 'next 3 actions');
ok(full.engine?.ran === true, 'engine ran flag');
ok(full.cvQuality?.score >= 0 && full.atsReadiness?.score >= 0, 'layer scores exposed');

const r1 = computeAtsScore(fullCv);
const r2 = computeAtsScore(fullCv);
ok(r1.total === r2.total, 'deterministic scoring');

const partial = computeAtsScore({ ...fullCv, education: [], skills: ['Figma'] });
ok(partial.total < full.total && partial.total >= 60, `partial CV average band (${partial.total})`);

let gte60 = 0;
for (let idx = 0; idx < P7_CV_FIXTURES.length; idx++) {
  const f = P7_CV_FIXTURES[idx];
  const { rawText: canonical } = resolveFixtureText(ROOT, f);
  const rawText = f.simulateOcr ? simulateOcrScan(canonical, f.ocrSeed ?? idx) : canonical;
  const imp = await runHirelyImportFromText(rawText, {
    source: f.id,
    extractionMethod: f.extractionMethod || 'paste',
  });
  const pack = buildFinalResumeData(imp.resumeData);
  const s = computeAtsScore(pack.cvData, { resumeData: pack.finalResumeData });
  if (s.total >= 60) gte60++;
}
ok(gte60 >= 14, `stress CVs >=60: ${gte60}/20`);

process.exit(failed ? 1 : 0);
