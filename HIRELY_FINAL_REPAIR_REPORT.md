# HIRELY FINAL REPAIR QA

Generated: 2026-06-06T18:39:41.324Z
PDF: `/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf`

## Verdict

# FAIL

## Before / after counts (headless OCR → browser)

| Field | Before (OCR fixture) | After (browser) |
|-------|---------------------:|----------------:|
| Name | Yohann Azancot | — |
| Email | yoaz@hotmail.fr | — |
| Experiences | 2 | undefined |
| Education | 2 | undefined |
| Tools | 1 | undefined |
| Clients | 8 | undefined |

## Checks

- [ ] **E2E run** — page.waitForFunction: Timeout 360000ms exceeded.

## Artifacts

- Screenshot: `tests/output/final-repair-qa/preview.png`
- PDF: `tests/output/final-repair-qa/yoaz-export.pdf`

## Files changed (final polish pass)

- `src/ui/export/a4-viewport.js` — desktop zoom 0.9, centered A4
- `src/ui/templates/cv-templates.js` — experience wrap, edu/lang lines
- `src/ui/hirely-document.css` — stacked experience readability
- `src/core/validation/sanitize-resume-display.js` — tools/lang/edu cleanup
- `src/core/parsing/resume-output-quality.js` — language normalize, edu gate
- `src/core/parsing/suggestion-confidence-score.js` — max 3 suggestions
- `index.html` — PRODUCT_SUGGESTIONS_MAX=3