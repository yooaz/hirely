#!/usr/bin/env node
/**
 * P0 — Generate EXTRACTION_LOSS_AUDIT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import {
  formatExtractionLossAuditMarkdown,
  summarizeExtractionLossAudits,
} from '../src/core/audit/extraction-loss-audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'EXTRACTION_LOSS_AUDIT.md');
const JSON_PATH = path.join(ROOT, 'tests/output/extraction-loss-audit/report.json');

function run(script) {
  const r = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout || ''}\n${r.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Extraction loss audit\n');

  const qa = run('src/tests/qa-extraction-loss-audit.mjs');
  console.log(qa.ok ? '  PASS qa-extraction-loss-audit' : '  FAIL qa-extraction-loss-audit');
  if (!qa.ok && qa.out) console.log(qa.out.slice(-4000));

  let data = null;
  try {
    if (fs.existsSync(JSON_PATH)) data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  } catch {
    data = null;
  }

  const audits = data?.fixtures || [];
  const summary =
    data?.summary ||
    summarizeExtractionLossAudits(audits) || {
      pass: false,
      total: 0,
      passed: 0,
      failed: 0,
      minRetentionPct: 0,
      avgRetentionPct: 0,
    };

  const md = formatExtractionLossAuditMarkdown(audits, summary);
  fs.writeFileSync(REPORT_PATH, md);

  console.log(`\nReport: ${REPORT_PATH}`);
  console.log(`Result: ${summary.pass && qa.ok ? 'PASS' : 'FAIL'}`);
  process.exit(summary.pass && qa.ok ? 0 : 1);
}

main();
