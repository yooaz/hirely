# Import Decision Final Report

**Status:** FAIL
**Generated:** 2026-06-18T13:13:53.489Z

## Decision tree

1. Native PDF text ≥ 300 chars → **Review** → `NATIVE_TEXT_OK`
2. Native text < 300 and PDF → **OCR**
3. OCR text > 100 chars → **Review** → `OCR_TEXT_OK`
4. OCR text ≤ 100 chars → **Paste** → `OCR_TEXT_TOO_SHORT`
5. DOCX/TXT/paste text > 100 chars → **Review** → `NATIVE_TEXT_OK`
6. Anything else → **Paste** → `RAW_TEXT_TOO_SHORT` or `UNSUPPORTED_FILE` or `PDF_IMAGE_ONLY`

## Reason codes (exactly one per import)

- `NATIVE_TEXT_OK`
- `OCR_TEXT_OK`
- `OCR_PARTIAL_USABLE`
- `OCR_TEXT_TOO_SHORT`
- `PDF_IMAGE_ONLY`
- `RAW_TEXT_TOO_SHORT`
- `UNSUPPORTED_FILE`
- `NON_PDF_TEXTUAL`
- `PDF_NATIVE_TEXT_OK`
- `OCR_UNUSABLE`

## Unit matrix

| Case | Expected | Actual | Pass |
|------|----------|--------|------|
| rule1_native_pdf | NATIVE_TEXT_OK | PDF_NATIVE_TEXT_OK | FAIL |
| rule2_3_ocr_ok | OCR_TEXT_OK | OCR_TEXT_OK | PASS |
| rule4_ocr_short | OCR_TEXT_TOO_SHORT | OCR_UNUSABLE | FAIL |
| pdf_image_only | PDF_IMAGE_ONLY | PDF_IMAGE_ONLY | PASS |
| rule5_docx_ok | NATIVE_TEXT_OK | NON_PDF_TEXTUAL | FAIL |
| rule5_txt_ok | NATIVE_TEXT_OK | NON_PDF_TEXTUAL | FAIL |
| rule5_paste_ok | NATIVE_TEXT_OK | NON_PDF_TEXTUAL | FAIL |
| rule6_raw_short | RAW_TEXT_TOO_SHORT | NON_PDF_TEXTUAL | FAIL |
| rule6_unsupported | UNSUPPORTED_FILE | UNSUPPORTED_FILE | PASS |

## Browser fixtures

| File | Expected | Logged | Pass |
|------|----------|--------|------|
| good.pdf | NATIVE_TEXT_OK | PDF_NATIVE_TEXT_OK | FAIL |
| scan.pdf | OCR_TEXT_OK | PDF_IMAGE_ONLY | FAIL |
| bad.pdf | OCR_TEXT_TOO_SHORT | PDF_IMAGE_ONLY | OCR_UNUSABLE | FAIL |
| txt.txt | NATIVE_TEXT_OK | NON_PDF_TEXTUAL | FAIL |

## Module

`src/core/import/import-decision-final.js`

## Re-run

```bash
npm run import-decision-final-report
```
