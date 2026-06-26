# IMPORT_FORENSICS_REPORT

**Status:** PASS
**Generated:** 2026-06-15T10:45:37.099Z
**Source:** `src/ui/runtime/import-forensics.js` + `importLog()` in `index.html`

Canonical milestones: `DROP_RECEIVED` → `FILE_SELECTED` → `FILE_VALIDATED` → `FILE_ROUTED` → (`PDF_TEXT_FOUND` | `OCR_STARTED` → `OCR_FINISHED`) → `EXTRACTION_STARTED` → `EXTRACTION_FINISHED` → `CV_READY` → `EXPORT_READY`.

## Primary import (full chain)

**Fixture:** `tests/fixtures/designer-cv-rich.txt`
**Result:** PASS

### Lifecycle chain

1. `DROP_RECEIVED` — ✓
2. `FILE_SELECTED` — ✓
3. `FILE_VALIDATED` — ✓
4. `FILE_ROUTED` — ✓
5. `PDF_TEXT_FOUND` (branch) (n/a) — ✗
6. `OCR_STARTED` (branch) (n/a) — ✗
7. `OCR_FINISHED` (branch) (n/a) — ✗
8. `EXTRACTION_STARTED` — ✓
9. `EXTRACTION_FINISHED` — ✓
10. `CV_READY` — ✓
11. `EXPORT_READY` — ✓

### First failure point

_No failure — chain completed or still in progress._

### Runtime summary

| Field | Value |
|-------|-------|
| Import timed out | false |
| Import status | — |
| CV live | true |
| Raw text length | 0 |
| Branch | routed |
| Completed | DROP_RECEIVED → FILE_SELECTED → FILE_VALIDATED → FILE_ROUTED → EXTRACTION_STARTED → EXTRACTION_FINISHED → CV_READY → EXPORT_READY |
| Missing | PDF_TEXT_FOUND, OCR_STARTED, OCR_FINISHED |
| Page errors | none |

### Milestone tail

| Time | Tag | Detail |
|------|-----|--------|
| 10:45:26.669 | `TEMPLATE_RENDERED` | {"final":{"experiences":1,"education":1,"skills":8,"tools":3 |
| 10:45:26.716 | `EXPORT_READY` | {"final":{"experiences":1,"education":1,"skills":8,"tools":3 |
| 10:45:26.716 | `EXPORT_READY` | {"template":"ats"} |
| 10:45:26.954 | `STUDIO_RENDER_DONE` | {"section":"identity"} |
| 10:45:27.076 | `STUDIO_RENDER_DONE` | {"section":"identity"} |
| 10:45:27.197 | `STUDIO_RENDER_DONE` | {"section":"identity"} |
| 10:45:27.322 | `STUDIO_RENDER_DONE` | {"section":"identity"} |
| 10:45:27.444 | `STUDIO_RENDER_DONE` | {"section":"identity"} |
| 10:45:27.560 | `STUDIO_RENDER_DONE` | {"section":"identity"} |
| 10:45:27.678 | `STUDIO_RENDER_DONE` | {"section":"identity"} |
| 10:45:27.796 | `STUDIO_RENDER_DONE` | {"section":"identity"} |
| 10:45:27.916 | `STUDIO_RENDER_DONE` | {"section":"identity"} |

## Threshold probe (sub-300 char paste fallback)

**Fixture:** `tests/fixtures/mvp-sample.txt`
**Result:** FAIL

### Lifecycle chain

1. `DROP_RECEIVED` — ✓
2. `FILE_SELECTED` — ✓
3. `FILE_VALIDATED` — ✓
4. `FILE_ROUTED` — ✓
5. `PDF_TEXT_FOUND` (branch) (n/a) — ✗
6. `OCR_STARTED` (branch) (n/a) — ✗
7. `OCR_FINISHED` (branch) (n/a) — ✗
8. `EXTRACTION_STARTED` — ✓
9. `EXTRACTION_FINISHED` — ✓
10. `CV_READY` — ✗
11. `EXPORT_READY` (n/a) — ✗

### First failure point

**Type:** explicit failure
**Tag:** `RAW_TEXT_THRESHOLD`
**At:** 2026-06-15T10:45:34.946Z
**Detail:** {"chars":255,"min":300}
**Chain gap at failure:** `CV_READY`

### Runtime summary

| Field | Value |
|-------|-------|
| Import timed out | false |
| Import status | — |
| CV live | false |
| Raw text length | 0 |
| Branch | routed |
| Completed | DROP_RECEIVED → FILE_SELECTED → FILE_VALIDATED → FILE_ROUTED → EXTRACTION_STARTED → EXTRACTION_FINISHED |
| Missing | PDF_TEXT_FOUND, OCR_STARTED, OCR_FINISHED, CV_READY, EXPORT_READY |
| Page errors | none |

### Milestone tail

| Time | Tag | Detail |
|------|-----|--------|
| 10:45:34.919 | `FILE_VALIDATED` | {"name":"mvp-sample.txt","size":270,"type":"text/plain"} |
| 10:45:34.919 | `IMPORT_STARTED` |  |
| 10:45:34.919 | `FILE_ROUTED` | {"docType":"txt","uploadSource":"txt-upload"} |
| 10:45:34.920 | `FILE_ROUTED` | txt |
| 10:45:34.921 | `EXTRACTION_STARTED` |  |
| 10:45:34.946 | `EXTRACTION_FINISHED` |  |
| 10:45:34.946 | `EXTRACTION_FINISHED` | {"chars":255,"method":"native_pdf"} |
| 10:45:34.946 | `RAW_TEXT_LENGTH` | 255 |
| 10:45:34.946 | `IMPORT_PHASE` | IMPORT_NEEDS_PASTE |
| 10:45:34.946 | `RAW_TEXT_THRESHOLD` | {"chars":255,"min":300} |
| 10:45:34.950 | `IMPORT_FINAL` | IMPORT_NEEDS_PASTE |
| 10:45:34.950 | `IMPORT_NEEDS_PASTE` | {"legacyStatus":"PASTE_FALLBACK_REQUIRED","rawLen":255,"ocrF |

## Policy

- All `importLog()` calls feed `HirelyImportForensics.record()`.
- Legacy tags are aliased (e.g. `EXTRACTION_DONE` → `EXTRACTION_FINISHED`).
- Branch milestones (`PDF_TEXT_FOUND`, `OCR_*`) apply only on PDF/OCR paths.
- **First failure** = earliest `FAILURE_TAGS` event, else first applicable chain gap.
- `RAW_TEXT_THRESHOLD` = extracted text under 300 chars → `IMPORT_NEEDS_PASTE` (no parser).

## Re-run

```bash
npm run qa:import-forensics
```
