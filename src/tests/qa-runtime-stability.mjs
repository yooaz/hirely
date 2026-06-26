#!/usr/bin/env node
/**
 * P0 — Runtime stability lock QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/runtime-stability/report.json');

const FILES = {
  stageResult: path.join(ROOT, 'src/core/runtime/pipeline-stage-result.js'),
  stabilityGuard: path.join(ROOT, 'src/core/runtime/runtime-stability-guard.js'),
  extractFile: path.join(ROOT, 'src/core/extraction/extract-file.js'),
  hirelyImport: path.join(ROOT, 'src/core/pipeline/hirely-import.js'),
  productionPipeline: path.join(ROOT, 'src/core/pipeline/production-pipeline.js'),
  pdfExport: path.join(ROOT, 'src/ui/export/hirely-pdf-export.js'),
  coreIndex: path.join(ROOT, 'src/core/index.js'),
  indexHtml: path.join(ROOT, 'index.html'),
};

let failed = 0;
const checks = [];
function ok(cond, id, detail = '') {
  checks.push({ id, pass: !!cond, detail });
  if (!cond) {
    failed++;
    console.error('FAIL', id, detail);
  } else console.log('OK', id, detail || '');
}

function read(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const stage = read(FILES.stageResult);
  const guard = read(FILES.stabilityGuard);
  const extract = read(FILES.extractFile);
  const hirelyImport = read(FILES.hirelyImport);
  const prod = read(FILES.productionPipeline);
  const pdf = read(FILES.pdfExport);
  const core = read(FILES.coreIndex);
  const html = read(FILES.indexHtml);

  ok(stage.includes('createStageResult'), 'contract_createStageResult');
  ok(stage.includes('normalizeStageResult'), 'contract_normalizeStageResult');
  ok(stage.includes('runStageSafe'), 'contract_runStageSafe');
  ok(/success.*data.*warnings.*errors/s.test(stage), 'contract_shape_documented');

  ok(guard.includes('buildProductionPipelineSafeFallback'), 'guard_production_fallback');
  ok(guard.includes('buildExtractionSafeFallback'), 'guard_extraction_fallback');
  ok(guard.includes('buildPdfExportSafeResult'), 'guard_pdf_export_fallback');

  ok(extract.includes('buildExtractionSafeFallback'), 'extract_safe_catch');
  ok(!/throw err;\s*\n\s*}\s*\n\s*const enterprise = result\.enterprise/.test(extract), 'extract_no_rethrow');

  ok(!hirelyImport.includes("throw new Error('PRODUCT_FALLBACK_DISABLED')"), 'import_no_fallback_throw');
  ok(hirelyImport.includes('normalizeImportResultShape'), 'import_result_normalized');

  ok(prod.includes('PRODUCTION_PIPELINE_SAFE_FALLBACK'), 'parser_safe_catch');
  ok(prod.includes('runProductionExtractionPipelineInner'), 'parser_inner_wrapper');

  ok(!pdf.includes('throw new Error'), 'export_no_throw');
  ok(pdf.includes('pdfExportFail'), 'export_safe_result');

  ok(core.includes('pipeline-stage-result'), 'core_exports_contract');
  ok(core.includes('runtime-stability-guard'), 'core_exports_guard');

  ok(!html.includes("throw new Error('CORE_BOOT_FAILED')"), 'ui_no_core_boot_throw');
  ok(!html.includes("throw new Error('PARSER_EMPTY')"), 'ui_no_parser_empty_throw');
  ok(!html.includes("throw new Error('templates unavailable')"), 'ui_no_template_throw');
  ok(!html.includes("throw new Error('PDF_BLOB_UNAVAILABLE')"), 'ui_no_pdf_blob_throw');
  ok(html.includes('CORE_BOOT_SAFE_FALLBACK'), 'ui_core_boot_safe_import');

  const throwCountCore = (guard.match(/throw new/g) || []).length;
  ok(throwCountCore === 0, 'guard_module_no_throw', String(throwCountCore));

  const report = {
    feature: 'RUNTIME_STABILITY_LOCK',
    generatedAt: new Date().toISOString(),
    checks,
    pass: failed === 0,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(failed ? '\nFAIL runtime-stability' : '\nPASS runtime-stability');
  process.exit(failed ? 1 : 0);
}

main();
