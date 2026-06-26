# HIRELY H7 — Import Stability

Generated: 2026-06-06T21:33:14.028Z
Suite: `h7-import-stability-v1`

## Requirement

**No upload should crash the app.** Every path must end in a terminal import state or visible fallback (paste panel / alert), with loading cleared.

## Summary

| Metric | Value |
|--------|-------|
| Scenarios run | 13 |
| Passed | 13 |
| Failed | 0 |
| Skipped | 0 |
| Crash risks | 0 |

**Overall: PASS**

## Upload flow (audit)

| Area | Entry | Timeout | Error handling |
|------|-------|---------|----------------|
| Click upload | `#fileInput` → `handleFileImport(f,'click')` | 180s PDF / 20s other | `try/catch` → paste fallback; `finally` clears loading |
| Drag & drop | `#drop` / `#hirelyTestDrop` → `handleFileImport(f,'drop')` | same | drop-no-file → paste panel; no uncaught throw |
| Mobile | same `#fileInput` (touch opens picker) | same | identical pipeline |
| Core extract | `canonicalImportFromFile` → `extractFromFileDetailed` | PDF `PDF_EXTRACTION_MAX_MS` (30s) + UI race 180s | OCR timeout → `IMPORT_NEEDS_PASTE` |
| Parser fail | `applyImportResult` catch | — | OCR failure → paste; else `IMPORT_FAILED` |

## Scenario results

| Scenario | Channel | Result | Risk | Notes |
|----------|---------|--------|------|-------|
| PDF (text layer) | node | PASS | OK | terminal UI outcome |
| Large PDF (repeated pages) | node | PASS | OK | terminal UI outcome |
| Scanned / blank-page PDF | node | PASS | OK | terminal UI outcome |
| Corrupt PDF | node | PASS | OK | terminal UI outcome |
| Empty filename | node | PASS | OK | terminal UI outcome |
| DOCX | node | PASS | OK | terminal UI outcome |
| PDF upload (click) | browser | PASS | OK | terminal UI outcome |
| PDF upload (drag & drop) | browser | PASS | OK | terminal UI outcome |
| Large PDF | browser | PASS | OK | terminal UI outcome |
| DOCX upload | browser | PASS | OK | terminal UI outcome |
| Mobile upload (file input) | browser | PASS | OK | terminal UI outcome |
| Unsupported file type | browser | PASS | OK | terminal import state |
| Missing file (null) | browser | PASS | OK | terminal import state |

## Node extraction detail

### PDF (text layer)

- Import state: `IMPORT_NEEDS_PASTE`
- Import status: `PASTE_FALLBACK_REQUIRED`
- Raw text length: 0
- Errors: PDF.js non chargé. Collez le texte du CV.; TEXT_EMPTY; PDF.js non chargé. Collez le texte du CV.

### Large PDF (repeated pages)

- Import state: `IMPORT_NEEDS_PASTE`
- Import status: `PASTE_FALLBACK_REQUIRED`
- Raw text length: 0
- Errors: PDF.js non chargé. Collez le texte du CV.; TEXT_EMPTY; PDF.js non chargé. Collez le texte du CV.

### Scanned / blank-page PDF

- Import state: `IMPORT_NEEDS_PASTE`
- Import status: `PASTE_FALLBACK_REQUIRED`
- Raw text length: 0
- Errors: PDF.js non chargé. Collez le texte du CV.; TEXT_EMPTY; PDF.js non chargé. Collez le texte du CV.

### Corrupt PDF

- Import state: `IMPORT_NEEDS_PASTE`
- Import status: `PASTE_FALLBACK_REQUIRED`
- Raw text length: 0
- Errors: PDF.js non chargé. Collez le texte du CV.; TEXT_EMPTY; PDF.js non chargé. Collez le texte du CV.

### Empty filename

- Import state: `IMPORT_NEEDS_PASTE`
- Import status: `PASTE_FALLBACK_REQUIRED`
- Raw text length: 0
- Errors: TEXT_EMPTY; FILE_MISSING

### DOCX

- Import state: `IMPORT_NEEDS_PASTE`
- Import status: `PASTE_FALLBACK_REQUIRED`
- Raw text length: 0
- Errors: Lecture DOCX indisponible. Collez le texte du CV.; TEXT_EMPTY; Lecture DOCX indisponible. Collez le texte du CV.

## Fixtures used

- PDF: `/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/tests/output/p7-final-lock/fixture.pdf`
- Large PDF: `/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/tests/output/h7-import/large-repeated.pdf` (20220 bytes)
- Scanned stub: `/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/tests/output/h7-import/blank-page.pdf`
- DOCX: `/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/tests/output/p7-final-lock/fixture.docx`
- Unsupported: `/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/tests/output/import-qa-unsupported.bin`

## Commands

```bash
npm run stress:h7
npm run stress:import-report
npm run qa:import
```

## Crash-risk checklist

- [x] Null file handled
- [x] Unsupported type handled
- [x] Loading clears after import
- [x] No page uncaught errors
- [x] Corrupt PDF does not throw
