/**
 * Review Studio V2 — export gates and readiness report.
 */
import {
  buildReviewReadinessReport,
  isExportReady,
} from '../core/validation/review-readiness.js';
import { computeAtsScore } from '../core/validation/ats-engine.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('  ✓', msg);
};

const fullCv = {
  name: 'Marie Dupont',
  title: 'Product Designer',
  email: 'marie@example.com',
  phone: '+33 6 12 34 56 78',
  summary: 'Senior designer with 8 years in B2B SaaS.',
  experience: [
    'Lead Designer — Acme Corp · 2020–Present',
    'Built design system used by 12 teams',
  ],
  education: ['Master Design — ENSAD Paris · 2014'],
  skills: ['Figma', 'Design systems', 'User research'],
  tools: ['Sketch'],
  languages: ['French', 'English'],
};

const emptyCv = {
  name: '',
  title: '',
  email: '',
  experience: [],
  education: [],
  skills: [],
};

function testEmptyNotExportReady() {
  const report = buildReviewReadinessReport(emptyCv);
  ok(!report.exportReady, 'empty CV is not export-ready');
  ok(report.completionPct === 0, `empty completion is 0 (${report.completionPct})`);
  ok(!isExportReady(report), 'isExportReady false for empty');
}

function testFullExportReady() {
  const ats = computeAtsScore(fullCv);
  const report = buildReviewReadinessReport(fullCv, {
    toClassifyCount: 0,
    atsScore: ats.total,
    atsBand: ats.band,
  });
  ok(report.gates.identity, 'identity gate passes');
  ok(report.gates.contact, 'contact gate passes');
  ok(report.gates.content, 'content gate passes');
  ok(report.exportReady, 'full CV is export-ready');
  ok(report.completionPct === 100, `full completion is 100 (${report.completionPct})`);
  ok(isExportReady(report), 'isExportReady true for full CV');
}

function testUnclassifiedBlocksExperience() {
  const partial = {
    ...fullCv,
    experience: [],
    skills: [],
    tools: [],
    summary: '',
  };
  const report = buildReviewReadinessReport(partial, { toClassifyCount: 3 });
  ok(!report.gates.content, 'content gate fails when only unclassified lines');
  ok(!report.exportReady, 'not export-ready with unclassified-only experience');
}

function testPartialWithoutEducationExportReady() {
  const partial = {
    name: 'Alex Martin',
    title: 'Product Designer',
    email: 'alex@example.com',
    phone: '+33 6 11 22 33 44',
    summary: 'Designer focused on SaaS products.',
    experience: ['Designer — Studio · 2020–Present'],
    education: [],
    skills: ['Figma', 'Research'],
  };
  const report = buildReviewReadinessReport(partial);
  ok(report.exportReady, 'partial CV without education is export-ready');
  ok(!report.gates.education, 'education gate informational when absent');
}

function testAnalysisSignals() {
  const dupCv = {
    ...fullCv,
    experience: [
      'Lead Designer — Acme Corp · 2020–Present',
      'Lead Designer — Acme Corp · 2020–Present',
      'Built checkout flow increasing conversion',
    ],
  };
  const report = buildReviewReadinessReport(dupCv);
  ok(report.duplicateExperiences.length >= 1, 'detects duplicate experiences');
  ok(report.detected.languages.length === 2, 'detects languages');
  ok(report.detected.skills.length >= 4, 'detects skills and tools');
  ok(report.detected.contact.email === 'marie@example.com', 'detects contact email');
  ok(report.missingDates.length >= 1, 'flags experience lines missing dates');
}

function run() {
  console.log('qa-review-studio-v2');
  testEmptyNotExportReady();
  testFullExportReady();
  testUnclassifiedBlocksExperience();
  testPartialWithoutEducationExportReady();
  testAnalysisSignals();
  console.log('qa-review-studio-v2: all passed');
}

run();
