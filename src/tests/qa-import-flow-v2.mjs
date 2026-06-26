#!/usr/bin/env node
/**
 * Import Flow V2 — static QA (4 macro steps, 5 progress beats, reassuring copy).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

const MACRO_EN = [
  { id: 'drop', key: 'importFlowV2StepDrop', label: 'Drop CV' },
  { id: 'extract', key: 'importFlowV2StepExtract', label: 'Reading your CV' },
  { id: 'review', key: 'importFlowV2StepReview', label: 'Review detected info' },
  { id: 'generate', key: 'importFlowV2StepGenerate', label: 'Premium CV' },
];

const MICRO_EN = [
  { id: 'read', key: 'importFlowV2Reading', label: 'Reading file…' },
  { id: 'structure', key: 'importFlowV2Structure', label: 'Analyzing structure…' },
  { id: 'experience', key: 'importFlowV2Experience', label: 'Detecting experience…' },
  { id: 'build', key: 'importFlowV2Build', label: 'Building CV…' },
  { id: 'report', key: 'importFlowV2Report', label: 'Generating recruiter report…' },
];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const flowJs = fs.readFileSync(path.join(ROOT, 'src/ui/product/import-flow-v2.js'), 'utf8');
const flowCss = fs.readFileSync(path.join(ROOT, 'src/ui/product/import-flow-v2.css'), 'utf8');

ok(flowJs.includes('IMPORT_FLOW_V2'), 'engine constant');
ok(/importFlowV2__macro/.test(flowCss), 'macro stepper styles');
ok(/importFlowV2__orb/.test(flowCss), 'extraction animation');
ok(html.includes('import-flow-v2.js'), 'index loads import-flow-v2.js');
ok(html.includes('import-flow-v2.css'), 'index links import-flow-v2.css');
ok(html.includes('id="importFlowV2"'), 'import flow host in markup');
ok(html.includes('HirelyImportFlowV2'), 'wired HirelyImportFlowV2');
ok(html.includes('importFlowV2Reading'), 'V2 reading progress key');
ok(html.includes('importFlowV2Reassure'), 'reassurance copy key');
ok(/IMPORT_UX_ORDER=\['read','structure','experience','build','report'\]/.test(html), '5-step forward order');
ok(html.includes("importFlowV2Report"), 'recruiter report progress key');
ok(flowJs.includes('onImportStart'), 'onImportStart hook');
ok(flowJs.includes('syncDocStep'), 'syncDocStep for doc navigation');

for (const step of MACRO_EN) {
  ok(html.includes(step.key), `macro EN key ${step.key}`);
}
for (const step of MICRO_EN) {
  ok(html.includes(step.key), `micro EN key ${step.key}`);
}

ok(html.includes("importFlowV2StepDrop:'Déposer le CV'"), 'macro FR drop step');
ok(html.includes("importFlowV2Reading:'Lecture du fichier…'"), 'micro FR reading');

console.log(failed ? `\n${failed} check(s) failed` : '\nAll Import Flow V2 checks passed');
process.exit(failed ? 1 : 0);
