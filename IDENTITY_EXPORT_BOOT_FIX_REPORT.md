# IDENTITY_EXPORT_BOOT_FIX_REPORT

**Status:** PASS
**Fix:** `IDENTITY_EXPORT_BOOT_FIX_V1`
**Generated:** 2026-06-12T10:52:31.535Z

## Fatal error addressed

```
CORE_BOOT_FAILED
../parsing/identity-extraction.js does not provide an export named looksLikeCompanyOrAgencyName
```

## Root cause

- `looksLikeCompanyOrAgencyName` is defined in `src/core/parsing/identity-extraction.js` (line ~152)
- Validation modules import it directly; it was missing from the `parsing/index.js` barrel
- `identity-contact-strictness.js` imported `no-fake-data-policy.js`, creating a load-order chain that could surface as a missing export during browser boot

## Fixes applied

| Change | File |
|--------|------|
| Confirmed `export function looksLikeCompanyOrAgencyName` | `identity-extraction.js` |
| Added barrel re-exports (`looksLikeCompanyOrAgencyName`, `nameCollidesWithEmployers`, `COMPANY_LIKE_NAME_RE`) | `parsing/index.js` |
| Removed `no-fake-data-policy` import cycle from strictness layer | `identity-contact-strictness.js` |
| Merged duplicate identity-extraction imports | `sanitize-resume-display.js` |

## Verification

| Command | Result |
|---------|--------|
| `npm run check:exports` | PASS |
| `npm run check:core` | PASS |
| `npm run build` | PASS |
| `npm run qa:identity-export-boot` | PASS |

## Browser acceptance

| Marker | Required |
|--------|----------|
| `CORE_BOOT_OK` | yes |
| `UPLOAD_BIND_OK` | yes |
| `IMPORT_UI_READY` / import handlers bound | yes |
| `CORE_BOOT_FAILED` | forbidden |

## QA checklist

| Check | Status |
|-------|--------|
| direct_export_function | PASS |
| barrel_export_function | PASS |
| core_star_export_function | PASS |
| core_boot_import | PASS |
| reject_company | PASS |
| accept_person | PASS |
| strictness_module_loads | PASS |
| sanitize_module_loads | PASS |
| browser_core_boot_ok | PASS |
| browser_upload_bind_ok | PASS |
| browser_import_ui_ready | PASS |
| browser_no_core_boot_failed | PASS |

## Importers of `looksLikeCompanyOrAgencyName`

- `src/core/validation/sanitize-resume-display.js`
- `src/core/validation/identity-contact-strictness.js`
- `src/core/validation/no-fake-data-policy.js`
- `src/core/validation/confidence-gate.js`

## Run

```bash
npm run check:exports
npm run check:core
npm run build
npm run qa:identity-export-boot
npm run identity-export-boot-fix-report
```
