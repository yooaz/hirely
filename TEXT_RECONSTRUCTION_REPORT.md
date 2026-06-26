# TEXT_RECONSTRUCTION_REPORT

**Status:** PASS
**Engine:** `TEXT_RECONSTRUCTION_V1`
**Generated:** 2026-06-11T00:03:11.451Z

## Problem

Extracted text was present but reconstructed incorrectly:

| Artifact | Example |
|----------|---------|
| Duplicate dates | `2011 - 2011-2011` |
| Entity duplication | `Independent / Freelance — Independent / Freelance` |
| Merge glitch | `Contributed as at Present` |
| OCR glue | `Fluent analyse` |

## Audit coverage

| Layer | Handler |
|-------|---------|
| Line merge | `smartLineMerge()` |
| Paragraph merge | `smartParagraphMerge()` |
| Date normalization | `normalizeReconstructedDates()` |
| Entity reconstruction | `dedupeEntitySegmentsInLine()` |
| Experience reconstruction | `sanitizeParserInput()` + parser pipeline |

## Rules (locked)

- Keep original meaning
- Never concatenate unrelated lines
- Never duplicate dates
- Never duplicate entities
- Section headers stay isolated
- Experience lines with distinct dates stay separate

## API

- `smartLineMerge(lines)` — merge continuation fragments only
- `smartParagraphMerge(text)` — merge broken paragraph blocks
- `reconstructExtractedText(text)` — full pre-parser reconstruction

## Integration

- `src/core/parsing/text-reconstruction.js`
- `src/core/extraction/extraction-audit.js` → `sanitizeParserInput()`
- `src/core/parsing/clean.js` → `safeClean()`

## Fixes verified

- 2011 - 2011-2011 → single range
- Contributed as at Present → Contributed at Present
- Fluent analyse → Fluent
- Independent / Freelance duplicates collapsed

## Yoaz fixture

- Experiences: 26
- Education: 4
- Duplicate date artifact: ✓ none

## Verify

```bash
npm run qa:text-reconstruction
npm run text-reconstruction-report
```
