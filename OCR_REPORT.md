# OCR Report (P0 auto-import)

**Status:** PASS
**Generated:** 2026-06-15T22:09:48.330Z

## Pipeline

1. PDF/image upload
2. Native text probe → image/scanned detection
3. Tesseract.js OCR (local vendored worker + WASM)
4. Text cleanup → parser → CV generation
5. Confidence shown; warning if < 60% — import never blocked

## UX

- Loading: **Analyse du CV...**
- Confidence warn threshold: **60%**
- Paste fallback: **not used** for OCR-sourced imports when text is recovered

## Vendor

| Check | Result |
|-------|--------|
| Tesseract assets | OK |

## Scanned PDF test

Fixture: `tests/fixtures/hirely-test-lab/scan.pdf`

| Metric | Value |
|--------|-------|
| Duration | 21234ms |
| CV preview chars | 538 |
| Doc step | edit |
| Paste panel | hidden (OK) |
| Live status | — |
| OCR confidence UI | Extraction OCR · 88% confiance |
| HIRELY_OCR_AUTO | true |

## Checks

- [x] **vendor_assets** — ok
- [x] **ocr_auto_flag** — true
- [x] **scanned_no_paste** — ok
- [x] **scanned_cv_preview** — 538
- [x] **ocr_confidence_ui** — Extraction OCR · 88% confiance
- [x] **scanned_timing** — 21234ms

## Commands

```bash
npm run setup:vendor-tesseract
npm run ocr-report
```
