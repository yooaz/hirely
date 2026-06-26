# Experience Segmentation — QA Report

**Result:** PASS

**Generated:** 2026-06-08T16:09:40.142Z

## Problem

Multiple jobs collapsed into one experience blob.

## Engine

`EXPERIENCE_SEGMENTATION_ENGINE` in `src/core/parsing/experience-segmentation-engine.js`

Each experience requires:

- title
- company
- date range

Split when:

- new company
- new year range
- new title

## Acceptance

| Entry | Status |
|-------|--------|
| McCann — separate | PASS |
| Freelance — separate | PASS |
| Nike projects — separate | PASS |
| No merged mega-line | PASS |

## Wiring

- `parseSegmentedExperiences()` — primary segmentation API
- `reconstructExperienceEntries()` — delegates to segmentation first
- `applyExperienceReconstruction()` — production `normalizeCvData()` path

## QA command

```bash
npm run qa:experience-segmentation
```

## Console output

```
OK McCann Paris is company header
OK Nike projects is company header
OK split on new title/company/dates
OK segmented into three groups (3)
OK three distinct entries (3)
OK engine id set
OK McCann entry present
OK Freelance entry present
OK Nike projects entry present
OK entry complete (Designer @ McCann)
OK title/company/dates (Designer|McCann|2011)
OK entry complete (Freelance @ Independent / Freelance)
OK title/company/dates (Freelance|Independent / Freelance|2014)
OK entry complete (Illustrator @ Nike projects)
OK title/company/dates (Illustrator|Nike projects|2016)
OK McCann dates (2011-2014)
OK Freelance dates (2014-2025)
OK Nike dates (2016-2020)
OK merged blob splits to three (3)
OK reconstruction emits three (3)
OK reconstruction keeps McCann, Freelance, Nike separate
OK normalizeCvData keeps three lines (3)
OK no collapsed mega-experience line
OK applyExperienceReconstruction keeps three (3)

EXPERIENCE_SEGMENTATION QA PASS
```
