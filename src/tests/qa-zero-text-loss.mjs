#!/usr/bin/env node
/**
 * ZERO TEXT LOSS — rawChars === structuredChars + archivedChars
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { runProductionExtractionPipeline } from '../core/pipeline/production-pipeline.js';
import {
  assertZeroTextLossBalance,
  buildZeroTextLossAudit,
  recoverOrphansToUnsortedArchive,
} from '../core/parsing/zero-text-loss.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = readFileSync(join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const { structured } = runSectionEngineV2(fixture, { rawText: fixture });
const audit = structured.metadata?.zeroTextLossAudit || buildZeroTextLossAudit(fixture, structured);

ok(audit.rawChars > 0, 'rawChars > 0');
ok(audit.structuredChars >= 0, 'structuredChars computed');
ok(audit.archivedChars >= 0, 'archivedChars computed');
ok(audit.balanced === true, `balanced (${audit.rawChars} = ${audit.structuredChars} + ${audit.archivedChars})`);
ok(
  audit.rawChars === audit.structuredChars + audit.archivedChars,
  'rawChars === structuredChars + archivedChars'
);
ok(audit.lossChars === 0, 'lossChars === 0');

const orphan = `ORPHAN_MARKER_${Date.now()}`;
const withOrphan = recoverOrphansToUnsortedArchive(`${fixture}\n${orphan}`, { ...structured });
ok(
  (withOrphan.unsortedArchive || []).some((x) => String(x.text || x).includes('ORPHAN_MARKER')),
  'unclassified line → UNSORTED_ARCHIVE'
);
const audit2 = buildZeroTextLossAudit(`${fixture}\n${orphan}`, withOrphan);
ok(audit2.balanced, 'balanced after orphan recovery');

try {
  assertZeroTextLossBalance(fixture, structured);
  ok(true, 'assertZeroTextLossBalance passes');
} catch (e) {
  ok(false, `unexpected PipelineLossError: ${e.message}`);
}

const empty = recoverOrphansToUnsortedArchive('LOST_LINE_ONLY', emptyStructured());
function emptyStructured() {
  return {
    identity: { name: 'A', title: '', email: '', phone: '' },
    summary: '',
    experiences: [],
    education: [],
    skills: [],
    unsorted: [],
    unsortedArchive: [],
  };
}
const badAudit = buildZeroTextLossAudit('LOST_LINE_ONLY', empty);
ok(badAudit.archivedChars >= 'LOST_LINE_ONLY'.length, 'orphan chars archived');

const pipe = await runProductionExtractionPipeline(fixture, { extractionMethod: 'paste' });
ok(pipe.structuredResume?.metadata?.zeroTextLossAudit?.balanced === true, 'pipeline zero text loss balanced');

if (failed) process.exit(1);
console.log('\nqa-zero-text-loss: all passed');
