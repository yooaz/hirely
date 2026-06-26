# UI Scale Fix Report

**Date:** 2026-06-14  
**Follows:** P0 Subtraction Sprint (`P0_SUBTRACTION_REPORT.md`)  
**Source critique:** `DESIGN_CRITIQUE_REPORT.md` — app still felt too zoomed after subtraction  
**Implementation:** `src/ui/product/ui-scale-fix.css` (loads last)

---

## Goal

Calm **Apple Pages / Keynote** rhythm:

- ~**15% smaller UI chrome** (controls, nav, cards, badges)
- **More air** around the CV preview
- **Less vertical stacking** (hide redundant step headers in prod)
- **CV document dominant** after import
- **Do not** shrink the A4 document — shrink chrome only

---

## What changed

| Area | Before (P0 baseline) | After (scale fix) |
|------|----------------------|-------------------|
| Density pass | `visual-density-pass.css` tightened chrome (+35% info/screen) | **Removed** from `index.html` |
| Typography | H1 up to 36px, mixed chrome sizes | **H1 ≤34px**, **H2 ≤26px**, **body 15px**, **caption 12–13px** |
| Top bar / buttons | Full-size pills | ~15% smaller padding and type |
| Import | Full-width split rail | **Centered card max 520px** on import step |
| Review | 68/32 grid | **70/30**, **18–22px** stage padding, neutral canvas `#f3f3f0` |
| Style | Gallery + long meta copy | **Thumbnails first**; hiring/best/style lines hidden; tiny labels |
| Export | Competing chrome | **Minimal header**, tall clean A4 stage, compact PDF bar |
| CV scale | Container scale up to 1.18× (felt zoomed) | **Capped ~1.05–1.08×** — document readable, not chrome-heavy |

---

## Files

| File | Role |
|------|------|
| `src/ui/product/ui-scale-fix.css` | **New** — calm scale tokens + step-specific layout |
| `index.html` | Dropped `visual-density-pass.css`; linked `ui-scale-fix.css` last |
| `scripts/qa-ui-scale-fix.mjs` | **New** — screenshots + typography assertions |

**Unchanged:** Import/review/style/export pipelines, P0 subtraction behavior, `hirely-ui-scale.css` (overridden where conflicting).

---

## Typography system

| Role | Max size | Usage |
|------|----------|--------|
| H1 | **34px** | Hero, step titles |
| H2 | **26px** | Recovery panel, section heads |
| Body | **15px** | Default UI copy |
| Caption | **12–13px** | Hints, nav, template labels, meta |

Verified in browser: `body 15px`, hero `h1 34px`.

---

## Layout by step

### Import
- `#wsImport` centered, **max-width 520px**
- Shorter drop zone (72px min-height), lighter padding
- Status row compact

### Review (`docStep-edit`)
- Grid **~70% CV / 30% sidebar**
- `#resumeStudioHead` hidden in production (less stack)
- CV stage: generous padding, no aggressive `transform` on inner page

### Style (`docStep-style`)
- `#templatePickerBar` compact
- Hidden: kicker, meta, hiring/best/style lines
- Gallery: **minmax(108px)** thumbnails, 10px names
- Style lead paragraph hidden

### Export (`docStep-export`)
- Export kicker/lead minimized
- Stage **min 74vh** for clean A4
- Footer: **Download PDF + More** only (from P0), narrower bar

---

## Screenshots

### Before (pre-scale — P0 subtraction baseline)

| Step | Path |
|------|------|
| Import / post-import | `.qa-screenshots/ui-scale-fix/before/01-import.png` |
| Review | `.qa-screenshots/ui-scale-fix/before/02-review.png` |
| Style | `.qa-screenshots/ui-scale-fix/before/03-style.png` |
| Export | `.qa-screenshots/ui-scale-fix/before/04-export.png` |

*Copied from `.qa-screenshots/p0-subtraction/`.*

### After (UI scale fix)

| Step | Path |
|------|------|
| Hero | `.qa-screenshots/ui-scale-fix/after/00-hero.png` |
| Import | `.qa-screenshots/ui-scale-fix/after/01-import.png` |
| Review | `.qa-screenshots/ui-scale-fix/after/02-review.png` |
| Style | `.qa-screenshots/ui-scale-fix/after/03-style.png` |
| Export | `.qa-screenshots/ui-scale-fix/after/04-export.png` |

---

## QA

```bash
npm run dev   # http://localhost:3001
HIRELY_URL='http://127.0.0.1:3001/?pro=true' node scripts/qa-ui-scale-fix.mjs
```

| Check | Result |
|-------|--------|
| Body ≤15px | ✅ 15px |
| H1 ≤34px | ✅ 34px |
| Review grid ~70/30 | ✅ `826px 360px` at 1440 viewport |
| CV stage width dominant | ✅ ~778px stage |
| Screenshots captured | ✅ before + after |
| `npm run check:core` | ✅ (run after pull) |

### Manual

1. Landing — headline feels editorial, not billboard.
2. Import — drop card centered, not full-bleed rail.
3. After import — CV fills center; review sidebar slim.
4. Style — scan thumbnails in one row; minimal text noise.
5. Export — A4 page calm, single PDF CTA.

---

## Design principles applied

1. **Shrink controls, not the document** — CV inner width stays 794px logical; only gentle container scale.
2. **One focal layer per step** — hide duplicate headers/kickers in production.
3. **Negative space is product** — stage padding increased vs density pass.
4. **No dashboard density** — removed `visual-density-pass.css` from production load order.

---

## Follow-ups (optional)

- Reconcile `hirely-ui-scale.css` tokens with `ui-scale-fix.css` (merge into one file).
- Update `prelaunch-browser.mjs` / `qa:smoke` to use `loadSample()` instead of `#sampleBtn`.
- Capture true pre-import drop screenshot (reset workspace in QA) for import-only before/after.
