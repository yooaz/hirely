# Component Split Plan

**Generated:** 2026-06-15T11:05:28.740Z
**Goal:** Decompose `index.html` into **ImportStep**, **ReviewStep**, **StyleStep**, **ExportStep**, **Landing**, **Header**, **Footer** — target **`index.html` < 1,500 lines**.

## Executive summary

| Metric | Value |
|--------|-------|
| Current `index.html` lines | **8,476** |
| Inline `<style>` block | 929 lines (~83 KB) |
| Inline `<script>` block | 6925 lines |
| Body HTML (components) | 514 lines |
| External `<script src>` tags | 22 lines |
| External `<link>` CSS tags | 50 |
| Inline JS functions | 393 |
| Target `index.html` | **< 1,500 lines** |

### Line budget to reach < 1,500

| Removal / move | Lines freed | Running total |
|----------------|------------:|--------------:|
| Move inline CSS → `core.css` (see CSS_CONSOLIDATION_PLAN) | −929 | 7,547 |
| Extract inline JS → ES modules | −6925 + ~35 script tags | **~657** |
| Extract HTML partials → `src/ui/components/*.html` | −514 + ~300 shell | **~443** |

> **Verdict:** `< 1,500` is achievable only when **inline CSS, inline JS, and body HTML** all leave `index.html`. The shell retains meta, bundle links, mount points, and `type="module"` entry.

## Current structure

```
index.html (8,476 lines)
├── <head>
│   ├── meta + fonts          (13 lines)
│   ├── 50× CSS <link>        (50 lines)
│   ├── HirelyLazy boot       (21 lines)
│   └── inline <style>        (929 lines)  ← MOVE OUT
├── <body>
│   ├── Header                (5 lines)
│   ├── Landing (#hero)       (28 lines)
│   ├── Workspace shell       (33 lines)
│   ├── ImportStep (#wsImport) (72 lines)
│   ├── wsProduct main        (~310 lines, multi-step)
│   ├── Footer + pricing      (64 lines)
│   ├── 22× external scripts  (22 lines)
│   └── inline <script>       (6925 lines)  ← MOVE OUT
└── </html>
```

### Doc-step mapping

| UI step | `docStep-*` class | Primary DOM roots |
|---------|-------------------|-------------------|
| **ImportStep** | `import` | `#wsImport`, `#drop`, `#fileInput`, `#importPasteFallback` |
| **ReviewStep** | `edit`, `verify` | `#reviewStudioCenter`, `#reviewStudioAnalysis`, `#studioRail`, `#wsInsights` |
| **StyleStep** | `style` | `#styleStepHead`, `#templatePickerBar`, `#premiumTemplateGallery` |
| **ExportStep** | `export` | `#exportStepHead`, `#a4ZoomBar`, `#cvExportBar`, `#downloadBtn` |
| **Landing** | pre-workspace | `#hero`, `#heroUploadBtn` |
| **Header** | global | `header.top`, `#uiLang`, nav anchors |
| **Footer** | global + step CTAs | `footer.docFooter`, `#pricing`, `.footer` |

## Component extraction map (HTML)

### Header

| Property | Value |
|----------|-------|
| Lines | 1017–1021 (5 lines) |
| Root | `header.top` |
| Active on | * |

**Proposed file:** `src/ui/components/Header.html`

### Landing

| Property | Value |
|----------|-------|
| Lines | 1022–1049 (28 lines) |
| Root | `section#hero` |
| Active on | import |

**Proposed file:** `src/ui/components/Landing.html`

### ImportStep

| Property | Value |
|----------|-------|
| Lines | 1083–1154 (72 lines) |
| Root | `aside#wsImport` |
| Active on | import |
| Also includes | 1054-1082 ProgressNav (shared shell) |

**Proposed file:** `src/ui/components/ImportStep.html`

### ReviewStep

| Property | Value |
|----------|-------|
| Lines (fragmented) | 157 across 4 regions |
| Root | `docStep-edit | docStep-verify` |
| Active on | edit, verify |

| Region | Lines | Anchor |
|--------|------:|--------|
| | 1156–1161 | `header#resumeStudioHead` |
| | 1308–1380 | `reviewStudioCenter + reviewStudioAnalysis` |
| | 1383–1421 | `aside#wsInsights (review mode)` |
| | 1423–1461 | `aside#studioRail` |

**Proposed file:** `src/ui/components/ReviewStep.html`

### StyleStep

| Property | Value |
|----------|-------|
| Lines (fragmented) | 68 across 4 regions |
| Root | `docStep-style` |
| Active on | style |

| Region | Lines | Anchor |
|--------|------:|--------|
| | 1162–1166 | `header#styleStepHead` |
| | 1176–1183 | `#extractionQualityStep` |
| | 1185–1198 | `#templatePickerBar` |
| | 1222–1262 | `#proCvLayoutTools + photoEditorDialog` |

**Proposed file:** `src/ui/components/StyleStep.html`

### ExportStep

| Property | Value |
|----------|-------|
| Lines (fragmented) | 26 across 3 regions |
| Root | `docStep-export` |
| Active on | export |

| Region | Lines | Anchor |
|--------|------:|--------|
| | 1167–1173 | `header#exportStepHead` |
| | 1263–1269 | `#a4ZoomBar` |
| | 1510–1521 | `#cvExportBar` |

**Proposed file:** `src/ui/components/ExportStep.html`

### SharedStudio

| Property | Value |
|----------|-------|
| Lines | 1174–1307 (134 lines) |
| Root | `#studioPreview / #cvStage` |
| Active on | edit, style, export |
| Note | CV preview shell shared across Review, Style, Export |

**Proposed file:** `src/ui/components/SharedStudio.html`

### Footer

| Property | Value |
|----------|-------|
| Lines (fragmented) | 61 across 2 regions |
| Root | `footer.docFooter, #pricing, .footer` |
| Active on | * |

| Region | Lines | Anchor |
|--------|------:|--------|
| | 1464–1522 | `footer.docFooter` |
| | 1525–1526 | `#pricing + .footer tag` |

**Proposed file:** `src/ui/components/Footer.html`

### SharedStudio (not a user-facing step)

Lines **1174–1307** (134 lines): `#studioPreview`, `#cvStage`, `#cvDoc`, `#a4Viewport`. Required by DOM contract (`cvDoc` / `cvPreview`). Lives in `src/ui/components/SharedStudio.html` or stays in shell.

### ProgressNav (workspace chrome)

Lines **1054–1082** (29 lines): `#docNav` — mount in shell or `WorkspaceShell.html`.

## Component extraction map (JavaScript)

**393 functions** in the monolithic script. Recommended ES module split:

| Module | Component | Est. lines | Functions (category) |
|--------|-----------|----------:|----------------------|
| `src/ui/shell/app-header.js` | Header | ~120 | — |
| `src/ui/shell/landing.js` | Landing | ~80 | — |
| `src/ui/shell/doc-nav.js` | Shell | ~200 | — |
| `src/ui/import/import-step.js` | ImportStep | ~2200 | 89 |
| `src/ui/review/review-step.js` | ReviewStep | ~1800 | 67 |
| `src/ui/style/style-step.js` | StyleStep | ~900 | 19 |
| `src/ui/export/export-step.js` | ExportStep | ~700 | 28 |
| `src/ui/render/render-cv.js` | SharedStudio | ~600 | 10 |
| `src/ui/shell/app-state.js` | Shell | ~150 | — |
| `src/ui/shell/app-boot.js` | Shell | ~400 | — |
| `src/ui/shell/i18n.js` | Shell | ~350 | — |
| `src/ui/footer/doc-footer.js` | Footer | ~400 | — |

### Function inventory by category

| Category | Count | Extract to |
|----------|------:|------------|
| shared | 144 | app-state.js + i18n.js |
| import | 89 | import-step.js |
| review | 67 | review-step.js |
| export | 28 | export-step.js |
| style | 19 | style-step.js |
| runtime-dup | 15 | DELETE (use dom-contract.js / boot-trace.js) |
| render-ui | 13 | render-cv.js + step modules |
| render-core | 10 | render-cv.js |
| shell | 8 | doc-nav.js + app-boot.js |

### Duplicate runtime (delete from index after extract)

These already exist in `src/ui/runtime/` — remove copies from inline script:

- `hirelyTrace`, `setHTML`, `setText`, `validateDomContract` → `dom-contract.js` / `dom-safe.js`
- `bootTraceStep`, `ensureBootTraceArray` → `boot-trace.js`
- Import forensics hooks → `import-forensics.js`

~15 functions / wrappers can be deleted outright.

### Critical anchors (do not break)

| Symbol | Line | Module owner |
|--------|-----:|--------------|
| `setDocStep()` | 2947 | `doc-nav.js` |
| `handleFileImport()` | — | `import-step.js` |
| `renderCV()` | 6682 | `render-cv.js` |
| `renderAll()` | 7208 | `render-cv.js` |
| `const state` | 2465 | `app-state.js` |
| `getHirelyCore().then(...)` | ~8388 | `app-boot.js` |

## Target `index.html` shell (< 1,500 lines)

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <!-- ~15 lines: meta, title, fonts -->
  <link rel="stylesheet" href="dist/core.css">
  <link rel="stylesheet" href="dist/design-system.css">
  <link rel="stylesheet" href="dist/templates.css">
  <script src="src/ui/runtime/hirely-lazy.js"></script>
</head>
<body>
  <div id="hirelyCoreLoadError" class="hidden">…</div>
  <div id="app">
    <div id="header-mount"></div>
    <div id="landing-mount"></div>
    <div id="workspace-mount"></div>
    <div id="footer-mount"></div>
  </div>
  <!-- ~22 runtime script tags (unchanged until barrel) -->
  <script type="module" src="src/ui/shell/app-main.js"></script>
</body>
</html>
```

**Estimated shell size:** ~180 lines (head) + ~120 (script refs) + ~40 (mount divs) = **~340 lines** with 3 CSS bundles.

## Assembly strategies

| Strategy | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **A. Build-time HTML includes** (Vite/Esbuild `import.meta.glob`) | Zero runtime fetch; DOM present at parse | Needs bundler in dev | **Preferred** |
| **B. Runtime `fetch()` partials** | No build step | Flash of empty mounts; DOM contract races | Dev-only fallback |
| **C. `document.createRange` templates in JS** | Single module graph | HTML buried in strings | Avoid |

### Workspace mount tree (post-split)

```
#workspace-mount
└── WorkspaceShell.html
    ├── ProgressNav.html
    ├── ImportStep.html          ← aside#wsImport
    └── wsProduct
        ├── StepHeads.html       ← resume/style/export headers
        ├── SharedStudio.html    ← #cvStage / #cvDoc
        ├── ReviewStep.html      ← review panels + studioRail
        ├── StyleStep.html       ← gallery + pro layout
        ├── ExportStep.html      ← zoom + export chrome
        └── InsightsAside.html   ← #wsInsights
```

## DOM IDs per component

| Component | ID count (sample) | Contract-critical |
|-----------|------------------:|-------------------|
| ImportStep | 39 | `drop`, `fileInput`, `importPasteFallback` |
| ReviewStep | 50 | `cvDoc` (via SharedStudio), `reviewPanel` |
| StyleStep | 6 | `templateGrid`, `premiumTemplateGallery` |
| ExportStep | 10 | `downloadBtn`, `cvExportBar` |

`dom-contract.js` **requiredIds** must resolve after partial assembly: `app`, `docNav`, `wsImport`, `drop`, `fileInput`, `cvPreview` (alias `cvDoc`).

## Phased migration

### Phase 0 — Inventory lock
1. Land this plan + `npm run qa:index-decomposition`.
2. Extend `dom-contract.js` optionalIds for every mount root (`header-mount`, etc.) only if using runtime assembly.
3. Baseline: `npm run qa:boot`, `npm run qa:dom-contract`, import forensics.

### Phase 1 — Extract JS (largest win)
1. Create `src/ui/shell/app-main.js` — sole `type="module"` entry.
2. Move `const state` → `app-state.js`; export `getState()` / `setState()`.
3. Move import pipeline (`handleFileImport` @ line 7387) → `import-step.js`.
4. Move `setDocStep` → `doc-nav.js`; re-export on `window` for QA scripts.
5. Move `renderCV` / `renderAll` → `render-cv.js`.
6. Delete runtime duplicates already in `src/ui/runtime/*`.

**Lines removed:** ~6925 → index drops to ~1586.

### Phase 2 — Extract inline CSS
1. Fold `<style>` block into `core.css` (per CSS_CONSOLIDATION_PLAN).
**Lines removed:** ~929.

### Phase 3 — Extract HTML partials
1. Cut/paste each component region into `src/ui/components/*.html`.
2. Wire Vite (or lightweight `scripts/assemble-index.mjs`) to emit final `index.html`.
3. Keep **one** `#workspaceGrid` wrapper — do not split across async fetches without shell.

### Phase 4 — Collapse script tags
1. Optional barrel: `src/ui/shell/runtime-scripts.js` imports existing `src/ui/**` modules.
2. Reduce 22 `<script src>` to 1 module graph.

## Risks

| Risk | Mitigation |
|------|------------|
| `setDocStep` CSS class toggles depend on DOM order | Keep `#workspaceGrid` in shell; partials inside stable children |
| Global `state` / `$()` used everywhere | Phase 1: `window.HirelyApp = { state, $ }` shim |
| QA scripts grep `index.html` | Update greps to `src/ui/**/*.js` |
| Import gate | Decomposition is structural — no visual polish during FAIL gate |
| `HirelyParse` export on boot | Preserve `window.HirelyParse` surface in `app-boot.js` |

## Verification

```bash
npm run qa:index-decomposition   # regenerate this report
npm run qa:dom-contract
npm run qa:boot
npm run qa:import-forensics
wc -l index.html                 # must be < 1500 after Phase 3
```

## Related

- `CSS_CONSOLIDATION_PLAN.md` — inline style extraction (~929 lines)
- `DOM_CONTRACT_REPORT.md` — required DOM IDs
- `DEAD_REFERENCE_REPORT.md` — stale selectors after split
