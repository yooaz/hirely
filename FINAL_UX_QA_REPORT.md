# FINAL UX QA REPORT

**Status:** PASS
**Date:** 2026-06-16T11:46:03.940Z
**Fixture:** `/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf`
**Pass:** 8/8

## Summary

End-to-end Playwright QA on the scanned Yoaz PDF (`cv2022 yohann azancot copie.pdf`). OCR completed in-browser (~14s); CV preview populated; uncertain OCR lines quarantined (15 lines); style layout does not obscure the preview; template switch and export UI work; PDF bytes generated from live preview.

> **Note:** Locked export prep reported `PREVIEW_NOT_LIVE`; PDF generation succeeded via live-preview blob export. The download button is visible; consider hardening `prepareLockedCvExport` for honest-mode / partial OCR imports.

## Criteria

| # | Criterion | Result | Detail |
|---|-----------|--------|--------|
| 1 | Import does not hang | PASS | import 20508ms, path=ocr-live, cvLen=339 |
| 2 | If OCR succeeds, Review opens | PASS | edit=true rawReview=false path=ocr-live |
| 3 | CV preview is not empty | PASS | len=339 name=true |
| 4 | Garbage text isolated in « À vérifier » | PASS | cvGarbage=false verifyLines=15 label="Texte à vérifier" |
| 5 | Style page does not cover CV | PASS | cover=1% cvLen=339 step=style |
| 6 | Template switch works | PASS | before=ats after=minimal-ats clicked=minimal-ats |
| 7 | Export button visible | PASS | step=export label="Télécharger le PDF" w=452 |
| 8 | PDF export works | PASS | 24478 bytes via preview-blob-fallback (lock warnings: PREVIEW_NOT_LIVE) |

## Import context

- OCR succeeded (heuristic): **yes**
- OCR confidence: **—**
- Honest extraction mode: **no**
- Import path: **ocr-live**
- Paste fallback shown: **no**
- Verify label: **—**

## Artifacts

- Screenshots: `tests/output/final-ux-qa/`
- JSON: `tests/output/final-ux-qa/report.json`

## How to re-run

```bash
npm run final-ux-qa
# or
node scripts/final-ux-qa.mjs
```
