# Review Queue Quality Report

**Status:** PASS
**Date:** 2026-06-11

## Goal

Review panel shows only useful, actionable suggestions — weak OCR noise hidden.

## Rules

| Rule | Implementation |
|------|----------------|
| Min confidence 35% | `meetsReviewVisibilityThreshold` in `filterProductSuggestions` |
| No 0% unless critical | `filterVisibleCategoryAlternatives` + archive `zero_confidence` |
| Ambiguous → À classer | `resolveDisplayCategory` (not Skill) |
| Compact primary text | `compactSuggestionDisplayText` (≤72 chars) |
| Weak items grouped | `+ {n} éléments masqués` via filter stats |

## Unit checks

| Check | Result |
|-------|--------|
| compact noisy OCR primary text | PASS (yoaz27) |
| ambiguous low confidence → unknown (À classer) | PASS (unknown) |
| 0% non-critical hidden | PASS (false) |
| hide 0% category alternatives | PASS ([{"id":"education","label":"Education","confidence":12}]) |
| filter hides <35% and 0% suggestions | PASS (visible=0 hidden=4 lowHidden=3) |
| masked count includes archived weak items | PASS (hidden=4) |

## Browser check (Yoaz fixture)

| Metric | Value |
|--------|-------|
| Visible cards | 2 |
| Long primary text | no |
| 0% in panel | no |
| Masked line | + 12 éléments masqués |
| Sample categories | À classer, À classer |

## Acceptance

Review panel shows only useful, actionable items; weak suggestions archived under masked count.

## Run

```bash
npm run review-queue-quality-report
```
