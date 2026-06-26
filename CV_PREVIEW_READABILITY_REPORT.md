# CV Preview Readability Report

**Status:** PASS
**Date:** 2026-06-11

## Goal

CV preview readable without browser zoom. Desktop default 100%. Side panels scroll; A4 stays native size and centered.

## Rules

| Rule | Implementation |
|------|----------------|
| Desktop default 100% | `ZOOM_MODES.P100` default + session default on desktop |
| Wide screen readable A4 | Native 794px width at scale 1.0 |
| No shrink for side panels | `computeZoom` skips `scaleW` cap on desktop/tablet for 100% |
| Panels scroll, CV readable | `overflow: auto` on stage/viewport; min-heights raised |
| Centered prominent preview | `transform-origin: top center`, fit wrapper margin auto |

## Browser check (1440×900)

| Metric | Value |
|--------|-------|
| Zoom mode | 100 |
| Scale | 1 |
| Name font | 44px |
| Body font | 14px |
| Visual width | 794px |
| Centered | yes |

## Acceptance

User can read CV text at default zoom without browser zoom.

## Run

```bash
npm run cv-preview-readability-report
```
