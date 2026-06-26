#!/usr/bin/env node
/**
 * CV Rebuild Engine QA — Extract → Structure → Normalize → Rebuild
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CV_REBUILD_ENGINE_V1,
  REBUILD_PIPELINE,
  runCvRebuildEngine,
  auditRebuildOutput,
} from '../core/pipeline/cv-rebuild-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const yoazTxt = readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8');
const creativeTxt = readFileSync(path.join(root, 'tests/fixtures/creative-cv/fixture.txt'), 'utf8');
const twoColJson = JSON.parse(
  readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/two-column-lines.json'), 'utf8')
);

function assertRebuildResult(result, label) {
  ok(result.version === CV_REBUILD_ENGINE_V1, `${label}: engine version`);
  ok(result.neverPreservesSourceLayout === true, `${label}: neverPreservesSourceLayout`);
  ok(
    JSON.stringify(result.pipeline) === JSON.stringify([...REBUILD_PIPELINE]),
    `${label}: pipeline stages`
  );
  ok(result.stages?.extract?.stage === 'extract', `${label}: extract stage`);
  ok(result.stages?.structure?.stage === 'structure', `${label}: structure stage`);
  ok(result.stages?.normalize?.stage === 'normalize', `${label}: normalize stage`);
  ok(result.stages?.rebuild?.stage === 'rebuild', `${label}: rebuild stage`);
  ok(result.structuredResume?.metadata?.rebuildFromData === true, `${label}: rebuildFromData meta`);
  ok(
    result.structuredResume?.metadata?.neverPreservesSourceLayout === true,
    `${label}: structured neverPreservesSourceLayout`
  );
  ok(result.audit?.clean === true, `${label}: audit clean (${result.audit?.violations?.join(', ') || 'none'})`);
  ok(!('_sourceLines' in (result.cvData || {})), `${label}: no _sourceLines in cvData`);
  ok(result.cvData && typeof result.cvData === 'object', `${label}: cvData object`);
  ok(
    result.finalResumeData?.identity?.name || result.cvData?.name || result.cvData?.identity?.name,
    `${label}: identity present`
  );
  ok(Array.isArray(result.cvData?.experience || result.cvData?.experiences), `${label}: experience array`);
}

const txtResult = runCvRebuildEngine({ rawText: yoazTxt, extractionMethod: 'txt' });
assertRebuildResult(txtResult, 'TXT fixture');

const creativeResult = runCvRebuildEngine({ rawText: creativeTxt, extractionMethod: 'paste' });
assertRebuildResult(creativeResult, 'creative paste');

const pdfLines = twoColJson.lines.map((l, i) => ({
  ...l,
  cleanedText: l.text,
  rawExtraction: l.text,
  confidence: 90,
  source: 'native',
  line: i,
}));
const twoColResult = runCvRebuildEngine({
  rawText: twoColJson.lines.map((l) => l.text).join('\n'),
  lines: pdfLines,
  extractionMethod: 'pdf',
});
assertRebuildResult(twoColResult, 'two-column PDF lines');
ok(
  twoColResult.stages?.structure?.layoutDetected != null ||
    twoColResult.stages?.structure?.blockPipeline?.layout?.layoutType,
  'two-column: layout was detected during structure (not preserved in output)'
);

const tabAligned = runCvRebuildEngine({
  rawText: 'Jane Doe\t\t\tSenior Designer\n\t\t\t\t\t\t  Paris',
  extractionMethod: 'paste',
});
ok(!/\t/.test(tabAligned.finalResumeData?.identity?.name || ''), 'tabs stripped from identity');
ok(tabAligned.audit?.checks?.find((c) => c.id === 'no_tab_alignment')?.ok === true, 'no tab alignment audit');

const emptyAudit = auditRebuildOutput({ cvData: {}, resumeData: {}, contract: { ok: false } });
ok(emptyAudit.clean === false, 'empty output fails audit');

console.log(failed ? `\nqa:cv-rebuild-engine FAILED (${failed})` : '\nqa:cv-rebuild-engine PASSED');
process.exit(failed ? 1 : 0);
