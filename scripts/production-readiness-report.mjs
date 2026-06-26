#!/usr/bin/env node
/**
 * HIRELY P2 — Generate PRODUCTION_READINESS_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import {
  P2_FIXTURE_COUNT,
  P2_GOALS,
  P2_CATEGORIES,
  P2_READINESS_ENGINE,
} from '../tests/lib/p2-production-readiness-catalog.mjs';
import { PRODUCTION_TEMPLATE_IDS } from '../src/ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'PRODUCTION_READINESS_REPORT.md');
const JSON_PATH = path.join(ROOT, 'tests/output/p2-production-readiness/report.json');

function run(script) {
  const r = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout || ''}\n${r.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P2 — Production readiness audit\n');
  const qa = run('src/tests/qa-production-readiness.mjs');
  console.log(qa.ok ? '  PASS qa-production-readiness' : '  FAIL qa-production-readiness');

  let data = null;
  try {
    if (fs.existsSync(JSON_PATH)) data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  } catch {
    data = null;
  }

  const s = data?.summary || {};
  const pass = qa.ok && s.pass;

  const categoryRows = P2_CATEGORIES.map((cat) => {
    const c = s.byCategory?.[cat] || {};
    return `| ${cat} | ${c.count ?? 20} | ${c.avgPreservation ?? '—'}% | ${c.fullPass ?? '—'}/${c.count ?? 20} | ${c.crashes ?? 0} | ${c.blankTemplates ?? 0} | ${c.blankExports ?? 0} | ${c.dataLoss ?? 0} |`;
  }).join('\n');

  const failRows = (data?.results || [])
    .filter((r) => !r.fullPass)
    .slice(0, 25)
    .map(
      (r) =>
        `| ${r.id} | ${r.category} | ${r.templateId} | ${r.preservation?.preservationPct ?? '—'}% | ${(r.blockers || []).join(', ') || r.error || '—'} |`
    )
    .join('\n');

  const lines = [
    '# HIRELY P2 — Production Readiness',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    `**Engine:** \`${P2_READINESS_ENGINE}\``,
    `**Fixtures:** ${data?.count ?? P2_FIXTURE_COUNT} CVs (20 corporate · 20 creative · 20 freelance · 20 executive)`,
    '',
    '## Audit scope',
    '',
    'Full production readiness across **80 CV archetypes**:',
    '- Content preservation (cleaned text utilization + parser recall)',
    '- Template rendering (no blank HTML)',
    '- PDF export (A4, pages, bytes)',
    '- Review queue stability',
    '- Parser stability (no crashes)',
    '',
    '## PASS criteria',
    '',
    '| Gate | Threshold | Result |',
    '|------|-----------|--------|',
    `| Content preserved | ≥ ${P2_GOALS.contentPreservationMin}% avg | **${s.avgContentPreservation ?? '—'}%** |`,
    `| Blank templates | ${P2_GOALS.blankTemplatesMax} | **${s.blankTemplates ?? '—'}** |`,
    `| Blank exports | ${P2_GOALS.blankExportsMax} | **${s.blankExports ?? '—'}** |`,
    `| Parser crashes | ${P2_GOALS.parserCrashesMax} | **${s.parserCrashes ?? '—'}** |`,
    `| Data loss events | ${P2_GOALS.dataLossMax} | **${s.dataLossCount ?? '—'}** |`,
    `| Full pipeline pass | — | **${s.fullPass ?? '—'}/${s.count ?? P2_FIXTURE_COUNT}** (${s.fullPassRate ?? '—'}%) |`,
    '',
    '## By category',
    '',
    '| Category | CVs | Avg preservation | Full pass | Crashes | Blank tpl | Blank PDF | Data loss |',
    '|----------|----:|-----------------:|----------:|--------:|----------:|----------:|----------:|',
    categoryRows,
    '',
    '## Metrics measured',
    '',
    '| Dimension | Method |',
    '|-----------|--------|',
    '| Content preservation | max(anchor recall in resume+render, H6 parser recall, utilization boost) |',
    '| Template rendering | `renderCV()` HTML length ≥ 200, non-empty main |',
    '| PDF export | Playwright A4 print + `validatePdfHardening` |',
    '| Review queue | import completes with `IMPORT_SUCCESS` |',
    '| Parser stability | try/catch per fixture — zero throws |',
    '| Data loss | severe: no structured content, no unsorted, preservation < 70% |',
    '',
    '## Templates exercised',
    '',
    ...PRODUCTION_TEMPLATE_IDS.map((id) => `- \`${id}\``),
    '- `ats` · `ats-executive` (corporate/executive tiers)',
    '',
  ];

  if (failRows) {
    lines.push('## Failures (sample)');
    lines.push('');
    lines.push('| ID | Category | Template | Preservation | Blockers |');
    lines.push('|----|----------|----------|-------------:|----------|');
    lines.push(failRows);
    lines.push('');
  }

  lines.push('## Pipeline');
  lines.push('');
  lines.push('```');
  lines.push('Fixture text → runHirelyImportFromText → sanitizeResumeForDisplay');
  lines.push('  → resumeDataToCvData → renderCV(template) → layoutCvA4Pages → Playwright PDF');
  lines.push('  → audit: preservation · review queue · parser stability');
  lines.push('```');
  lines.push('');
  lines.push('## Module map');
  lines.push('');
  lines.push('| File | Role |');
  lines.push('|------|------|');
  lines.push('| `tests/lib/p2-production-readiness-catalog.mjs` | 80 CV catalog |');
  lines.push('| `tests/lib/p2-production-readiness-metrics.mjs` | Gate metrics + aggregation |');
  lines.push('| `src/tests/lib/p2-production-readiness-suite.mjs` | Suite runner |');
  lines.push('| `src/tests/qa-production-readiness.mjs` | QA acceptance |');
  lines.push('');
  lines.push('## Run');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run test:production-readiness');
  lines.push('```');
  lines.push('');
  lines.push('## Acceptance');
  lines.push('');
  lines.push(
    pass
      ? '**PASS** — 80 CVs audited. Content preservation ≥ 95%, zero blank templates/exports, zero parser crashes, zero data loss.'
      : '**FAIL** — See failures and QA output below.'
  );
  lines.push('');

  if (!pass && qa.out) {
    lines.push('## QA output', '', '```', qa.out.slice(0, 12000), '```', '');
  }

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`\nWrote ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
