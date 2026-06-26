#!/usr/bin/env node
/**
 * P1 generic parser stress gate.
 * node src/tests/p1-generic-stress.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { resumeDataToCvData } from '../core/resume-data.js';
import { resolveFixtureText } from '../../tests/lib/stress-catalog.mjs';
import {
  P1_PRIMARY_FIXTURES,
  P1_YOAZ_VERIFY,
  P1_USABLE_GOAL,
} from '../../tests/lib/p1-generic-stress-catalog.mjs';
import { evaluateGenericUsability } from '../../tests/lib/p1-generic-stress-metrics.mjs';
import { scanParserHardcodeViolations } from '../../tests/lib/universal-parser-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

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
  return { entry, importResult, rd, cv, usability, fileName };
}

async function main() {
  const hardcode = scanParserHardcodeViolations(ROOT);
  ok(hardcode.length === 0, `no P0 hardcode in parser (${hardcode.length} violations)`);
  if (hardcode.length) hardcode.forEach((v) => console.error('  ', v));

  const primaryRows = [];
  for (const entry of P1_PRIMARY_FIXTURES) {
    primaryRows.push(await runFixture(entry));
  }

  const yoazRow = await runFixture(P1_YOAZ_VERIFY);

  let usableCount = 0;
  for (const row of primaryRows) {
    const { entry, usability } = row;
    if (usability.usable) usableCount++;
    ok(
      usability.usable,
      `${entry.id}: usable (${usability.failures.join('; ') || 'all checks'})`
    );
  }

  ok(usableCount >= P1_USABLE_GOAL, `usable fixtures ${usableCount}/${P1_PRIMARY_FIXTURES.length} (goal ${P1_USABLE_GOAL})`);

  ok(yoazRow.usability.usable, `yoaz-cv parses via generic rules (${yoazRow.usability.failures.join('; ') || 'ok'})`);
  ok(
    (yoazRow.rd?.experiences?.length || 0) >= 1,
    `yoaz-cv experience count ${yoazRow.rd?.experiences?.length || 0}`
  );

  console.log('\nP1 generic stress:', failed ? 'FAILED' : 'PASSED');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
