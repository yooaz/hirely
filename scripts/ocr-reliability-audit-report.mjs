#!/usr/bin/env node
/**
 * P0 — Generate OCR_RELIABILITY_AUDIT_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'OCR_RELIABILITY_AUDIT_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/ocr-reliability-audit/report.json');
const LOCAL_OCR_JSON = path.join(ROOT, 'tests/output/local-ocr-csp-fix/report.json');

function runQa(script) {
  const res = spawnSync('node', [script], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
    timeout: 120000,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim().slice(-3000) };
}

const qa =
  process.env.HIRELY_SKIP_QA === '1' ? { pass: null, out: '' } : runQa('src/tests/qa-ocr-reliability-audit.mjs');
const cspQa =
  process.env.HIRELY_SKIP_BROWSER_QA === '1'
    ? { pass: null }
    : runQa('scripts/local-ocr-csp-fix-report.mjs');

const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const auditPass = report?.pass === true && (qa.pass === true || qa.pass === null);

function checksFor(prefix) {
  return (report?.checks || []).filter((c) => c.id.startsWith(prefix) || c.id.includes(prefix));
}

function statusIcon(pass) {
  return pass ? 'PASS' : 'FAIL';
}

const sections = [
  {
    title: '1. Local Tesseract assets exist',
    ids: ['local_tesseract_assets', 'asset_'],
    detail:
      'Six vendored files under `/vendor/tesseract/` (main, worker, 2× WASM core, eng+fra traineddata). Setup: `npm run setup:vendor-tesseract` (one-time download; not a runtime CDN).',
  },
  {
    title: '2. No CDN dependency at runtime',
    ids: ['no_cdn_runtime', 'worker_path', 'core_path', 'lang_path', 'worker_blob'],
    detail:
      'Production code loads `/vendor/tesseract/*` only. `getLocalTesseractOptions()` sets `workerPath`, `corePath`, `langPath`. Build script may fetch from jsdelivr once; archived `legacy-public` CDN path is not used.',
  },
  {
    title: '3. Worker loads locally',
    ids: ['csp_loader', 'ocr_tesseract_uses', 'worker_blob_url'],
    detail:
      '`csp-safe-loader.js` → `ensureTesseract()` → same-origin script + `workerBlobURL: false` so workers spawn from `/vendor/tesseract/worker.min.js`.',
  },
  {
    title: '4. CSP allows worker-src correctly',
    ids: ['csp_worker', 'csp_wasm', 'csp_no_unsafe'],
    detail:
      '`index.html` meta CSP: `worker-src \'self\' blob:` + `wasm-unsafe-eval` for WASM OCR core (no broad `unsafe-eval`).',
  },
  {
    title: '5. OCR timeout is realistic',
    ids: ['pdf_extraction', 'ocr_absolute', 'early_paste', 'rotation_trial'],
    detail:
      'Hard budget **20s** (`PDF_EXTRACTION_MAX_MS`). UI soft hint at **8s**; rotation trials capped at **8s**. Partial text recovery allowed; empty extract → paste fallback.',
  },
  {
    title: '6. OCR does not pretend success on empty text',
    ids: ['throws_ocr_empty', 'has_valid_ocr', 'discards_empty', 'empty_text_fails'],
    detail:
      '`runCachedTimedPdfOcr` throws `OCR_EMPTY` when `hasValidOcrResult` is false. `OCR_RESULT_DISCARDED empty_text` logged. Parser not invoked on empty OCR.',
  },
  {
    title: '7. OCR result is scored before use',
    ids: ['pdf_ocr_run_evaluates', 'ocr_parser_gate', 'quality_min', 'gibberish', 'good_sample'],
    detail:
      '`evaluateOcrParserGate()` in `pdf-ocr-run.js` before return; `ocr-parser-gate.js` blocks parser in `canonical-import.js`. Min score **42** + CV anchors (email/phone/years/keywords).',
  },
  {
    title: '8. OCR cannot run → IMPORT_NEEDS_PASTE + clear UX',
    ids: ['fallback_ocr', 'extract_timeout', 'ocr_unavailable', 'verify_assets'],
    detail:
      '`OcrUnavailableError` (`OCR_ASSETS_MISSING`, `OCR_SCRIPT_LOAD_FAILED`) + timeout/quality → `IMPORT_NEEDS_PASTE`. User copy in `import-fallback-ux.js` (scanned/illisible, OCR local indisponible, timeout).',
  },
];

function sectionTable(section) {
  const rows = (report?.checks || []).filter(
    (c) =>
      section.ids.some((id) => c.id === id || c.id.startsWith(id.replace(/_$/, '')) || c.id.includes(id))
  );
  if (!rows.length) return '- *(not run)*';
  return rows
    .map((c) => `| ${c.id} | ${statusIcon(c.pass)} | ${c.detail || '—'} |`)
    .join('\n');
}

const passed = report ? report.checks.filter((c) => c.pass).length : 0;
const total = report?.checks?.length || 0;

const lines = [
  '# OCR_RELIABILITY_AUDIT_REPORT',
  '',
  `**Status:** ${auditPass ? 'PASS' : 'FAIL'}`,
  `**Audit:** \`${report?.version || 'OCR_RELIABILITY_AUDIT_V1'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  `**Checks:** ${report ? `${passed}/${total}` : 'not run'}`,
  `**Browser CSP QA:** ${cspQa.pass === true ? 'PASS' : cspQa.pass === false ? 'FAIL' : 'skipped'}`,
  '',
  '## Scope',
  '',
  'Browser-local Tesseract OCR for scanned PDFs and images — asset hosting, CSP, timeouts, empty-text honesty, quality gating, and paste fallback when OCR cannot run.',
  '',
  '## Checklist summary',
  '',
  '| # | Requirement | Result |',
  '|---|-------------|--------|',
  ...sections.map((s, i) => {
    const related = (report?.checks || []).filter((c) =>
      s.ids.some((id) => c.id === id || c.id.startsWith(id.replace(/_$/, '')) || (id.endsWith('_') && c.id.startsWith(id)))
    );
    const allPass = related.length > 0 && related.every((c) => c.pass);
    const someFail = related.some((c) => !c.pass);
    return `| ${i + 1} | ${s.title.replace(/^\d+\.\s*/, '')} | ${someFail ? '**FAIL**' : allPass ? 'PASS' : '—'} |`;
  }),
  '',
  '## Thresholds',
  '',
  '| Constant | Value |',
  '|----------|------:|',
  `| \`PDF_EXTRACTION_MAX_MS\` | ${report?.thresholds?.PDF_EXTRACTION_MAX_MS ?? 20000} |`,
  `| \`OCR_ABSOLUTE_MAX_MS\` | ${report?.thresholds?.OCR_ABSOLUTE_MAX_MS ?? 20000} |`,
  `| \`OCR_UI_SOFT_TIMEOUT_MS\` | ${report?.thresholds?.OCR_UI_SOFT_TIMEOUT_MS ?? 8000} |`,
  `| \`OCR_QUALITY_MIN_PASS\` | ${report?.thresholds?.OCR_QUALITY_MIN_PASS ?? 42} |`,
  '',
];

for (const section of sections) {
  lines.push(`## ${section.title}`, '', section.detail, '', '| Check | Status | Detail |', '|-------|--------|--------|', sectionTable(section), '');
}

lines.push(
  '## Architecture',
  '',
  '```mermaid',
  'flowchart TD',
  '  A[PDF/Image upload] --> B{Native text >= 300?}',
  '  B -->|yes| C[Native path]',
  '  B -->|no| D[ensureTesseract local assets]',
  '  D -->|missing| E[IMPORT_NEEDS_PASTE + OCR_ASSETS_MISSING UX]',
  '  D -->|ok| F[Tesseract worker /vendor/tesseract]',
  '  F --> G[OCR passes + 20s budget]',
  '  G --> H{evaluateOcrParserGate}',
  '  H -->|pass| I[Parser → resumeData]',
  '  H -->|fail| J[IMPORT_NEEDS_PASTE + quality message]',
  '  G -->|empty| K[OCR_EMPTY → paste]',
  '  G -->|timeout no text| L[PDF_OCR_TIMEOUT → paste]',
  '```',
  '',
  '## Vendored assets',
  '',
  report?.assets
    ? report.assets
        .map((a) => `- \`${a.path}\` — ${a.exists ? `${a.size} bytes` : '**MISSING**'}`)
        .join('\n')
    : '- *(run audit)*',
  '',
  '## Known gaps / watch',
  '',
  '| Item | Severity | Notes |',
  '|------|----------|-------|',
  '| `qualityBypass` after timeout | low | Very short partial OCR (&lt;20 chars) may skip gate on absolute fallback — still blocked by 300-char import gate |',
  '| `setup-vendor-tesseract.mjs` uses jsdelivr | info | Build-time only; not loaded in browser |',
  '| Vendored `worker.min.js` contains jsdelivr fallback string | info | Overridden at runtime via `getLocalTesseractOptions()` |',
  '| `multiFormat.nativeTextLength` in browser QA | info | Sometimes 0 in reports; selected text length is authoritative |',
  '',
  '## Verification',
  '',
  '```bash',
  'npm run setup:vendor-tesseract',
  'npm run qa:ocr-reliability-audit',
  'npm run local-ocr-csp-fix-report   # browser: 0 jsdelivr requests',
  'npm run ocr-reliability-audit-report',
  'npm run qa:ocr-quality-score',
  'npm run qa:ocr-parser-gate',
  '```',
  '',
  '## Related',
  '',
  '- `LOCAL_OCR_CSP_FIX_REPORT.md`',
  '- `REAL_CV_IMPORT_ROOT_FIX_REPORT.md`',
  '- `NO_FAKE_PASS_IMPORT_GATE_REPORT.md`',
  ''
);

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(auditPass ? 0 : 1);
