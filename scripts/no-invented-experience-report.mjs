#!/usr/bin/env node
/**
 * P0 — Generate NO_INVENTED_EXPERIENCE_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'NO_INVENTED_EXPERIENCE_REPORT.md');
const JSON_PATH = path.join(ROOT, 'tests/output/no-invented-experience/report.json');

function run(script) {
  const r = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout || ''}\n${r.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — No invented experience audit\n');
  const qa = run('src/tests/qa-no-invented-experience.mjs');
  console.log(qa.ok ? '  PASS qa-no-invented-experience' : '  FAIL qa-no-invented-experience');

  let data = null;
  try {
    if (fs.existsSync(JSON_PATH)) data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  } catch {
    data = null;
  }

  const pass = qa.ok && data?.pass;

  const rows = (data?.audits || [])
    .map(
      (a) =>
        `| ${a.id} | ${a.experienceCount} | ${a.clientCount} | ${(a.clients || []).slice(0, 6).join(', ') || '—'} | ${a.hits?.length ? '✗' : '✓'} |`
    )
    .join('\n');

  const lines = [
    '# HIRELY P0 — Stop Invented Experience Sentences',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'CV export was generating fake experience lines such as:',
    '- `Contributed as at Present`',
    '- `Contributed as at Nike`',
    '- `Contributed as at Converse`',
    '- `Contributed as at Louis Vuitton`',
    '',
    '## Rules (locked)',
    '',
    '- Never convert client names into experience rows',
    '- Never generate `Contributed as at…`',
    '- Never invent company/date/role combinations',
    '- Clients stay in `clients[]` unless source has role + company + date',
    '- Uncertain lines → `reviewQueue`, not `finalResumeData.experiences`',
    '',
    '## Root causes fixed',
    '',
    '| Layer | Issue | Fix |',
    '|-------|-------|-----|',
    '| `creative-experience-recovery-engine.js` | `expandClientEngagements` spawned per-client fake jobs | Clients merged into parent `clients[]`; expansion returns `[]` |',
    '| `sanitize-resume-display.js` | `normalizeDisplayExperience` invented bullets when empty | Removed fabricated bullet templates |',
    '| `final-cv-readability.js` | `normalizeFreelanceHero` / `normalizeMccannHero` hardcoded bullets | Preserve source bullets only; strip invented at pass end |',
    '| `invented-experience-guard.js` | — | New P0 guard: client-only rows, invented bullets, `expandedFromClient` |',
    '| `undetected-label.js` | Audit missed invented bullets | Extended `FABRICATED_EXPORT_PATTERNS` + bullet scan |',
    '',
    '## Audited modules',
    '',
    '- Experience reconstruction — `creative-experience-recovery-engine.js`, `experience-reconstruction-engine-v2.js`',
    '- Client recovery — `mergeClientsIntoParentExperience`, `extractCreativeClientEntities`',
    '- Semantic repair — `experience-semantic-layer.js` (no invented bullets on empty)',
    '- Final builder — `sanitize-resume-display.js` → `buildFinalResumeData`',
    '',
    '## Fixture results',
    '',
    '| Fixture | Experiences | Clients | Sample clients | Invented-free |',
    '|---------|------------:|--------:|----------------|:-------------:|',
    rows || '| — | — | — | — | — |',
    '',
    '## Acceptance',
    '',
    pass
      ? '**PASS** — No fake experience sentences. Client brands render in Clients section only. Experience rows require role + company + dates.'
      : '**FAIL** — See QA output below.',
    '',
    '## Run',
    '',
    '```bash',
    'npm run test:no-invented-experience',
    '```',
    '',
  ];

  if (!pass && qa.out) {
    lines.push('## QA output', '', '```', qa.out.slice(0, 8000), '```', '');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
