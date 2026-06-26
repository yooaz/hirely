# MULTI_FORMAT_EXTRACTION_REPORT

**Status:** PASS
**Engine:** `MULTI_FORMAT_ENGINE_V1`
**Generated:** 2026-06-10T23:55:20.680Z

## Supported formats

| Format | sourceType | Native | OCR | Merge |
|--------|------------|--------|-----|-------|
| PDF selectable text | `pdf_text` | ✓ | — | — |
| PDF scanned | `pdf_scanned` | partial | ✓ | ✓ |
| PDF image-based | `pdf_image` | — | ✓ | ✓ |
| PDF mixed | `pdf_mixed` | ✓ | ✓ | ✓ |
| DOCX | `docx` | ✓ | — | — |
| DOC | `doc` | ✓ | — | — |
| TXT | `txt` | ✓ | — | — |
| RTF | `rtf` | ✓ | — | — |
| Image | `image` | — | ✓ | — |

## Pipeline

1. **Native extraction** — pdf.js text layer, mammoth (DOCX/DOC), plain read (TXT/RTF)
2. **OCR extraction** — Tesseract for scans, weak pages, images
3. **Merge** — dedupe native + OCR lines; prefer higher confidence
4. **Confidence scoring** — line confidence + text-layer / OCR quality
5. **Best version selection** — richest source (length × confidence weight)

## Per-import metadata

Every import via `extractFromFileDetailed` now exposes:

| Field | Description |
|-------|-------------|
| `sourceType` | Resolved format (`pdf_text`, `docx`, `rtf`, …) |
| `nativeTextLength` | Chars from native lines |
| `ocrTextLength` | Chars from OCR lines |
| `mergedTextLength` | Chars after native+OCR merge |
| `confidenceScore` | 0–100 composite quality |
| `selectedSource` | `native` \| `ocr` \| `merged` |

## Code

- `src/core/extraction/multi-format-extraction-engine.js` — orchestrator
- `src/core/extraction/extract-file.js` — enrichment on every import
- `src/core/extraction/document-extract.js` — DOC + RTF routes
- `src/core/extraction/file-type-detect.js` — RTF / DOC detection

## Format runs

| Format | sourceType | native | ocr | merged | confidence | selected |
|--------|------------|--------|-----|--------|------------|----------|
| rtf | rtf | 47 | 0 | 47 | 65 | native |
| txt | txt | 2490 | 0 | 2490 | 100 | native |
| docx | docx | 2490 | 0 | 2490 | 100 | native |
| doc | doc | 2490 | 0 | 2490 | 100 | native |
| pdf_text | pdf_text | 2490 | 0 | 2490 | 100 | native |
| pdf_image | pdf_image | 0 | 2495 | 2495 | 91 | ocr |
| pdf_mixed | pdf_mixed | 886 | 1451 | 2338 | 94 | merged |

## DOCX vs PDF structured parity

| Section | DOCX | PDF (simulated native) | Match |
|---------|------|------------------------|-------|
| Experience | 32 | 32 | ✓ |
| Education | 2 | 2 | ✓ |
| Skills+Tools | 19 | 19 | ✓ |

## Verify

```bash
npm run qa:multi-format-extraction
npm run multi-format-extraction-report
```
