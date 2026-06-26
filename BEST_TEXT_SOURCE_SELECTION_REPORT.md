# BEST_TEXT_SOURCE_SELECTION_REPORT

**Status:** PASS
**Engine:** `BEST_TEXT_SOURCE_SELECTION_V1`
**Generated:** 2026-06-11T00:26:55.091Z

## Problem

Native PDF text and OCR text can conflict. The pipeline must automatically pick the best source without polluting good native text with bad OCR.

## Inputs

| Source | Field |
|--------|-------|
| Native PDF text layer | `nativeText` |
| OCR output | `ocrText` |
| DOCX extraction | `docxText` |
| User paste | `pastedText` |

## Scoring dimensions

| Dimension | Weight / effect |
|-----------|-----------------|
| Length | 18% of composite |
| Plausible word ratio | 32% of composite |
| Email presence | +8 |
| Phone presence | +8 |
| Date presence | +4 each (max 15) |
| Section headers | +4 each (max 12) |
| Garbage ratio | −35 × ratio |
| Duplicate ratio | −22 × ratio |
| Source bias | native +4, docx +3, paste +2, OCR −2 |

## Rules

| Rule | Behavior |
|------|----------|
| Do not merge bad OCR into good native | Merge rejected when OCR garbage > 35% or OCR score < 55% of best single |
| Merge only if it improves score | `merged` candidate must beat best single by > 2 points |
| Audit trail | `textSourceAudit` records candidates, merge decision, rejection reason |

## API

- `selectBestTextSource({ nativeText, ocrText, docxText, pastedText })`
- `scoreTextSource(text, sourceId)`
- `mergeTextSourcesConservative(native, ocr)` — native base + non-duplicate OCR lines only

## Integration

- `src/core/extraction/best-text-source-selection.js`
- `src/core/extraction/multi-format-extraction-engine.js` → `selectBestExtractionVersion()`
- `enrichMultiFormatExtraction()` attaches `textSourceAudit` to import metadata

## Scenario results

| Scenario | Pass |
|----------|------|
| Native beats bad OCR | ✓ |
| DOCX beats weak native | ✓ |
| Paste wins when richest | ✓ |
| Bad OCR merge rejected | ✓ |

## Yoaz native scoring

- Composite: 92
- Garbage ratio: 0
- Duplicate ratio: 0.019

## Verify

```bash
npm run qa:best-text-source-selection
npm run best-text-source-selection-report
```

---

### Console

```
OK engine version
OK good native beats bad OCR
OK bad OCR merge rejected
OK bad OCR not in selected text
OK conservative merge skips garbage OCR lines
OK no merge when OCR is garbage
OK weak native vs good OCR picks viable source
OK selected text richer than weak native
OK docx beats weak native
OK pasted wins when richest
OK merge considered for native+ocr
OK merge improves score
OK length scored
OK plausible word ratio
OK email detected
OK phone detected
OK dates detected
OK section headers detected
OK low garbage on good native
OK low duplicate on good native
OK composite score reasonable
OK audit version
OK audit candidates
OK audit lists candidates
Wrote /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/tests/output/best-text-source-selection/report.json

(node:8816) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/extraction/best-text-source-selection.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
