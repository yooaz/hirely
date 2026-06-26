#!/usr/bin/env node
/**
 * P0 — Generate PORTFOLIO_EXTRACTION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import vm from 'vm';
import {
  PORTFOLIO_EXTRACTION_ENGINE,
  PORTFOLIO_ANCHOR_TARGETS,
  auditPortfolioExtraction,
  runPortfolioExtraction,
  detectPortfolioLinksFromText,
} from '../src/core/parsing/portfolio-extraction-engine.js';
import { runSectionEngineV2 } from '../src/core/parsing/section-engine-v2.js';
import { buildResumeData, resumeDataToCvData } from '../src/core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PORTFOLIO_EXTRACTION_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/portfolio-extraction/report.json');
const RICH_FIXTURE = path.join(ROOT, 'tests/fixtures/portfolio-links-rich.txt');
const CREATIVE_FIXTURE = path.join(ROOT, 'tests/fixtures/creative-cv/fixture.txt');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-portfolio-extraction.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function renderCheck(cv) {
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sb = { console };
  sb.window = sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(code, sb);
  sb.initHirelyTemplates({
    esc: (s) => String(s || ''),
    sectionLabel: (k) => k,
    cvBlock: (t, h) => h || '',
    cvSkillsHtml: () => '',
    getPhotoHtml: () => '',
  });
  const html = sb.HirelyTemplates.render(cv, 'portfolio-artist');
  return {
    hasSection: /cvSection--portfolio/.test(html),
    linksInHtml: (cv.portfolioLinks || []).filter((l) => html.includes(String(l).split(' — ').pop() || l)),
  };
}

function fixtureAudit(label, text) {
  const parsed = runSectionEngineV2(text, { rawText: text });
  const rd = buildResumeData({
    importResult: { resumeData: parsed.structured },
    structured: parsed.structured,
    rawText: text,
    cleanedText: text,
  });
  const cv = resumeDataToCvData(rd);
  const audit = auditPortfolioExtraction(text, parsed.structured);
  const render = renderCheck(cv);
  return {
    label,
    audit,
    links: rd.portfolioLinks || [],
    cvLinks: cv.portfolioLinks || [],
    linkedin: rd.identity?.linkedin || '',
    render,
    wired: parsed.structured?.metadata?.portfolioExtraction,
  };
}

function main() {
  console.log('HIRELY P0 — Portfolio extraction audit\n');
  const qa = runQa();
  console.log(qa.pass ? '  PASS qa-portfolio-extraction' : '  FAIL qa-portfolio-extraction');

  let qaData = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      qaData = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      qaData = null;
    }
  }

  const fixtures = [];
  if (fs.existsSync(RICH_FIXTURE)) fixtures.push(fixtureAudit('portfolio-links-rich', fs.readFileSync(RICH_FIXTURE, 'utf8')));
  if (fs.existsSync(CREATIVE_FIXTURE)) fixtures.push(fixtureAudit('creative-cv', fs.readFileSync(CREATIVE_FIXTURE, 'utf8')));

  const labeledSample = [
    'Portfolio: https://janecreative.com',
    'Website: www.janecreative.design',
    'LinkedIn: linkedin.com/in/janecreative',
    'Foundation: foundation.app/@janecreative',
  ].join('\n');
  const labeledDetected = detectPortfolioLinksFromText(labeledSample);
  const forced = runPortfolioExtraction(
    { experiences: [], portfolioLinks: [], unsorted: [], identity: {} },
    fs.existsSync(RICH_FIXTURE) ? fs.readFileSync(RICH_FIXTURE, 'utf8') : labeledSample,
    { forceCreative: true }
  );

  const pass = qa.pass && qaData?.pass;

  const lines = [
    '# HIRELY P0 — Portfolio Extraction',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'Creative CVs surface portfolio and social links in contact headers and labeled lines, but the parser often left them in unsorted text instead of `resume.portfolioLinks[]`.',
    '',
    '## PORTFOLIO_EXTRACTION_ENGINE',
    '',
    `Engine: \`${PORTFOLIO_EXTRACTION_ENGINE}\` · wired in \`section-engine-v2.js\` when creative mode is active, and in \`polishResumeOutput\` when portfolio signals are present.`,
    '',
    'Detects:',
    '- Contact separator lines (`email · behance.net/user · instagram.com/user`)',
    '- Labeled rows (`Portfolio:`, `Website:`, `LinkedIn:`, `Foundation:`, etc.)',
    '- Inline URLs (`https://`, `www.`, bare `behance.net/...`)',
    '- Identity fields (`identity.linkedin`, `identity.website`) merged into links',
    '',
    'Platforms: ' + PORTFOLIO_ANCHOR_TARGETS.map((p) => `**${p}**`).join(' · '),
    '',
    'Stores: `structured.portfolioLinks[]` → `resumeData.portfolioLinks[]` → `cvData.portfolioLinks[]` → template `cvSection--portfolio`.',
    '',
    '### Labeled sample',
    '',
    '```',
    labeledSample,
    '```',
    '',
    `Detected (${labeledDetected.length}): ${labeledDetected.join(' · ')}`,
    '',
    `Rich fixture forced run: ${forced.portfolioLinks.length} links`,
    '',
  ];

  if (fixtures.length) {
    lines.push('## Fixture audits', '');
    lines.push(
      '| Fixture | portfolioLinks[] | cvData.links | Platform recall | Template section |',
      '|---------|-----------------:|-------------:|----------------:|:----------------:|'
    );
    for (const fx of fixtures) {
      lines.push(
        `| ${fx.label} | ${fx.links.length} | ${fx.cvLinks.length} | ${fx.audit.recallPct}% | ${fx.render.hasSection ? '✓' : '✗'} |`
      );
    }
    lines.push('');

    for (const fx of fixtures) {
      lines.push(`### ${fx.label}`, '');
      lines.push('**resume.portfolioLinks[]:**');
      for (const link of fx.links) lines.push(`- ${link}`);
      if (!fx.links.length) lines.push('- —');
      lines.push('');
      if (fx.linkedin) lines.push(`**identity.linkedin:** ${fx.linkedin}`);
      lines.push('');
      lines.push('| Expected in source | Detected |');
      lines.push('|--------------------|----------|');
      for (const platform of fx.audit.expected) {
        const hit = fx.audit.found.includes(platform) ? '✓' : '✗';
        lines.push(`| ${platform} | ${hit} |`);
      }
      lines.push('');
    }
  }

  lines.push(
    '## Rules',
    '',
    '- Portfolio URLs must never be discarded as random unsorted text.',
    '- `LinkedIn` URLs sync to `identity.linkedin` when missing.',
    '- Primary non-LinkedIn URL syncs to `identity.website` when missing.',
    '- `foundation.app` is included alongside Behance, Dribbble, ArtStation, Instagram.',
    '- Templates render `cvSection--portfolio` on creative layouts (`portfolio-artist`, etc.).',
    '',
    '## Acceptance',
    '',
    pass
      ? '**PASS** — Creative CVs expose portfolio/social links in `resume.portfolioLinks[]` and templates.'
      : '**FAIL** — See QA output.',
    '',
    '## Run',
    '',
    '```bash',
    'npm run test:portfolio-extraction',
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
