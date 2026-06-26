# OCR HARDENING REPORT

Generated: 2026-06-06T20:43:08.632Z
Scope: HIRELY H3 — generic OCR preprocessing (no candidate-specific recovery)

## Verdict

**PASS** — generic hardening module wired into `postProcessOcrText` before cleanup.

## Pipeline placement

```
OCR pixels → ocr-preprocess.js (deskew, DPI, binarize)
         → Tesseract / cloud OCR
         → ocr-hardening.js (structural text repairs)
         → ocr-cleanup.js + ocr-postprocess.js (typos, sections)
         → parser / sanitize
```

## Fixes implemented

| Issue | Module | Technique |
|-------|--------|-----------|
| Hyphenated words | `ocr-hardening.js` | Join `word-\nword` soft/hard breaks |
| Broken OCR spacing | `ocr-hardening.js` | Collapse single-letter token runs (≥45% singles) |
| Duplicated lines | `ocr-hardening.js` | Consecutive + global dedupe on normalized keys |
| Headers repeated | `ocr-hardening.js` | Collapse duplicate fuzzy section headers |
| Footer repetition | `ocr-hardening.js` | Drop page numbers + repeated CV/footer phrases |
| Column merge | `ocr-hardening.js` | Split wide gaps, dual section headers per line |
| Scanned PDF noise | `ocr-postprocess.js` | Hardening pass before `cleanupOcrText` |

## Synthetic before/after

| Sample | Lines before | Lines after | Merged headers before | After | Deduped |
|--------|-------------:|------------:|----------------------:|------:|--------:|
| Hyphenated word break | 3 | 2 | 0 | 0 | 0 |
| Spaced-letter OCR | 2 | 2 | 0 | 0 | 0 |
| Merged column headers | 2 | 3 | 1 | 0 | 0 |
| Duplicated lines | 4 | 2 | 0 | 0 | 0 |
| Footer repetition | 6 | 2 | 0 | 0 | 2 |
| Column gap merge | 1 | 4 | 1 | 0 | 0 |

## Fixture evaluation (post-harden import)

| Fixture | Lines in | Lines out | Unique ratio ↑ | Section items detected |
|---------|----------:|----------:|---------------:|------------------------:|
| text-pdf | 16 | 16 | +0% | 7 |
| scanned-pdf | 11 | 11 | +0% | 2 |
| two-column-cv | 11 | 11 | +0% | 4 |
| yoaz-pdf-live | 42 | 44 | +0% | 26 |

## Residual gaps

- Deep OCR glyph corruption still needs dictionary typo repairs (`ocr-cleanup.js`).
- Two-column reading order at pixel stage depends on `detectMultiColumn` + PSM selection.
- Single-year MBA lines (`HEC Paris — MBA — 2018`) remain a parser education issue, not OCR.

## Verification

```bash
node src/tests/ocr-hardening-test.mjs
node src/tests/ocr-postprocess-test.mjs
npm run qa:preprocess
npm run parser:reliability
```
