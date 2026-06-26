# Extraction Reliability Hotfix Report

**Date:** 2026-06-06  
**Version:** `EXTRACTION_RELIABILITY_V1`  
**QA command:** `npm run qa:extraction-reliability`

## Goal

Stop Hirely from showing fake import success or exporting empty/broken CVs. Terminal import states are now **only** `IMPORT_READY` or `IMPORT_NEEDS_PASTE` (no `IMPORT_STUCK` user state, no `IMPORT_PARTIAL` success path).

## Rules enforced

| Rule | Implementation |
|------|----------------|
| No fake success | Stale-run, timeout catch, and paste paths use `resolveHonestImportState()` — weak data → paste sheet |
| `REAL_CV_IMPORT_MIN_CHARS` (300) | Text under 300 chars → `IMPORT_NEEDS_PASTE` + single paste recovery sheet |
| Required content for ready | Name + contact (email **or** phone) + body (experience, education, clients, or projects) |
| Missing field detection | `assessResumeDataReliability()` reports `name`, `contact`, `experience_or_education`, warns on `skills` |
| Export blocked when incomplete | `validateExportLock` + `validateExtractionReliabilityForExport` + stricter quality validator |
| Pre-export checks | Name, contact, body section, non-empty preview, header visible / not clipped |

## Core changes

### New module: `src/core/validation/extraction-reliability.js`

- `assessResumeDataReliability()` — strict import minimum
- `resolveHonestImportState()` — maps pipeline output to `IMPORT_READY` \| `IMPORT_NEEDS_PASTE`
- `resumeDataMeetsImportMinimum()` — replaces loose “any one field” check
- `validateExtractionReliabilityForExport()` — structured + DOM export gate

### Pipeline

- **`canonical-import.js`** — honest terminal state after parse
- **`import-status.js`** — text &lt; 300 chars no longer returns `PARTIAL_TEXT_RECOVERED`
- **`hirely-import.js`** — re-run `repairResumeDataFromRaw` + `reconcileCreativeSections` after rebuild (fixes executive name loss)
- **`hirely-flow-lock.js`** — delegates minimum check to reliability module

### Export / quality

- **`export-lock.js`** — contact required, creative clients/projects count as body, header clip detection
- **`quality-validator.js`** — contact (email or phone), experience **or** education, skills as warning, header visibility check

### Parsing hygiene

- **`line-cleaner.js`** — languages stripped from skills partition
- **`skills-languages-guard.js`** — tools bucket scanned for language lines

### UI (`index.html`)

- `resolveHonestImportTerminalUi()` — single honest state resolver
- Stale OCR race / catch paths no longer upgrade weak imports to `IMPORT_READY`
- `resumeDataMeetsImportMinimumUi()` — strict (no review-guarantee bypass)
- `collectCvExportMetrics()` — `headerClipped` flag
- `finishImportUi()` — emits ready flow only on true `IMPORT_READY`

## QA results (7 fixtures)

| Fixture | Raw chars | Honest state | Import ready | Export gate |
|---------|-----------|--------------|--------------|-------------|
| developer-cv | 899 | IMPORT_READY | ✓ | ✓ |
| creative-cv | 1003 | IMPORT_READY | ✓ | ✓ |
| consultant-cv | 857 | IMPORT_READY | ✓ | ✓ |
| marketing-cv | 835 | IMPORT_READY | ✓ | ✓ |
| executive-cv | 794 | IMPORT_READY | ✓ | ✓ |
| student-cv | 846 | IMPORT_READY | ✓ | ✓ |
| thin-text | 32 | IMPORT_NEEDS_PASTE | ✗ (thin) | ✗ |

**Result: 7/7 passed**

Full JSON: `tests/output/extraction-reliability/report.json`

## Verification

```bash
npm run check:core
npm run qa:extraction-reliability
```

## User-visible behavior

1. **Scan/PDF timeout or weak extract** → paste recovery sheet (`IMPORT_NEEDS_PASTE`), not a blank review screen marked success.
2. **Import with partial fields** (e.g. skills only) → paste sheet with honest messaging.
3. **Valid import** → review opens only when `IMPORT_READY`; export button stays disabled until quality + reliability gates pass.
4. **Export attempt** blocked with specific quality message when name, contact, body, or preview checks fail.

## Notes

- Internal timeout label `IMPORT_STUCK_TIMEOUT` remains for race handling; user-facing terminal state is always `IMPORT_NEEDS_PASTE`.
- `IMPORT_PARTIAL` enum value still exists for legacy logs but is no longer used as a success path in the UI.
- Creative CVs may satisfy the body requirement via `clients` / `projects` sections when experience rows are sparse.
