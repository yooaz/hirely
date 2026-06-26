# Local OCR CSP Fix Report

**Status:** PASS
**Date:** 2026-06-12

## Goal

PDF OCR uses self-hosted Tesseract under `/vendor/tesseract/` — no CDN, CSP-safe workers.

## Architecture

| Component | Path |
|-----------|------|
| Main | `/vendor/tesseract/tesseract.min.js` |
| Worker | `/vendor/tesseract/worker.min.js` |
| Core WASM | `/vendor/tesseract/core/` |
| Traineddata | `/vendor/tesseract/lang/` |

## Rules

| Rule | Implementation |
|------|----------------|
| No CDN runtime | `getLocalTesseractOptions()` in every `recognize` call |
| Local worker | `workerBlobURL: false`, `workerPath` → `/vendor/tesseract/` |
| CSP workers | `worker-src 'self' blob:` |
| No unsafe-eval | `wasm-unsafe-eval` only (WASM) |
| Missing assets | `OcrUnavailableError` → paste fallback UX |

## Unit checks

| Check | Result |
|-------|--------|
| asset /vendor/tesseract/tesseract.min.js | PASS (66695b) |
| asset /vendor/tesseract/worker.min.js | PASS (123724b) |
| asset /vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js | PASS (3938657b) |
| asset /vendor/tesseract/core/tesseract-core-lstm.wasm.js | PASS (3938277b) |
| asset /vendor/tesseract/lang/eng.traineddata.gz | PASS (2952873b) |
| asset /vendor/tesseract/lang/fra.traineddata.gz | PASS (707406b) |
| worker.min.js has no jsdelivr default when paths passed | PASS (runtime overrides workerPath/corePath/langPath) |
| vendored worker still contains jsdelivr fallback string | PASS (overridden at runtime via getLocalTesseractOptions) |
| CSP worker-src self blob | PASS (worker-src 'self' blob:) |
| CSP no unsafe-eval | PASS (wasm-unsafe-eval only) |
| CSP connect-src no broad https | PASS (connect-src 'self' blob: data:) |

## Browser checks

| Metric | Value |
|--------|-------|
| jsdelivr requests | 0 |
| Local worker requests | 2 |
| Worker URL | http://127.0.0.1:50458/vendor/tesseract/worker.min.js |
| Tesseract loaded | yes |
| OCR probe error | none |
| Upload UI | ok |

## Acceptance

No jsdelivr OCR traffic; local worker loads under CSP; upload UI ready; OCR probe succeeds or fails with clear local error (no infinite loading).

## Setup

```bash
npm run setup:vendor-tesseract
npm run local-ocr-csp-fix-report
```
