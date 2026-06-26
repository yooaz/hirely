#!/usr/bin/env node
/**
 * P0 — Generate CLIENT_DETECTION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import vm from 'vm';
import {
  CLIENT_DETECTION_ENGINE,
  CLIENT_ANCHOR_TARGETS,
  auditClientDetection,
  runClientDetection,
} from '../src/core/parsing/client-detection-engine.js';
import { runSectionEngineV2 } from '../src/core/parsing/section-engine-v2.js';
import { buildResumeData, resumeDataToCvData } from '../src/core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CLIENT_DETECTION_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/client-detection/report.json');
const CREATIVE_FIXTURE = path.join(ROOT, 'tests/fixtures/creative-cv/fixture.txt');
const RICH_FIXTURE = path.join(ROOT, 'tests/fixtures/creative-experience-rich.txt');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-client-detection.mjs'], {
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
    hasSection: /cvSection--clients/.test(html),
    brandsInHtml: CLIENT_ANCHOR_TARGETS.filter((b) => new RegExp(`\\b${b}\\b`, 'i').test(html)),
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
  const audit = auditClientDetection(text, parsed.structured);
  const render = renderCheck(cv);
  return { label, audit, clients: rd.clients || [], cvClients: cv.clients || [], render, wired: parsed.structured?.metadata?.clientDetection };
}

function main() {
  console.log('HIRELY P0 — Client detection audit\n');
  const qa = runQa();
  console.log(qa.pass ? '  PASS qa-client-detection' : '  FAIL qa-client-detection');

  let qaData = null;
  if (fs.existsSync(QA_JSON)) {
    try {
      qaData = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
    } catch {
      qaData = null;
    }
  }

  const fixtures = [];
  if (fs.existsSync(CREATIVE_FIXTURE)) fixtures.push(fixtureAudit('creative-cv', fs.readFileSync(CREATIVE_FIXTURE, 'utf8')));
  if (fs.existsSync(RICH_FIXTURE)) fixtures.push(fixtureAudit('creative-experience-rich', fs.readFileSync(RICH_FIXTURE, 'utf8')));

  const workedForSample = `Worked for:\nNike\nAdobe\nMarvel\nApple\nGoogle\nMeta\nSony\nCadillac`;
  const workedFor = runClientDetection({ experiences: [], clients: [] }, workedForSample, { forceCreative: true });

  const pass = qa.pass && qaData?.pass;

  const lines = [
    '# HIRELY P0 — Client Detection',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'Creative CVs list client brands in bullets and prose, but the parser treated them as random text instead of `resume.clients[]`.',
    '',
    '## CLIENT_DETECTION_ENGINE',
    '',
    `Engine: \`${CLIENT_DETECTION_ENGINE}\` · wired in \`section-engine-v2.js\` when creative mode is active.`,
    '',
    'Detects:',
    '- `Worked for:` / `Worked with:` multiline blocks',
    '- `clients including` / `Collaborated with` bullet lists',
    '- Entity dictionary matches (`clients.json`, `creative_clients.json`)',
    '',
    'Anchor targets: ' + CLIENT_ANCHOR_TARGETS.map((c) => `**${c}**`).join(' · '),
    '',
    'Stores: `structured.clients[]` → `resumeData.clients[]` → `cvData.clients[]` → template `cvSection--clients`.',
    '',
    '### Worked-for sample',
    '',
    '```',
    workedForSample,
    '```',
    '',
    `Detected (${workedFor.clients.length}): ${workedFor.clients.join(', ')}`,
    '',
  ];

  if (fixtures.length) {
    lines.push('## Fixture audits', '');
    lines.push('| Fixture | clients[] | cvData.clients | Anchor recall | Template section |', '|---------|----------:|---------------:|--------------:|:----------------:|');
    for (const fx of fixtures) {
      lines.push(
        `| ${fx.label} | ${fx.clients.length} | ${fx.cvClients.length} | ${fx.audit.recallPct}% | ${fx.render.hasSection ? '✓' : '✗'} |`
      );
    }
    lines.push('');

    for (const fx of fixtures) {
      lines.push(`### ${fx.label}`, '');
      lines.push('**resume.clients[]:** ' + (fx.clients.join(', ') || '—'));
      lines.push('');
      lines.push('**Rendered brands:** ' + (fx.render.brandsInHtml.join(', ') || '—'));
      lines.push('');
      lines.push('| Expected in source | Detected |');
      lines.push('|--------------------|----------|');
      for (const brand of fx.audit.expected) {
        const hit = fx.audit.found.includes(brand) ? '✓' : '✗';
        lines.push(`| ${brand} | ${hit} |`);
      }
      lines.push('');
    }
  }

  lines.push(
    '## Rules',
    '',
    '- Client brands must never be discarded as random unsorted text.',
    '- `Adobe` in a client bullet is a brand; `Adobe Illustrator` in Tools is not.',
    '- Agencies (e.g. McCann) stay in experience — not duplicated as clients when they are employers.',
    '- Templates render `cvSection--clients` / `cvSection--clients-hero` on creative layouts.',
    '',
    '## Acceptance',
    '',
    pass
      ? '**PASS** — Creative CVs expose client history in `resume.clients[]` and templates.'
      : '**FAIL** — See QA output.',
    '',
    '## Run',
    '',
    '```bash',
    'npm run test:client-detection',
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
