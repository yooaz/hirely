# HIRELY P2 — Premium Import Experience

**Result:** PASS
**Generated:** 2026-06-10T02:31:56.261Z

## Problem

The import flow felt technical — opaque loading, pipeline jargon, and errors that did not help users continue.

## Solution

A four-step premium import experience with human copy, a visible progress bar, and stage detail that follows real pipeline events.

### Four steps

| # | Stage | English | Français |
|---|-------|---------|----------|
| 1 | `file` | Reading document | Lecture du document |
| 2 | `extract` | Extracting content | Extraction du contenu |
| 3 | `sections` | Organizing sections | Organisation des sections |
| 4 | `prepare` | Preparing your CV | Préparation de votre CV |

### What users see

- **Step label** — active stage name in `#importLiveStatus` / `#cvLoadingLabel`
- **Real message** — short explanation in `#importLoadingDetail`
- **Progress bar** — tied to stage (`12% → 35% → 62% → 92%`)
- **Estimated wait** — `#importLoadingWait`
- **After 8s** — paste hint: *Vous pouvez aussi coller le texte du CV.*
- **On timeout** — paste fallback: *Lecture automatique incomplète. Collez le texte pour continuer.*

### Real progress (not fake spinners)

Pipeline log steps advance the UI when loading is active:

| Event | Stage |
|-------|-------|
| `IMPORT_STARTED`, `FILE_SELECTED` | Reading document |
| `EXTRACTION_STARTED`, `PDF_NATIVE_FIRST` | Extracting content |
| `EXTRACTION_DONE`, `PARSER_STARTED`, `IMPORT_PARSING` | Organizing sections |
| `PARSER_DONE`, `RENDER_STARTED`, `FINAL_RESUME_READY` | Preparing your CV |

Timer-based fallbacks still run if OCR is slow, but **forward-only** progress prevents stages from jumping backward.

### Never loading forever

| Guard | Value | Behavior |
|-------|-------|----------|
| `importRaceTimeout` | 20s (text/docx), 180s (PDF/OCR) | Always resolves to paste fallback or review |
| `IMPORT_LOADING_PASTE_MS` | 8s | Paste hint during loading |
| `OCR_UX_FULL_FALLBACK_MS` | 20s | Full paste panel for slow OCR |

### Never technical errors

- `userFacingImportError()` maps `PDF_EXTRACTION_TIMEOUT`, `OCR_TIMEOUT`, `IMPORT_STUCK`, stack traces → friendly paste message
- `importPipelineFail` toast removed from consumer import paths
- Users always get a next action (paste text), not error codes

## Implementation

| Piece | Location |
|-------|----------|
| Stage stepper | `src/ui/product/import-analysis-stages.js` |
| Stage styles | `src/ui/product/import-analysis-stages.css` |
| Loading orchestration | `index.html` — `startImportLoadingUx`, `setImportLoadingUx`, `IMPORT_LOG_TO_UX` |
| Pipeline phase hook | `index.html` — `setImportPhaseUi`, `IMPORT_PHASE_TO_UX` |

## QA

```
OK EN stage file: Reading document
OK EN stage extract: Extracting content
OK EN stage sections: Organizing sections
OK EN stage prepare: Preparing your CV
OK FR stage file: Lecture du document
OK FR stage extract: Extraction du contenu
OK FR stage sections: Organisation des sections
OK FR stage prepare: Préparation de votre CV
OK exactly 4 stages
OK pipeline steps drive loading UX
OK forward-only progress order
OK parsing phase maps to organizing sections
OK import cannot spin forever
OK 8s paste hint
OK 20s OCR paste fallback
OK technical errors sanitized
OK friendly timeout message
OK no technical importPipelineFail toast
OK 4-stage stepper host
OK active stage detail line
OK loading UX orchestrator
OK progress bar visible while loading

PASS premium-import-experience
```

```bash
npm run test:premium-import-experience
```

