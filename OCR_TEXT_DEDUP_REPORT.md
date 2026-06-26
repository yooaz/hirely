# HIRELY P0 — OCR Text Dedup Without Data Loss

**Result:** PASS
**Generated:** 2026-06-10T20:50:58.325Z
**Engine:** DEDUPE_ENGINE_V3
**Final lock:** DEDUPE_FINAL_RESUME_V3

## Problem

Console reported `DUPLICATE_TEXT_DETECTED` when OCR + native PDF text merged. Dedup was:

- Collapsing **unique** client tokens embedded in longer experience lines (e.g. `Nike` inside a role line)
- Using **global** fuzzy match across pages (dropping valid section content)
- **Dropping** duplicates instead of keeping the **richest** label

Result: final CV **repeated** some lines and **lost** unique clients/projects.

## Fix (V3)

1. **`semanticSimilarityForDedup()`** — safe similarity:
   - Section labels never merge with content
   - Single-token entities (`Nike`, `Adobe`) not treated as duplicates of longer lines
   - Near-length OCR variants (`McCann G. Agency` / `McCann Agency`) still merge
2. **`dedupeExtractedLines()`** — per-page fuzzy dedup only; merges to **richest** text
3. **`dedupeClientList()` / `dedupeProjectList()`** — entity-safe final dedup
4. **Experience dedup** — different companies never merge unless company similarity ≥ 0.88

## Acceptance examples

| Input | Rule | Result |
| --- | --- | --- |
| Nike / Nike | exact duplicate | 1 |
| Adobe Illustrator / Adobe Illustrator | exact duplicate | 1 |
| McCann G. Agency / McCann Agency | near duplicate | 1 richest (`${payload.samples.richestMcCann}`) |
| Nike + experience line containing Nike | unique entity guard | both kept |
| Adobe + Adobe Illustrator | unique entity guard | both kept |
| Visual Communication ×2 | near duplicate | 1 |
| Market Reviews ×2 | parser metadata | 1 (label guard) |
| clients + Nike | label vs content | never merged |

## Samples

**Clients:** Nike · Adobe · Adobe Illustrator · McCann G. Agency (6 → 4)
**Projects:** Visual Communication · Air Max Campaign
**OCR lines:** 3 lines from 5 inputs
**McCann similarity:** 100%
**Nike vs experience guard:** 0% (< 92% = kept separate)
**finalResumeData duplicate audit:** PASS (0 pairs)

## Verification

```bash
npm run qa:ocr-text-dedup
npm run test:ocr-text-dedup
npm run qa:dedupe-engine
```

## Files

- `src/core/parsing/dedupe-engine.js` — `DEDUPE_ENGINE_V3`, `semanticSimilarityForDedup`
- `src/core/extraction/extraction-audit.js` — per-page richer line merge
- `src/core/validation/dedupe-final-resume.js` — client/project safe dedup
- `src/core/validation/final-resume-contract.js` — build pipeline
- `src/tests/qa-ocr-text-dedup.mjs`

