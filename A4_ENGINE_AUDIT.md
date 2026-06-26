# A4 Engine Audit

**Date:** 2026-06-03  
**Status:** Recovered — true A4 viewport with proportional zoom and overflow warnings

## Symptom

Preview was broken:

- Content cropped (name cut off)
- Zoom incorrect on studio / smaller screens
- Page not centered
- Paper ratio lost on mobile (`width: 100%` + `min-height: 900px`)

## Architecture

```
#cvDoc (794×1123 px per sheet, 210×297 mm)
    ↓
HirelyA4Pages.layoutCvA4Pages()  — pack content into discrete sheets
    ↓
#a4Viewport (A4Viewport)
    ├── computeZoom()     — fit-page | fit-width | auto by breakpoint
    ├── apply()           — scale + center, never stretch
    └── detectPageOverflow() — SAFE_PAGE_OVERFLOW
    ↓
.cvStageInner  transform: scale(zoom), transform-origin: top left
.a4Viewport__fit  layout box = content × zoom (centering)
```

## Root causes

### 1. A4 mode disabled scaling

`syncStudioCvScale()` set `transform: none` when `#cvDoc.cv--a4`, leaving a fixed 794px canvas that overflowed narrow viewports → horizontal crop.

### 2. Conflicting studio CSS

`studio-layout.css` forced `transform: none !important` on A4 inner — fought viewport centering.

### 3. Mobile CSS broke ratio

```css
@media (max-width: 760px) {
  .cv { width: 100%; min-height: 900px; }  /* not 1123 @ 794 — ratio lost */
}
```

### 4. Silent overflow

`.cvA4Sheet__surface` and `.cvInner` used `overflow-y: hidden` without user-visible warning when packing failed.

### 5. Weak centering

`centerCvPreviewInStage()` only adjusted `scrollLeft` — insufficient with variable zoom.

## Fix

### New modules

| File | Role |
|------|------|
| `src/ui/export/a4-viewport.js` | `HirelyA4Viewport` — zoom, fit, center, overflow detect |
| `src/ui/export/a4-viewport.css` | Viewport shell, overflow warning, ratio lock |

### A4 constants (ISO)

| Unit | Width | Height |
|------|-------|--------|
| mm | 210 | 297 |
| px @ 96dpi | 794 | 1123 |
| ratio | 1 | √2 ≈ 1.414 |

### Zoom behaviour

| Breakpoint | Mode | Behaviour |
|------------|------|-----------|
| Desktop (>1180px) | `fit-page` | Scale to fit full stack in viewport |
| Tablet (761–1180px) | `fit-width` | Fit width, vertical scroll |
| Mobile (≤760px) | `fit-width` | Scaled preview (min zoom 0.28) |

Proportions always preserved — single `scale()` transform, never unequal width/height.

### SAFE_PAGE_OVERFLOW

`detectPageOverflow()` measures each `.cvInner` against `1123px`:

- Adds `.cvA4Sheet--overflow` + amber outline
- Shows `#a4OverflowWarn` banner with page numbers and overflow px
- Overflow sheets use `overflow: visible` — **never crop silently**

### DOM structure

```html
<div id="cvStage" class="cvStage">
  <div id="a4OverflowWarn" class="a4OverflowWarn hidden"></div>
  <div id="a4Viewport" class="a4Viewport">
    <div class="a4Viewport__fit">
      <div class="cvStageInner">… #cvDoc …</div>
    </div>
  </div>
</div>
```

## Verification

```bash
npm run qa:a4-viewport
npm run qa:product-recovery   # browser — A4 sheets 794×1123, no silent clip
```

### Manual check

1. Import CV → preview shows full name (not left-cropped)
2. Resize window → page scales down, stays centered
3. Mobile width → smaller proportional preview, ratio unchanged
4. If content exceeds a page → amber warning banner appears

## Files changed

- `src/ui/export/a4-viewport.js` (new)
- `src/ui/export/a4-viewport.css` (new)
- `src/ui/export/cv-a4-pages.js` — post-layout viewport apply, overflow export
- `src/ui/export/cv-a4-pages.css` — preview overflow rules
- `src/ui/studio/studio-layout.css` — remove A4 scale blockers
- `index.html` — A4Viewport DOM, CSS, wiring, mobile ratio fix
- `src/tests/qa-a4-viewport.mjs` (new)
