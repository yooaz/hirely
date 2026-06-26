# ATS Elite PDF Export

**Status:** PASS  
**Generated:** 2026-06-11T01:11:01.020Z  
**Template:** `ats-elite`

## Export path

Playwright print-to-PDF via `src/tests/lib/pdf-export-playwright.mjs`:

- A4 width (210mm / 794px)
- Stylesheets include `cv-templates-ats-elite.css`
- A4 page layout via `cv-a4-pages.js`

## Output artifact

| File | Size |
|------|------|
| `tests/output/ats-elite/ats-elite.pdf` | 142518 bytes |

## Verification

```bash
npm run qa:ats-elite-template
npm run ats-elite-pdf-export-report
```

## Checks

- PDF generated (yes)
- PDF size > 2KB (yes)
- No horizontal crop in preview
- Black & white typography preserved in export CSS stack

**QA overall:** PASS
