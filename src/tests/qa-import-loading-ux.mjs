#!/usr/bin/env node
/**
 * HIRELY UX — Import progress experience QA (UI-only, 4 stages).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const INDEX = path.join(ROOT, 'index.html');
const STAGES_JS = path.join(ROOT, 'src/ui/product/import-analysis-stages.js');
const OUT = path.join(ROOT, 'tests/output/import-loading-ux/report.json');

const STEPS = [
  { id: 'file', label: 'Lecture du document', key: 'importProgressRead', detailKey: 'importProgressReadDetail' },
  { id: 'extract', label: 'Extraction du contenu', key: 'importProgressExtract', detailKey: 'importProgressExtractDetail' },
  { id: 'sections', label: 'Organisation des sections', key: 'importProgressSections', detailKey: 'importProgressSectionsDetail' },
  { id: 'prepare', label: 'Préparation de votre CV', key: 'importProgressPrepare', detailKey: 'importProgressPrepareDetail' },
];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function main() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const stagesJs = fs.existsSync(STAGES_JS) ? fs.readFileSync(STAGES_JS, 'utf8') : '';
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const checks = [];

  for (const step of STEPS) {
    const pass = html.includes(step.key) && (stagesJs.includes(step.id) || html.includes(`'${step.id}'`));
    checks.push({ id: step.id, label: step.label, pass });
    ok(pass, `stage ${step.id}: ${step.key}`);
    ok(html.includes(step.detailKey), `stage detail ${step.id}: ${step.detailKey}`);
  }

  ok(stagesJs.includes('STAGES') && (stagesJs.match(/id: '/g) || []).length === 4, 'exactly 4 stages in import-analysis-stages.js');
  ok(!html.includes('10 à 30 secondes'), 'no legacy 10–30s wait copy');
  ok(/importLoadWait.*quelques secondes selon le fichier/.test(html), 'estimated wait copy');
  ok(/importLoadPasteHint.*coller le texte du CV/.test(html), '8s paste hint copy');
  ok(html.includes('IMPORT_FALLBACK_UX_LEAD') && html.includes('Lecture incomplète. Collez le texte du CV pour continuer.'), 'timeout user message');
  ok(html.includes('importLoadingDetail'), 'loading detail element');
  ok(html.includes('importLoadingWait'), 'loading wait element');
  ok(html.includes('importLoadingPasteHint'), 'paste hint element');
  ok(html.includes('importAnalysisStages'), '4-stage stepper host');
  ok(html.includes('startImportLoadingUx'), 'loading UX orchestrator');
  ok(html.includes('IMPORT_LOADING_PASTE_MS=8000'), '8s paste timer');
  ok(html.includes('userFacingImportError'), 'technical error sanitizer');
  ok(/wsImport\.wsImport--loading \.progress\{display:block!important/.test(html), 'progress visible while loading');
  ok(!/show\(t\('importPipelineFail'\)/.test(html), 'no technical importPipelineFail toast');
  ok(!/catch\(parserErr\)[\s\S]{0,280}importPipelineFail/.test(html), 'parser catch avoids technical toast');

  const report = {
    feature: 'IMPORT_PROGRESS_UX',
    generatedAt: new Date().toISOString(),
    steps: STEPS,
    checks,
    pass: failed === 0,
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(failed ? '\nFAIL import-loading-ux' : '\nPASS import-loading-ux');
  process.exit(failed ? 1 : 0);
}

main();
