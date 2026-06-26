# NORMALIZATION_REPORT

Generated: 2026-06-13T09:14:17.391Z

## P1 status

| Item | Value |
|------|-------|
| Version | `CV_NORMALIZER_V1` |
| Pipeline position | OCR → RAW TEXT → **NORMALIZER** → ENTITY EXTRACTION → VALIDATION → STRUCTURED CV → TEMPLATE |
| Module | `src/core/parsing/cv-normalizer.js` |
| Integration | `normalizePipelineTexts()` + `production-pipeline.js` (pre-sanitize) |
| QA | **PASS** |

## Responsibilities

| Duty | Implementation |
|------|----------------|
| Remove OCR garbage | `normalizeOcrDocument()` + line rejection |
| Remove duplicate lines | `removeDuplicateLines()` |
| Remove page numbers | `removePageNumberLines()` + `stripHeaderFooterLines()` |
| Remove repeated headers | `stripHeaderFooterLines()` (≥3 occurrences) |
| Repair common OCR mistakes | `repairCommonOCRMistakes()` + OCR char repairs |
| Normalize dates | `normalizeReconstructedDates()` per line |
| Normalize phone formats | `extractPhoneCandidate()` inline |
| Normalize email formats | `sanitizeEmailOcrArtifacts()` + RFC validation |

## QA snapshot

| Suite | Result |
|-------|--------|
| `qa-cv-normalizer` | **PASS** |
| `ocr-normalization-test` | **PASS** |

## Fixture demo

**Input (excerpt):**

```
Page 1 of 2
MARIE MARTIN
marie . martin @ company . ch
+41 78 555 12 34
EXPERIENCE
2018 - Present
Art Director — Art Director
Page 2 of 2
...
```

**Output:**

```
MARIE MARTIN
marie.martin@company.ch +41 78 555 12 34
WORK EXPERIENCE
2018 — Present Art Director — Art Director
OCR noise
```

**Stats:**

| Metric | Value |
|--------|-------|
| Input lines | 5 |
| Output lines | 5 |
| Page numbers removed | 0 |
| Duplicates removed | 0 |
| Headers removed | 0 |
| OCR engine used | true |
| Contacts normalized | 1 |
| Dates normalized | 1 |

## Pipeline wiring

```
OCR
  ↓
RAW TEXT (archive preserved in `rawText`)
  ↓
NORMALIZER (`normalizeCvDocument` / `normalizePipelineTexts`)
  ↓
ENTITY EXTRACTION (`sanitizeParserInput` → `runP0Pipeline`)
  ↓
VALIDATION
  ↓
STRUCTURED CV
  ↓
TEMPLATE
```

## Verification

```bash
npm run qa:cv-normalizer
npm run normalization-report
```
