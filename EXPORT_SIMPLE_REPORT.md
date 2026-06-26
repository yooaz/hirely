# Export Simple

**Generated:** 2026-06-16T07:16:15.933Z
**Status:** **PASS** (17/17 checks)
**Version:** `EXPORT_SIMPLE_V1` (`export-simple-v1`)

## Rule

Export is allowed when **both** are true:

1. `resumeData` exists
2. Visible CV preview is live (`#cvDoc.cv--live`, no empty state)

One primary control: **Download PDF** (`#downloadBtn` in `#cvExportBar` on the Export step).

## Removed / bypassed

| Blocker / duplicate | Status |
| --- | --- |
| Quality validator export gate | Bypassed when `HIRELY_EXPORT_SIMPLE` |
| ATS checklist export blocker | Export item follows `canExportSimple()` |
| `validateExportLock` / `prepareLockedCvExport` gates | `prepareSimpleCvExport()` when simple mode |
| Pro paywall on PDF (`requirePro`, `tab--pro`) | Skipped in export simple |
| Export More menu (email, TXT, back) | Removed from DOM + hidden in CSS |
| `exportFinalPanel` duplicate buttons | Hidden via CSS |

## Runtime flag

```javascript
HIRELY_EXPORT_SIMPLE = true  // also when NAVIGATION_LOCK / ONE_CV_SOURCE
```

## Functions (index.html)

| Function | Behavior |
| --- | --- |
| `canExportSimple()` | `hasNavResumeData() && cvPreviewIsLive()` |
| `isExportReady()` | Alias → `canExportSimple()` |
| `prepareSimpleCvExport()` | Render preview, no quality/ATS lock |
| `downloadPDF()` | Gate on `canExportSimple()` only |
| `syncExportBarChrome()` | Show bar on export step when export allowed |

## Module map

| File | Role |
| --- | --- |
| `src/core/export/export-simple.js` | `canExportSimple`, preview live check |
| `src/ui/product/export-simple.css` | Hide duplicate export UI |
| `index.html` | Single `#downloadBtn`, simplified export path |

## Static checks

| Check | Status | Detail |
| --- | --- | --- |
| file:export-simple-js | PASS | — |
| file:export-simple-css | PASS | — |
| core:exports-export-simple | PASS | — |
| index:links-export-simple-css | PASS | — |
| flag:HIRELY_EXPORT_SIMPLE | PASS | — |
| fn:exportSimpleActive | PASS | — |
| fn:canExportSimple | PASS | — |
| export:isExportReady-simple | PASS | — |
| export:prepareSimpleCvExport | PASS | — |
| export:validate-no-quality-gate | PASS | — |
| export:downloadPDF-simple-gate | PASS | — |
| ui:single-download-btn | PASS | — |
| ui:download-not-tab-pro | PASS | — |
| css:hide-export-more | PASS | — |
| css:hide-email-txt-export | PASS | — |
| fn:syncExportBarChrome | PASS | — |
| module:canExportSimple-export | PASS | — |

## Verification

```bash
npm run export-simple-report
```

## UX note

Style-step **flow CTA** (`#flowPrimaryCtaBtn`) still navigates to the Export step — it is not a second PDF download. The only download action is `#downloadBtn` on the Export step.
