#!/usr/bin/env node
/**
 * HIRELY P1 — DATA LOSS AUDIT
 * node scripts/generate-data-loss-audit.mjs
 * Output: DATA_LOSS_AUDIT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  runDataLossP1Audit,
  formatDataLossAuditMarkdown,
} from '../src/debug/data-loss-p1-audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'DATA_LOSS_AUDIT.md');
const OUT_JSON = path.join(ROOT, 'tests/output/data-loss-audit/report.json');

const FIXTURE =
  process.env.HIRELY_DATA_LOSS_FIXTURE ||
  path.join(ROOT, 'tests/fixtures/developer-cv/fixture.txt');

const rawText = fs.readFileSync(FIXTURE, 'utf8');
const label = path.basename(path.dirname(FIXTURE)) || 'developer-cv';

const report = await runDataLossP1Audit(rawText, {
  label,
  extractionMethod: 'paste',
  templateId: 'ats',
});

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(REPORT_PATH, formatDataLossAuditMarkdown(report));
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

console.log(`DATA LOSS AUDIT: ${report.verdict}`);
console.log(`Report: ${REPORT_PATH}`);
console.log('');
console.log('Loss locations:');
for (const b of report.blockers) console.log(` - ${b}`);

process.exit(report.verdict === 'PASS' ? 0 : 1);
