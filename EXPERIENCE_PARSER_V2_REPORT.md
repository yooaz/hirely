# Experience Parser V2 — QA Report

**Result:** PASS

**Generated:** 2026-06-08T15:48:22.839Z

## Scope

P1 rebuild of experience parsing: date-anchored entry splitting without OCR or template changes.

## Problem

Adjacent experience lines were merged into one sentence, e.g.:

```
Designer - McCann - 2011-2014
Freelance - 2014-2025
```

## Rules

A new experience entry starts when a line contains:

- a date range (`2011-2014`, `2017 — Present`)
- month + year (`Jan 2018 - Mar 2022`)
- a standalone year on a short header line

Each entry extracts: `title`, `company`, `startDate`, `endDate`, `description`.

## Acceptance

| Check | Status |
|-------|--------|
| McCann = one entry | PASS |
| Freelance = one entry | PASS |
| No merged experiences | PASS |
| Merged one-line blob splits | PASS |
| Builder pipeline emits 2 jobs | PASS |

## Implementation

- `src/core/parsing/experience-split-parser.js` — `EXPERIENCE_SPLIT_PARSER_V2`
- `isExperienceEntryStartLine()` — replaces narrow role-keyword anchor gate
- `splitExperienceLines()` — wired into `splitLinesIntoDateAnchoredGroups()`
- `splitMergedExperienceByDates()` — fixes multi-range single-line blobs
- `parseExperiencesV2()` — structured field extraction

## QA command

```bash
npm run qa:experience-parser-v2
```

## Console output

```
OK McCann line is entry start
OK Freelance line is entry start
OK month+year range is entry start
OK bullet description is not entry start
OK split into two groups (2)
OK legacy split into two groups (2)
OK parseExperiencesV2 returns two entries (2)
OK engine id set
OK McCann entry present
OK Freelance entry present
OK McCann title (Designer)
OK McCann company (McCann)
OK McCann dates (2011-2014)
OK Freelance title (Freelance)
OK Freelance dates (2014-2025)
OK merged one-line splits (2)
OK reconstruction splits merged blob (2)
OK month start (Jan 2018)
OK month end (Mar 2022)
OK builder emits two experiences (2)
OK builder keeps McCann and Freelance separate
OK normalizeCvData keeps two experience lines (2)
OK no giant merged experience sentence

EXPERIENCE_PARSER_V2 QA PASS
```
