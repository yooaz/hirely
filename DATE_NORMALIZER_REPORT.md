# Date Normalizer — QA Report

**Result:** PASS

**Generated:** 2026-06-08T15:53:35.492Z

## Scope

P1 date normalization: clamp impossible future end years and flag long durations.

## Problem

Impossible date ranges appeared in CV output, e.g. `2008–2032`.

## Rules

- Current year max = **2026**
- If end year > 2026 → replace with **Present**
- If duration > 20 years → flag **review**

## Acceptance

| Check | Status |
|-------|--------|
| No future dates beyond 2026 | PASS |
| 2008–2032 → 2008–Present | PASS |
| Long duration flagged for review | PASS |

## Implementation

- `src/core/parsing/date-normalizer.js` — `DATE_NORMALIZER`
- `normalizeYearRange()` — core year clamp + review flag
- `applyDateNormalizationToCvData()` — wired into `normalizeCvData()`

## QA command

```bash
npm run qa:date-normalizer
```

## Console output

```
OK max year is 2026 (2026)
OK future end becomes Present (Present)
OK start preserved (2008)
OK dates label (2008–Present)
OK endWasFuture flagged
OK long duration flagged for review
OK review reason (duration_exceeded_20_years)
OK valid range end (2022)
OK valid short range not flagged
OK Present end preserved
OK experience line has no 2032
OK experience line normalized (Designer — McCann — 2008–Present)
OK experience long duration flagged
OK cvData date normalizer marker
OK cvData output has no year beyond 2026
OK date review items (2)
OK experience output has no 2032
OK education output has no 2032
OK normalizeCvData output has no year beyond 2026
OK normalizeCvData uses Present for future end

DATE_NORMALIZER QA PASS
```
