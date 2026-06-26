# BOOT Fix Report

**Status:** PASS  
**Date:** 2026-06-15  
**Engine:** `HIRELY_BOOT_FIX_V1`

## Summary

Fixed two P0 boot failures that blocked the product shell:

1. **`window.__HIRELY_CORE_BOOT_TRACE__.push is not a function`** — trace was overwritten with a `{ steps: [] }` object after boot diagnostics, then `.push` was called on the next boot attempt.
2. **`Cannot set properties of null (setting 'innerHTML')`** — `renderOutputs()` wrote to `#auditPanelInner`, which was removed during P0 UI subtraction.

## Root causes

| # | Cause | Fix |
|---|--------|-----|
| 1 | `diag.trace` (object) assigned directly to `window.__HIRELY_CORE_BOOT_TRACE__` | `storeBootDiagTrace()` merges steps into a guaranteed array via `safeBootTrace()` |
| 2 | `getHirelyCore()` used `\|\| []` which kept a truthy non-array trace | `ensureBootTraceArray()` reinitializes or migrates legacy object → array |
| 3 | `onStep` called `.push` directly on global trace | All boot logs go through `safeBootTrace(step)` |
| 4 | `renderOutputs()` required removed debug panels | `setHTML()` skips missing optional nodes and logs `MISSING_DOM_TARGET` |
| 5 | `renderAll()` crashed when optional panels absent | Defensive helpers + existing per-function try/catch retained |

## Helpers added (`index.html`)

```javascript
ensureBootTraceArray()   // always returns Array; preserves legacy object as __HIRELY_CORE_BOOT_TRACE_LEGACY__
safeBootTrace(event)     // sole entry point for boot trace writes
storeBootDiagTrace(diag) // merges loader trace object without clobbering array
setHTML(id, html)        // null-safe innerHTML by id
setElHTML(el, html)      // null-safe innerHTML on element ref
validateRequiredDom()    // checks #app, #wsImport, #cvDoc, #docNav
```

## Required DOM nodes (must exist)

| ID | Role | Present |
|----|------|---------|
| `app` | Main root | ✅ |
| `wsImport` | Import area | ✅ |
| `cvDoc` | CV preview | ✅ |
| `docNav` | Review / Style / Export nav | ✅ |

## Missing optional DOM targets found

These IDs are referenced at runtime but **not in current HTML** (removed during P0 subtraction). They are now skipped safely:

| ID | Source function | Impact |
|----|-----------------|--------|
| `auditPanelInner` | `renderOutputs` | Dev-mode audit panel only — skipped, boot continues |
| `linkedinText` | `renderOutputs` | LinkedIn export tab removed — `.value` guarded |
| `letterText` | `renderOutputs` | Cover letter tab removed — `.value` guarded |

Full runtime list after boot: `window.__HIRELY_MISSING_DOM__`

## Unsafe `innerHTML` replacements

| Location | Before | After |
|----------|--------|-------|
| `getHirelyCore` → `onStep` | `window.__HIRELY_CORE_BOOT_TRACE__.push(step)` | `safeBootTrace(step)` |
| `showHirelyCoreLoadError` | `window.__HIRELY_CORE_BOOT_TRACE__ = diag.trace` | `storeBootDiagTrace(diag?.trace)` |
| `reportHirelyCoreStatus` | `window.__HIRELY_CORE_BOOT_TRACE__ = diag.trace` | `storeBootDiagTrace(diag?.trace)` |
| `renderOutputs` (×3) | `$('auditPanelInner').innerHTML = …` | `setHTML('auditPanelInner', …)` |
| `updateDetected` | `$('structRows').innerHTML = …` | `setHTML('structRows', …)` |
| `renderCVInner` (×4) | `$('cvDoc').innerHTML = …` | `setElHTML(cvDocEl, …)` + early guard |
| `setStatusIcon` | `el.innerHTML = …` without null check | guard `if (!el) return` |

## Console — before fix

```
Le moteur Hirely n'a pas chargé
TypeError: window.__HIRELY_CORE_BOOT_TRACE__.push is not a function
    at onStep (index.html)
TypeError: Cannot set properties of null (setting 'innerHTML')
    at renderOutputs (index.html)
    at renderAll (index.html)
CORE_BOOT_FAILED …
```

## Console — after fix

```
BOOT_START
UPLOAD_BIND_OK
[CORE_BOOT] BOOT_START ok
[CORE_BOOT] CORE_BOOT src/core/index.js loaded
CORE_BOOT_OK
TEMPLATE_REGISTRY_READY
UI_READY
```

- No `CORE_BOOT_FAILED`
- No `TypeError`
- No `push is not a function`
- No `innerHTML` on null
- `Array.isArray(window.__HIRELY_CORE_BOOT_TRACE__)` → `true`

## QA

| Check | Command / method | Result |
|-------|------------------|--------|
| Build | `npm run build` | PASS |
| Browser boot | `node scripts/test-browser-boot-upload.mjs` | PASS (CORE_BOOT_OK, UPLOAD_BIND_OK) |
| Boot fix QA | `node scripts/test-boot-fix.mjs` | PASS |
| Trace array | Playwright evaluate | PASS (9 steps) |
| Required DOM | Playwright evaluate | PASS (4/4) |
| Import zone | Playwright click `[data-upload-zone]` | PASS |
| Dev server | `npm run dev` → http://localhost:3001 | Manual verify OK |

## Files changed

- `index.html` — boot trace helpers, DOM guards, `renderOutputs`, `renderCVInner`, `updateDetected`, `setStatusIcon`, `show`
- `scripts/test-boot-fix.mjs` — regression script (new)

## Verify locally

```bash
npm run build
npm run dev
# open http://localhost:3001 — console should show CORE_BOOT_OK, no red errors
node scripts/test-boot-fix.mjs
node scripts/test-browser-boot-upload.mjs
```
