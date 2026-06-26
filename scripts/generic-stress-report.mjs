#!/usr/bin/env node
/**
 * P1 generic parser stress report.
 * node scripts/generic-stress-report.mjs
 * Output: HIRELY_GENERIC_STRESS_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../src/core/validation/sanitize-resume-display.js';
import { resumeDataToCvData } from '../src/core/resume-data.js';
import { resolveFixtureText } from '../tests/lib/stress-catalog.mjs';
import {
  P1_GENERIC_STRESS_V1,
  P1_PRIMARY_FIXTURES,
  P1_YOAZ_VERIFY,
  P1_USABLE_GOAL,
} from '../tests/lib/p1-generic-stress-catalog.mjs';
import { evaluateGenericUsability } from '../tests/lib/p1-generic-stress-metrics.mjs';
import { scanParserHardcodeViolations } from '../tests/lib/universal-parser-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'HIRELY_GENERIC_STRESS_REPORT.md');

async function runFixture(entry) {
  const { rawText, fileName } = resolveFixtureText(ROOT, entry);
  const importResult = await runHirelyImportFromText(rawText, {
    source: entry.id,
    extractionMethod: 'paste',
    file: { name: fileName, type: 'text/plain', size: rawText.length },
  });
  const rd = sanitizeResumeForDisplay(importResult?.resumeData || {});
  const cv = resumeDataToCvData(rd);
  const usability = evaluateGenericUsability(rawText, rd, cv);
  return { entry, rd, cv, usability, importStatus: importResult?.importStatus };
}

function runGateScript(rel) {
  try {
    execSync(`node "${path.join(ROOT, rel)}"`, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const generatedAt = new Date().toISOString();
  const hardcode = scanParserHardcodeViolations(ROOT);

  const primaryRows = [];
  for (const entry of P1_PRIMARY_FIXTURES) {
    primaryRows.push(await runFixture(entry));
  }
  const yoazRow = await runFixture(P1_YOAZ_VERIFY);

  const usablePrimary = primaryRows.filter((r) => r.usability.usable).length;
  const gatePass = runGateScript('src/tests/p1-generic-stress.mjs');
  const universalPass = runGateScript('tests/lib/universal-parser-gate.mjs');
  const releasePass = runGateScript('src/tests/release-gate.mjs');

  const overallPass =
    hardcode.length === 0 &&
    usablePrimary >= P1_USABLE_GOAL &&
    yoazRow.usability.usable &&
    gatePass;

  const lines = [];
  lines.push('# HIRELY P1 — Generic Parser Stress Report');
  lines.push('');
  lines.push(`**Generated:** ${generatedAt}`);
  lines.push(`**Suite:** \`${P1_GENERIC_STRESS_V1}\``);
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  lines.push(`**${overallPass ? 'PASS' : 'FAIL'}**`);
  lines.push('');
  lines.push('## Acceptance');
  lines.push('');
  lines.push('| Criterion | Status |');
  lines.push('|-----------|--------|');
  lines.push(`| No P0 production-specific parser rules | ${hardcode.length === 0 ? 'PASS' : 'FAIL'} (${hardcode.length} violations) |`);
  lines.push(`| Yoaz CV parses via generic rules | ${yoazRow.usability.usable ? 'PASS' : 'FAIL'} |`);
  lines.push(`| ≥ ${P1_USABLE_GOAL}/6 primary fixtures usable | ${usablePrimary >= P1_USABLE_GOAL ? 'PASS' : 'FAIL'} (${usablePrimary}/6) |`);
  lines.push(`| Universal parser gate | ${universalPass ? 'PASS' : 'FAIL'} |`);
  lines.push(`| Release gate (templates + PDF) | ${releasePass ? 'PASS' : 'FAIL'} |`);
  lines.push('');
  lines.push('## Generic rules added');
  lines.push('');
  lines.push('- `generic-career-signals.js` — role words, freelance/intern patterns, date ranges, org context');
  lines.push('- Identity: top-line name scoring, email local-part fallback, no person literals');
  lines.push('- Education: dictionary-driven schools (`schools.json`) + generic degree keywords');
  lines.push('- OCR entity hints loaded from `CREATIVE_SCHOOLS` + `CREATIVE_AGENCIES` catalogs');
  lines.push('- UI classify/suggestion heuristics use generic school/education terms only');
  lines.push('');
  lines.push('## Specific rules removed');
  lines.push('');
  lines.push('- `import-repair.js` — removed `mccann|graphic designer` career line regex');
  lines.push('- `pipeline-contract.js` — removed McCann/freelance literal career signals');
  lines.push('- `review-queue-categories.js` — removed `lisaa|créapole` education hints');
  lines.push('- `creative-entity-guard.js` — removed inline LISAA/Créapole/McCann OCR hints');
  lines.push('- `index.html` — demo sample uses generic Alex Martin; `?test=demo` replaces `?test=yoaz`');
  lines.push('');
  lines.push('## Fixture results');
  lines.push('');
  lines.push('| Fixture | Usable | Name | Email | Phone | Exp | Edu | Skills | Lang | Issues |');
  lines.push('|---------|--------|------|-------|-------|-----|-----|--------|------|--------|');

  for (const row of [...primaryRows, yoazRow]) {
    const u = row.usability;
    const pick = (id) => u.checks.find((c) => c.id === id);
    const fmt = (id) => (pick(id)?.pass ? '✓' : '✗');
    lines.push(
      `| ${row.entry.label} | ${u.usable ? 'PASS' : 'FAIL'} | ${fmt('name')} | ${fmt('email')} | ${fmt('phone')} | ${fmt('experience')} | ${fmt('education')} | ${fmt('skills')} | ${fmt('languages')} | ${u.failures.join('; ') || '—'} |`
    );
  }

  lines.push('');
  lines.push('## Yoaz verification (generic only)');
  lines.push('');
  lines.push(`- Name: \`${yoazRow.rd?.identity?.name || yoazRow.cv?.name || '—'}\``);
  lines.push(`- Experience: ${yoazRow.rd?.experiences?.length || 0}`);
  lines.push(`- Education: ${yoazRow.rd?.education?.length || 0}`);
  lines.push(`- Skills+tools: ${(yoazRow.rd?.skills?.length || 0) + (yoazRow.rd?.tools?.length || 0)}`);
  lines.push('');
  lines.push('## Commands');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run stress:p1');
  lines.push('npm run stress:p1-report');
  lines.push('node tests/lib/universal-parser-gate.mjs');
  lines.push('```');
  lines.push('');

  fs.writeFileSync(OUT_MD, `${lines.join('\n')}\n`);
  console.log('Wrote', OUT_MD);
  console.log('Verdict:', overallPass ? 'PASS' : 'FAIL');
  process.exit(overallPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
