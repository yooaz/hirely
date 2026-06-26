# HIRELY UX — Import Progress Experience

**Result:** PASS
**Generated:** 2026-06-10T02:23:13.031Z

## Goal

During CV import, the user always sees four clear stages with label, short explanation, progress bar, and estimated wait — never technical error text.

## Four stages (French product copy)

| # | Stage | Label | Explanation |
|---|-------|-------|-------------|
| 1 | `file` | Lecture du document | Nous ouvrons votre PDF, Word ou fichier texte. |
| 2 | `extract` | Extraction du contenu | Nous récupérons le contenu de votre CV. |
| 3 | `sections` | Organisation des sections | Expérience, formation, compétences et coordonnées. |
| 4 | `prepare` | Préparation de votre CV | Nous structurons votre profil pour l'aperçu. |

## UX elements

- **Progress bar** — visible while `#wsImport` has `wsImport--loading`
- **Stage stepper** — `#importAnalysisStages` (4 items via `import-analysis-stages.js`)
- **Active stage label** — `#importLiveStatus` / `#cvLoadingLabel`
- **Short explanation** — `#importLoadingDetail` (active stage detail)
- **Estimated wait** — `#importLoadingWait`: *Cela peut prendre quelques secondes selon le fichier.*
- **After 8s** — `#importLoadingPasteHint`: *Vous pouvez aussi coller le texte du CV.*
- **On timeout / incomplete read** — paste fallback panel: *Lecture automatique incomplète. Collez le texte pour continuer.*

## Timers

| Timer | Value | Behavior |
|-------|-------|----------|
| `IMPORT_LOADING_PASTE_MS` | 8s | Show paste hint during loading |
| OCR full fallback | 20s | Show paste fallback panel (OCR logic unchanged) |

## Error handling (UI only)

- `userFacingImportError()` maps technical codes (`PDF_EXTRACTION_TIMEOUT`, `OCR_TIMEOUT`, stack errors, etc.) to the friendly timeout message.
- `show(t('importPipelineFail')…)` removed from import failure paths — users see paste fallback instead.

## Scope

- **Changed:** `index.html` (import loading orchestration + copy), `src/ui/product/import-analysis-stages.js`, `src/ui/product/import-analysis-stages.css`
- **Not changed:** OCR pipeline, parser, templates, scoring, pricing

## QA checks

| Check | Status |
|-------|--------|
| Lecture du document | PASS |
| Extraction du contenu | PASS |
| Organisation des sections | PASS |
| Préparation de votre CV | PASS |

## Gate

| Command | Status |
|---------|--------|
| `npm run test:import-progress-ux` | PASS |

```bash
npm run test:import-progress-ux
```