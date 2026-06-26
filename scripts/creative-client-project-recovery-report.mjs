#!/usr/bin/env node
/**
 * P1 — Generate CREATIVE_CLIENT_PROJECT_RECOVERY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  CREATIVE_CLIENT_PROJECT_RECOVERY,
  CREATIVE_RECOVERY_CLIENT_ANCHORS,
  CREATIVE_RECOVERY_PROJECT_TYPES,
  auditCreativeClientProjectRecovery,
  runCreativeClientProjectRecovery,
} from '../src/core/parsing/creative-client-project-recovery.js';
import { runSectionEngineV2 } from '../src/core/parsing/section-engine-v2.js';
import { buildResumeData } from '../src/core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CREATIVE_CLIENT_PROJECT_RECOVERY_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/creative-client-project-recovery/report.json');
const FIXTURE = path.join(ROOT, 'tests/fixtures/creative-client-project-recovery.txt');
const CREATIVE_FIXTURE = path.join(ROOT, 'tests/fixtures/creative-cv/fixture.txt');
const RICH_FIXTURE = path.join(ROOT, 'tests/fixtures/creative-experience-rich.txt');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-creative-client-project-recovery.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

function analyzeFixture(label, filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = runSectionEngineV2(text, { rawText: text });
  const rd = buildResumeData({
    importResult: { resumeData: parsed.structured },
    structured: parsed.structured,
    rawText: text,
    cleanedText: text,
  });
  const audit = auditCreativeClientProjectRecovery(text, parsed.structured);
  const stats = parsed.structured?.metadata?.creativeClientProjectRecovery || {};
  return { label, audit, stats, clients: rd.clients || [], projects: rd.projects || [], experiences: rd.experiences?.length || 0 };
}

const qa = runQa();
const qaJson = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const recoveryFixture = analyzeFixture('creative-client-project-recovery', FIXTURE);
const creativeFixture = analyzeFixture('creative-cv', CREATIVE_FIXTURE);
const richFixture = analyzeFixture('creative-experience-rich', RICH_FIXTURE);

const lines = [
  '# CREATIVE_CLIENT_PROJECT_RECOVERY_REPORT',
  '',
  `**Engine:** \`${CREATIVE_CLIENT_PROJECT_RECOVERY}\``,
  `**Status:** ${qa.pass ? 'PASS' : 'FAIL'}`,
  `**Generated:** ${new Date().toISOString()}`,
  '',
  '## Goal',
  '',
  'Recover creative CV client brands and project history into `clients[]` and `projects[]` without promoting brands into fake experience entries.',
  '',
  '## Rules',
  '',
  '- Clients stay in `clients[]` unless a source line contains **role + date + company** (then it is treated as a job row, not a client harvest line).',
  '- Recovery scans unsorted lines, experience bullets, summaries, and full raw text.',
  '- Experience count must not inflate from client recovery.',
  '',
  '## Anchor clients',
  '',
  CREATIVE_RECOVERY_CLIENT_ANCHORS.map((c) => `- ${c}`).join('\n'),
  '',
  '## Project type keywords',
  '',
  CREATIVE_RECOVERY_PROJECT_TYPES.map((p) => `- ${p}`).join('\n'),
  '',
  '## QA',
  '',
  '```',
  qa.out,
  '```',
  '',
  '## Fixture results',
  '',
  '| Fixture | clients | projects | experiences | client recall | project recall |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
  [recoveryFixture, creativeFixture, richFixture]
    .map(
      (f) =>
        `| ${f.label} | ${f.clients.length} | ${f.projects.length} | ${f.experiences} | ${f.audit.clientRecallPct}% | ${f.audit.projectTypeRecallPct}% |`
    )
    .join('\n'),
  '',
  '### Recovery fixture — clients',
  '',
  ...(recoveryFixture.clients.length
    ? recoveryFixture.clients.map((c) => `- ${c}`)
    : ['- _(none)_']),
  '',
  '### Recovery fixture — projects',
  '',
  ...(recoveryFixture.projects.length
    ? recoveryFixture.projects.map((p) => `- ${p}`)
    : ['- _(none)_']),
  '',
  '## Metadata stats (recovery fixture)',
  '',
  '```json',
  JSON.stringify(recoveryFixture.stats, null, 2),
  '```',
  '',
  '## QA JSON',
  '',
  qaJson ? `\`${path.relative(ROOT, QA_JSON)}\`` : '_not generated_',
  '',
];

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(qa.pass ? 0 : 1);
