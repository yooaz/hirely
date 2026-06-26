# Hirely Performance Cleanup Report

**Generated:** 2026-06-03  
**Scope:** Static audit of JS, CSS, templates, OCR modules, backups, and scripts.  
**Action taken:** None — classification only (no files deleted).

---

## Executive summary

| Category | Finding | Est. recoverable disk |
|----------|---------|----------------------|
| Archived legacy tree | `archive/` (~18 MB) not loaded by app | **~18.0 MB** |
| QA artifacts | `tests/output/` regenerable | **~0.9 MB** |
| Dead premium CSS | Old `template-premium-*` classes not emitted | **~10 KB** |
| Root deprecation shims | 3 tiny re-export files | **~1 KB** |
| Deprecated `scripts/` wrappers | Spawn canonical tests | **~4 KB** |

**Runtime bundle (what users load):** `index.html` (~190 KB) + 3 CSS (~13 KB) + `cv-templates.js` (~22 KB) + lazy ES modules on import. Biggest live cost is **monolithic `index.html`** (inline CSS + app logic), not `archive/`.

---

## Estimates (if recommendations are applied)

| Metric | Current baseline | After “safe” cleanup | After “safe + review” cleanup |
|--------|------------------|----------------------|-----------------------------|
| **Disk (repo)** | ~19.5 MB excl. `node_modules` | **~0.5 MB** (−18 MB archive, −0.9 MB `tests/output`) | **~0.55 MB** (+ strip dead CSS/API if approved) |
| **`npm run release:gate`** | ~12–15 s | ~12–15 s (unchanged) | ~10–12 s (fewer redundant Playwright audits) |
| **Browser first paint** | `index.html` parse ~190 KB | No change unless archive removed | **~5–15 KB** if dead inline CSS + unused `hirely-document.css` overlap trimmed |
| **Browser memory** | Lazy CDN (pdf.js, tesseract, html2pdf) | No change | **~50–200 KB** if debug/forensic never loaded in prod; **~7 KB** if premium CSS unlinked |
| **Dev `node_modules`** | ~42 MB (Playwright) | N/A — keep for QA | N/A |

Build speed gains are modest: there is no webpack bundle step; gains come from **shorter CI** (fewer duplicate QA scripts) and **faster grep/search**, not compile time.

---

## 1. Unused / low-value JavaScript

### Production path (loaded from `index.html`)

| File | Size | References | Class |
|------|------|------------|-------|
| `index.html` (inline + boot) | ~190 KB | Entry | **KEEP** — split optional later |
| `src/ui/templates/cv-templates.js` | ~22 KB | `<script src>` | **KEEP** |
| `src/ui/export/hirely-pdf-export.js` | ~4 KB | `<script src>` | **KEEP** |
| `src/core/parsing/pipeline.js` | — | dynamic `import()` | **KEEP** |
| `src/core/extraction/extraction-session.js` | — | dynamic `import()` | **KEEP** |
| `src/core/index.js` | — | dynamic `import()` fallback | **KEEP** |
| `src/debug/forensic-mode.js` | ~20 KB | only if `FORENSIC_MODE` | **REVIEW FIRST** — gate behind flag; do not load in prod builds |

### Canonical modules (not all loaded at once — tree-shaken by usage)

| File | Class | Notes |
|------|-------|-------|
| `src/core/parsing/rich-parser.js` (~44 KB) | **KEEP** | Main parser; used by pipeline |
| `src/core/parsing/cv-parser.js` | **KEEP** | Thin facade → `rich-parser`; used by section QA |
| `lib/cv-parser.js` (~37 KB) | **REVIEW FIRST** | **Only** `api/analyze.js`; not used by `index.html` |
| `api/analyze.js` | **REVIEW FIRST** | Legacy Vercel analyze route; README says do not use for product |
| `api/ocr.js`, `api/structure-cv.js` | **KEEP** | Used when deployed (`/api/ocr`, optional LLM structure) |
| `src/core/parsing/structure-from-api.js` | **KEEP** | Pipeline optional LLM merge |

### Root shims (duplicate entrypoints)

| File | Class |
|------|-------|
| `cv-templates.js` | **SAFE TO DELETE** after updating docs/scripts that still mention root path — only loads `src/ui/templates/cv-templates.js` |
| `core/pipeline.js` | **SAFE TO DELETE** — re-exports `src/core/parsing/pipeline.js`; `index.html` already tries canonical path first |
| `core/extraction.js` | **SAFE TO DELETE** — re-exports `src/core/extraction/index.js` |

### Debug toolkit (`src/debug/` ~53 KB total)

| File | Class |
|------|-------|
| `forensic-mode.js`, `ocr-forensic.js`, `extraction-trace.js`, `parser-lab-report.js`, `stats.js` | **KEEP** for dev; **REVIEW FIRST** for production — load only via `FORENSIC_MODE` / parser-lab |
| `parser-lab/index.html` | **REVIEW FIRST** — dev tool, not release gate |

---

## 2. Unused / duplicate CSS

### Linked from production `index.html`

| Stylesheet | Size | Class |
|------------|------|-------|
| `src/ui/templates/cv-design-tokens.css` | ~2.6 KB | **KEEP** |
| `src/ui/templates/cv-templates-professional.css` | ~7.6 KB | **KEEP** — 8 production templates |
| `src/ui/templates/cv-pdf-export.css` | ~3.1 KB | **KEEP** |
| `src/ui/hirely-document.css` | (see file) | **REVIEW FIRST** — second stylesheet; overlap with large inline `<style>` in `index.html` |

### Not linked from production `index.html`

| Stylesheet | Size | Class |
|------------|------|-------|
| `src/ui/templates/cv-templates-premium.css` | ~7.8 KB | **SAFE TO DELETE** for prod — targets `.template-premium-*`; renders use `.template-productdesigner`, `.template-executive`, etc. |
| `cv-design-tokens.css` lines 96–118 (premium-* overrides) | ~0.5 KB | **REVIEW FIRST** — remove with premium CSS cleanup |
| `archive/legacy-public/css/*` (22 files) | ~315 KB | **SAFE TO DELETE** with `archive/` |
| `archive/cv-templates-premium-20-pack.css` | ~20 KB | **SAFE TO DELETE** with `archive/` |

### Dead rules inside `index.html` (~54 matches)

Selectors for removed UI: `.wsAnalysis`, `.parseFeed`, `.fieldAudit` (hidden with `display:none!important` but rules remain).

| Item | Est. size | Class |
|------|-----------|-------|
| Inline dead workspace/analysis CSS | **~4–8 KB** | **REVIEW FIRST** — safe to strip after visual QA |

---

## 3. Duplicate templates

| Item | Status | Class |
|------|--------|-------|
| **8 production templates** in `cv-templates.js` + `production-template-ids.mjs` | Active | **KEEP** |
| **Alias map** (`premium-moderne` → `productdesigner`, etc.) | IDs resolve to canonical template; DOM class is `template-{canonicalId}` | **KEEP** aliases for old URLs; **REVIEW FIRST** removing alias CSS files |
| **`archive/cv-templates-20-pack.js`** | Superseded | **SAFE TO DELETE** (in `archive/`) |
| **`cv-templates-premium.css`** | Styles obsolete class names | **SAFE TO DELETE** (prod) / **REVIEW** (parser-lab still links it) |
| **Mini previews** | Generated in JS (`renderMini`) | **KEEP** |

**Duplicate?** No second renderer — one `cv-templates.js`. Duplication is **legacy CSS + archive packs** still on disk.

---

## 4. OCR modules — overlap audit

OCR is a **layered stack**, not copy-paste duplicates. Keep unless consolidating architecture.

```
extract-file / enterprise-engine
    ├── pdf-lines-native, pdf-text-quality (text layer)
    └── ocr-lines / pdf-ocr-pages
            ├── pdf-ocr-render (canvas)
            ├── ocr-pipeline (Vision → cloud → Tesseract)
            │       ├── ocr-tesseract
            │       └── ocr-preprocess
            └── ocr-multipass → ocr-fusion
ocr.js (browser facade → pipeline + pdf-ocr-pages + cloud-ocr)

parsing/ocr-postprocess.js  ← text normalization AFTER OCR (not duplicate of image OCR)
```

| Module | Role | Class |
|--------|------|-------|
| `ocr.js` | Browser entry | **KEEP** |
| `ocr-pipeline.js` | Canvas OCR orchestration | **KEEP** |
| `ocr-tesseract.js` | Tesseract worker | **KEEP** |
| `ocr-preprocess.js` | Image prep | **KEEP** |
| `ocr-multipass.js` + `ocr-fusion.js` | Multi-pass + scoring | **KEEP** — used by enterprise path |
| `ocr-lines.js` | Line-level enterprise OCR | **KEEP** |
| `pdf-ocr-pages.js` + `pdf-ocr-render.js` | Page render + OCR | **KEEP** |
| `cloud-ocr.js` | Remote OCR | **KEEP** |
| `parsing/ocr-postprocess.js` | Char/section fixes on **text** | **KEEP** — different layer |
| `archive/legacy-public/lib/*` OCR-ish code | Old stack | **SAFE TO DELETE** with archive |

**REVIEW FIRST (consolidation, not deletion):** Merge `ocr.js` + `ocr-pipeline.js` into one facade file (~2 KB saved, clearer graph). Low priority.

---

## 5. Old backups & archive

| Path | Size | Loaded by app? | Class |
|------|------|----------------|-------|
| `archive/` (total) | **~18.2 MB** | No | **SAFE TO DELETE** from active repo — keep as zip/tag externally if history needed |
| `archive/legacy-public/` | ~580 KB | No | **SAFE TO DELETE** |
| `archive/legacy-docs/` | docs only | No | **REVIEW FIRST** — product history |
| `archive/cv-templates-20-pack.js` | ~24 KB | No | **SAFE TO DELETE** |
| `tests/output/` | **~905 KB** | No (generated) | **SAFE TO DELETE** — regenerate via `npm run release:gate` |
| `docs/CLEANUP_REPORT.md` | older pass | — | **REVIEW FIRST** — superseded by this root report |
| `docs/v27-ocr-port-map.html` | ~32 KB | No | **REVIEW FIRST** — reference doc |

No `*.bak` / `*backup*` files found in tree.

---

## 6. Orphan & overlapping scripts

### `package.json` scripts vs usage

| Script | Wired to release gate? | Class |
|--------|------------------------|-------|
| `release:gate` / `validate:release` | — (orchestrator) | **KEEP** |
| `qa:ocr-pipeline`, `qa:corruption-detector`, `qa:parser-sections`, `qa:review-queue`, `template-audit`, `qa:pdf-export` | Yes | **KEEP** |
| `qa:smoke` | Partial overlap | **KEEP** — fast sanity |
| `qa:quality-gate` | Overlaps import/browser with release gate | **REVIEW FIRST** — merge or deprecate |
| `qa:premium-pdf` | Overlaps `qa:pdf-export` | **REVIEW FIRST** — redundant |
| `qa:template-export` | Overlaps `template-audit` | **REVIEW FIRST** — redundant |
| `templates:screenshots` | Same as `template-audit` | **REVIEW FIRST** — duplicate npm alias |
| `qa:extraction`, `qa:enterprise`, `qa:reliability`, … | Specialist | **KEEP** for deep dives |

### Not in `package.json` (orphan QA)

| File | Class |
|------|-------|
| `src/tests/qa-extraction-quality.mjs` | **REVIEW FIRST** — add to CI or delete |
| `src/tests/qa-safe-clean.mjs` | **REVIEW FIRST** |
| `src/tests/qa-section-sanity.mjs` | **REVIEW FIRST** |
| `src/tests/trim-template-css.mjs` | **REVIEW FIRST** — build tool; outputs wrong-era template IDs |

### Duplicate wrappers (`scripts/`)

| File | Class |
|------|-------|
| `scripts/qa-smoke.mjs`, `core-flow-test.mjs`, `extraction-test.mjs`, `prelaunch-browser.mjs`, `test-extract.mjs` | **SAFE TO DELETE** — spawn `src/tests/*` / `tests/*` |
| `scripts/load-hirely-parse.mjs` | **SAFE TO DELETE** — re-export only |
| `scripts/trim-template-css.mjs` | **REVIEW FIRST** — duplicate of `src/tests/trim-template-css.mjs` |

### `tests/` (root) — still valid but not in release gate

| File | Class |
|------|-------|
| `tests/parser-validation.mjs`, `parser-archetypes.mjs`, `parser-validation-browser.mjs` | **KEEP** — parser regression |
| `tests/mvp-recovery.mjs` | **REVIEW FIRST** — legacy recovery harness |
| `tests/ocr-forensic.mjs` | **KEEP** — CLI for OCR debug |
| `tests/run-extract.mjs` | **KEEP** — `test:extract` |

---

## 7. Classification tables

### SAFE TO DELETE (not referenced by canonical app; regenerate or archived)

| Item | Disk | Risk |
|------|------|------|
| Entire `archive/` directory | ~18.0 MB | Low if history preserved elsewhere |
| `tests/output/**` | ~0.9 MB | None — QA regenerates |
| `src/ui/templates/cv-templates-premium.css` (production) | ~7.6 KB | Low after parser-lab updated to use `cv-templates-professional.css` |
| Root `cv-templates.js`, `core/pipeline.js`, `core/extraction.js` | ~1 KB | Low — update doc links first |
| `scripts/*.mjs` deprecation wrappers (7 files) | ~4 KB | Low |
| `docs/CLEANUP_REPORT.md` (May 2026, in `docs/`) | small | Low — superseded by root report |

### REVIEW FIRST (may still be used in deploy, dev tools, or overlapping QA)

| Item | Why review |
|------|------------|
| `lib/cv-parser.js` + `api/analyze.js` | Vercel legacy; not in `index.html` — confirm deploy still needs |
| `cv-templates-premium.css` + premium tokens in `cv-design-tokens.css` | parser-lab + `qa-quality-gate` preview HTML |
| `index.html` dead CSS (`.wsAnalysis`, `.parseFeed`, …) | Needs quick visual regression |
| `src/ui/hirely-document.css` vs inline styles | Overlap audit |
| `qa:quality-gate`, `qa:premium-pdf`, `qa:template-export` | Overlap with `release:gate` |
| Orphan QA: `qa-extraction-quality`, `qa-safe-clean`, `qa-section-sanity` | Wire into gate or remove |
| `parser-lab/index.html` | Dev-only surface |
| `src/debug/*` | Keep for forensic; exclude from prod deploy |
| `tests/mvp-recovery.mjs` | Old MVP harness |
| OCR facade merge (`ocr.js` + `ocr-pipeline.js`) | Architectural, not dead code |
| `index.html` monolith split | Performance maintainability |

### KEEP (canonical product + release gate)

| Item |
|------|
| `index.html`, `src/ui/templates/cv-templates.js`, `cv-templates-professional.css`, `cv-design-tokens.css`, `cv-pdf-export.css` |
| `src/core/**` (extraction, parsing, validation, export) |
| `src/data/dictionaries/**` |
| `src/tests/release-gate.mjs`, `pdf-export-qa.mjs`, `template-audit.mjs`, `load-hirely-parse.mjs` |
| `tests/fixtures/yoaz-cv/**`, `tests/lib/quality-gate.mjs` |
| `api/ocr.js`, `api/structure-cv.js` (when deployed) |
| Full OCR stack under `src/core/extraction/` (layered, not redundant) |
| `RELEASE_REPORT.md`, `production-template-ids.mjs` |

---

## 8. Suggested cleanup order (manual)

1. **Delete `tests/output/`** — instant ~0.9 MB; zero product risk.  
2. **Zip `archive/` → store outside repo → remove from tree** — ~18 MB disk; no runtime effect.  
3. **Remove root shims** after grep for `core/pipeline.js` / `cv-templates.js` in docs.  
4. **Retire `cv-templates-premium.css`** — switch parser-lab + QA previews to professional CSS; prune token overrides.  
5. **Strip dead inline CSS** in `index.html` (analysis sidebar rules).  
6. **Consolidate npm scripts** — one template audit, one PDF QA, one gate.  
7. **Decide on `api/analyze.js` + `lib/cv-parser.js`** — delete or move to `archive/` if Vercel route retired.

---

## 9. Commands used for this audit

```bash
npm run release:gate    # current baseline ~12–15s
du -sh archive tests/output src
rg "cv-templates-premium|archive/|core/pipeline" .
```

---

*No files were modified or deleted during this audit except creating/updating this report.*
