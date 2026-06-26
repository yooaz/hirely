# IMPORT_STABILITY_LOCK — No Template Work Until Import Stable

## Policy

**Do not create new templates** until all import stability gates report **PASS**.

Templates are render-only skins. Shipping new template work while import/extraction is unstable hides data-loss and format failures behind visual polish.

## Required gates (all must be PASS)

| Report | QA |
|--------|-----|
| `FORMAT_SUPPORT_AUDIT_REPORT.md` | `npm run qa:format-support-audit` |
| `DOCX_FULL_EXTRACTION_REPORT.md` | `npm run qa:docx-full-extraction` |
| `TEXT_RECONSTRUCTION_ENGINE_REPORT.md` | `npm run qa:text-reconstruction-engine` |
| `REAL_FORMAT_QA_REPORT.md` | `npm run qa:real-format-qa` |

## Enforcement

| Layer | Mechanism |
|-------|-----------|
| Lock module | `src/core/import/import-stability-lock.js` |
| Template gate | `src/ui/templates/template-import-gate.mjs` |
| QA gate | `npm run qa:import-stability-lock` |
| Template QA | `qa-template-lock`, `qa-template-completeness-lock` call gate first |

When blocked, `assertImportStabilityForTemplateWork()` throws:

```
IMPORT_STABILITY_LOCK: template work blocked. Fix import gates first (…). Run: npm run qa:import-stability-lock
```

## Allowed while blocked

- Import / extraction / parsing fixes
- Fallback UX, format QA, reconstruction engine
- Bug fixes to existing templates (no new template IDs)

## Blocked while lock fails

- New template IDs in `production-template-ids.mjs`
- New template renderers / CSS packs
- Template gallery expansion
- Template completeness / P5 lock work on new skins

## Verify lock status

```bash
npm run qa:import-stability-lock
npm run import-stability-lock-report
```

Expected: `IMPORT_STABILITY_LOCK_OK`, `Template work: ALLOWED`.
