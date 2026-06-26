# OCR Import Report

**Status:** PASS
**Generated:** 2026-06-16T09:14:28.250Z

## Flow

1. PDF upload
2. Native PDF extraction (pdf.js)
3. If extracted text < 300 chars → automatic OCR (max 20s)
4. If OCR text > 100 chars → createResumeFromText → review
5. If OCR text ≤ 100 chars → paste panel

## Progress copy

- Lecture du PDF…
- Reconnaissance du texte…
- Création du CV…

## Auto-import rate

| Metric | Value |
|--------|-------|
| Scannable fixtures | 3 |
| Auto-import (no paste) | 3 |
| Rate | 100% |
| Target | ≥ 95% |

## Checks

| Check | Result | Detail |
|-------|--------|--------|
| vendor_assets | PASS | ok |
| ocr_flags_enabled | PASS | true |
| scan_auto_import | PASS | true |
| no_early_paste | PASS | true |
| auto_rate_95 | PASS | 100% (3/3) |

## Fixture results

| File | ms | Auto-import | Paste | Live status |
|------|-----|-------------|-------|-------------|
| scan.pdf | 3347 | yes | no | — |
| good.pdf | 1420 | yes | no | — |
| canva-export.pdf | 2117 | yes | no | — |
| bad.pdf | 400 | no | yes | — |

## Stack

- pdf.js — native text layer + page render for OCR
- tesseract.js — multipage scanned PDF / image OCR

## Re-run

```bash
npm run ocr-import-report
```
