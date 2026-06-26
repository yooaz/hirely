#!/usr/bin/env node
/**
 * HIRELY P2 — Premium import experience QA (4 product stages, real progress hooks).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const INDEX = path.join(ROOT, 'index.html');
const STAGES_JS = path.join(ROOT, 'src/ui/product/import-analysis-stages.js');
const OUT = path.join(ROOT, 'tests/output/premium-import-experience/report.json');

const STEPS_EN = [
  { id: 'file', label: 'Reading document', key: 'importProgressRead' },
  { id: 'extract', label: 'Extracting content', key: 'importProgressExtract' },
  { id: 'sections', label: 'Organizing sections', key: 'importProgressSections' },
  { id: 'prepare', label: 'Preparing your CV', key: 'importProgressPrepare' },
];

const STEPS_FR = [
  { id: 'file', label: 'Lecture du document', key: 'importProgressRead' },
  { id: 'extract', label: 'Extraction du contenu', key: 'importProgressExtract' },
  { id: 'sections', label: 'Organisation des sections', key: 'importProgressSections' },
  { id: 'prepare', label: 'Préparation de votre CV', key: 'importProgressPrepare' },
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

  for (const step of STEPS_EN) {
    const pass =
      html.includes(`${step.key}:'${step.label}'`) ||
      html.includes(`${step.key}:"${step.label}"`);
    checks.push({ id: step.id, locale: 'en', label: step.label, pass });
    ok(pass, `EN stage ${step.id}: ${step.label}`);
  }

  for (const step of STEPS_FR) {
    const pass =
      html.includes(`${step.key}:'${step.label}'`) ||
      html.includes(`${step.key}:"${step.label}"`);
    checks.push({ id: step.id, locale: 'fr', label: step.label, pass });
    ok(pass, `FR stage ${step.id}: ${step.label}`);
  }

  ok(stagesJs.includes('STAGES') && (stagesJs.match(/id: '/g) || []).length === 4, 'exactly 4 stages');
  ok(html.includes('IMPORT_LOG_TO_UX'), 'pipeline steps drive loading UX');
  ok(html.includes('IMPORT_UX_ORDER'), 'forward-only progress order');
  ok(/IMPORT_PARSING\]:'sections'/.test(html), 'parsing phase maps to organizing sections');
  ok(html.includes('importRaceTimeout'), 'import cannot spin forever');
  ok(html.includes('IMPORT_LOADING_PASTE_MS=8000'), '8s paste hint');
  ok(html.includes('OCR_UX_FULL_FALLBACK_MS=20000'), '20s OCR paste fallback');
  ok(html.includes('userFacingImportError'), 'technical errors sanitized');
  ok(html.includes('IMPORT_TIMEOUT_USER_MSG'), 'friendly timeout message');
  ok(!/show\(t\('importPipelineFail'\)/.test(html), 'no technical importPipelineFail toast');
  ok(html.includes('importAnalysisStages'), '4-stage stepper host');
  ok(html.includes('importLoadingDetail'), 'active stage detail line');
  ok(html.includes('startImportLoadingUx'), 'loading UX orchestrator');
  ok(/wsImport\.wsImport--loading \.progress\{display:block!important/.test(html), 'progress bar visible while loading');

  const report = {
    feature: 'PREMIUM_IMPORT_EXPERIENCE',
    generatedAt: new Date().toISOString(),
    stepsEn: STEPS_EN,
    stepsFr: STEPS_FR,
    checks,
    pass: failed === 0,
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(failed ? '\nFAIL premium-import-experience' : '\nPASS premium-import-experience');
  process.exit(failed ? 1 : 0);
}

main();
