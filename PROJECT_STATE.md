# HIRELY — Canonical Project State

## EXTRACTION FREEZE (active)

**Mission:** extraction reliability only. **No** feature, UI, style, or export work.

Release blocked until `npm test` passes. Criteria: see [EXTRACTION_FREEZE.md](./EXTRACTION_FREEZE.md).

---

## Canonical lock

| Field | Value |
|-------|--------|
| **Canonical version** | `hirely_FINAL_CURSOR_STABLE_UI` |
| **Reference archive** | `HIRELY_V27_IMPORT_FIX (1)` (read-only) |
| **Status** | **ACTIVE** |

### Rules (do not violate)

1. Work **only** inside `hirely_FINAL_CURSOR_STABLE_UI`.
2. **Never** edit `HIRELY_V27_IMPORT_FIX (1)`.
3. **Never** merge folders between canonical and V27.
4. **Never** copy entire folders from V27 into canonical.
5. V27 is a **read-only reference** for ports, diffs, and behavior comparison — port concepts file-by-file only.

### Paths

| Role | Absolute path |
|------|----------------|
| Canonical (edit here) | `/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI` |
| Reference (read-only) | `/Users/yohannazancot/YOAZ_STUDIO_OS/HIRELY_V27_IMPORT_FIX (1)` |

---

## Architecture status

**Model:** Browser-canonical SPA — static host + ES modules under `src/`, no full V27 Node `backend/` in canonical.

```
Upload (PDF / DOCX / image / paste)
  → file-type-detect + pdf-text-quality
  → enterprise-engine (native_pdf | mixed hybrid | OCR)
  → clean + ocr-postprocess + corruption-detector
  → parser-enterprise / pipeline → structuredResume
  → validation (score, extraction-quality, line gate)
  → cv-templates (8 production) → export (html2pdf / text)
```

| Layer | Location | Status |
|-------|----------|--------|
| Extraction | `src/core/extraction/` | **ACTIVE** — enterprise engine, fusion A–D, preprocess, hybrid PDF |
| Parsing | `src/core/parsing/` | **ACTIVE** — structured resume, section mapper, sanity, OCR postprocess |
| Validation | `src/core/validation/` | **ACTIVE** — score, import quality, corruption export gate |
| UI / templates | `src/ui/templates/`, `index.html` | **ACTIVE** — 8 production templates, gallery wired |
| Export | `src/core/export/`, client html2pdf | **ACTIVE** — browser export; Playwright PDF route deferred (P1) |
| QA | `src/tests/`, `tests/` | **ACTIVE** — extract pack, reliability, fusion, core-flow, smoke |

**Port map (living):** `docs/v27-ocr-port-map.html` — P0 OCR shipped in STABLE; P1/P2 tracked separately.

**Dev server:** `npm run dev` → `http://localhost:3000/index.html`

---

## Template count

**8** production CV templates (`PRODUCTION_TEMPLATE_IDS` in `src/ui/templates/production-template-ids.mjs`):

`ats`, `premium-moderne`, `premium-classique`, `premium-creatif`, `premium-luxe`, `executive`, `swiss`, `creativedirector`

Source of truth for gallery order: same file + `cv-templates.js` + `index.html` featured list (must stay in sync).

---

## Extraction status

| Capability | Status |
|------------|--------|
| Native PDF first (pdf.js) | **Done** — skips OCR when text layer is usable |
| Document kind | **Done** — `native_pdf` / `pdf_mixed` / `pdf_scanned` |
| Mixed PDF routing | **Done** — hybrid: native pages + OCR on weak pages |
| OCR multipass + fusion | **Done** — passes A–D; per-line `candidate`, `confidence`, `source` |
| Preprocess | **Done** — rotate, deskew, denoise, adaptive threshold, dynamic DPI cap |
| OCR cleanup | **Done** — unicode/garbage/punctuation; creative brand protection |
| Image / DOCX / TXT / paste | **Done** — `extract-file.js` + enterprise wrappers |

**Tests (last verified):**

- `npm run test:extract` — **0 FAIL**, 11 NEEDS_REVIEW (parser retention notes, non-blocking)
- `npm run qa:reliability` / `qa:fusion` / `qa:preprocess` — pass
- `npm run qa:core-flow` — pass

---

## Parser status

| Capability | Status |
|------------|--------|
| `structured-resume.js` + `section-mapper.js` | **ACTIVE** |
| Section sanity + line confidence gate | **ACTIVE** |
| Enterprise metadata (`extractionMethod`, per-line archive) | **ACTIVE** |
| Corruption detector + export block | **ACTIVE** |
| Archetype / fixture pack | **ACTIVE** — `tests/run-extract.mjs`, `tests/parser-archetypes.mjs` |

**Tests:**

- `npm run qa:parser-sections` — pass
- `npm run test:extract` — no hard FAIL; typical review note: **~40–69%** of cleaned text retained in structured fields (parser mapping loss, not OCR fusion failure)

**Known gaps (not canonical regressions):** multi-column layout order (P1), deeper V27 semantic classifiers (P1), server-side Playwright PDF (P1).

---

## Change log pointer

OCR P0 implementation (Jun 2026): fusion line metadata, cleanup dictionaries, mixed PDF hybrid, memory-safe OCR render — see agent session / `docs/v27-ocr-port-map.html`.

*Update this file when canonical scope, template count, or gate status changes.*
