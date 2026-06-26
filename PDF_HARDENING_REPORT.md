# PDF HARDENING REPORT

Generated: 2026-06-07T23:29:01.878Z
Engine: `HIRELY_PDF_HARDENING_H7`

## Verdict

# **PASS**

**100/100** exports succeeded (100%).

## Guarantees audited

| Guarantee | Enforcement |
|-----------|-------------|
| A4 | PDF page size 595.28×841.89 pt (±4 pt) |
| Multi-page | 1–4 pages by content volume |
| No overflow | `overflow: visible` on `.cv`; width 794px / 210mm |
| No clipping | Each `cvA4Sheet` packed ≤ 1123px; PDF pages match sheet count |
| Embedded fonts | PDF contains `/Type /Font` or font descriptors |
| Stable pagination | `pageCount === cvA4Sheet` count (HirelyA4Pages) |

## Summary

| Metric | Value |
|--------|------:|
| Total resumes | 100 |
| Passed | 100 |
| Failed | 0 |
| Pass rate | 100% |

## By template

| Template | Pass | Fail |
|----------|-----:|-----:|
| ats | 20 | 0 |
| creative | 20 | 0 |
| executive | 20 | 0 |
| minimal | 20 | 0 |
| premium | 20 | 0 |

## Pipeline

```
generateHardeningResumes(100)
    → HirelyTemplates.render(cv, templateId)
    → HirelyA4Pages.layoutCvA4Pages()
    → Playwright print PDF (A4, embedded fonts)
    → validatePdfHardening() + auditExportDom()
```

## Module map

| File | Role |
|------|------|
| `src/ui/export/hirely-pdf-export.js` | Browser html2pdf export |
| `src/ui/templates/cv-pdf-export.css` | A4 print rules, break-inside |
| `src/core/export/pdf-export-config.js` | Shared A4 constants |
| `src/tests/lib/pdf-export-playwright.mjs` | QA print + validation |
| `src/ui/export/cv-a4-pages.js` | Deterministic A4 sheet pagination |
| `src/tests/lib/pdf-hardening-resumes.mjs` | 100 resume generator |
| `src/tests/lib/pdf-hardening-suite.mjs` | H7 runner |

## Verification

```bash
npm run qa:pdf-hardening
npm run pdf:hardening-report
```
