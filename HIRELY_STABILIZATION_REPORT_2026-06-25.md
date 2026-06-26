# Hirely Stabilization Report — 2026-06-25

## First exact blocker found

`src/core/import/import-decision-final.js` allowed image/scanned PDF imports to resolve to `structured_from_ocr` without a confirmed OCR lifecycle and without a structured OCR payload. It could infer OCR readiness from generic parser/native `textLength`, which made the UI believe a scanned PDF had a structured CV when it only had raw text.

## Patch summary

- Hardened OCR routing: `structured_from_ocr` now requires `ocrAttempted === true`, `ocrUsable === true`, and structured payload.
- OCR text without structured payload now routes to `recovery`, not fake structured review and not paste.
- Raw/parser text can no longer inflate OCR readiness for scanned PDF routing.
- Recovery rendering now explicitly hides paste fallback before showing recovery/review UI.
- Browser import finalization still requests synthesized structured payload for the real app path so usable OCR can create a visible CV instead of leaving a blank review.
- Fixed the template visibility QA canonical editorial lookup so the production `editorial-magazine` template is tested, not an absent legacy map key.

## Modified files

- `index.html`
- `src/core/import/import-decision-final.js`
- `src/core/import/enrich-import-result-ocr-settlement.js`
- `src/tests/qa-template-content-visibility.mjs`
- `TEMPLATE_CONTENT_VISIBILITY_REPORT.md`
- `EXPORT_PAGE_FULL_PREVIEW_REPORT.md`
- `REVIEW_SCREEN_GUARANTEE_REPORT.md`
- `HIRELY_STABILIZATION_REPORT_2026-06-25.md`

## QA checklist

| Area | Status | Evidence |
|---|---:|---|
| TXT / Paste parser path | PASS | `npm test`, `npm run qa:review-flow`, `npm run qa:preview-render-gate` |
| DOCX extraction logic | NOT RUN | `mammoth` package missing in sandbox; app dependency exists in package.json but node_modules is not installed |
| PDF text extraction routing | PASS | `npm run check:core` passed until browser-only Playwright gate; native PDF policy checks passed |
| PDF image / scanned OCR decision | PASS | `npm run qa:pdf-image-ocr-decision` |
| Raw text fallback / recovery UX | PASS | `npm run qa:extraction-recovery-ux`; `npm run test:review-screen-guarantee` static guarantee passed |
| Review page visible when rawText exists | PASS | recovery + review screen guarantee static checks passed |
| Templates content visibility | PASS | `npm run test:template-content-visibility` |
| Export page static contract | PASS / BROWSER NOT RUN | static export checks in script passed, browser run blocked by missing `playwright` package |
| Full browser Import → Review → Style → Export → Download PDF | NOT RUN | `playwright` package missing in sandbox node_modules |

## Commands run

```bash
npm test
npm run qa:review-flow
npm run qa:preview-render-gate
node src/tests/qa-automatic-import-policy.mjs
npm run check:core
npm run test:template-content-visibility
npm run qa:pdf-image-ocr-decision
npm run qa:extraction-recovery-ux
npm run test:review-screen-guarantee
npm run test:export-page-full-preview
```

## Known environment limitation

The repository ZIP did not include `node_modules`. Browser/DOCX tests requiring `playwright` or `mammoth` could not execute in this sandbox without installing dependencies. The code paths and package declarations remain present.
