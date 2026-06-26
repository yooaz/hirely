# CV Import Audit (P0 bulletproof)

**Status:** PASS
**Generated:** 2026-06-15T22:49:57.263Z

## Fallback chain

```
PDF native text (PDF.js)
    ↓ empty / image PDF
Tesseract OCR
    ↓ parser weak / partial
Raw extraction → guaranteed cvData
```

**Policy:** Never block when text exists. Always produce `cvData` / `resumeData`. Never fail silently.

## Progress UI (4 steps)

1. Reading file
2. Extracting content
3. Understanding profile
4. Building CV

## Import matrix

| Case | Pass | Time | CV chars | Paste | cvData | Notes |
|------|------|------|----------|-------|--------|-------|
| pdf_text | PASS | 2690ms | 471 | no | no | Import → cvData (471 chars, 2690ms) |
| docx | PASS | 1958ms | 471 | no | no | Import → cvData (471 chars, 1958ms) |
| txt | PASS | 356ms | 609 | no | no | Import → cvData (609 chars, 356ms) |
| linkedin_pdf | PASS | 788ms | 609 | no | no | Import → cvData (609 chars, 788ms) |
| canva_pdf | PASS | 22017ms | 538 | no | no | OCR pipeline → preview (538 chars, 22017ms) |
| scanned_pdf | PASS | 26987ms | 538 | no | no | OCR pipeline → preview (538 chars, 26987ms) |
| image_cv | PASS | 43801ms | 409 | no | no | OCR pipeline → preview (409 chars, 43801ms) |
| corrupt_pdf | PASS | 389ms | 0 | yes | no | Import → cvData (0 chars, 389ms) |

## Failure cases (never silent)

| ID | Trigger | User message | Fallback | Silent? |
|----|---------|--------------|----------|---------|
| empty_extract | PDF/image with zero readable text | Aucun texte détecté dans ce fichier. | Paste panel (IMPORT_NEEDS_PASTE) | **no** |
| ocr_timeout | OCR exceeds HIRELY_PDF_EXTRACTION_MAX_MS | La lecture a pris trop de temps — aperçu partiel si texte récupéré. | Cached OCR text → guaranteed cvData, else paste | **no** |
| ocr_low_confidence | OCR quality score < 60% | Extraction OCR partielle — vérifiez le contenu dans Relecture. | Continue with cvData + warning banner | **no** |
| file_import_timeout | Native extract > FILE_IMPORT_MAX_MS (5s) | La lecture a pris trop de temps. | Guaranteed cvData if partial text, else paste | **no** |
| parser_blocked | OCR gate fail with empty text | Import partiel — vérifiez le contenu dans Relecture. | Guaranteed raw extraction when text > 100 chars | **no** |
| thin_text | Extracted text ≤ 100 chars | Import partiel ou paste si vide | Guaranteed cvData if any text; paste only when empty | **no** |
| corrupt_pdf | Invalid PDF bytes (bad.pdf) | Aucun texte détecté / format illisible | Paste panel with reason | **no** |
| core_boot_failed | __HIRELY_CORE_BOOT__ not ok | Le moteur d'import n'a pas démarré. Rechargez la page. | Paste panel | **no** |
| import_stuck_timeout | handleFileImport race timeout | La lecture a pris trop de temps | Recovery via tryRecoverImportWithText if text cached | **no** |
| unsupported_format | RTF / unknown binary | Format non supporté en V1 | Paste panel | **no** |

## Vendor / OCR

| Tesseract assets | OK |

## Commands

```bash
npm run setup:vendor-tesseract
npm run cv-import-audit
npm run ocr-report
```
