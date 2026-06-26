#!/usr/bin/env node
/**
 * H7 import stability gate — no upload may crash the app.
 * node src/tests/h7-import-stability.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { H7_SCENARIOS } from '../../tests/lib/h7-import-catalog.mjs';
import {
  ensureH7Fixtures,
  runNodeImportScenario,
  runBrowserImportScenarios,
  summarizeRows,
} from '../../tests/lib/h7-import-runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

async function main() {
  const fixtures = ensureH7Fixtures(ROOT);
  ok(!!fixtures.pdf, 'PDF fixture available');

  const nodeKinds = ['pdf', 'pdf_large', 'pdf_scanned', 'corrupt_pdf', 'empty_name'];
  if (fixtures.docx) nodeKinds.push('docx');

  const nodeRows = [];
  for (const kind of nodeKinds) {
    const row = await runNodeImportScenario(ROOT, kind, fixtures);
    nodeRows.push(row);
    if (row.skipped) {
      console.log('SKIP node', kind, row.note);
      continue;
    }
    ok(row.pass, `node ${kind}: ${row.risk} — ${row.note}`);
  }

  const browserScenarios = H7_SCENARIOS.filter(
    (s) => s.channel.includes('browser')
  );
  const browserRows = await runBrowserImportScenarios(ROOT, browserScenarios, fixtures);
  for (const row of browserRows) {
    const id = row.scenario?.id || '?';
    if (row.skipped) {
      console.log('SKIP browser', id, row.note);
      continue;
    }
    ok(row.pass, `browser ${id}: ${row.risk} — ${row.note}`);
    ok(!row.busy, `browser ${id}: loading cleared`);
  }

  const summary = summarizeRows(nodeRows, browserRows);
  ok(summary.crashRisks.length === 0, `no crash risks (${summary.crashRisks.length})`);
  ok(summary.failCount === 0, `all scenarios stable (${summary.passCount}/${summary.total - summary.skipCount})`);

  console.log('\nH7 import stability:', failed ? 'FAILED' : 'PASSED');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
