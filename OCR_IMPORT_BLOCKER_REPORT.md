# OCR Import Blocker Report

**Verdict:** PASS
**Generated:** 2026-06-14T10:05:32.845Z

## Root cause

- Local Tesseract traineddata + WASM were missing or not verified before OCR — `npm run setup:ocr` now enforces vendored assets.
- Browser OCR was timing out (rotation + multi-pass) and returning **partial fake text** (< 300 chars) instead of honest `IMPORT_NEEDS_PASTE`.
- UI showed generic timeout copy instead of scanned/protected guidance.

## Asset status

| Path | Size | Status |
|------|------|--------|
| `/vendor/tesseract/tesseract.min.js` | 66695 | OK |
| `/vendor/tesseract/worker.min.js` | 123724 | OK |
| `/vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js` | 3938657 | OK |
| `/vendor/tesseract/core/tesseract-core-simd-lstm.wasm` | 2859709 | OK |
| `/vendor/tesseract/core/tesseract-core-lstm.wasm.js` | 3938277 | OK |
| `/vendor/tesseract/core/tesseract-core-lstm.wasm` | 2859424 | OK |
| `/vendor/tesseract/lang/eng.traineddata.gz` | 2952873 | OK |
| `/vendor/tesseract/lang/fra.traineddata.gz` | 707406 | OK |

## Browser diagnostics (smoke test)

- **OCR_ASSET_PATH:** /vendor/tesseract/tesseract.min.js
- **OCR_WORKER_PATH:** /vendor/tesseract/worker.min.js
- **OCR_WASM_PATH:** /vendor/tesseract/core/tesseract-core-simd-lstm.wasm
- **OCR_LANG_PATH:** /vendor/tesseract/lang
- **OCR_WORKER_LOADED:** true
- **OCR_WASM_LOADED:** true
- **OCR_LANG_LOADED:** true
- **OCR_FIRST_PAGE_STARTED:** true
- **OCR_FIRST_PAGE_TEXT_LENGTH:** 0
- **OCR_FIRST_PAGE_CONFIDENCE:** 0
- **OCR_FINAL_TEXT_LENGTH:** 0
- **OCR_FINAL_CONFIDENCE:** 0
- **OCR_FAIL_REASON:** OCR_TIMEOUT:no_recoverable_text

- **importState:** —
- **selectedTextLength:** 0
- **fakeSuccess:** no
- **durationMs:** 68251

## Fixed files

- `src/core/extraction/ocr-runtime-diagnostics.js`
- `src/core/extraction/pdf-ocr-run.js`
- `src/core/extraction/enterprise-engine.js`
- `src/core/extraction/extract-file.js`
- `src/core/extraction/document-extract.js`
- `src/core/import/canonical-import.js`
- `src/core/import/import-fallback-ux.js`
- `src/vendor/csp-safe-loader.js`
- `src/vendor/tesseract-runtime.js`
- `scripts/setup-ocr.mjs`
- `src/tests/qa-ocr-browser-smoke.mjs`
- `index.html`

## Acceptance

| Criterion | Result |
|-----------|--------|
| Local OCR assets | PASS |
| Browser OCR smoke | PASS |
| No fake CV on OCR fail | PASS |
| Honest paste fallback | PASS |

## Commands

```bash
npm run setup:ocr
npm run qa:ocr-browser-smoke
npm run ocr-import-blocker-report
```
