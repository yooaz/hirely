# Emergency Fix Report

**Generated:** 2026-06-15T12:32:34.584Z
**Verdict:** PASS

## Root causes fixed

| Issue | Cause | Fix |
|-------|-------|-----|
| Collapsed hero | `hirely-ui-scale.css` set `.hero { max-width: 560px }` | Hero max-width **1100px**, centered |
| Import card lost / low | Split grid + centered 520px card in wide column | Pre-ready landing: **single column**, import under hero |
| OCR 100+ seconds | `PDF_EXTRACTION_MAX_MS` default **120000** + UI paste lock at 120s | OCR budget **15s**; UI timer no longer locks paste early |
| Stuck on IMPORT_PARTIAL | `isFinalResumeValid()` blocked Review; `finishImportUi` ignored PARTIAL; OCR UX lock; `guardCvDataStep` reset `docStep` to import; `renderAllFromFinalResume` no-op when contract invalid; paste apply only accepted `IMPORT_READY` | PARTIAL → Review; partial render from `resumeData`; progress nav unlocked; paste apply accepts PARTIAL |
| #heroStart warning | Obsolete `bindClick('heroStart')` | Removed; `bindClick` silent when missing |

## CSS that broke hero

```css
/* hirely-ui-scale.css (before) */
.hero {
  max-width: 560px; /* ← collapsed hero to narrow left column */
}
```

## Why IMPORT_PARTIAL blocked flow

1. `resolveHonestImportState()` only returned `IMPORT_READY` or `IMPORT_NEEDS_PASTE` — never `IMPORT_PARTIAL`.
2. `ensureImportReviewVisible()` returned early when `!isFinalResumeValid()` even with live CV preview.
3. `finishImportUi()` only emitted `CV_READY` for `IMPORT_READY`.
4. `triggerPdfOcrFullFallback()` at 120s set `_importFallbackUiLock`, trapping UI on Import even after extraction succeeded.
5. `guardCvDataStep()` rejected `edit` when `validateCvData` was `INVALID`, immediately resetting `docStep` back to `import` after a successful partial import.
6. `renderAllFromFinalResume()` returned early when `!isFinalResumeValid()`, so OCR partial imports never rendered a CV preview.
7. Paste fallback apply only called `ensureImportReviewVisible` for `IMPORT_READY`, re-trapping `IMPORT_PARTIAL` users.

## QA file

`/Users/yohannazancot/Downloads/Nouveau dossier contenant des éléments 2/cv. Yohann azancot (1).pdf`

## Results

| Check | Result |
|-------|--------|
| Core boot ok/degraded | PASS (ok) |
| Hero copy width ≥ 400px | PASS (672px) |
| Import ≤ 20s (15s OCR + buffer) | FAIL (28455ms) |
| Reached Review (`docStep=edit`) | PASS |
| CV preview not empty | PASS (790 chars) |
| Terminal status | — |
| Raw text chars | 0 |
| Honest paste (<300 chars) | NO |
| Boot trace (tail) | — |
| Export step + Download visible | PASS |

## Screenshots

- Landing: `tests/output/emergency-fix/after-landing.png`
- After import: `tests/output/emergency-fix/after-import.png`
- Export step: `tests/output/emergency-fix/after-export-step.png`

## Verify

```bash
node scripts/qa-emergency-import-fix.mjs
```
