# HIRELY UI SCALE AUDIT

**Mission:** UI REBALANCE — reduce perceived zoom, increase breathing room, fit more above the fold.  
**Generated:** 2026-06-14  
**Implementation:** `src/ui/hirely-ui-scale.css` (loaded last) + targeted patches in `index.html`, `studio-layout.css`

---

## Executive summary

| Goal | Before | After |
|------|--------|-------|
| Global chrome scale | ~100% (felt “zoomed in”) | **~83%** (−17% padding, type, cards) |
| Max content width | 920–1480px (step-dependent) | **1440px** unified |
| CV preview prominence | 794px fixed, 48px stage padding | **794px + container scale up to 1.18×**, 12–18px padding |
| Side insight rail | 200–248px | **148–168px** |
| Import split rail | 260–300px | **200–220px** |
| Body typography | 15px (OK) | **15px** (locked) |
| H1 (hero / step titles) | clamp 30–46px | **36px cap** |

---

## Typography system

| Role | Token | Size | Line-height | Usage |
|------|-------|------|-------------|-------|
| H1 | `--hirely-h1` | **36px** | 1.12 | Hero headline, import/style/export step titles |
| H2 | `--hirely-h2` | **28px** | 1.20 | Section headers, review studio titles |
| H3 | `--hirely-h3` | **22px** | 1.25 | Panel titles, import h2, suggestion blocks |
| Body | `--hirely-body` | **15px** | 1.55 | Default UI copy, buttons, forms |
| Caption | `--hirely-caption` | **13px** | 1.45 | Meta, hints, gallery subtitles, nav |

**Files:** `src/ui/hirely-ui-scale.css` (`:root` + element mappings)

---

## Spacing system (−17% rebalance)

| Token | Before (polish) | After (rebalance) | Typical use |
|-------|-----------------|-------------------|-------------|
| `--space-1` | 4px | **3px** | Hairline gaps |
| `--space-2` | 8px | **7px** | Chip gaps, tight stacks |
| `--space-3` | 12px | **10px** | Card internal gap |
| `--space-4` | 16px | **13px** | Panel padding unit |
| `--space-5` | 20px | **17px** | Section padding |
| `--space-6` | 24px | **20px** | Step nav margin |
| `--space-8` | 32px | **26px** | Hero / zone spacing |

**Layout tokens**

| Token | Value |
|-------|-------|
| `--hirely-max` | **1440px** |
| `--hirely-gutter` | **32px** (20px mobile) |
| `--hirely-aside-max` | **168px** |
| `--hirely-aside-import-max` | **220px** |

**Radius (−17%)**

| Token | Before | After |
|-------|--------|-------|
| `--radius-sm` | 8px | **7px** |
| `--radius-md` | 12px | **10px** |
| `--radius-lg` | 16px | **13px** |
| `--radius-xl` | 20px | **16px** |

---

## Page-by-page audit

### 1. Dashboard (Landing / Hero)

**DOM:** `#hero`, `.heroGrid`, `.heroPipeline`

| Element | Before | After |
|---------|--------|-------|
| Hero padding | 48px 0 40px | **28px 0 24px** |
| H1 | clamp(30–46px) | **clamp(28–36px)** |
| Hero step cards | min-height 108px, pad 16px | **88px / 13px** |
| Max copy width | 640px | **560px** |

**Above-the-fold:** Pipeline cards + CTA visible without scroll on 900px viewport.

---

### 2. Import

**DOM:** `#wsImport`, `.importPanel`, `.drop`, `#importPasteFallback`

| Element | Before | After |
|---------|--------|-------|
| Panel padding | 20px | **17px** |
| Drop zone min-height | 108px | **88px** |
| Import h2 | 16px | **22px (H3)** |
| Grid aside (pre-ready) | 260–300px | **200–220px** |
| Paste fallback textarea | 220px min | **180px** |

**Step:** `docStep-import` — full-width import, nav only.

---

### 3. Analysis (Review / Edit)

**DOM:** `#reviewStudioCenter`, `#reviewStudioAnalysis`, `.studioPreview`, `#cvStage`

| Element | Before | After |
|---------|--------|-------|
| Review cards padding | 20px | **13–17px** |
| Edit step grid gap | 24px | **16–20px** |
| CV stage padding | 48px / 16–24px | **12–18px** |
| CV min-height (edit) | 68vh / 880px | **62vh / 760px** |
| Template bar sticky top | 64px | **52px** |
| Gallery max-height | 228px / 36vh | **196px / 32vh** |
| Gallery card min | 148px | **128px** |

**CV preview scale:** `@container` on `.workspaceCanvas` — scales `.cvStageInner` up to **1.18×** when canvas ≥ 1100px.

---

### 4. Templates (Style step)

**DOM:** `#premiumTemplateGallery`, `.premiumGalleryGrid`, `.templatePickerBar`

| Element | Before | After |
|---------|--------|-------|
| Gallery columns | minmax(196px) | **minmax(156px)** |
| Card padding | 10px | **8px** |
| Filter pills | 8×14px | **6×11px** |
| Edit-step gallery scroll | 228px | **196px** |

**Above-the-fold:** Compact gallery + top of A4 visible on 1440×900.

---

### 5. Export

**DOM:** `#exportStepHead`, `.docFooter`, `.cvExportBar`, `#exportFinalPanel`

| Element | Before | After |
|---------|--------|-------|
| Export bar padding | 16–20px | **13–17px** |
| Primary CTA min-width | 200px | **168px** |
| Cover letter panel | 20px pad | **17px** |
| Preview min-height | 72vh / 900px | **64vh / 780px** |

---

## Layout specs (production flow)

```
┌──────────────────────────────────────────────────────────── max 1440px ─┐
│  Top bar (46px)                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  Progress nav (compact, ~52px)                                           │
├──────────────────────────────────────┬─────────────────────────────────┤
│  Main column (1fr)                   │  Aside 148–168px (when shown)   │
│  ┌─ Template bar (style/edit) ─────┐  │  Score / insights (narrow)      │
│  ┌─ CV preview (scaled A4) ──────┐  │                                 │
│  │  794px logical × up to 1.18×   │  │                                 │
│  └────────────────────────────────┘  │                                 │
│  Review / Analysis panels (compact)  │                                 │
└──────────────────────────────────────┴─────────────────────────────────┘
```

**Edit step (`docStep-edit`):** single column studio — template bar → CV → review panels (stacked, tighter gaps).

**Style / Export:** full-width main, no aside, CV + export bar.

---

## Files changed

| File | Change |
|------|--------|
| `src/ui/hirely-ui-scale.css` | **NEW** — tokens, typography, spacing, CV container scale |
| `index.html` | Link CSS; `.app` 1440px; grid columns; hero H1; cvStage padding |
| `src/ui/studio/studio-layout.css` | Edit max-width 1440px; gap 16px |

---

## Screenshots

### Before (documented baseline — pre-rebalance)

Captured from prior QA session (`.qa-screenshots/`):

| Screen | File |
|--------|------|
| Import result | `.qa-screenshots/01-import-result.png` |
| Template gallery | `.qa-screenshots/02-template-gallery.png` |
| Export view | `.qa-screenshots/04-export-view.png` |
| A4 preview | `.qa-screenshots/05-a4-preview-centered.png` |

These reflect the **pre-rebalance** scale (larger padding, narrower effective canvas).

### After (post-rebalance)

Captured via `node scripts/ui-scale-screenshots.mjs` @ **1440×900**:

| Screen | File |
|--------|------|
| Dashboard (Hero) | `.qa-screenshots/ui-scale-rebalance/after-01-dashboard.png` |
| Import | `.qa-screenshots/ui-scale-rebalance/after-02-import.png` |
| Analysis / Edit | `.qa-screenshots/ui-scale-rebalance/after-03-analysis-edit.png` |
| Templates (Style) | `.qa-screenshots/ui-scale-rebalance/after-04-templates.png` |
| Export | `.qa-screenshots/ui-scale-rebalance/after-05-export.png` |

Regenerate:

```bash
node scripts/ui-scale-screenshots.mjs
```

---

## Verification checklist

- [ ] Hard refresh (`Cmd+Shift+R`) on `http://localhost:3001`
- [ ] Hero H1 ≤ 36px on desktop
- [ ] Workspace never exceeds 1440px centered
- [ ] CV preview visibly larger vs chrome on edit/style steps
- [ ] Template cards smaller but gallery shows more cards per row
- [ ] Export CTA bar less tall, more preview above fold
- [ ] Mobile ≤960px: CV scale resets to 1× (no horizontal clip)

---

## Design rationale

1. **Chrome −17%, CV +12–18%** — Users care about the document; panels and cards were stealing viewport.
2. **1440px cap** — Matches modern laptop width; avoids over-stretched empty margins on ultra-wide.
3. **Narrower rails** — 168px aside frees ~80px for CV column without losing score readability.
4. **Container-based CV scale** — Keeps export/PDF at 794px logical while preview fills available width.
5. **Single CSS layer** — `hirely-ui-scale.css` overrides polish without rewriting template CV CSS.

---

## Rollback

Remove from `index.html`:

```html
<link rel="stylesheet" href="src/ui/hirely-ui-scale.css">
```

Or set in console for A/B:

```js
document.querySelector('link[href*="hirely-ui-scale"]')?.remove();
```
