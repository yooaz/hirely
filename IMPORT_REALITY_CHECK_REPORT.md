# IMPORT_REALITY_CHECK_REPORT

**Status:** PASS
**Engine:** `IMPORT_REALITY_CHECK_V1`
**Generated:** 2026-06-11T23:27:55.904Z

## Scope

Post-OCR-fix import-only reality check across six format categories (browser product path).

| # | Format | Fixture |
|---|--------|---------|
| 1 | Selectable PDF | `yoaz-selectable.pdf` |
| 2 | Scanned PDF | `blank-scan.pdf` (no text layer) |
| 3 | Protected PDF | `protected-scan.pdf` |
| 4 | DOCX | `yoaz.docx` |
| 5 | TXT | `yoaz.txt` |
| 6 | Image PNG / JPG | `cv-scan.png`, `cv-scan.jpg` |

## Metrics per file

| Field | Meaning |
|-------|---------|
| `fileType` | Detected source type (`pdf_text`, `docx`, `image`, …) |
| `nativeTextLength` | Native / structured text chars |
| `ocrTextLength` | OCR text chars |
| `selectedTextLength` | Text chosen for import (final `rawText`) |
| `status` | Terminal import outcome |

## Allowed statuses

| Status | Meaning |
|--------|---------|
| `IMPORT_READY` | Full import succeeded |
| `IMPORT_PARTIAL` | Partial text recovered |
| `IMPORT_NEEDS_PASTE` | Paste fallback — acceptable terminal |
| `IMPORT_UNSUPPORTED` | Format not supported — no crash |

## Forbidden

| Rule |
|------|
| `IMPORT_STUCK` — loading never clears |
| Silent fail — spinner with no terminal UI |
| Fake success — `IMPORT_READY` with zero selected text |

## Results

| Format | fileType | native | ocr | selected | status | Duration | Pass |
|--------|----------|--------|-----|----------|--------|----------|------|
| Selectable PDF | pdf_text | 0 | 0 | 1769 | **IMPORT_READY** | 2577ms | ✓ |
| Scanned PDF (blank page) | pdf | 0 | 0 | 0 | **IMPORT_NEEDS_PASTE** | 66883ms | ✓ |
| Protected PDF | pdf | 0 | 0 | 0 | **IMPORT_NEEDS_PASTE** | 768ms | ✓ |
| DOCX | docx | 0 | 0 | 2490 | **IMPORT_READY** | 2675ms | ✓ |
| TXT | txt | 0 | 0 | 2490 | **IMPORT_READY** | 3493ms | ✓ |
| Image PNG | image | 0 | 0 | 0 | **IMPORT_NEEDS_PASTE** | 2632ms | ✓ |
| Image JPG | image | 0 | 0 | 0 | **IMPORT_NEEDS_PASTE** | 1815ms | ✓ |

## Outcome distribution

- **IMPORT_READY**: 3
- **IMPORT_NEEDS_PASTE**: 4

## Forbidden totals

| Check | Count |
|-------|-------|
| IMPORT_CRASH | 0 |
| IMPORT_STUCK | 0 |
| Fake success | 0 |
| Silent fail | 0 |

## Verify

```bash
npm run setup:vendor-tesseract
npm run qa:import-reality-check
npm run import-reality-check-report
```
