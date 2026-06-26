#!/usr/bin/env node
/**
 * H16 — Real product experience acceptance checks (product layer only).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  applyScoreCredibilityCap,
  assessCredibilityIssues,
} from '../core/validation/score-credibility-cap.js';
import {
  assessProductExperienceGate,
  EXTRACTION_QUALITY_EXPORT_MIN,
} from '../core/validation/product-experience-gate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/h16-real-product-experience');
fs.mkdirSync(outDir, { recursive: true });

const checks = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function baseReport(total = 92) {
  return {
    total,
    band: { label: 'Excellent', labelKey: 'bandExcellent' },
    checklist: [],
  };
}

// Score credibility caps
{
  const wrongName = applyScoreCredibilityCap(baseReport(95), { name: 'Nom à confirmer' });
  check('cap wrong name ≤ 30', wrongName.total <= 30, `got ${wrongName.total}`);

  const noExp = applyScoreCredibilityCap(baseReport(88), {
    name: 'Alex Martin',
    title: 'Designer',
    email: 'a@b.com',
    experience: [],
  });
  check('cap missing experience ≤ 50', noExp.total <= 50, `got ${noExp.total}`);

  const noEdu = applyScoreCredibilityCap(baseReport(88), {
    ...AlexProfile(),
    education: [],
  });
  check('cap missing education ≤ 60', noEdu.total <= 60, `got ${noEdu.total}`);

  const noEmail = applyScoreCredibilityCap(baseReport(88), { ...AlexProfile(), email: '' });
  check('cap missing email ≤ 40', noEmail.total <= 40, `got ${noEmail.total}`);

  const partial = applyScoreCredibilityCap(baseReport(88), AlexProfile(), {
    reviewQueue: [{ id: 'x', status: 'pending', field: 'identity.name', detected: 'X', confidence: 40 }],
  });
  check('cap critical review ≤ 70', partial.total <= 70, `got ${partial.total}`);

  const clean = applyScoreCredibilityCap(baseReport(88), AlexProfile());
  check('clean CV may exceed 80', clean.total > 80, `got ${clean.total}`);
  check('clean CV not capped unnecessarily', !clean.credibilityCapped, `total ${clean.total}`);
}

function AlexProfile() {
  return {
    name: 'Alex Martin',
    title: 'Senior Designer',
    email: 'alex@example.com',
    phone: '+33 6 00 00 00 00',
    experience: ['Lead Designer — Studio Nova · Paris · 2021–Present'],
    education: ['MA Design — ENSAD'],
    skills: ['Figma', 'Branding'],
  };
}

// Product experience gate
{
  const low = assessProductExperienceGate({
    importQualityScore: { overall: 62, parser: 60, completeness: 55 },
    exportReady: true,
    recruiterTotal: 85,
  });
  check('low extraction hides ready export', !low.showReadyExport);
  check('low extraction hides high score band', !low.showHighRecruiterScore);
  check('low extraction shows review required', low.reviewRequired);
  check('export min threshold is 80', EXTRACTION_QUALITY_EXPORT_MIN === 80);

  const ok = assessProductExperienceGate({
    importQualityScore: { overall: 88, parser: 90, completeness: 85 },
    exportReady: true,
    recruiterTotal: 86,
  });
  check('high extraction allows ready export', ok.showReadyExport);
  check('high extraction allows high score', ok.showHighRecruiterScore);
}

// Static assets present
{
  const files = [
    'src/ui/product/import-analysis-stages.js',
    'src/ui/product/import-analysis-stages.css',
    'src/ui/templates/cv-templates-h16.css',
    'src/core/validation/score-credibility-cap.js',
    'src/core/validation/product-experience-gate.js',
  ];
  for (const f of files) {
    check(`file ${f}`, fs.existsSync(path.join(root, f)));
  }

  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  check('import stage stepper in index', index.includes('importAnalysisStages'));
  check('A4 zoom 75%', index.includes('data-a4-zoom="75"'));
  check('A4 zoom 125%', index.includes('data-a4-zoom="125"'));
  check('review required badge', index.includes('reviewV2ReviewRequiredBadge'));

  const a4 = fs.readFileSync(path.join(root, 'src/ui/export/a4-viewport.js'), 'utf8');
  check('a4 viewport 125 mode', a4.includes("P125: '125'"));

  const tpl = fs.readFileSync(path.join(root, 'src/ui/templates/cv-templates.js'), 'utf8');
  check('template ATS Professional', tpl.includes("name: 'ATS Professional'"));
  check('template Tech Resume', tpl.includes("name: 'Tech Resume'"));
  check('template Modern Editorial', tpl.includes("name: 'Modern Editorial'"));
}

const pass = checks.every((c) => c.ok);
const report = {
  version: 'H16_REAL_PRODUCT_EXPERIENCE',
  pass,
  checks,
  summary: {
    total: checks.length,
    passed: checks.filter((c) => c.ok).length,
    failed: checks.filter((c) => !c.ok).length,
  },
};

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
process.exit(pass ? 0 : 1);
