# CORE_IMPORT_AUDIT

Audit date: 2026-06-05  
Scope: `FACT_TYPE_TO_CV_FIELD` export failure causing degraded core load.

## Broken import

| Consumer | Import statement | Expected source |
|----------|------------------|-----------------|
| `src/core/parsing/index.js` | `export { FACT_TYPE_TO_CV_FIELD, ... } from './review-queue.js'` | `review-queue.js` |
| Browser via `src/core/index.js` → `parsing/index.js` | static re-export chain | `review-queue.js` |

**Console error:**
```
The requested module './review-queue.js' does not provide an export named 'FACT_TYPE_TO_CV_FIELD'
Hirely: src/core failed to load — degraded import only (no block pipeline)
```

## Root cause

1. **Circular module graph** — `review-queue.js` imports `cv-section-contract.js` (and other parsing modules). `parsing/index.js` re-exported `FACT_TYPE_TO_CV_FIELD` from `review-queue.js` in the same barrel as other review-queue symbols. During browser module init, `review-queue.js` was not fully evaluated when the barrel requested the named export.

2. **Wrong canonical location** — `FACT_TYPE_TO_CV_FIELD` was defined inline on `review-queue.js`, a module with heavy downstream imports. A constant map belongs on an acyclic leaf module.

3. **Silent degraded fallback** — `index.html` caught core import failure and substituted `buildInlineCoreFallback()`, masking the error and running a stub parser (no ATS, no cover letter, no reconstruction, incomplete review queue).

## Fix applied

| File | Change |
|------|--------|
| `src/core/parsing/fact-types.js` | **Canonical** `export const FACT_TYPE_TO_CV_FIELD` (acyclic; only imports `classification-engine-v2.js`) |
| `src/core/parsing/review-queue.js` | `import` only (no re-export — avoids barrel circular init) |
| `src/core/parsing/index.js` | Export `FACT_TYPE_TO_CV_FIELD` from `./fact-types.js` only |
| `src/core/parsing/fact-types.js` | Zero-import acyclic leaf (no `classification-engine-v2` dependency) |
| `index.html` | Removed `buildInlineCoreFallback()`; core load throws on failure; `CORE_BOOT_OK` / `CORE_BOOT_FAILED`; import UI blocked when boot fails |
| `src/tests/qa-core-import.mjs` | Verifies fact-types + review-queue re-export + core barrel |

## Import map (post-fix)

| Symbol | Canonical export | Re-exported by |
|--------|------------------|----------------|
| `FACT_TYPE_TO_CV_FIELD` | `fact-types.js` | `parsing/index.js`, `core/index.js` (via `export *`) |

**Direct importers of `FACT_TYPE_TO_CV_FIELD`:** none in runtime pipeline (barrel only).  
**Direct importers of `review-queue.js`:** validation-stage, conflict-resolver-stage, confidence-scoring, structured-resume-from-blocks, block-classifier (re-export), p0-pipeline, production-pipeline — none import `FACT_TYPE_TO_CV_FIELD`.

## Verification

### Node
```bash
npm run qa:core-import
```
Expected tail:
```
CORE_BOOT_OK
qa-core-import: all passed
```

### Browser
1. Reload app (`npm run dev`)
2. Console must show: `CORE_BOOT_OK`
3. Console must NOT show:
   - `does not provide an export named 'FACT_TYPE_TO_CV_FIELD'`
   - `degraded import only`
   - `CORE_BOOT_FAILED`
4. `window.__HIRELY_CORE_BOOT__ === 'ok'`
5. `window.__HIRELY_CORE_STATUS__.loaded === true`
6. Import CV → real pipeline runs (ATS, review queue, reconstruction)

### On failure
- Red banner: *Le moteur Hirely n'a pas chargé. Rechargez la page.*
- Import controls disabled (no silent stub pipeline)
- Console: `CORE_BOOT_FAILED`
