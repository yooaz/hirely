# WORKING MVP RESET REPORT

**Date:** 2026-06-15  
**Status:** PASS (simple import path)  
**Mode:** `SIMPLE_IMPORT_MODE = true`

## Goal

Stop patching the complex import flow. Ship a **reliable MVP**: upload → extract text → Review always shows content → Style → Export.

## What changed

### New module: `src/core/import/simple-import-mode.js`

| Symbol | Role |
|--------|------|
| `SIMPLE_IMPORT_MODE` | `true` — master switch |
| `SIMPLE_IMPORT_MIN_CHARS` | `100` — minimum text to continue (not 300) |
| `canContinueWithRawText(rawText)` | `true` when text length > 100 |
| `fallbackRawTextCvData(rawText)` | Flat CV object for templates |
| `fallbackRawTextResumeData(rawText)` | Structured resume for commit |
| `renderFallbackCv(rawText)` | HTML preview: name + « Contenu extrait » + raw lines |
| `simpleExtractTextFromFile(file)` | PDF native / DOCX / TXT only — **no OCR** |
| `simpleCanonicalImportFromFile(file)` | Full simple import → `IMPORT_READY` |

### Wiring

- `canonical-import.js` delegates to `simpleCanonicalImportFromFile` when simple mode is on.
- `src/core/index.js` exports all simple-mode helpers.
- `index.html` sets `globalThis.HIRELY_SIMPLE_IMPORT_MODE = true` and bypasses:
  - OCR (`expectOcr = false`, no Tesseract for images)
  - `validateCvData` strict INVALID gates
  - `isFinalResumeValid` / `isExportReady` / `isTemplateReady` blockers when raw text exists
  - `guardCvDataStep` for edit/style/export
  - Empty CV protection (« CV incomplete ») when raw text exists
  - Recruiter / extraction recovery `blockRender`
  - Progress nav locks on Style / Export

### Simple flow

1. Upload PDF / DOCX / TXT  
2. Extract text (PDF = **native layer only**, OCR disabled)  
3. If text > 100 chars → parse (best effort) + fallback CV → **Review**  
4. If text ≤ 100 chars → paste fallback  
5. Review **always** shows something (structured CV or `renderFallbackCv`)  
6. Style and Export unlocked when preview has text  

### Critical rule

**Never show « CV incomplete » when raw extracted text exists** — enforced in `renderCVInner` + `getCvDataValidation`.

## Acceptance test

| Check | Result | Notes |
|-------|--------|-------|
| Import file with text (`yoaz.txt`) | PASS | ~5s → Review |
| CV preview not empty | PASS | 1544 chars, `cv--live` |
| No « CV incomplete » | PASS | |
| Style button works | PASS | `docStep: style` |
| Export step reachable | PASS | `docStep: export` |
| Download PDF visible | PASS | `#downloadBtn` visible |

### PDF notes (no OCR)

| File | Result | Reason |
|------|--------|--------|
| `cv2022 yohann azancot copie.pdf` | Paste fallback | Scanned PDF — no native text layer (< 100 chars) |
| PDF with native text layer | Expected PASS | Native extraction only |

Scanned PDFs require **paste** in MVP mode (OCR intentionally off). Use DOCX/TXT or paste text for scanned CVs.

## How to disable simple mode

```js
globalThis.HIRELY_SIMPLE_IMPORT_MODE = false;
// or set SIMPLE_IMPORT_MODE = false in simple-import-mode.js + index.html
```

## Files touched

- `src/core/import/simple-import-mode.js` (new)
- `src/core/import/canonical-import.js`
- `src/core/index.js`
- `index.html` (gates + render + import)

## Verify locally

```bash
npm run dev
# Open http://127.0.0.1:3001/index.html
# Upload tests/output/real-format-qa/yoaz.txt or any DOCX
# Or paste text for scanned PDFs
```
