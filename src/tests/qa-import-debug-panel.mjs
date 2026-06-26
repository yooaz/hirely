#!/usr/bin/env node
/**
 * P0 — Import debug panel QA (developer-only).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const INDEX = path.join(ROOT, 'index.html');
const PANEL_JS = path.join(ROOT, 'src/ui/product/import-debug-panel.js');
const PANEL_CSS = path.join(ROOT, 'src/ui/product/import-debug-panel.css');
const OUT = path.join(ROOT, 'tests/output/import-debug-panel/report.json');

const REQUIRED_STEPS = [
  'IMPORT_STARTED',
  'TEXT_EXTRACTED',
  'PARSER_DONE',
  'FINAL_RESUME_READY',
  'REVIEW_SCREEN_VISIBLE',
];

const REQUIRED_METRICS = [
  'PDF imported',
  'Text length',
  'OCR used',
  'Parser used',
  'Experiences found',
  'Education found',
  'Skills found',
  'Review items count',
];

let failed = 0;
const checks = [];

function ok(cond, id, detail = '') {
  checks.push({ id, pass: !!cond, detail });
  if (!cond) {
    failed++;
    console.error('FAIL', id, detail);
  } else console.log('OK', id, detail || '');
}

function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const html = fs.readFileSync(INDEX, 'utf8');
  const panelJs = fs.existsSync(PANEL_JS) ? fs.readFileSync(PANEL_JS, 'utf8') : '';
  const panelCss = fs.existsSync(PANEL_CSS) ? fs.readFileSync(PANEL_CSS, 'utf8') : '';

  ok(fs.existsSync(PANEL_JS), 'module_exists');
  ok(fs.existsSync(PANEL_CSS), 'css_exists');
  ok(html.includes('import-debug-panel.js'), 'html_script_linked');
  ok(html.includes('import-debug-panel.css'), 'html_css_linked');
  ok(html.includes('id="importDebugPanel"'), 'html_panel_host');
  ok(html.includes('class="importDebugPanel'), 'html_panel_class');

  ok(/html:not\(\.debug-mode\)[^{]*\.importDebugPanel/.test(html), 'css_hidden_without_debug_mode');

  for (const step of REQUIRED_STEPS) {
    ok(panelJs.includes(`'${step}'`) || panelJs.includes(`"${step}"`), `step_${step}`);
  }

  ok(panelJs.includes('EXTRACTION_DONE') && panelJs.includes('TEXT_EXTRACTED'), 'step_alias_extraction');

  for (const metric of REQUIRED_METRICS) {
    ok(panelJs.includes(metric), `metric_${metric.replace(/\s+/g, '_').toLowerCase()}`);
  }

  ok(html.includes('refreshImportDebugPanel') || html.includes('HirelyImportDebugPanel'), 'ui_wired');
  ok(html.includes('HirelyImportDebugPanel'), 'ui_panel_api');
  ok(panelJs.includes('debugMode'), 'panel_gated_on_debug_mode');
  ok(panelCss.includes('.importDebugPanel'), 'panel_styles');

  const report = {
    feature: 'IMPORT_DEBUG_PANEL',
    generatedAt: new Date().toISOString(),
    steps: REQUIRED_STEPS,
    metrics: REQUIRED_METRICS,
    checks,
    pass: failed === 0,
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(failed ? '\nFAIL import-debug-panel' : '\nPASS import-debug-panel');
  process.exit(failed ? 1 : 0);
}

main();
