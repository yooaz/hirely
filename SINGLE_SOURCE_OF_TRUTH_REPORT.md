# HIRELY P0 — Single Source of Truth

**Result:** PASS
**Generated:** 2026-06-10T13:04:10.996Z

## Principle

**`state.finalResumeData`** is the only canonical object. All surfaces derive from it:

- Review panel
- CV preview
- Template renderer
- Export screen
- PDF export

Forbidden: separate `cvData` / `exportData` / stale template caches as sources of truth.

## Pipeline logs

- `FINAL_DATA_COMMITTED`
- `REVIEW_RENDERED`
- `PREVIEW_RENDERED`
- `TEMPLATE_RENDERED`
- `EXPORT_RENDERED`

## Section parity (final vs preview)

| Section | finalResumeData | Preview | Match |
|---------|-----------------|---------|-------|
| experiences | 2 | 2 | yes |
| education | 0 | 0 | yes |
| skills | 6 | 6 | yes |
| tools | 1 | 1 | yes |
| languages | 0 | 0 | yes |
| clients | 0 | 0 | yes |
| projects | 0 | 0 | yes |

**Parity gate:** PASS

## Runtime logs captured

```
FINAL_DATA_COMMITTED, REVIEW_RENDERED, PREVIEW_RENDERED, TEMPLATE_RENDERED, REVIEW_RENDERED, PREVIEW_RENDERED, TEMPLATE_RENDERED, REVIEW_RENDERED, PREVIEW_RENDERED, EXPORT_RENDERED
```

## Implementation

| Change | Location |
|--------|----------|
| `getFinalSectionCounts` / `getPreviewSectionCounts` | `index.html` |
| `syncDerivedCvDataFromFinal` (cache only) | `index.html` |
| `renderAllFromFinalResume` orchestrator | `index.html` |
| Review/classify actions use `getFinalCvData()` | `index.html` |
| Education issue uses final counts | `collectSimpleIssues` |
| Export `resumeDataSectionCounts` export | `recruiter-checklist-source.js` |

## Gate

```bash
npm run test:single-source-of-truth
```

## QA output

```
OK finalResumeData valid after import
OK review/preview section parity after import
OK preview live (Yohann Azancot)
OK log FINAL_DATA_COMMITTED
OK log REVIEW_RENDERED
OK log PREVIEW_RENDERED
OK log TEMPLATE_RENDERED
OK education parity final=false preview=false
OK template switch (creative)
OK preview live after template switch
OK section parity after template switch
OK log TEMPLATE_RENDERED after switch
OK export preview visible
OK section parity on export
OK log EXPORT_RENDERED
OK no false education-missing when education present

PASS single-source-of-truth
```

