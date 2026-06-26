#!/usr/bin/env node
/**
 * P1 — Generate PROJECTS_ENGINE_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import vm from 'vm';
import {
  PROJECTS_ENGINE,
  PROJECT_ANCHOR_TARGETS,
  auditProjectsExtraction,
  runProjectsExtraction,
  parseProjectLine,
} from '../src/core/parsing/projects-engine.js';
import { runSectionEngineV2 } from '../src/core/parsing/section-engine-v2.js';
import { buildResumeData, resumeDataToCvData } from '../src/core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PROJECTS_ENGINE_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/projects-engine/report.json');
const RICH_FIXTURE = path.join(ROOT, 'tests/fixtures/projects-creative-rich.txt');
const DESIGNER_FIXTURE = path.join(ROOT, 'tests/fixtures/designer-cv-rich.txt');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-projects-engine.mjs'], {
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
    hasSection: /cvSection--projects/.test(html),
    projectsInHtml: (cv.projects || []).filter((p) => html.toLowerCase().includes(String(p).split(' — ')[0].slice(0, 12).toLowerCase())),
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
  const audit = auditProjectsExtraction(text, parsed.structured);
  const render = renderCheck(cv);
  return { label, audit, projects: rd.projects || [], cvProjects: cv.projects || [], render, wired: parsed.structured?.metadata?.projectsExtraction };
}

function main() {
  console.log('HIRELY P1 — Projects extraction audit\n');
  const qa = runQa();
  console.log(qa.pass ? '  PASS qa-projects-engine' : '  FAIL qa-projects-engine');

  let qaData = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      qaData = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      qaData = null;
    }
  }

  const fixtures = [];
  if (fs.existsSync(RICH_FIXTURE)) fixtures.push(fixtureAudit('projects-creative-rich', fs.readFileSync(RICH_FIXTURE, 'utf8')));
  if (fs.existsSync(DESIGNER_FIXTURE)) fixtures.push(fixtureAudit('designer-cv-rich', fs.readFileSync(DESIGNER_FIXTURE, 'utf8')));

  const anchorSamples = PROJECT_ANCHOR_TARGETS.map((line) => {
    const p = parseProjectLine(line);
    return { line, parsed: p };
  });

  const pass = qa.pass && qaData?.pass;

  const lines = [
    '# HIRELY P1 — Projects Extraction',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'Creative CVs list campaign and poster work as unstructured lines. The parser failed to extract project title, client, year, and role into `resume.projects[]`.',
    '',
    '## PROJECTS_ENGINE',
    '',
    `Engine: \`${PROJECTS_ENGINE}\` · wired in \`section-engine-v2.js\` (creative/designer mode) and \`polishResumeOutput\`.`,
    '',
    'Detects per project:',
    '- **Title** — e.g. God of War Poster, Max Campaign',
    '- **Client** — PlayStation, Adobe, Marvel, Visa (entity dictionary + anchors)',
    '- **Year** — `2021`, `2023`, …',
    '- **Role** — Art Director, Lead Designer, … (from line or identity title)',
    '',
    'Stores formatted entries in `structured.projects[]` → `resumeData.projects[]` → `cvData.projects[]` → template `cvSection--projects`.',
    '',
    'Display format: `Title — Client · Year · Role`',
    '',
    '### Anchor examples',
    '',
    '| Source line | Client | Title |',
    '|-------------|--------|-------|',
  ];

  for (const sample of anchorSamples) {
    lines.push(
      `| ${sample.line} | ${sample.parsed?.client || '—'} | ${sample.parsed?.title || '—'} |`
    );
  }
  lines.push('');

  if (fixtures.length) {
    lines.push('## Fixture audits', '');
    lines.push(
      '| Fixture | projects[] | cvData.projects | Anchor recall | Template section |',
      '|---------|----------:|----------------:|--------------:|:----------------:|'
    );
    for (const fx of fixtures) {
      lines.push(
        `| ${fx.label} | ${fx.projects.length} | ${fx.cvProjects.length} | ${fx.audit.recallPct}% | ${fx.render.hasSection ? '✓' : '✗'} |`
      );
    }
    lines.push('');

    for (const fx of fixtures) {
      lines.push(`### ${fx.label}`, '');
      lines.push('**resume.projects[]:**');
      for (const project of fx.projects) lines.push(`- ${project}`);
      if (!fx.projects.length) lines.push('- —');
      lines.push('');
      lines.push('| Expected in source | Detected |');
      lines.push('|--------------------|----------|');
      for (const anchor of fx.audit.expected) {
        const hit = fx.audit.found.includes(anchor) ? '✓' : '✗';
        lines.push(`| ${anchor} | ${hit} |`);
      }
      lines.push('');
    }
  }

  lines.push(
    '## Rules',
    '',
    '- Project lines must never be discarded as random unsorted text when they match poster/campaign patterns.',
    '- Client names resolve via `clients.json` and creative client anchors (PlayStation, Visa, …).',
    '- Experience job rows with date ranges are never promoted to projects.',
    '- Templates render `cvSection--projects` on creative layouts (`portfolio-artist`, `behance-creative`, etc.).',
    '',
    '## Acceptance',
    '',
    pass
      ? '**PASS** — Creative CVs expose structured project work in `resume.projects[]` and templates.'
      : '**FAIL** — See QA output.',
    '',
    '## Run',
    '',
    '```bash',
    'npm run test:projects-engine',
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
