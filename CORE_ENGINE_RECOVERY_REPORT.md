# CORE_ENGINE_RECOVERY_REPORT

Generated: 2026-06-12T19:53:35.062Z

## P0 status

| Check | Result |
|-------|--------|
| Full barrel `src/core/index.js` | loaded |
| Boot loader wired in `index.html` | yes |
| Tiered assessment (not all-or-nothing) | yes |
| Minimal import fallback | `src/core/boot/minimal-import-core.mjs` |
| Per-feature unavailable messages | `Feature unavailable: … failed` |

## Startup audit

- **BOOT_START**: ok
- **CORE_BOOT**: ok
- **TEMPLATE_REGISTRY_READY**: ok
- **IMPORT_UI_READY**: ok

## Missing exports (optional features)

- **import_core** (`src/core/pipeline/hirely-import.js`): resumeDataMeetsImportMinimum
- **fact_extraction** (`src/core/parsing/fact-pipeline.js`): extractFactsFromSectionBlocks
- **identity_extraction** (`src/core/parsing/identity-extraction.js`): extractIdentityFromText, resolveIdentityContact
- **ocr_pipeline** (`src/core/extraction/ocr-pipeline.js`): runOcrPipeline, extractWithOcr

## Emergency fallback behavior

```
Full index.js fails
  → load minimal-import-core (hirely-import + canonical-import + resume-data)
  → import_core OK → CORE_BOOT_OK (degraded)
  → optional features show amber banner, not red fatal banner
```

## Required exports (`import_core`)

- `runHirelyImportFromText`
- `resumeDataMeetsImportMinimum`

## Optional exports (disable feature only)

- File import: canonicalImportFromFile
- Review queue: buildReviewQueue
- Fact extraction: extractFactsFromSectionBlocks | runFactPipeline
- Section engine: runSectionEngineV2
- Resume graph: runResumeGraphEngine
- Identity extraction: extractIdentityFromText | resolveIdentityContact
- OCR pipeline: runOcrPipeline | extractWithOcr

## Recommendations

- Use core-boot-loader.mjs in browser (tiered assessment, minimal fallback).
- Block import UI only when import_core missing; show per-feature warnings otherwise.
- Never show core_modules_incomplete when paste import is available.
- Persist __HIRELY_CORE_BOOT_TRACE__ in bug reports.

## Verification commands

```bash
npm run test:core-boot
npm run test:browser-boot-upload
node scripts/audit-core-engine-boot.mjs
node scripts/check-core-exports.mjs
```

## Related artifacts

- `STARTUP_DEPENDENCY_MAP.md`
- `BOOT_FAILURE_ROOT_CAUSE.md`
- `.cache/core-engine-boot-audit.json`
