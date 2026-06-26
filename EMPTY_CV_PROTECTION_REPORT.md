# EMPTY_CV_PROTECTION_REPORT

**Status:** PASS
**Generated:** 2026-06-15T10:52:56.596Z
**Module:** `src/core/validation/cv-data-protection.js`

## validateCvData() outcomes

| Status | Meaning | Review | Style | Export |
|--------|---------|--------|-------|--------|
| `VALID` | Name, experience, sections, and preview OK | ✓ | ✓ | ✓ |
| `PARTIAL` | Minimum structure but not export-safe | ✓ | ✗ | ✗ |
| `INVALID` | Missing name, experience, sections, or preview | ✗ | ✗ | ✗ |

## INVALID triggers

- `name_missing` — invalid or placeholder name
- `experience_missing` — zero experiences
- `all_sections_empty` — no section content and no summary
- `preview_empty` — preview not live and no displayable text

## INVALID behavior

- Recovery UI via `extractionRecoveryPanel` + import warning
- `setDocStep(edit|style|export)` redirected to import
- `downloadPDF()` hard-blocked
- Progress nav disables Review / Style / Export

## Checks

| Check | Result | Detail |
|-------|--------|--------|
| unit_validateCvData | PASS | — |
| report_invalid_status | PASS | INVALID |
| browser_empty_cv_invalid | PASS | {"invalidStatus":"INVALID","reasons":["name_missing","experience_missing","all_sections_empty","preview_empty"],"blockExport":true,"blockReview":true,"exportBlocked":true,"downloadDisabled":true} |
| browser_export_nav_blocked_when_invalid | PASS | — |
| browser_rich_import_valid_or_partial | PASS | {"status":"VALID","blockExport":false,"editDisabled":false,"exportDisabled":true,"cvLive":true} |
| browser_rich_cv_live | PASS | — |

## Browser snapshot

```json
{
  "emptyGate": {
    "invalidStatus": "INVALID",
    "reasons": [
      "name_missing",
      "experience_missing",
      "all_sections_empty",
      "preview_empty"
    ],
    "blockExport": true,
    "blockReview": true,
    "exportBlocked": true,
    "downloadDisabled": true
  },
  "richGate": {
    "status": "VALID",
    "blockExport": false,
    "editDisabled": false,
    "exportDisabled": true,
    "cvLive": true
  }
}
```

## Re-run

```bash
npm run qa:empty-cv-protection
```
