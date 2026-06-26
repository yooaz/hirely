#!/usr/bin/env node
/**
 * P4 — Generate EXPERIENCE_RECONSTRUCTION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'EXPERIENCE_RECONSTRUCTION_REPORT.md');
const JSON_PATH = path.join(ROOT, 'tests/output/experience-reconstruction-p4/report.json');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function runQa(script) {
  return spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

console.log('Running qa:experience-reconstruction-p4…');
const qaP4 = runQa('src/tests/qa-experience-reconstruction-p4.mjs');
console.log('Running qa:experience-reconstruction-engine…');
const qaEngine = runQa('src/tests/qa-experience-reconstruction-engine.mjs');

const data = readJson(JSON_PATH);
const pass = qaP4.status === 0 && qaEngine.status === 0 && data?.pass !== false;
const checks = data?.checks || [];
const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass);

const lines = [];
lines.push('# EXPERIENCE_RECONSTRUCTION_REPORT');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Verdict: **${pass ? 'PASS' : 'FAIL'}**`);
lines.push(`P4 checks: **${passed}/${checks.length}**`);
lines.push('');

lines.push('## P4 — Experience Reconstruction Engine');
lines.push('');
lines.push('Raw CV contains N jobs → preview must account for all N (auto + review + unsorted).');
lines.push('**Never discard** career content.');
lines.push('');
lines.push('### Full-document scan');
lines.push('- Detect **company**, **role**, **date** across entire document');
lines.push('- V1 inline reconstruction + V2 OCR harvest');
lines.push('- Candidate dedupe by employer + year');
lines.push('');
lines.push('### Confidence routing');
lines.push('');
lines.push('| Confidence | Action |');
lines.push('|------------|--------|');
lines.push('| **> 80%** | Auto-add to `experiences` |');
lines.push('| **40–80%** | Review queue |');
lines.push('| **< 40%** | `unsorted` (to-classify) |');
lines.push('');
lines.push('### Acceptance');
lines.push('');
lines.push('| Fixture | Target |');
lines.push('|---------|--------|');
lines.push(`| Five-job CV | 5 experiences in preview (latest: ${data?.fiveJobs?.auto ?? '—'}) |`);
lines.push('| Yoaz OCR fragmented | ≥ 5 auto + remainder queued/unsorted |');
lines.push('| Tier routing | auto / review / unsorted split |');
lines.push('');
lines.push('### Modules');
lines.push('');
lines.push('| File | Role |');
lines.push('|------|------|');
lines.push('| `experience-reconstruction-engine.js` | Segment parse, confidence score |');
lines.push('| `experience-reconstruction-engine-v2.js` | Full-document OCR harvest |');
lines.push('| `experience-reconstruction-confidence-router.js` | **P4** scan + tier routing |');
lines.push('');
lines.push('**Hook:** `section-engine-v2.js` → `runExperienceReconstructionEngine()` after V2 + universal recon.');
lines.push('');

if (failed.length) {
  lines.push('## Failed P4 checks');
  lines.push('');
  for (const f of failed) {
    lines.push(`- **${f.id}**${f.detail ? `: ${f.detail}` : ''}`);
  }
  lines.push('');
}

lines.push('## P4 checks');
lines.push('');
for (const c of checks) {
  lines.push(`- [${c.pass ? 'x' : ' '}] **${c.id}**${c.detail ? ` — ${c.detail}` : ''}`);
}
lines.push('');

lines.push('## Run');
lines.push('');
lines.push('```bash');
lines.push('npm run qa:experience-reconstruction-p4');
lines.push('npm run experience-reconstruction-report');
lines.push('npm run qa:experience-reconstruction-engine');
lines.push('npm run qa:experience-reconstruction-v2');
lines.push('```');

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(pass ? 0 : 1);
