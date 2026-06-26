# HIRELY P0 — STACK OVERFLOW ROOT CAUSE

**Verdict:** PASS
**Date:** 2026-06-10

## Browser symptom

```
RangeError: Maximum call stack size exceeded
```

Trace:

1. `src/data/dictionaries/match-utils.js`
2. `education-confidence.js`
3. `experience-parser.js`

## Recursive loops (audited)

**Cycle A — education ↔ experience ↔ dictionary**

```
experience-parser (lineIsEducationData)
  → education-confidence (getEducationLineSignals / mustNeverBeExperience)
    → dictionary matching (findLongestDictionaryTerm → termMatchesHay)
  → section-sanity (passesExperienceGate)
    → experience-parser (qualifiesStrictExperience / scoreStrictExperienceEntry)
  → isLikelyTool → passesExperienceGate (mutual recursion)
```

**Cycle B — segmentation ↔ full V2 parse (browser stack)**

```
segmentExperienceInput (per line)
  → extractExperienceSignature
    → parseExperienceEntryV2
      → buildExperienceEntryFromLineGroup → normalizeExperienceRole → stripAgePhrase
```

**Cycle C — score ↔ readiness (browser glue)**

```
enrichScoreReport
  → isExportReady
    → getReviewReadinessReport
      → computeProductScoreReport
        → enrichScoreReport (infinite loop)
```

## Fix rules applied

| Rule | Implementation |
|------|----------------|
| Dictionary match pure | `match-utils.js` — `termMatchesHay` index scan; no parser imports in `src/data/dictionaries/` |
| Dictionary never calls parser | Verified: zero parser imports under dictionaries |
| Education confidence never re-enters experience parser | `education-confidence.js` imports only dictionaries + `parser-cycle-guard` |
| Experience parser: one edu call per line | `cachedEducationLineCheckInner` — single `getEducationLineSignals(l)`; cache on repeat |
| Recursion guard depth 10 | `parser-cycle-guard.js` — `MAX_PARSER_DEPTH = 10`, visited-node set |
| Cycle → UNKNOWN / confidence 0 | `UNKNOWN_EDUCATION_SIGNALS`, `UNKNOWN_CLASSIFICATION` |
| Score/readiness never re-enter score report | `score-cycle-guard.js` — depth 10; `exportReadyFromCvData` during enrichment |

## Key files

- `src/core/parsing/parser-cycle-guard.js`
- `src/core/parsing/education-confidence.js`
- `src/core/parsing/experience-parser.js`
- `src/core/parsing/section-sanity.js`
- `src/core/parsing/experience-segmentation-engine.js` — lightweight sig during segmentation
- `src/core/parsing/classification-fixes.js` — `stripAgePhrase` index scan (no regex replace loop)
- `src/data/dictionaries/match-utils.js`
- `src/core/validation/score-cycle-guard.js` — breaks Cycle C in score glue
- `src/core/resume-data.js` — `resumeDataToCvData` stack fallback

## P0 test lines

- `visual communication`
- `JB Impressions`
- `LISAA Web & Motion Design`
- `Créapole Visual Communication`
- `Yoaz Tumblr Comagi`
- `Address Illustrations`

## Checks (16)

| Check | Result | Detail |
|-------|--------|--------|
| max_parser_depth_10 | PASS | 10 |
| p0_line:visual communication | PASS |  |
| p0_line:JB Impressions | PASS |  |
| p0_line:LISAA Web & Motion Design | PASS |  |
| p0_line:Créapole Visual Communication | PASS |  |
| p0_line:Yoaz Tumblr Comagi | PASS |  |
| p0_line:Address Illustrations | PASS |  |
| p0_creative_fixture_segment | PASS |  |
| p0_stress_school_dictionary | PASS |  |
| p0_experience_count | PASS | 9 jobs |
| p0_yoaz_fixture_full_parse | PASS |  |
| max_score_cycle_depth_10 | PASS | 10 |
| score_cycle_depth_cap | PASS | 10 |
| score_cycle_inside_false | PASS |  |
| score_cycle_export_ready_direct | PASS | true |
| p0_score_cycle_guard | PASS |  |

## Acceptance

| Criterion | Status |
|-----------|--------|
| No RangeError on P0 lines | PASS |
| Parser completes (yoaz fixture) | PASS |
| Review / CV preview (browser) | `qa:final-reset` ingest passes — no RangeError; CV preview live |

## Run

```bash
npm run test:stack-overflow-parser
node scripts/test-dictionary-recursion.mjs
```


