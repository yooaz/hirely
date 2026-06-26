# Hirely — canonical source

**Canonical active project:** `hirely_FINAL_CURSOR_STABLE_UI` (`/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI`).  
**Reference only:** `HIRELY_V27_IMPORT_FIX (1)` — do not edit or merge from active work.

**Live app:** `index.html` + **`src/`** tree. Do not load `archive/` or legacy `public/lib/hirely-*.js`.

| Path | Role |
|------|------|
| `index.html` | UI shell, workspace, import/export |
| `src/core/index.js` | **Preferred** browser import (extraction + parsing + validation) |
| `src/core/extraction/` | PDF, OCR pipeline, `extract-file.js` |
| `src/core/parsing/` | `clean.js`, `rich-parser.js`, `cv-parser.js`, `pipeline.js` |
| `src/ui/templates/` | `cv-templates.js`, premium CSS, `production-template-ids.mjs` |
| `src/tests/` | **Canonical** QA (`npm run qa:*`) |
| `tests/` | Fixture extract + parser validation |
| `api/` | Vercel: `ocr.js`, `structure-cv.js`, `analyze.js` |

## Compatibility shims (do not extend)

| Path | Use instead |
|------|-------------|
| `core/*.js` | `src/core/...` |
| `cv-templates.js` (root) | `src/ui/templates/cv-templates.js` |
| `scripts/*.mjs` | `src/tests/*.mjs` or `npm run …` |
| `lib/cv-parser.js` | `src/core/parsing/` for new code; keep for `api/analyze.js` |

## Canonical import (single engine)

All UI import paths (file upload, paste, TXT, DOCX, PDF) use:

`importFile()` / `importText()` → `extractDocument()` → `buildBlocks()` → `classifyBlocks()` → `buildStructuredResume()` → `renderCV()`

Implementation: `src/core/pipeline/canonical-import.js` → `runProductionExtractionPipeline()` (never raw `parseCV`).

Legacy `parseCV()` is **disabled in the browser**; Node QA may set `globalThis.HIRELY_ALLOW_LEGACY_PARSE_CV = true`.

## Imports (harmonized)

```javascript
// Browser (index.html getHirelyCore)
import * as HirelyCore from './src/core/index.js';
// importFile, importText, runCanonicalImport

// Node tests
import { loadHirelyParse } from './src/tests/load-hirely-parse.mjs';
import { parseCV } from './src/core/parsing/cv-parser.js';
import { PRODUCTION_TEMPLATE_IDS } from './src/ui/templates/production-template-ids.mjs';
```

## Template count

14 production templates — registry in `production-template-ids.mjs`.  
`npm run qa:smoke` compares `cv-templates.js` ↔ registry ↔ `index.html` `FEATURED_TEMPLATE_IDS`.

## Dev server

```bash
npm run dev
```

Open **http://127.0.0.1:3000/** — debug: **?debug=true** — Pro on localhost: **?pro=true**
