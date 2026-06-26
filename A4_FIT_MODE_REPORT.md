# A4_FIT_MODE_REPORT

**Result:** PASS
**Date:** 2026-06-08T22:03:19.868Z

## Mission

CV preview always shows a complete A4 page at true 794×1123 ratio — centered, no crop, no horizontal scroll. Default **Fit** scales to viewport height (first page fully visible on desktop). Long CVs stack page 1 + page 2 with clear separation. PDF export unchanged at native A4.

## Requirements

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| A4 ratio 794×1123 | `HirelyA4Viewport.A4_WIDTH_PX` / `A4_HEIGHT_PX`, `aspect-ratio: 210/297` | yes |
| Default: entire first page | `computeZoom` fit mode uses `availH / A4_HEIGHT_PX` | yes |
| Auto scale from viewport | `ResizeObserver` on `#cvStage` + `apply()` | yes |
| Centered page | `transform-origin: top center`, `.a4Viewport__fit` margin auto | yes |
| No crop | `overflow: visible` on sheets; overflow warning only | yes |
| No horizontal scroll | `overflow-x: hidden` on viewport + stage | yes |
| Zoom Fit / 90% / 100% | `#a4ZoomBar` + `HirelyA4Viewport.setZoomMode()` | yes |
| Long CV stacked pages | `.cvA4Stack` gap 24px, page labels, sheet shadow | yes |
| PDF export real A4 | `suspendScaleForExport()` / `restoreScaleAfterExport()` | yes |

## Architecture

- `src/ui/export/a4-viewport.js` — fit / 90% / 100% zoom, first-page fit math
- `src/ui/export/a4-viewport.css` — zoom toolbar + viewport layout
- `src/ui/export/cv-a4-pages.js` + `.css` — stacked A4 sheets, 24px gap
- `index.html` — `#a4ZoomBar`, `renderA4ZoomBar()`, `syncStudioCvScale()`

## QA gates

```
qa-a4-fit-mode: PASS
OK zoom modes defined
OK zoom mode API
OK fit uses first-page height for scale
OK export scale suspend
OK zoom toolbar in DOM
OK Fit control
OK 90% control
OK 100% control
OK zoom bar chrome wired
OK zoom bar styles
OK stacked page gap 24px
OK page labels on continuation sheets
OK horizontal overflow blocked
OK preview centered from top
OK desktop 1280×720 shows full first page (688px tall)
OK no horizontal overflow at 1280px (486px wide)

qa-a4-fit-mode: all passed

qa-a4-viewport: PASS
qa-a4-viewport
  ✓ ISO A4 mm dimensions
  ✓ A4 px dimensions 794×1123
  ✓ px ratio matches mm (1.414 ≈ 1.414)
  ✓ 1440px fit zoom 0.7729
  ✓ 1280px fit zoom 0.7017
  ✓ first page fits 1440×900 viewport (868px ≤ 868px)
  ✓ review column fit zoom 0.4452
  ✓ first page fits review column height (500px)
  ✓ 90% preset is 0.9
  ✓ 100% preset is 1
  ✓ 1024px fit zoom 0.5948
  ✓ mobile fit zoom 0.4509
  ✓ mobile respects min zoom (0.4509 >= 0.22)
  ✓ scaled width fits container (388px)
  ✓ scaled page preserves aspect ratio
  ✓ zoom is deterministic
  ✓ export width matches preview
  ✓ export height matches preview
qa-a4-viewport: passed

qa-a4-preview-contract: PASS
OK fit mode default zoom
OK zoom controls Fit 90% 100%
OK A4 px canvas 794×1123
OK A4 aspect ratio locked
OK preview page uses 794×1123
OK long lines wrap in preview
OK footer hidden on edit step
OK export footer not sticky
OK export footer avoids sticky overlap
OK viewport blocks horizontal overflow
OK preview column scroll contained
OK preview centered from top

qa-a4-preview-contract: all passed
```

## Acceptance

- On desktop, first A4 page is visible entirely by default (Fit mode).
- User can switch to 90% or 100%; width capped to prevent horizontal scroll.
- Multi-page CVs scroll vertically with labeled stacked sheets.
- PDF export captures 794×1123 per sheet without preview scale transform.
