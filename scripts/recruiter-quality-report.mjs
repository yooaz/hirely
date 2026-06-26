#!/usr/bin/env node
/**
 * H5 recruiter quality audit report.
 * node scripts/recruiter-quality-report.mjs
 * Output: RECRUITER_QUALITY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../src/core/validation/sanitize-resume-display.js';
import { runRecruiterAudit } from '../src/core/validation/recruiter-audit.js';
import { RECRUITER_QUALITY_V1 } from '../src/core/validation/recruiter-quality-audit.js';
import { STRESS_FIXTURES, resolveFixtureText } from '../tests/lib/stress-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'RECRUITER_QUALITY_REPORT.md');

const CHECK_LABELS = {
  missing_dates: 'Missing dates',
  missing_contact: 'Missing contact info',
  timeline_gaps: 'Timeline gaps',
  duplicate_roles: 'Duplicate roles',
  weak_descriptions: 'Weak descriptions',
  ats_compatibility: 'ATS compatibility',
};

function mdTable(headers, rows) {
  const sep = headers.map(() => '---');
  const body = rows.map((r) => headers.map((h) => String(r[h] ?? '').replace(/\|/g, '\\|')).join(' | '));
  return [`| ${headers.join(' | ')} |`, `| ${sep.join(' | ')} |`, ...body.map((r) => `| ${r} |`)].join('\n');
}

async function auditFixture(entry) {
  let raw = '';
  try {
    raw = resolveFixtureText(ROOT, entry).rawText;
  } catch {
    return null;
  }
  const imported = await runHirelyImportFromText(raw, { fileName: `${entry.id}.txt` });
  const cvData = sanitizeResumeForDisplay(imported?.cvData || imported?.resumeData || {});
  const audit = runRecruiterAudit(cvData, { resumeData: imported?.resumeData });
  return {
    id: entry.id,
    label: entry.label,
    score: audit.atsScore,
    band: audit.band?.label,
    checks: audit.checks || [],
    fixes: audit.fixes || [],
  };
}

async function main() {
  const fixtureResults = [];
  for (const fx of STRESS_FIXTURES) {
    const row = await auditFixture(fx);
    if (row) fixtureResults.push(row);
  }

  const summaryChecks = Object.fromEntries(
    Object.keys(CHECK_LABELS).map((k) => [k, { ok: 0, warn: 0, fail: 0, skip: 0 }])
  );
  for (const fx of fixtureResults) {
    for (const c of fx.checks) {
      const bucket = summaryChecks[c.id];
      if (bucket && bucket[c.status] !== undefined) bucket[c.status] += 1;
    }
  }

  const lines = [
    '# RECRUITER_QUALITY_REPORT',
    '',
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Engine: \`${RECRUITER_QUALITY_V1}\``,
    '',
    '## Summary',
    '',
    `- Fixtures audited: **${fixtureResults.length}**`,
    '- Checks run on **extracted cvData only** — no invented fields',
    '- Panel: recruiter mode → 6 quality dimensions + prioritized fixes',
    '',
    '## Quality dimensions',
    '',
    '| Check | Description |',
    '| --- | --- |',
    '| Missing dates | Experience rows without year/range in extracted data |',
    '| Missing contact | Email, phone, LinkedIn, location gaps |',
    '| Timeline gaps | >1 year between dated roles (from parsed years) |',
    '| Duplicate roles | Same role+company key repeated |',
    '| Weak descriptions | Short lines, few action verbs, no metrics |',
    '| ATS compatibility | Weighted ATS score from `ats-engine.js` |',
    '',
    '## Aggregate check status (fixtures)',
    '',
    mdTable(
      ['Check', 'OK', 'Warn', 'Fail', 'Skip'],
      Object.entries(CHECK_LABELS).map(([id, label]) => ({
        Check: label,
        OK: summaryChecks[id].ok,
        Warn: summaryChecks[id].warn,
        Fail: summaryChecks[id].fail,
        Skip: summaryChecks[id].skip,
      }))
    ),
    '',
    '## Fixture results',
    '',
  ];

  for (const fx of fixtureResults) {
    lines.push(`### ${fx.id} — ${fx.label}`);
    lines.push('');
    lines.push(`- Score: **${fx.score}** (${fx.band || '—'})`);
    lines.push(`- Fixes: ${fx.fixes.length}`);
    lines.push('');
    lines.push(
      mdTable(
        ['Check', 'Status', 'Count'],
        fx.checks.map((c) => ({
          Check: CHECK_LABELS[c.id] || c.id,
          Status: c.status,
          Count: c.count ?? (c.findings || []).length,
        }))
      )
    );
    if (fx.fixes.length) {
      lines.push('');
      lines.push('**Top fixes**');
      for (const f of fx.fixes.slice(0, 5)) {
        lines.push(`- [${f.severity}] ${f.issue} — ${f.fix}`);
      }
    }
    lines.push('');
  }

  lines.push('## Safety');
  lines.push('');
  lines.push('- All findings include `evidence` from existing cvData strings');
  lines.push('- No LLM inference; no synthetic experience or contact fields');
  lines.push('- `hallucinationSafe: true` on every audit result');
  lines.push('');
  lines.push('## Verification');
  lines.push('');
  lines.push('```bash');
  lines.push('node src/tests/recruiter-quality-test.mjs');
  lines.push('node src/tests/qa-ats-pipeline.mjs');
  lines.push('npm run recruiter:quality-report');
  lines.push('```');
  lines.push('');

  fs.writeFileSync(OUT_PATH, `${lines.join('\n')}\n`);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Fixtures: ${fixtureResults.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
