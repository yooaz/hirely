# Import Boot Independence Report

**Status:** PASS
**Date:** 2026-06-11

## Goal

Import UI must work even if templates, photo editor, section reorder, or Pro features fail. Upload binding initializes first.

## Required boot order

1. `UPLOAD_BIND_OK`
2. `IMPORT_UI_READY`
3. `CORE_BOOT_OK`
4. `TEMPLATE_REGISTRY_READY`

## Normal boot

| Check | Result |
|-------|--------|
| Boot order valid | yes |
| `__hirelyBootOrder` | `UPLOAD_BIND_OK → IMPORT_UI_READY → CORE_BOOT_OK → TEMPLATE_REGISTRY_READY` |
| Import handlers bound | yes |
| “Déposez votre CV” opens picker | yes |
| CORE_BOOT | ok |
| ReferenceError | no |

## Template boot failure simulation

| Check | Result |
|-------|--------|
| Import handlers bound | yes |
| “Déposez votre CV” opens picker | yes |
| Template stub/registry | present |

## Changes

- `ensureImportTemplateStub()` — minimal registry before full template boot
- `bindVerifiedImportHandlers()` runs immediately after definition (not after templates)
- `bootTemplateRegistryDeferred()` runs after `CORE_BOOT_OK`
- Pro/photo init wrapped in try/catch inside deferred template boot
- Post-core `renderAll` / `updatePhotoPreview` wrapped in try/catch

## Run

```bash
npm run import-boot-independence-report
```
