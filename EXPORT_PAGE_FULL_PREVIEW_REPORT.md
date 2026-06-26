# HIRELY P0 — Export Page Full Preview

**Result:** FAIL
**Generated:** 2026-06-25T20:02:22.085Z

## Problem

The export step could look empty — users landed on export without seeing the final CV.

## Requirement

Export screen must always show:

| Element | Implementation |
|---------|----------------|
| Selected template name | `#exportStepTemplateName` in `#exportStepHead` |
| Full A4 preview | `#studioPreview` visible on export · `ensureExportPreviewRendered()` |
| Zoom fit | `#a4ZoomBar` · default `fit` on export entry |
| Télécharger PDF | `#downloadBtn` in `#cvExportBar` |
| Retour aux modèles | `#exportBackToTemplatesBtn` + header back button |

No blank export screen.

## QA snapshot

| Check | Value |
|-------|-------|
| Preview visible | yes |
| Template label | ATS Clean |
| CV live | yes (459 chars) |
| Preview name | Yohann Azancot |
| A4 stage height | 1484px |
| Zoom bar | visible |
| Zoom fit | active |
| PDF button | Télécharger PDF |
| Back button | Retour aux modèles |

## Screenshot

![Export page](tests/output/export-page-full-preview/export-page.png)

## Acceptance

**FAIL** — See QA output below.

## Run

```bash
npm run test:export-page-full-preview
```

## QA output

```
node:internal/modules/package_json_reader:256
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
        ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'playwright' imported from /mnt/data/hirely_work/hirely_FINAL_CURSOR_STABLE_UI/src/tests/qa-export-page-full-preview.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:256:9)
    at packageResolve (node:internal/modules/esm/resolve:768:81)
    at moduleResolve (node:internal/modules/esm/resolve:854:18)
    at defaultResolve (node:internal/modules/esm/resolve:984:11)
    at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:780:12)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:704:25)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:687:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:305:38)
    at ModuleJob._link (node:internal/modules/esm/module_job:137:49) {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v22.16.0
```
