# CORE_BOOT_EXPORT_FIX_REPORT

Generated: 2026-06-08T12:02:49.559Z
Verdict: **PASS**

## P0 — Fix missing export core boot

Fatal error addressed: `resumeDataMeetsImportMinimum` missing from `hirely-flow-lock.js` export surface.

### Export
- `src/core/pipeline/hirely-flow-lock.js` — `export function resumeDataMeetsImportMinimum(resumeData)`
- Re-exported via `src/core/pipeline/index.js` and `src/core/index.js`

### Import minimum logic
- `identity.email`
- `identity.phone`
- `identity.name` (non-placeholder)
- `experiences`, `education`, `skills`, or `clients` with at least one item

### Boot guards
- `reportHirelyCoreStatus()` now requires `canonicalImportFromFile` and `resumeDataMeetsImportMinimum`
- `scripts/test-core-boot.mjs` imports `src/core/index.js` and asserts required exports

## Acceptance markers

- ✓ `CORE_BOOT_OK`
- ✓ `UPLOAD_BIND_OK`
- ✓ `IMPORT_UI_READY`

## Forbidden

- ✓ No `CORE_BOOT_FAILED`
- ✓ No `missing export`
- ✓ No `ReferenceError`
- ✓ No `SyntaxError`

## Run

```bash
npm run test:core-boot
npm run check:core-exports
npm run core-boot-export-fix-report
```