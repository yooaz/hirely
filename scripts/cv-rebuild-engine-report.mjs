#!/usr/bin/env node
/**
 * Generate REBUILD_ENGINE_REPORT.md
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  CV_REBUILD_ENGINE_V1,
  REBUILD_PIPELINE,
  runCvRebuildEngine,
} from '../src/core/pipeline/cv-rebuild-engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gate = spawnSync('node', ['src/tests/qa-cv-rebuild-engine.mjs'], { cwd: root, encoding: 'utf8' });
const gateOk = gate.status === 0;

const yoazTxt = readFileSync(join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8');
const creativeTxt = readFileSync(join(root, 'tests/fixtures/creative-cv/fixture.txt'), 'utf8');

const fixtures = [
  { id: 'yoaz-txt', label: 'Yoaz TXT', input: { rawText: yoazTxt, extractionMethod: 'txt' } },
  { id: 'creative-paste', label: 'Creative paste', input: { rawText: creativeTxt, extractionMethod: 'paste' } },
];

const rows = fixtures.map((f) => ({
  ...f,
  result: runCvRebuildEngine(f.input),
}));

const lines = [];
lines.push('# CV Rebuild Engine Report');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
lines.push(`**Engine:** \`${CV_REBUILD_ENGINE_V1}\``);
lines.push(`**QA gate:** ${gateOk ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## Policy');
lines.push('');
lines.push('Instead of preserving original layout, Hirely **rebuilds from extracted data**.');
lines.push('');
lines.push('- **Never rely on source formatting** — columns, tabs, geometry, and layout hints are discarded.');
lines.push('- **Output must always be clean** — semantic fields only, normalized and contract-locked.');
lines.push('- Templates receive rebuilt `cvData`, not source structure.');
lines.push('');
lines.push('## Pipeline');
lines.push('');
lines.push('```');
lines.push('CV → Extract → Structure → Normalize → Rebuild');
lines.push('```');
lines.push('');
lines.push('| Stage | Module | Role |');
lines.push('|-------|--------|------|');
lines.push('| Extract | `enterprise-engine.js`, `cv-normalizer.js` | Raw text / lines → cleaned extraction |');
lines.push('| Structure | `p0-pipeline.js`, `structured-resume-from-blocks.js` | Blocks → semantic `structuredResume` |');
lines.push('| Normalize | `cv-normalizer.js`, `resume-data.js` | Strip formatting artifacts, normalize fields |');
lines.push('| Rebuild | `final-resume-contract.js`, `resume-data.js` | `finalResumeData` + clean `cvData` |');
lines.push('');
lines.push('## Architecture');
lines.push('');
lines.push('| Layer | Path | Role |');
lines.push('|-------|------|------|');
lines.push('| Engine | `src/core/pipeline/cv-rebuild-engine.js` | Orchestrates 4-stage rebuild pipeline |');
lines.push('| Import wire | `src/core/pipeline/hirely-import.js` | `applyCvRebuildEngine` patches import result |');
lines.push('| QA | `src/tests/qa-cv-rebuild-engine.mjs` | Fixture matrix + audit gates |');
lines.push('');
lines.push('## Stages');
lines.push('');
for (const stage of REBUILD_PIPELINE) {
  lines.push(`- **${stage}**`);
}
lines.push('');
lines.push('## Fixture matrix');
lines.push('');
lines.push('| Fixture | Audit clean | Renderable | Identity | Experiences | Violations |');
lines.push('|---------|-------------|------------|----------|-------------|------------|');
for (const { label, result } of rows) {
  const name =
    result.finalResumeData?.identity?.name ||
    result.cvData?.name ||
    result.cvData?.identity?.name ||
    '—';
  const expCount = (result.finalResumeData?.experiences || result.cvData?.experience || []).length;
  lines.push(
    `| ${label} | ${result.audit?.clean} | ${result.renderable} | ${name} | ${expCount} | ${(result.audit?.violations || []).join(', ') || '—'} |`
  );
}
lines.push('');
lines.push('## Audit checks');
lines.push('');
lines.push('- `never_preserves_layout` — metadata flag set');
lines.push('- `rebuild_engine_version` — `CV_REBUILD_ENGINE_V1`');
lines.push('- `no_forbidden_cv_keys` — no `_sourceLines`, layout blocks, forensic payloads');
lines.push('- `no_layout_meta` — no `layoutType`, `bbox`, column geometry in output meta');
lines.push('- `no_tab_alignment` / `no_multi_space_alignment` — source column formatting stripped');
lines.push('- `has_identity` — rebuilt CV has a name');
lines.push('');
lines.push('## Verification');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:cv-rebuild-engine');
lines.push('npm run cv-rebuild-engine-report');
lines.push('```');
lines.push('');
if (!gateOk && gate.stderr) {
  lines.push('### QA stderr');
  lines.push('');
  lines.push('```');
  lines.push(gate.stderr.trim().slice(0, 2000));
  lines.push('```');
}

writeFileSync(join(root, 'REBUILD_ENGINE_REPORT.md'), lines.join('\n') + '\n', 'utf8');
console.log('Wrote REBUILD_ENGINE_REPORT.md');
process.exit(gateOk ? 0 : 1);
