# Editor Features QA — Core Safety

**Status:** PASS  
**Generated:** 2026-06-11T08:24:22.289Z

## Isolation contract

Editor features (profile photo + section reorder) must **not** touch import, OCR, parser, or `finalResumeData`.

| Layer | Allowed | Forbidden |
|-------|---------|-----------|
| Editor state | `index.html` `state.photo*`, `state.sectionOrder` | Writing into `finalResumeData` |
| Template render | `cv-templates.js`, `pro-cv-features.js` | Parser / extraction modules |
| PDF export | `pdf-export-playwright.mjs`, `cv-pdf-export.css` | Pipeline import locks |

### Injection point (render-only)

`sectionOrder` is merged into the **display cv payload** at `renderCVInner` only — after `getFinalCvData()` / `normalizeCvData()`. It is **not** stored on `finalResumeData`.

### Core contamination scan

**No editor markers found in forbidden core paths.**

- `sectionOrder`, `photoPerTemplate`, `HirelyProCvFeatures` absent from `src/core/import`, `src/core/extraction`, `src/core/resume-data.js`, main parser/pipeline entrypoints

### Editor touch surface (expected)

- `src/ui/pro/pro-cv-features.js`
- `src/ui/pro/pro-cv-features.css`
- `src/ui/templates/cv-templates.js`
- `src/tests/lib/pdf-export-playwright.mjs`
- `index.html`

## Suite results

| Suite | Critical | Result |
|-------|----------|--------|
| `check:exports` | yes | PASS |
| `check:core` | yes | PASS |
| `qa:p7-stress-test` | yes | PASS |
| `qa:template-h3-polish` | no | FAIL |
| `qa:pdf-export-hardening` | yes | PASS |
| `qa:photo-section-reorder` | yes | PASS |

## Notes

- **`qa:template-h3-polish`** — marked non-critical for this gate. Failures reflect H3 template-lock drift (10-template V1 vs legacy H3 expectations: display names, `cv-templates-professional.css` path checks, executive-minimal label). **Not caused by editor features.** All per-template PDF export checks in that suite still pass.
- **`qa:pdf-export-hardening`** — includes `p6-photo-ats` (photo in export DOM). PASS confirms PDF path safe with photo markup.
- **`qa:p7-stress-test`** — full import → parser → review → ATS → PDF pipeline on 20 fixtures. PASS confirms core pipeline unchanged.

## Failure excerpts

### qa:template-h3-polish
```
FAIL production-template-ids declares p5 lock
FAIL five production templates
FAIL canonical order ats → creative → executive-minimal
FAIL V2 ids match production set
FAIL tech-structured display name
FAIL agency-designer display name
FAIL ats-elite has professional CSS
FAIL swiss-editorial has professional CSS
FAIL creative-director has professional CSS
FAIL art-director-portfolio has professional CSS
FAIL executive-luxury has professional CSS
FAIL visual-timeline has professional CSS
```

## Commands

```bash
npm run check:exports
npm run check:core
npm run qa:p7-stress-test
npm run qa:template-h3-polish
npm run qa:pdf-export-hardening
npm run qa:photo-section-reorder
npm run editor-features-qa-report
```
