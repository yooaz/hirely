# Hirely cleanup pass — final report (May 2026)

Cleanup completed before resuming OCR work. Goal: one canonical stack, six curated templates, no duplicate experiments in the active app path.

---

## Step 1 — Audit summary

### Largest folders (runtime vs archived)

| Path | Size | Verdict |
|------|------|---------|
| `archive/` | ~18 MB | **ARCHIVED** (not loaded by app) |
| `archive/legacy-public/` | ~580 KB | **ARCHIVED** — duplicate CSS/JS never linked from `index.html` |
| `archive/legacy-preview/` | ~2 MB | **ARCHIVED** — screenshots only |
| `node_modules/` | dev only | **KEEP** — Playwright for `qa:browser` |
| Project root (app + scripts) | ~308 KB JS/HTML/CSS (excl. archive) | **KEEP** |

### Largest active files

| File | Bytes | Verdict |
|------|------:|---------|
| `index.html` | 184,761 | **KEEP** (monolith UI; still large — future split optional) |
| `lib/cv-parser.js` | 36,957 | **KEEP** — Vercel `api/analyze.js` only |
| `core/extraction.js` | 14,094 | **KEEP** — browser extraction |
| `cv-templates.js` | 13,817 | **KEEP** — 6 templates |
| `cv-templates-premium.css` | 6,751 | **KEEP** — trimmed from 20-pack |
| `scripts/extraction-test.mjs` | 8,936 | **KEEP** — regression |

### Duplicate / dead inventory

| Area | Finding | Verdict |
|------|---------|---------|
| OCR | Tesseract + inline PDF parsers in `index.html` removed; PDF/DOCX via `core/extraction.js` + lazy CDN | **REMOVED** from active path |
| Parsers | `public/lib/hirely-cv-parser.js` archived; inline fallback in `index.html` kept for import failure; `core/extraction.js` canonical | **REVIEW** inline vs core-only later |
| Review UI | `wsAnalysis` panel removed; legacy CSS hidden with `display:none` | **REVIEW** — optional CSS strip (~2 KB) |
| Template renderers | 20-pack → `archive/`; active `cv-templates.js` | **KEEP** one pack |
| PDF export | Single path: lazy `html2pdf` | **KEEP** |
| Routes | Single-page `index.html`; no router | **N/A** |
| Dead CSS | `.wsAnalysis`, `.parseFeed`, `.fieldAudit` rules still in stylesheet block but suppressed | **REVIEW** |
| Unused assets | `public/css`, `public/lib` | **ARCHIVED** |

### Workspace tabs (product)

| Tab | Status |
|-----|--------|
| Importer | **KEEP** — `wsImport` |
| Vérifier / audit | **KEEP** — score + insights (no separate analysis column) |
| Style | **KEEP** — template grid (6) |
| Exporter | **KEEP** — PDF/TXT export bar |

---

## Step 2 — Duplicates removed (active app)

- Archived full **20-template** pack (`cv-templates-20-pack.js`, `cv-templates-premium-20-pack.css`).
- Archived **`legacy-public/`** (unused polish stacks and duplicate `hirely-*.js`).
- Removed from **`index.html`**: sync CDN tags for PDF.js / Mammoth / html2pdf (replaced with `window.HirelyLazy`).
- Removed dead **`imageFileToText` / inline PDF OCR** paths; extraction defers to **`core/extraction.js`**.
- Removed legacy **`runExtractionPipeline`**, confidence gates, **`wsAnalysis`** aside, parse feed UI wiring.

**Canonical sources:** see `CANONICAL_SOURCE.md` and `archive/README.md`.

---

## Step 3 — UI cleanup

- Obsolete **analysis sidebar** removed from DOM.
- **Featured templates** limited to six IDs in `FEATURED_TEMPLATE_IDS`.
- Legacy review widgets forced hidden via CSS (`display:none !important`).

---

## Step 4 — Template curation

Six templates retained (aliases map old IDs):

| ID | Display name |
|----|----------------|
| `ats` | Minimal ATS |
| `executive` | Executive |
| `swiss` | Swiss Editorial |
| `artdirector` | Creative Director |
| `tech` | Product Designer |
| `compact` | Compact Recruiter |

`ats` remains the only **free** tier template (enforced in `qa-smoke.mjs`).

---

## Step 5 — Performance

| Change | Effect |
|--------|--------|
| Lazy-load PDF.js, Mammoth, html2pdf via `HirelyLazy` | No heavy CDN scripts on first paint |
| Removed `pdfjs-dist` npm dependency | Browser uses CDN only when importing PDF |
| Trimmed `cv-templates-premium.css` | ~18 KB → **6.7 KB** (script: `scripts/trim-template-css.mjs`) |
| Archived unused `public/` tree | ~580 KB out of active tree |

**Dependencies (production runtime):** none in `package.json` — static app + optional Vercel API.

**DevDependencies:** `playwright` only (QA).

### Bundle size (active app files)

| Metric | Before cleanup (approx.) | After cleanup |
|--------|--------------------------|---------------|
| `index.html` + `cv-templates.js` + `cv-templates-premium.css` + `core/extraction.js` | ~244 KB | **~220 KB** |
| Template CSS alone | ~18 KB | **6.7 KB** |
| Unused `public/` in tree | ~580 KB | **0** (archived) |
| First-load CDN scripts | 3 sync tags | **0** (on-demand) |

*Before figures from pre-cleanup measurement of the same file set; `index.html` line count reduced by ~400+ lines of dead pipeline/OCR.*

---

## Step 6 — Files moved / removed

### Archived (`archive/` — ~18 MB total)

- `legacy-public/css/`, `legacy-public/lib/`
- `legacy-docs/` (patch markdown)
- `legacy-preview/screenshots/`
- `hirely_premium_repair_patch.zip`
- `cv-templates-20-pack.js`, `cv-templates-premium-20-pack.css`

### Updated in place

- `index.html`, `cv-templates.js`, `cv-templates-premium.css`
- `package.json` (removed `pdfjs-dist`)
- `scripts/qa-smoke.mjs` (expects **6** templates)
- `scripts/prelaunch-browser.mjs` (template count ≥ 6)
- `scripts/trim-template-css.mjs` (new)

### Dependencies removed

- `pdfjs-dist` (unused after CDN lazy-load)

---

## QA status (post-cleanup)

| Script | Result |
|--------|--------|
| `npm run qa:smoke` | Pass |
| `npm run qa:extraction` | Pass |
| `npm run qa:core-flow` | Pass |
| `npm run qa:browser` | Pass (server on port 3456, `?pro=true`) |

---

## KEEP / REVIEW / REMOVE (quick reference)

### KEEP

- `index.html`, `cv-templates.js`, `cv-templates-premium.css`, `core/extraction.js`
- `lib/cv-parser.js`, `api/analyze.js`
- `scripts/*` QA suite, `CANONICAL_SOURCE.md`, `PROJECT_BRAIN.md`

### REVIEW (safe follow-ups, not blocking)

- Strip dead `.wsAnalysis` / `.parseFeed` / `.fieldAudit` CSS from `index.html`
- Consolidate inline `parseCV` fallback with `core/extraction.js` only
- Split `index.html` into modules when ready for maintainability

### REMOVE / ARCHIVED (do not re-import)

- Everything under `archive/`
- Duplicate parsers and OCR experiments in archived `legacy-public/lib/`

---

## OCR work — intentionally paused

PDF text extraction uses **`core/extraction.js`** + lazy **PDF.js**. No new OCR features were added in this pass. Resume OCR only after approving this baseline.
