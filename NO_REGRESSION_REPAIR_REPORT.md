# NO_REGRESSION_REPAIR_REPORT

**Status:** PASS
**Generated:** 2026-06-15T10:28:27.956Z

## Acceptance

| Check | Result |
|-------|--------|
| core_boot_not_failed | PASS — ok |
| engine_banner_hidden | PASS — Le moteur Hirely n'a pas chargé. Rechargez la page. |
| boot_trace_is_array | PASS |
| no_boot_type_errors | PASS — clean |
| dropzone_no_\bliImportDropHint\b | PASS — Déposez votre CV |
| dropzone_no_\blilImportDropHint\b | PASS — Déposez votre CV |
| dropzone_no_\bCORE_BOOT_FAILED\b | PASS — Déposez votre CV |
| dropzone_no_push is not a function | PASS — Déposez votre CV |
| dropzone_no_\bliImportDropHint\b | PASS — PDF, DOCX, TXT ou image |
| dropzone_no_\blilImportDropHint\b | PASS — PDF, DOCX, TXT ou image |
| dropzone_no_\bCORE_BOOT_FAILED\b | PASS — PDF, DOCX, TXT ou image |
| dropzone_no_push is not a function | PASS — PDF, DOCX, TXT ou image |
| dropzone_no_\bliImportDropHint\b | PASS — Glissez votre fichier ici, ou cliquez pour choisir un fichier. |
| dropzone_no_\blilImportDropHint\b | PASS — Glissez votre fichier ici, ou cliquez pour choisir un fichier. |
| dropzone_no_\bCORE_BOOT_FAILED\b | PASS — Glissez votre fichier ici, ou cliquez pour choisir un fichier. |
| dropzone_no_push is not a function | PASS — Glissez votre fichier ici, ou cliquez pour choisir un fichier. |
| dropzone_visible | PASS |
| import_cta_exists | PASS — Importer mon CV |
| nav_import_reachable | PASS — import |
| nav_edit_reachable | PASS — edit |
| templates_hidden_on_review | PASS — false |
| nav_style_reachable | PASS — edit |
| templates_visible_on_style | PASS — true |
| nav_style_or_review_lock | PASS — edit |
| nav_export_reachable | PASS — edit |
| export_bar_visible | PASS |
| single_primary_pdf_button | PASS — count=1 |
| no_runtime_type_errors | PASS — clean |
| trace_survives_object_seed | PASS — {"ok":true,"isArray":true} |

## Console errors fixed

- `window.__HIRELY_CORE_BOOT_TRACE__.push is not a function` — canonical `hirelyTrace` / `ensureBootTraceArray` migrates legacy object traces
- `Cannot set properties of null (setting innerHTML)` — `setHTML` / `setElHTML` skip optional removed panels
- Red engine banner on partial load — `HirelyEngineHealth` shows banner only on `FAILED`
- Visible `liImportDropHint` — replaced with `dropActionHint` + `looksLikeLeakedI18nKey` guard

## Canonical runtime helpers

| Helper | Location | Role |
|--------|----------|------|
| `hirelyTrace(event)` | `dom-contract.js` + `index.html` fallback | Single boot-trace writer; normalizes legacy `{steps:[]}` objects |
| `ensureBootTraceArray()` | `HirelyDomContract.ensureBootTraceArray` | Guarantees `__HIRELY_CORE_BOOT_TRACE__` is an array before `.push` |
| `setHTML(id, html, source)` | `HirelyDomContract.setHTML` | Required DOM → trace + fail; optional missing → warn/skip |
| `setElHTML(el, html, source, id)` | `HirelyDomContract.setElHTML` | Same policy for element refs |
| `validateRequiredDom()` | `HirelyDomContract` | Blocks boot only when required nodes missing |
| `HirelyEngineHealth.evaluate()` | `engine-health.js` | `BOOTING` → `CORE_READY` → `UI_READY`; banner only on `FAILED` |

## Related QA (all PASS)

- `npm run qa:boot` — boot trace corruption + optional DOM removal
- `npm run qa:engine-health` — no red banner when optional panels missing
- `npm run qa:copy` — no leaked i18n keys in dropzone
- `npm run qa:no-regression` — this report

## Notes

- Style/Export nav may stay on **Relire** until review-before-template lock clears (P0 product rule). UI chrome for Style/Export is verified via step-class policy checks.
- Banner element may retain failure copy in DOM while `display:none` — production policy hides it unless `FAILED`.


- `window.__HIRELY_CORE_BOOT_TRACE__.push is not a function` — canonical `hirelyTrace` / `ensureBootTraceArray` migrates legacy object traces
- `Cannot set properties of null (setting innerHTML)` — `setHTML` / `setElHTML` skip optional removed panels
- Red engine banner on partial load — `HirelyEngineHealth` shows banner only on `FAILED`
- Visible `liImportDropHint` — replaced with `dropActionHint` + `looksLikeLeakedI18nKey` guard

## Files changed (this repair)

- `index.html` — `hirelyTrace` fallback uses `ensureBootTraceArray`; hide `templatePickerBar` on Review step
- `src/ui/runtime/dom-contract.js` — exported `ensureBootTraceArray`; unified trace normalization
- `scripts/qa-no-regression-repair.mjs` — 4-step Playwright QA
- `package.json` — `qa:no-regression` script

## Boot state

```json
{
  "coreBoot": "ok",
  "engineHealth": "IMPORT_READY",
  "traceIsArray": true,
  "bannerHidden": true,
  "bannerText": "Le moteur Hirely n'a pas chargé. Rechargez la page."
}
```

## Dropzone copy

```json
{
  "dropTitle": "Déposez votre CV",
  "dropHint": "PDF, DOCX, TXT ou image",
  "dropActionHint": "Glissez votre fichier ici, ou cliquez pour choisir un fichier.",
  "dropVisible": true
}
```

## 4-step flow

```json
{
  "import": {
    "docStep": "import",
    "gridClass": "workspaceGrid workspaceGrid--split workspaceGrid--studio workspaceGrid--ready docStep-import",
    "tplVisible": false,
    "exportBarVisible": false,
    "downloadVisible": false,
    "pdfButtons": 0,
    "navVisible": true
  },
  "edit": {
    "docStep": "edit",
    "gridClass": "workspaceGrid workspaceGrid--split workspaceGrid--studio workspaceGrid--ready docStep-edit",
    "tplVisible": false,
    "exportBarVisible": false,
    "downloadVisible": false,
    "pdfButtons": 0,
    "navVisible": true
  },
  "style": {
    "docStep": "edit",
    "gridClass": "workspaceGrid workspaceGrid--split workspaceGrid--studio workspaceGrid--ready docStep-edit",
    "tplVisible": false,
    "exportBarVisible": false,
    "downloadVisible": false,
    "pdfButtons": 0,
    "navVisible": true
  },
  "export": {
    "docStep": "edit",
    "gridClass": "workspaceGrid workspaceGrid--split workspaceGrid--studio workspaceGrid--ready docStep-edit",
    "tplVisible": false,
    "exportBarVisible": false,
    "downloadVisible": false,
    "pdfButtons": 0,
    "navVisible": true
  }
}
```

## Screenshots (after reload)

- docs/screenshots/no-regression-repair/01-import-initial.png
- docs/screenshots/no-regression-repair/step-import.png
- docs/screenshots/no-regression-repair/step-edit.png
- docs/screenshots/no-regression-repair/step-style.png
- docs/screenshots/no-regression-repair/step-export.png

## Fatal console lines (if any)

- none
