# OCR Page Renderer Report

**Status:** PASS
**Generated:** 2026-06-16T08:58:28.257Z

## Pipeline

For each PDF page:

1. Render page to canvas at **scale 2** (pdf.js)
2. Convert canvas → PNG image
3. OCR with Tesseract.js
4. Append page text in order

**Total budget:** 20s — no retry loop

## Return shape

```json
{
  "pageCount": number,
  "ocrAttempted": true,
  "ocrTextPerPage": string[],
  "totalOcrTextLength": number,
  "rawText": string
}
```

## Checks

| Check | Result | Detail |
|-------|--------|--------|
| vendor_assets | PASS | ok |
| return_shape | PASS | scan.pdf shape ok |
| scale_2 | PASS | 2 |
| scan_text_length | PASS | 554 |
| pages_in_order | PASS | 1/1 |
| budget_20s | PASS | 1297ms |
| unreadable_low_text | PASS | open failed: page.evaluate: InvalidPDFException |

## scan.pdf (readable scan)

| Field | Value |
|-------|-------|
| pageCount | 1 |
| pagesProcessed | 1 |
| totalOcrTextLength | 554 |
| elapsedMs | 1297 |
| timedOut | false |

### Per-page text lengths

- Page 1: 554 chars

## bad.pdf (unreadable)

| totalOcrTextLength | 0 |
| paste expected | ≤ 100 chars after import |

## Module

`src/core/extraction/pdf-ocr-page-renderer.js`

## Re-run

```bash
npm run ocr-page-renderer-report
```
