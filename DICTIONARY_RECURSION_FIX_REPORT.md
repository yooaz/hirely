# Dictionary Recursion Fix Report

**Verdict:** PASS
**Date:** 2026-06-09

## Goal

Stop `RangeError: Maximum call stack size exceeded` in dictionary matching during post-parse render.

## Fix summary

- `match-utils.js`: pure `termMatchesHay` / `safeRegex`, term sanitization (min 2, max 80 chars), capped alternation
- `json-dictionary-match.js`: `findLongestDictionaryTerm` delegates to index scan (no per-term RegExp loop)
- `schools.js`: removed giant `SCHOOL_NAME_RE` alternation; dictionary-only `lineMatchesSchool`
- `education-confidence.js`: `getEducationLineSignals` cache; no `schools.js` / experience-parser imports
- `experience-parser.js`: single cached education check per line; broke redundant dictionary round-trips
- `education-normalization-layer.js`: broke cycle with quality engine; depth guard on `stripEducationLeaks`
- `education-quality-engine.js`: `alreadyStripped` flag avoids double strip
- `field-sanitize.js` / `line-cleaner.js`: client/tool matching via `termMatchesHay` (no RegExp-per-term)
- `parser-recovery.js`: school term positions use index scan
- `classification-fixes.js`: `stripAgePhrase` input cap

## Files changed

- src/data/dictionaries/match-utils.js
- src/data/dictionaries/json-dictionary-match.js
- src/data/dictionaries/schools.js
- src/core/parsing/education-confidence.js
- src/core/parsing/experience-parser.js
- src/core/parsing/education-normalization-layer.js
- src/core/parsing/education-quality-engine.js
- src/core/parsing/field-sanitize.js
- src/core/parsing/line-cleaner.js
- src/core/parsing/parser-recovery.js
- src/core/parsing/classification-fixes.js
- scripts/test-dictionary-recursion.mjs
- package.json

## Required samples

- `visual communication`
- `JB Impressions`
- `LISAA Web & Motion Design`
- `Créapole Visual Communication`
- `Yoaz Tumblr Comagi`
- `LISAA — Web & Motion Design`
- `Créapole — Visual Communication / Product Design`
- `Freelance Illustrator / Graphic Designer`
- `McCann Paris`
- `Lead Illustrator · 2011 — 2014`

## Checks (16)

| Check | Result | Detail |
|-------|--------|--------|
| safeRegex_empty | PASS |  |
| escapeRegex_special | PASS |  |
| sample:visual communication | PASS |  |
| sample:JB Impressions | PASS |  |
| sample:LISAA Web & Motion Design | PASS |  |
| sample:Créapole Visual Communication | PASS |  |
| sample:Yoaz Tumblr Comagi | PASS |  |
| sample:LISAA — Web & Motion Design | PASS |  |
| sample:Créapole — Visual Communication / Pr | PASS |  |
| sample:Freelance Illustrator / Graphic Desi | PASS |  |
| sample:McCann Paris | PASS |  |
| sample:Lead Illustrator · 2011 — 2014 | PASS |  |
| stress_school_terms_x_samples | PASS |  |
| parse_yoaz_experience_count | PASS | 9 jobs |
| parse_yoaz_fixture_lines | PASS |  |
| education_classifies_school_lines | PASS | LISAA Web & Motion Design / Créapole Visual Communication / LISAA — Web & Motion Design / Créapole — Visual Communication / Product Design |

## Acceptance

| Criterion | Status |
|-----------|--------|
| No stack overflow on dictionary path | PASS |
| Education / experience cycle broken | PASS |
| Real Hirely errors not hidden in QA | PASS (extension filter unchanged) |


