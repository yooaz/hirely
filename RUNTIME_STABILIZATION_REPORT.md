# Runtime Stabilization Report

**Status:** PASS  
**Date:** 2026-06-15  
**Engine:** `HIRELY_RUNTIME_STABILIZATION_V1`

## Mission

Make the JavaScript runtime compatible with the simplified post-P0 UI without restoring deleted panels or re-adding obsolete DOM.

## Architecture changes

| Area | Change |
|------|--------|
| DOM contract | `src/ui/runtime/dom-contract.js` — required vs optional IDs, `setHTML`, `hirelyTrace` |
| Boot trace | `hirelyTrace()` replaces all direct `.push`; legacy trace preserved on corruption |
| `renderOutputs` | Returns `{ rendered, skipped, missingRequired }`; optional panels skipped |
| `renderAll` | Phase-safe wrapper; warnings only; never aborts boot |
| Debug overlay | `#hirelyBootHealth` shown only when `debug=true` |
| Core error banner | Shown only on true `getHirelyCore()` failure (not render/DOM skips) |

## Stale JS dependencies removed or guarded

| Reference | Action |
|-----------|--------|
| `auditPanelInner` innerHTML | → `trackRenderHtml` / `setHTML` (optional skip) |
| `linkedinText` / `letterText` | Guarded before `.value` |
| `exportFinalPanel` | Already optional-chained in flow snapshot |
| `extractionAlert` | No-op (`setExtractionAlert`) |
| `extractionGate` DOM | State-only; no `getElementById` dependency |
| `hirelyDebugPanel` | Guarded; debug init only |
| `hirelyForensicPanel` | Guarded; forensic mode only |
| `hirelyTestClickBtn` / `hirelyTestImport` | CSS hidden prod; no required boot path |
| `coverLetterWorkspace` | Optional in `renderOutputs` |
| `recruiterReviewPanel` / `studioScorePanel` | Existing null guards retained |
| `wsInsights` | `setWorkspaceReady` null-safe |

## Required vs optional DOM (summary)

See [DOM_CONTRACT.md](./DOM_CONTRACT.md) for full tables.

- **Required (14):** `app`, `workspace`, `workspaceGrid`, `wsImport`, `drop`, `fileInput`, `docNav`, `wsProduct`, `cvPanel`, `cvDoc`, `importPasteFallback`, `statusText`, `progress`, `progressBar`
- **Optional (22):** audit/letter/linkedin panels, debug/forensic panels, legacy export/gate/test nodes, duplicate recruiter UI, etc.

## Console — before stabilization

```
CORE_BOOT_FAILED …
TypeError: window.__HIRELY_CORE_BOOT_TRACE__.push is not a function
TypeError: Cannot set properties of null (setting 'innerHTML')
    at renderOutputs → renderAll
Le moteur Hirely n'a pas chargé
```

## Console — after stabilization

```
BOOT_START
UPLOAD_BIND_OK
[CORE_BOOT] BOOT_START ok
[CORE_BOOT] CORE_BOOT src/core/index.js loaded
CORE_BOOT_OK
TEMPLATE_REGISTRY_READY
UI_READY
```

- `hirelyTrace` keeps trace as array even when seeded with `{}` or string
- `renderOutputs` skips `auditPanelInner` with `MISSING_DOM_TARGET` (warning)
- `renderAll` completes all phases; `outputs.skipped` includes removed panels
- No red `#hirelyCoreLoadError` when core loads OK

## Debug boot health (`?debug=1`)

Bottom-left overlay shows: core boot state, trace length, required DOM gaps, optional skips, `renderAll` phase results.

## Files changed

- `src/ui/runtime/dom-contract.js` (new)
- `index.html` — contract wiring, `hirelyTrace`, `renderOutputs`, `renderAll`, boot health CSS/overlay
- `scripts/qa-boot-regression.mjs` — status object assertions
- `package.json` — `qa:boot` runs regression + upload boot test
- `DOM_CONTRACT.md` (new)

## QA

```bash
npm run build
npm run qa:boot
```

Manual checklist:

- [ ] Fresh reload / hard refresh — no TypeError
- [ ] Import click + file drop + paste fallback
- [ ] Review → Style → Export nav steps
- [ ] No `CORE_BOOT_FAILED` when core loads
- [ ] `?debug=1` shows boot health overlay, not red engine banner
