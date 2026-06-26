#!/usr/bin/env node
/**
 * P0 — Generate DATA_RETENTION_TRACE.json + DATA_RETENTION_TRACE_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const QA_JSON = path.join(ROOT, 'tests/output/data-retention-trace/report.json');

function run(script) {
  const r = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout || ''}\n${r.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — Data retention trace\n');
  const qa = run('src/tests/qa-data-retention-trace.mjs');
  console.log(qa.ok ? '  PASS qa-data-retention-trace' : '  FAIL qa-data-retention-trace');

  let data = null;
  try {
    if (fs.existsSync(QA_JSON)) data = JSON.parse(fs.readFileSync(QA_JSON, 'utf8'));
  } catch {
    data = null;
  }

  const pass = qa.ok && data?.pass;
  const jsonExists = fs.existsSync(path.join(ROOT, 'DATA_RETENTION_TRACE.json'));
  const mdExists = fs.existsSync(path.join(ROOT, 'DATA_RETENTION_TRACE_REPORT.md'));

  console.log(`  JSON: ${jsonExists ? 'DATA_RETENTION_TRACE.json' : 'missing'}`);
  console.log(`  MD:   ${mdExists ? 'DATA_RETENTION_TRACE_REPORT.md' : 'missing'}`);

  if (!pass) {
    if (qa.out) console.log('\n' + qa.out.slice(0, 3000));
    process.exit(1);
  }
  process.exit(0);
}

main();
