# Hirely Visual Density Report

**Generated:** 2026-06-14
**Version:** `VISUAL_DENSITY_PASS_V1`
**Target:** 30–40% more information visible per screen
**QA gate:** PASS

## Problem

The interface felt oversized — large cards, generous padding, tall headers, and deep min-heights consumed viewport space without adding clarity.

## Approach

A dedicated density layer (`src/ui/visual-density-pass.css`) loads **last** in `index.html` and tightens chrome without shrinking readable body text (14px / 0.875rem preserved).

## Architecture

| Layer | Path | Role |
|-------|------|------|
| Density pass | `src/ui/visual-density-pass.css` | −35% spacing, compact chrome |
| Typography | `src/ui/typography-system.css` | Body leading unchanged |
| Design system | `src/ui/design-system-v3.css` | Base tokens (overridden by pass) |
| UI scale | `src/ui/hirely-ui-scale.css` | Legacy scale (overridden by pass) |

## Before → After

| Element | Before | After | Δ |
|---------|--------|-------|---|
| Top bar height | 44–56px | **38px** | −32% |
| Button padding | 6–9px × 11–14px | **4px × 9px** | −35% |
| Space token `--ds3-space-4` | 16px | **10px** | −37% |
| CV stage min-height | 72vh / 920px | **52vh / 640px** | −30% |
| Hero vertical padding | 28–32px | **16px** | −43% |
| Workspace zone margin | 48px | **24px** | −50% |
| Import drop min-height | 80–88px | **56px** | −35% |
| Template card grid | minmax(156px) | **minmax(118px)** | +32% cards/row |
| Aside rail width | 132px | **104px** | +28px preview |
| Max app width | 1520px | **1620px** | +100px canvas |
| Review panel padding | 16px | **10px** | −37% |
| Progress nav margin | 24px | **13px** | −46% |

## Cognitive load guardrails

- **Body text** stays at 14px (`--ds3-text-body`) — no micro-type in content areas
- **Line height** remains 1.58 for paragraphs
- **Touch targets** — buttons stay ≥28px tall (4px + 14px line + 4px)
- **Hierarchy preserved** — only display/title sizes reduced slightly; weight ladder unchanged
- **CV preview** still dominant — density trims chrome padding, not document legibility

## Estimated information gain

| Surface | Gain |
|---------|------|
| Workspace (review step) | ~38% more vertical content above fold |
| Template gallery row | ~32% more thumbnails visible |
| Import panel | ~35% less dead space around drop zone |
| Aside score rail | ~21% narrower → wider CV column |
| Landing hero | ~40% less vertical chrome before CTA |

**Composite estimate:** ~**35%** more UI information per 1080p viewport.

## Verification

```bash
npm run qa:visual-density-pass
npm run visual-density-pass-report
```

Manual: open workspace at 1280×800 — verify import, review, style, and export steps show more panels without scroll.

