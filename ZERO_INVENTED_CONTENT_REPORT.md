# Zero Invented Content Report (H18)

**Verdict:** PASS

## Policy

Forbidden without OCR / DOCX / TXT / user edit:

- Generated identity names
- Generated job titles
- Generated summaries
- Generated experience
- Generated education
- Generated skills

When data is missing, UI displays:

> **Information non détectée**

Never fabricate CV content.

## Audited symbols

- `fallbackTitle` — not found in product layer
- `fallbackName` — not found in product layer
- `fallbackSummary` — not found in product layer
- `demoData` — not found in product layer
- `placeholderIdentity` — not found in product layer
- `sampleResume` — not found in product layer

No matches for `fallbackTitle`, `fallbackName`, `fallbackSummary`, `demoData`, `placeholderIdentity`, or `sampleResume` in the product layer (`index.html`, templates, final-resume contract, resume-data, safe-fallback).

## Remediation (H18)

| Area | Change |
|------|--------|
| Canonical label | `src/core/display/undetected-label.js` |
| Export fabrication | Removed `ensurePartialExportProfile` summary/experience synthesis |
| Identity sanitize | Invalid name/title → empty string (display layer shows undetected) |
| OCR failure preview | Empty identity — no `Nom à confirmer` injection |
| Template gallery | `MINI_CV` uses undetected label only — no Alex Martin demo CV |
| UI placeholders | Header, editor, i18n → `Information non détectée` |
| Parser recovery | `NAME_UNCERTAIN_LABEL` / `TITLE_UNCERTAIN_LABEL` → undetected label |

## Explicit sample path

`loadSample()` / `sampleBtn` still loads bundled paste text when the user opts in — treated as **user action**, not auto-invented content.

## Acceptance checks

| Check | Result | Detail |
|-------|--------|--------|
| undetected label is French product copy | PASS | — |
| parser recovery maps uncertain labels | PASS | — |
| title uncertain maps to undetected | PASS | — |
| invalid name stored empty | PASS | — |
| invalid title stored empty | PASS | — |
| empty name is uncertain | PASS | — |
| empty title is uncertain | PASS | — |
| no fabricated summary | PASS | — |
| no fabricated experience | PASS | — |
| no fabricated export profile violations | PASS | — |
| no fallbackTitle/fallbackName/demoData symbols in product layer | PASS | — |
| index defines undetected label | PASS | — |
| index removed OCR_FAILURE_NAME constant | PASS | — |
| renderOcrFailureCleanPreview clears identity | PASS | — |
| MINI_CV has no Alex Martin | PASS | — |
| MINI_CV uses undetected label | PASS | — |
| template placeholders use undetected label | PASS | — |
| empty exportable cv has no invented name | PASS | — |
| empty exportable cv has no toClassify without raw | PASS | — |

## Run

```bash
npm run qa:h18-zero-invented-content
```

---
Generated: 2026-06-09T14:30:22.501Z
