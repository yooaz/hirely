# OCR_REBUILD_REPORT

**Status:** PASS
**Audit:** `OCR_REBUILD_V1`
**Generated:** 2026-06-13T09:11:28.411Z

## Executive summary

| Requirement | Status |
|-------------|--------|
| Local Tesseract assets | ✓ all present |
| No CDN at runtime | ✓ |
| No remote worker | ✓ same-origin worker |
| No fake OCR success | ✓ OCR_EMPTY + quality gate |
| OCR fail → IMPORT_NEEDS_PASTE | ✓ |

**Policy:** Missing paste prompt is honest. Empty OCR never becomes `IMPORT_READY`.

## Worker & WASM sources

| Component | Source | Path |
|-----------|--------|------|
| Main script | `node_modules/tesseract.js/dist` → vendored | `/vendor/tesseract/tesseract.min.js` |
| Worker | `node_modules/tesseract.js/dist/worker.min.js` → vendored | `/vendor/tesseract/worker.min.js` |
| WASM loader (SIMD) | `tesseract.js-core` → vendored | `/vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js` |
| WASM binary (SIMD) | `tesseract.js-core` → vendored | `/vendor/tesseract/core/tesseract-core-simd-lstm.wasm` |
| WASM loader (fallback) | `tesseract.js-core` → vendored | `/vendor/tesseract/core/tesseract-core-lstm.wasm.js` |
| WASM binary (fallback) | `tesseract.js-core` → vendored | `/vendor/tesseract/core/tesseract-core-lstm.wasm` |
| Language packs | build-time fetch → vendored | `/vendor/tesseract/lang/fra.traineddata.gz`, `eng.traineddata.gz` |

Runtime loader: `src/vendor/csp-safe-loader.js` → `ensureTesseract()` → `getLocalTesseractOptions()` with `workerBlobURL: false`.

## Load time (browser probe)

| Phase | ms |
|-------|---:|
| Page DOM ready | 201 |
| Tesseract script + asset verify | 276 |
| First `recognize()` (eng, 200×60 canvas) | 402 |
| Total probe | 913 |

Probe OCR text: `Hirely OCR Test`

Local requests during probe:
- `/src/vendor/tesseract-runtime.js`
- `/vendor/tesseract/tesseract.min.js`
- `/vendor/tesseract/worker.min.js`
- `/vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js`
- `/vendor/tesseract/core/tesseract-core-simd-lstm.wasm`
- `/vendor/tesseract/core/tesseract-core-lstm.wasm.js`
- `/vendor/tesseract/core/tesseract-core-lstm.wasm`
- `/vendor/tesseract/lang/eng.traineddata.gz`
- `/vendor/tesseract/lang/fra.traineddata.gz`

## Failure rate (benchmark snapshot)

Source: `tests/output/real-format-qa/report.json` (2026-06-11T00:58:53.284Z)

| Metric | Value |
|--------|------:|
| Total cases | 14 |
| IMPORT_READY | 9 |
| IMPORT_NEEDS_PASTE | 5 |
| Paste fallback rate | **35.7%** |

Note: `IMPORT_NEEDS_PASTE` is an honest outcome (scanned PDF, OCR timeout, quality fail) — not a crash.

## CSP rules

```
default-src 'self'; script-src 'self' 'unsafe-inline' blob: 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self';
```

| Rule | Purpose |
|------|---------|
| `worker-src 'self' blob:` | Local Tesseract worker only |
| `script-src ... wasm-unsafe-eval` | WASM OCR core (no broad `unsafe-eval`) |
| `connect-src 'self' blob: data:` | No remote OCR API in browser path |

## Timeout handling

| Constant | Value | Behavior |
|----------|------:|----------|
| `PDF_EXTRACTION_MAX_MS` | 20000 | Hard PDF/OCR budget |
| `OCR_ABSOLUTE_MAX_MS` | 20000 | Absolute OCR race cap |
| `OCR_UI_SOFT_TIMEOUT_MS` | 8000 | Early paste hint |
| `OCR_UX_EARLY_PASTE_MS` | 8000 | UX soft message |
| `OCR_QUALITY_MIN_PASS` | 42 | Parser gate min score |

On timeout/empty/quality fail: `OCR_EMPTY` / `OCR_QUALITY_FAILED` → `IMPORT_NEEDS_PASTE` with user copy from `import-fallback-ux.js`.

## IMPORT_NEEDS_PASTE explanations

| Trigger | User message (FR) |
|---------|-------------------|
| OCR assets missing | La lecture OCR locale est indisponible — collez le texte du CV pour continuer. |
| Scanned / quality fail | Le document semble scanné, protégé ou illisible. |
| Timeout | La lecture automatique a pris trop de temps — collez le texte du CV pour continuer. |
| Thin text | Le contenu extrait est insuffisant pour continuer. |

Lead copy: **Lecture incomplète. Collez le texte du CV pour continuer.**

## Vendored assets

| Asset | Size | Source |
|-------|-----:|--------|
| `/vendor/tesseract/tesseract.min.js` | 66,695 | node_modules/tesseract.js/dist (copied) |
| `/vendor/tesseract/worker.min.js` | 123,724 | node_modules/tesseract.js/dist (copied) |
| `/vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js` | 3,938,657 | node_modules/tesseract.js-core (copied) |
| `/vendor/tesseract/core/tesseract-core-simd-lstm.wasm` | 2,859,709 | node_modules/tesseract.js-core (copied) |
| `/vendor/tesseract/core/tesseract-core-lstm.wasm.js` | 3,938,277 | node_modules/tesseract.js-core (copied) |
| `/vendor/tesseract/core/tesseract-core-lstm.wasm` | 2,859,424 | node_modules/tesseract.js-core (copied) |
| `/vendor/tesseract/lang/eng.traineddata.gz` | 2,952,873 | setup-vendor-tesseract (build-time download → vendored) |
| `/vendor/tesseract/lang/fra.traineddata.gz` | 707,406 | setup-vendor-tesseract (build-time download → vendored) |

Tesseract npm **5.1.1** / core **5.1.1** (`tesseract-vendor-1`)

## No fake OCR success

- `hasValidOcrResult()` guard in `pdf-ocr-run.js`
- Throws `OCR_EMPTY` when text/lines invalid
- `evaluateOcrParserGate()` before parser
- `buildOcrParserBlockedResult()` → `IMPORT_NEEDS_PASTE`
- Empty gate score fails (`evaluateOcrParserGate('')`)

## Architecture

```mermaid
flowchart TD
  A[Upload PDF/Image] --> B{Native text usable?}
  B -->|yes| C[Native path]
  B -->|no| D[verifyTesseractVendorAssets]
  D -->|fail| E[OCR_ASSETS_MISSING → IMPORT_NEEDS_PASTE]
  D -->|ok| F[/vendor/tesseract/worker.min.js]
  F --> G[WASM core + fra+eng traineddata]
  G --> H[OCR passes ≤20s]
  H --> I{evaluateOcrParserGate}
  I -->|pass| J[Parser]
  I -->|fail| K[IMPORT_NEEDS_PASTE + scanned copy]
  H -->|empty| L[OCR_EMPTY → IMPORT_NEEDS_PASTE]
```

## Static QA

Result: **PASS** (`qa:ocr-reliability-audit`)

Checks: 44/44

## Verification

```bash
npm run setup:vendor-tesseract
npm run qa:ocr-reliability-audit
npm run ocr-rebuild-report
npm run local-ocr-csp-fix-report   # browser CSP + 0 CDN
```

## Related

- `OCR_RELIABILITY_AUDIT_REPORT.md`
- `LOCAL_OCR_CSP_FIX_REPORT.md`
- `src/vendor/tesseract-runtime.js`
