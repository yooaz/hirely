# Hirely architecture (locked)

Single-page app entry: **`index.html`** at repo root. All product logic lives under **`src/`** by responsibility. Do not add features when touching this layout — move code, fix imports, keep boundaries.

## Folder map

```
src/
  core/
    extraction/     # File → raw text (TXT, DOCX, PDF text, OCR). No parsing.
    parsing/        # Raw/clean text → cvData JSON. No OCR, no HTML templates.
    validation/     # Scores, audits, field checks.
    export/         # Structured text / export helpers (PDF UI still in index until split).
    index.js        # Browser facade (preferred import path).
  ui/
    templates/      # cv-templates.js, premium CSS, production-template-ids.mjs
    hirely-document.css
  data/dictionaries/
  debug/
  tests/            # Canonical QA (npm run qa:*)

index.html          # UI shell — imports src/core/index.js, src/ui/templates/*
api/                # Vercel serverless (ocr, structure-cv, analyze)
tests/              # Fixture quality gate (test:extract, parser validation)
scripts/            # Thin wrappers → src/tests (legacy paths only)
archive/            # Retired code — never import
core/*.js           # Deprecated re-exports → src/ (backward compatibility)
lib/cv-parser.js    # Legacy API helper for api/analyze.js only
cv-templates.js     # Deprecated script loader → src/ui/templates/
```

## Template registry (14 production)

**Source of truth:** `src/ui/templates/production-template-ids.mjs`  
**Implementations:** `src/ui/templates/cv-templates.js`  
**Gallery order:** `FEATURED_TEMPLATE_IDS` in `index.html` (must match)

| ID | Style |
|----|--------|
| `ats` | Free · minimal ATS |
| `premium-moderne` | Corporate moderne (bleu) |
| `premium-classique` | Minimaliste (beige/gris) |
| `premium-creatif` | Créatif / graphique |
| `premium-luxe` | Luxe (sidebar, accent or) |
| `executive` … `europeancorp` | Curated pro layouts |

`npm run qa:smoke` fails if registry count ≠ `production-template-ids.mjs` (fixes old “Expected 10 templates, got 12” drift).

Premium CSS: `cv-design-tokens.css`, `cv-templates-premium.css`.

---

## Locked product flow (HIRELY_FLOW_LOCK_V2)

Single canonical path after Block Builder + Section Classifier + Experience Builder V2:

```
Import
  → OCR / Text          src/core/extraction/
  → Clean               src/core/parsing/clean.js, ocr-postprocess.js
  → Build Blocks        src/core/parsing/block-builder-v1.js
  → Classify Blocks     src/core/parsing/section-classifier-v1.js
  → Build ResumeData    src/core/parsing/section-engine-v2.js
                        section-field-extract-v2.js + experience-builder-v2.js
                        → resume-data.js
  → Safety Gate         src/core/validation/universal-safety-gate.js
  → Studio              src/ui/studio/ (editor state = resumeData)
  → Style               src/ui/templates/cv-templates.js
  → Export              src/ui/export/hirely-pdf-export.js
```

**Contract** (`src/core/pipeline/hirely-flow-lock.js`):

| Rule | Enforcement |
|------|-------------|
| No raw text → template | `stripTemplateCvData`, `renderCV` omits `raw`/`cleanText` |
| No raw text → experience parser | `buildFlowLockedStructured` — Experience Builder V2 only |
| No debug in resumeData | `stripResumeDataForProduct`, `assertResumeDataFlowLock` |
| No duplicate engines | `structured-resume-from-blocks.js` early-returns on flow lock |

Orchestration: `runHirelyImportFromFile/Text` → `production-pipeline.js` → `buildStructuredResumeFromDocumentBlocks`.

Disable lock (tests/lab only): `globalThis.HIRELY_FLOW_LOCK = false`.

---

## Boundary rules

| Rule | Meaning |
|------|---------|
| OCR only in `src/core/extraction` | Vision API → cloud → Tesseract; PDF pages via pdf.js |
| Parser only in `src/core/parsing` | `rich-parser.js`, `clean.js`, `section-mapper.js`, `pipeline.js` |
| Validation only in `src/core/validation` | `score.js`, `audit.js` |
| Templates only in `src/ui/templates` | HTML/CSS; `cvData` in, no parsing |
| No parsing in UI | `applyCvPipeline` / `runExtractionPipeline` only |
| No OCR in templates | Text fields only (decorative bars/icons are non-essential) |

---

## 1. Import flow

```
User → index.html → HirelyLazy (PDF.js, Mammoth, Tesseract)
    → extractFromFileDetailed()  [src/core/extraction/]
    → applyCvPipeline()          [src/core/parsing/pipeline.js]
```

---

## 2. Extraction & OCR

```
PDF
  → text layer (pdf-text.js) if usable
  → else pdf-ocr: render pages (pdf-ocr-render.js) → ocr-pipeline.js
        1. POST /api/ocr (Google Vision) when deployed
        2. HIRELY_CLOUD_OCR_URL proxy (optional)
        3. Tesseract.js offline (ocr-tesseract.js + ocr-preprocess.js)
```

Modules: `extract-file.js`, `pdf-ocr-pages.js`, `ocr.js`, `cloud-ocr.js`.

---

## 3. Parsing flow

```
rawText
  → clean.js (headers/footers, special chars, section casing)
  → ocr-postprocess.js (when OCR-like)
  → line-cleaner.js
  → parseCV() / parseStructuredCV()  [rich-parser.js + section-mapper.js]
  → cvData JSON
```

Optional: `POST /api/structure-cv` when `HIRELY_USE_LLM_STRUCTURE=true`.

Public parser API: `src/core/parsing/cv-parser.js` re-exports rich-parser + clean + section-mapper.

---

## 4. Core load (browser) — no recursive stubs

`getHirelyCore()` imports **`./src/core/index.js`** only.

If import fails, `buildInlineCoreFallback()` sets `__hirelyFallback: true` and plain `emptyCVData()` — **no** `emptyCVData()` calling itself (fixed infinite recursion).

`emptyCVData()` in UI checks `__hirelyFallback` before delegating to core.

---

## 5. Review & export

- `scoreCV`, `auditPipeline` → `src/core/validation/`
- PDF: `html2pdf` on `#cvDoc` (`downloadPDF` in index.html), styles under `body.export-pdf`
- Premium PDF rules in `cv-templates-premium.css`

---

## Commands

```bash
npm run dev                 # http://127.0.0.1:3000
npm run qa:smoke            # 14 templates + index sync
npm run qa:extraction
npm run qa:core-flow
npm run qa:ocr-pipeline
npm run qa:premium-pdf
npm run test:extract        # tests/fixtures
```

Legacy: `node scripts/qa-smoke.mjs` delegates to `src/tests/qa-smoke.mjs`.

---

## API surface (unchanged)

| Entry | Role |
|-------|------|
| `window.HirelyTemplates` | `render`, `resolve`, `list`, `PRODUCTION_TEMPLATE_IDS` |
| `window.HirelyParse` / pipeline | `applyCvPipeline`, `extractFromFile` |
| `api/analyze.js` | Still uses `lib/cv-parser.js` (not moved to avoid breaking deploy) |
| `api/ocr.js`, `api/structure-cv.js` | Server OCR / LLM structure |

---

## Related docs

- `CANONICAL_SOURCE.md` — entrypoints and import paths
- `IMPLEMENTATION.md` — OCR env vars and premium pack
- `docs/CLEANUP_REPORT.md` — historical inventory
- `archive/README.md` — do not import
