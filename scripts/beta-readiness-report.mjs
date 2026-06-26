#!/usr/bin/env node
/**
 * HIRELY H9 — Beta readiness lock report.
 * Runs stable gates and writes BETA_READINESS_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'BETA_READINESS_REPORT.md');
const P7_REPORT = path.join(ROOT, 'tests/output/p7-final-lock/report.json');

const H9_COMMANDS = [
  { id: 'check_exports', script: 'check:exports', label: 'Missing exports' },
  { id: 'check_core', script: 'check:core', label: 'Core boot' },
  { id: 'p7_final_lock', script: 'qa:p7-final-lock', label: 'P7 final lock (browser E2E)' },
  { id: 'p7_stress', script: 'qa:p7-stress-test', label: 'P7 stress pipeline' },
  { id: 'pdf_hardening', script: 'qa:pdf-export-hardening', label: 'PDF export hardening' },
  { id: 'template_h3', script: 'qa:template-h3-polish', label: 'Template H3 polish' },
];

const P7_CRITERIA = [
  { id: 'upload_works', match: ['1_import_pdf', '2_import_docx'], label: 'Upload works' },
  { id: 'paste_fallback', match: ['3_paste_text'], label: 'Paste / text import works' },
  { id: 'review_visible', match: ['4_review_suggestions', '3_export_ready_after_import'], label: 'Review visible' },
  { id: 'ats_visible', match: ['6_ats_visible', '6_ats_updates'], label: 'ATS visible' },
  { id: 'pdf_export', match: ['9_export_pdf'], label: 'PDF export works' },
  { id: 'templates_3', match: ['8_switch_style'], label: '3 templates work' },
  { id: 'no_fatal_console', match: ['no_fatal_console'], label: 'No fatal console errors' },
];

function runNpm(script) {
  const res = spawnSync('npm', ['run', script], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;
  return {
    script,
    pass: res.status === 0,
    status: res.status ?? 1,
    output: out.trim(),
  };
}

function parseSignals(output) {
  const signals = {
    coreBootFailed: /CORE_BOOT_FAILED|Duplicate export of/i.test(output),
    missingExport: /MISSING_EXPORT_AUDIT FAIL|\d+ issue\(s\)/i.test(output) && !/0 issue/i.test(output),
    fatalConsole: /no_fatal_console.*FAIL|Fatal console:/i.test(output),
  };
  return signals;
}

function loadP7Results() {
  if (!fs.existsSync(P7_REPORT)) return null;
  try {
    return JSON.parse(fs.readFileSync(P7_REPORT, 'utf8'));
  } catch {
    return null;
  }
}

function evaluateP7Criteria(p7) {
  if (!p7?.results) {
    return P7_CRITERIA.map((c) => ({ ...c, pass: false, detail: 'p7 report missing' }));
  }
  const byId = Object.fromEntries(p7.results.map((r) => [r.id, r]));
  return P7_CRITERIA.map((c) => {
    const rows = c.match.map((id) => byId[id]).filter(Boolean);
    const pass = rows.length === c.match.length && rows.every((r) => r.pass);
    const detail = rows.map((r) => `${r.id}:${r.pass ? 'ok' : r.detail || 'fail'}`).join('; ');
    return { ...c, pass, detail: detail || 'check missing' };
  });
}

function main() {
  console.log('HIRELY H9 — Beta readiness lock\n');

  const commandResults = [];
  const blockers = [];
  const allSignals = { coreBootFailed: false, missingExport: false, fatalConsole: false };

  for (const cmd of H9_COMMANDS) {
    console.log(`> npm run ${cmd.script}`);
    const res = runNpm(cmd.script);
    const signals = parseSignals(res.output);
    if (cmd.id === 'check_core') allSignals.coreBootFailed ||= signals.coreBootFailed;
    if (cmd.id === 'check_exports') allSignals.missingExport ||= signals.missingExport;
    if (cmd.id === 'p7_final_lock') allSignals.fatalConsole ||= signals.fatalConsole;

    commandResults.push({ ...cmd, ...res, signals });
    console.log(res.pass ? `  PASS ${cmd.label}` : `  FAIL ${cmd.label}`);
    if (!res.pass) blockers.push(`${cmd.label} (npm run ${cmd.script})`);
    if (signals.coreBootFailed) blockers.push('CORE_BOOT_FAILED');
    if (signals.missingExport) blockers.push('Missing export detected');
  }

  const p7 = loadP7Results();
  const p7Criteria = evaluateP7Criteria(p7);
  for (const c of p7Criteria) {
    if (!c.pass) blockers.push(`${c.label}: ${c.detail}`);
  }
  if (p7?.consoleErrors?.length) {
    allSignals.fatalConsole = true;
    if (!blockers.some((b) => b.includes('fatal console'))) {
      blockers.push(`Fatal console: ${p7.consoleErrors.slice(0, 2).join(' | ')}`);
    }
  }

  const commandsPass = commandResults.every((r) => r.pass);
  const p7Pass = p7Criteria.every((c) => c.pass);
  const signalsPass = !allSignals.coreBootFailed && !allSignals.missingExport && !allSignals.fatalConsole;
  const pass = commandsPass && p7Pass && signalsPass;

  const uniqueBlockers = [...new Set(blockers)];

  const lines = [];
  lines.push('# HIRELY H9 — Beta Readiness Lock');
  lines.push('');
  lines.push(`**Result:** ${pass ? 'PASS' : 'FAIL'}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Command gates');
  lines.push('');
  lines.push('| Command | Status |');
  lines.push('|---------|--------|');
  for (const r of commandResults) {
    lines.push(`| \`npm run ${r.script}\` | ${r.pass ? 'PASS' : 'FAIL'} |`);
  }
  lines.push('');
  lines.push('## Product criteria (from P7 final lock)');
  lines.push('');
  lines.push('| Criterion | Status | Detail |');
  lines.push('|-----------|--------|--------|');
  for (const c of p7Criteria) {
    lines.push(`| ${c.label} | ${c.pass ? 'PASS' : 'FAIL'} | ${String(c.detail || '').replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
  lines.push('## Signal checks');
  lines.push('');
  lines.push(`| Signal | Status |`);
  lines.push(`|--------|--------|`);
  lines.push(`| CORE_BOOT_FAILED | ${allSignals.coreBootFailed ? 'FAIL' : 'PASS'} |`);
  lines.push(`| Missing export | ${allSignals.missingExport ? 'FAIL' : 'PASS'} |`);
  lines.push(`| Fatal console errors | ${allSignals.fatalConsole ? 'FAIL' : 'PASS'} |`);
  lines.push('');
  if (!pass) {
    lines.push('## Remaining blockers');
    lines.push('');
    if (!uniqueBlockers.length) lines.push('_None listed — inspect command output._');
    else for (const b of uniqueBlockers) lines.push(`- ${b}`);
    lines.push('');
  } else {
    lines.push('## Remaining blockers');
    lines.push('');
    lines.push('_None — beta lock ready._');
    lines.push('');
  }
  lines.push('## Run');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run beta-readiness-report');
  lines.push('```');

  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
  console.log(`\nWrote ${OUT}`);
  console.log(pass ? '\nH9 BETA READINESS: PASS' : `\nH9 BETA READINESS: FAIL (${uniqueBlockers.length} blockers)`);
  if (!pass) {
    for (const b of uniqueBlockers) console.log(`  - ${b}`);
  }

  process.exit(pass ? 0 : 1);
}

main();
