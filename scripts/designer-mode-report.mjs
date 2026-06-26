#!/usr/bin/env node
/**
 * P1 — Generate DESIGNER_MODE_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  DESIGNER_CV_MODE,
  DESIGNER_MODE_TARGET_ROLES,
  DESIGNER_PRIORITY_SECTIONS,
  DESIGNER_SECTION_WEIGHTS,
  DESIGNER_ATS_ADJUSTMENTS,
  detectDesignerCvMode,
} from '../src/core/parsing/designer-cv-mode.js';
import { runSectionEngineV2 } from '../src/core/parsing/section-engine-v2.js';
import { buildResumeData, resumeDataToCvData } from '../src/core/resume-data.js';
import { computeAtsQualityH8 } from '../src/core/validation/ats-quality-h8.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'DESIGNER_MODE_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/designer-cv-mode/report.json');
const DESIGNER_FIXTURE = path.join(ROOT, 'tests/fixtures/designer-cv-rich.txt');
const CREATIVE_FIXTURE = path.join(ROOT, 'tests/fixtures/creative-cv/fixture.txt');
const DEV_FIXTURE = path.join(ROOT, 'tests/fixtures/developer-cv/fixture.txt');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-designer-cv-mode.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function fixtureAudit(label, text, compareDev = false) {
  const parsed = runSectionEngineV2(text, { rawText: text });
  const rd = buildResumeData({
    importResult: { resumeData: parsed.structured },
    structured: parsed.structured,
    rawText: text,
    cleanedText: text,
  });
  const cv = resumeDataToCvData(rd);
  const ats = computeAtsQualityH8(cv, { resumeData: rd });
  const mode = detectDesignerCvMode(text);
  let devAts = null;
  if (compareDev && fs.existsSync(DEV_FIXTURE)) {
    const devText = fs.readFileSync(DEV_FIXTURE, 'utf8');
    const devRd = buildResumeData({
      importResult: { resumeData: runSectionEngineV2(devText, { rawText: devText }).structured },
      structured: runSectionEngineV2(devText, { rawText: devText }).structured,
      rawText: devText,
      cleanedText: devText,
    });
    devAts = computeAtsQualityH8(resumeDataToCvData(devRd), { resumeData: devRd });
  }
  return {
    label,
    mode,
    clients: rd.clients?.length || 0,
    projects: rd.projects?.length || 0,
    portfolioLinks: rd.portfolioLinks?.length || 0,
    awards: rd.awards?.length || 0,
    exhibitions: rd.exhibitions?.length || 0,
    atsScore: ats.score,
    atsReadiness: ats.atsReadiness?.score,
    archetype: ats.archetype,
    wired: parsed.structured?.metadata?.designerCvMode,
    devAtsReadiness: devAts?.atsReadiness?.score,
  };
}

function main() {
  console.log('HIRELY P1 — Designer CV Mode audit\n');
  const qa = runQa();
  console.log(qa.pass ? '  PASS qa-designer-cv-mode' : '  FAIL qa-designer-cv-mode');

  let qaData = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      qaData = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      qaData = null;
    }
  }

  const fixtures = [];
  if (fs.existsSync(DESIGNER_FIXTURE)) {
    fixtures.push(fixtureAudit('designer-cv-rich', fs.readFileSync(DESIGNER_FIXTURE, 'utf8'), true));
  }
  if (fs.existsSync(CREATIVE_FIXTURE)) {
    fixtures.push(fixtureAudit('creative-cv', fs.readFileSync(CREATIVE_FIXTURE, 'utf8')));
  }

  const pass = qa.pass && qaData?.pass;

  const lines = [
    '# HIRELY P1 — Designer CV Mode',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'The parser and ATS scorer were optimized for corporate CVs — penalizing portfolio-heavy designer profiles and under-weighting clients, projects, awards, and exhibitions.',
    '',
    '## DESIGNER_CV_MODE',
    '',
    `Engine: \`${DESIGNER_CV_MODE}\` · wired in \`section-engine-v2.js\`, \`section-sanity.js\`, and \`ats-quality-h8.js\`.`,
    '',
    '### Trigger roles',
    '',
    DESIGNER_MODE_TARGET_ROLES.map((r) => `- **${r}**`).join('\n'),
    '',
    '### Priority sections (increased weight)',
    '',
    DESIGNER_PRIORITY_SECTIONS.map((s) => `- \`${s}[]\` × ${DESIGNER_SECTION_WEIGHTS[s] || DESIGNER_SECTION_WEIGHTS.portfolio || '—'}`).join('\n'),
    '',
    '### ATS adjustments',
    '',
    `- Corporate ATS readiness factor: **${DESIGNER_ATS_ADJUSTMENTS.corporateReadinessFactor}** (dampened)`,
    `- Creative portfolio boost: **${DESIGNER_ATS_ADJUSTMENTS.creativePortfolioBoost}**`,
    `- Experience weight factor: **${DESIGNER_ATS_ADJUSTMENTS.experienceWeightFactor}**`,
    `- Education weight factor: **${DESIGNER_ATS_ADJUSTMENTS.educationWeightFactor}**`,
    '',
    'When designer mode is active:',
    '- Parser confidence increases for clients, projects, portfolio, awards, exhibitions',
    '- Creative section scoring bonus applied in H8 ATS',
    '- Corporate `atsReadiness` score is dampened — portfolio reach matters more than ATS checklist compliance',
    '',
  ];

  if (fixtures.length) {
    lines.push('## Fixture audits', '');
    lines.push(
      '| Fixture | Mode | clients | projects | portfolio | awards | exhibitions | Score | ATS readiness | Archetype |',
      '|---------|:----:|--------:|---------:|----------:|-------:|------------:|------:|--------------:|:---------:|'
    );
    for (const fx of fixtures) {
      lines.push(
        `| ${fx.label} | ${fx.mode.active ? '✓' : '✗'} | ${fx.clients} | ${fx.projects} | ${fx.portfolioLinks} | ${fx.awards} | ${fx.exhibitions} | ${fx.atsScore} | ${fx.atsReadiness} | ${fx.archetype} |`
      );
    }
    lines.push('');

    const rich = fixtures.find((f) => f.label === 'designer-cv-rich');
    if (rich?.devAtsReadiness != null) {
      lines.push(
        '### Corporate vs designer ATS readiness',
        '',
        `- Designer fixture readiness: **${rich.atsReadiness}**`,
        `- Developer fixture readiness: **${rich.devAtsReadiness}**`,
        `- Designer mode dampens corporate ATS scoring while boosting creative signals`,
        ''
      );
    }
  }

  lines.push(
    '## Pipeline',
    '',
    '```',
    'RAW_TEXT → SECTION_ENGINE_V2 → detectDesignerCvMode()',
    '  → creative pipelines (clients, portfolio, experience recovery)',
    '  → resumeData.meta.designerMode',
    '  → computeAtsQualityH8() → applyDesignerAtsAdjustments()',
    '```',
    '',
    '## Acceptance',
    '',
    pass
      ? '**PASS** — Designer CVs activate designer mode, prioritize creative sections, and use dampened corporate ATS scoring.'
      : '**FAIL** — See QA output.',
    '',
    '## Run',
    '',
    '```bash',
    'npm run test:designer-mode',
    '```',
    ''
  );

  if (!qa.pass && qa.out) {
    lines.push('## QA output', '', '```', qa.out.slice(0, 8000), '```', '');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
