# HIRELY P0 — OCR + Text Dedup Engine

**Generated:** 2026-06-10T20:30:23.661Z
**Engine:** DEDUPE_ENGINE_V2
**Result:** PASS

## Problem

`DUPLICATE_TEXT_DETECTED` — OCR text and selectable PDF text were merged, producing duplicate companies, experiences, schools, and skills inside `finalResumeData`.

## Solution: `dedupeBySimilarity()`

| Layer | Technique |
|-------|-----------|
| Normalize | trim, collapse spaces, lowercase, accent-fold, date keys |
| Fuzzy | Levenshtein ratio on normalized strings |
| Semantic | token Jaccard overlap + substring containment |
| Structured | experience role + company + dates similarity |

Default threshold: **0.88** (short tokens: **0.92**)

## Acceptance rules

| Rule | Sample | Result |
|------|--------|--------|
| Nike + Nike = 1 | clients | 1 |
| McCann + McCann = 1 | clients | 1 |
| Adobe Illustrator + Adobe Illustrator = 1 | tools | 1 |
| OCR line variant merge | lines | 2 (from 4) |
| Plain text merge | chars removed | 30 |
| McCann G. Agency ≈ McCann G Agency | similarity | 100% |
| No duplicate entities in finalResumeData | audit | PASS |

## Acceptance

- No duplicate entities (clients, tools, skills)
- No duplicate experience rows
- No duplicate education rows

## Pipeline hooks

- `src/core/parsing/dedupe-engine.js` — `dedupeBySimilarity`, Levenshtein, semantic similarity
- `src/core/extraction/extraction-audit.js` — OCR/native line + plain-text dedupe
- `src/core/validation/dedupe-final-resume.js` — last-pass `finalResumeData` lock
- `src/core/validation/final-resume-contract.js` — build pipeline
- `src/core/validation/sanitize-resume-display.js` — display gate

## Education / experience samples

| Input | Output count |
|-------|--------------|
| Créapole ×2 | 1 (expected 1) |
| Creative School Management ×2 | 1 (expected 1) |
| Freelance ×2 | 1 (expected 1) |
| Nike experience ×2 | 1 (expected 1) |

## QA

```bash
npm run qa:dedupe-engine
npm run dedupe-engine-report
```

