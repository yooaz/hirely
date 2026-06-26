#!/usr/bin/env node
/**
 * P0 — OCR reliability audit (static + asset checks).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  TESSERACT_REQUIRED_ASSETS,
  TESSERACT_VENDOR_PATHS,
  getLocalTesseractOptions,
} from '../vendor/tesseract-runtime.js';
import {
  PDF_EXTRACTION_MAX_MS,
  OCR_UX_EARLY_PASTE_MS,
  OCR_ROTATION_TRIAL_MAX_MS,
} from '../core/extraction/pdf-extraction-timeout.js';
import {
  OCR_ABSOLUTE_MAX_MS,
  OCR_UI_SOFT_TIMEOUT_MS,
} from '../core/extraction/pdf-ocr-run.js';
import {
  evaluateOcrParserGate,
  OCR_QUALITY_MIN_PASS,
  isOcrQualityAcceptable,
} from '../core/extraction/ocr-quality-score.js';
import { isOcrSourcedImport } from '../core/import/ocr-parser-gate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/ocr-reliability-audit');
const OUT_JSON = path.join(OUT_DIR, 'report.json');

const OCR_RELIABILITY_AUDIT_V1 = 'OCR_RELIABILITY_AUDIT_V1';

let failed = 0;
const checks = [];

function record(id, pass, detail = '') {
  checks.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}${detail ? ` — ${detail}` : ''}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// 1 — Local Tesseract assets
const missingAssets = TESSERACT_REQUIRED_ASSETS.filter(
  (p) => !fs.existsSync(path.join(ROOT, p.replace(/^\//, '')))
);
record('local_tesseract_assets', missingAssets.length === 0, missingAssets.join(', ') || 'all present');

for (const asset of TESSERACT_REQUIRED_ASSETS) {
  const fp = path.join(ROOT, asset.replace(/^\//, ''));
  record(
    `asset_${asset.split('/').pop()}`,
    fs.existsSync(fp) && fs.statSync(fp).size > 1000,
    fs.existsSync(fp) ? `${fs.statSync(fp).size}b` : 'missing'
  );
}

// 2 — No CDN runtime dependency
const runtimeFiles = [
  'src/vendor/csp-safe-loader.js',
  'src/vendor/tesseract-runtime.js',
  'src/core/extraction/ocr-tesseract.js',
  'src/core/extraction/pdf-ocr-run.js',
  'src/core/extraction/ocr-pipeline.js',
  'index.html',
];
const cdnHits = [];
for (const rel of runtimeFiles) {
  const src = read(rel);
  if (/cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare/i.test(src)) cdnHits.push(rel);
}
record('no_cdn_runtime_import', cdnHits.length === 0, cdnHits.join(', ') || 'clean');

const opts = getLocalTesseractOptions();
record('worker_path_local', opts.workerPath.startsWith('/vendor/tesseract'));
record('core_path_local', opts.corePath.startsWith('/vendor/tesseract'));
record('lang_path_local', opts.langPath.startsWith('/vendor/tesseract'));
record('worker_blob_url_disabled', opts.workerBlobURL === false);

// 3 — Worker loads locally
record(
  'csp_loader_uses_vendor_tesseract',
  /TESSERACT_VENDOR_PATHS\.main/.test(read('src/vendor/csp-safe-loader.js'))
);
record(
  'ocr_tesseract_uses_getLocalTesseractOptions',
  /getLocalTesseractOptions/.test(read('src/core/extraction/ocr-tesseract.js'))
);

// 4 — CSP worker-src
const csp = read('index.html').match(/Content-Security-Policy[^>]+content="([^"]+)"/i)?.[1] || '';
record('csp_worker_src_self', /worker-src[^;]*'self'/.test(csp), csp.slice(0, 120));
record('csp_worker_src_blob', /worker-src[^;]*blob:/.test(csp));
record('csp_wasm_unsafe_eval', /wasm-unsafe-eval/.test(csp));
record('csp_no_unsafe_eval', !/'unsafe-eval'/.test(csp));

// 5 — OCR timeout realistic
record('pdf_extraction_max_20s', PDF_EXTRACTION_MAX_MS === 20000, String(PDF_EXTRACTION_MAX_MS));
record('ocr_absolute_matches_budget', OCR_ABSOLUTE_MAX_MS === PDF_EXTRACTION_MAX_MS);
record('early_paste_before_hard_cap', OCR_UI_SOFT_TIMEOUT_MS < PDF_EXTRACTION_MAX_MS);
record('early_paste_8s', OCR_UX_EARLY_PASTE_MS === 8000);
record('rotation_trial_cap_8s', OCR_ROTATION_TRIAL_MAX_MS === 8000);

// 6 — No fake success on empty OCR
const ocrRunSrc = read('src/core/extraction/pdf-ocr-run.js');
record('throws_ocr_empty', /code:\s*'OCR_EMPTY'/.test(ocrRunSrc));
record('has_valid_ocr_result_guard', /hasValidOcrResult/.test(ocrRunSrc));
record('discards_empty_result', /OCR_RESULT_DISCARDED.*empty_text/.test(ocrRunSrc));
record(
  'canonical_ocr_quality_catch',
  /OCR_QUALITY_FAILED/.test(read('src/core/import/canonical-import.js'))
);

const emptyGate = evaluateOcrParserGate('', []);
record('empty_text_fails_quality_gate', !emptyGate.pass, `score=${emptyGate.qualityScore}`);

// 7 — OCR scored before parser use
record('pdf_ocr_run_evaluates_gate', /evaluateOcrParserGate/.test(ocrRunSrc));
record('ocr_parser_gate_blocks_parser', /buildOcrParserBlockedResult/.test(read('src/core/import/ocr-parser-gate.js')));
record('quality_min_pass_42', OCR_QUALITY_MIN_PASS === 42);

const gibberish = 'ION3IIHIAXI NOILY3NQ3 YOLVEISNTN Buipeoy';
record('gibberish_rejected', !isOcrQualityAcceptable(gibberish));

const goodSample = `
Alex Martin
Graphic Designer
alex@example.com
Experience
Designer — Studio — 2019 – Present
Education
MA Design — ENSAD — 2014
Skills
Photoshop, Illustrator
`.trim();
record('good_sample_passes_gate', evaluateOcrParserGate(goodSample).pass);

// 8 — OCR cannot run → IMPORT_NEEDS_PASTE + explanation
const fallbackUx = read('src/core/import/import-fallback-ux.js');
record('fallback_ocr_assets_missing', /OCR_ASSETS_MISSING/.test(fallbackUx));
record('fallback_ocr_script_failed', /OCR_SCRIPT_LOAD_FAILED/.test(fallbackUx));
record('fallback_ocr_unavailable', /OCR_UNAVAILABLE/.test(fallbackUx));
record('fallback_ocr_quality_copy', /scanné|illisible|mal orient/i.test(fallbackUx));
record(
  'extract_timeout_needs_paste',
  /IMPORT_NEEDS_PASTE/.test(read('src/core/extraction/extract-file.js'))
);
record(
  'ocr_unavailable_error_class',
  /class OcrUnavailableError/.test(read('src/vendor/tesseract-runtime.js'))
);
record(
  'verify_assets_before_load',
  /verifyTesseractVendorAssets/.test(read('src/vendor/csp-safe-loader.js'))
);

// Parser gate wiring
record('ocr_sourced_detected', isOcrSourcedImport({ method: 'pdf-ocr' }));
record('native_pdf_not_ocr_sourced', !isOcrSourcedImport({ method: 'native_pdf' }));

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  version: OCR_RELIABILITY_AUDIT_V1,
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  failed,
  checks,
  thresholds: {
    PDF_EXTRACTION_MAX_MS,
    OCR_ABSOLUTE_MAX_MS,
    OCR_UI_SOFT_TIMEOUT_MS,
    OCR_QUALITY_MIN_PASS,
  },
  assets: TESSERACT_REQUIRED_ASSETS.map((p) => ({
    path: p,
    exists: fs.existsSync(path.join(ROOT, p.replace(/^\//, ''))),
    size: fs.existsSync(path.join(ROOT, p.replace(/^\//, '')))
      ? fs.statSync(path.join(ROOT, p.replace(/^\//, ''))).size
      : 0,
  })),
  csp: csp,
  vendorPaths: TESSERACT_VENDOR_PATHS,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log(failed ? `\n${failed} failed` : '\nOCR reliability audit passed');
process.exit(failed ? 1 : 0);
