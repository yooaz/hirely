# TEMPLATE_DENSITY_POLISH_REPORT

**Status:** PASS
**Generated:** 2026-06-12T14:54:02.860Z

## Goal

Premium polish so CVs never feel empty when data exists: identity plus major sections above the fold, tighter vertical rhythm, stronger experience hierarchy, and compact clients/tools rows.

## P0 rules

- First A4 page shows **identity** + **≥3 major sections** when resume data exists.
- Reduce excessive vertical spacing (section gaps, header lead, meta grid).
- Experience uses `cvSection--primary` with stronger role/company hierarchy.
- Clients and tools use `cvSection--compact` + single-line `·` separators.
- Empty sections are not rendered (builders return empty string + CSS :empty hide).
- Rich CVs (4+ sections) target ≥50% first-page fill; no giant blank lower half.

## Implementation

| Area | Change |
|------|--------|
| `template-density.mjs` | `DENSITY_POLISH_MIN_MAJOR_SECTIONS_PAGE1`, filled threshold 4, fill gate 50% |
| `cv-templates.js` | Default `expDensity: tight`, `cvSection--primary` on experience, compact clients/tools |
| `cv-template-density.css` | Tighter gaps, experience emphasis, compact client chips + tools lines |
| `cv-templates-professional.css` | Reduced section margins, meta grid gap, experience role weight |
| `cv-a4-pages.js` | Editorial magazine `cvEmCol` columns paginate on page 1 (was header-only) |
| `cv-templates-editorial-magazine.css` | Compact cover + spread padding when `cvDensity--filled` |

## QA summary

| Metric | Value |
|--------|-------|
| Templates audited | 11 |
| Major-section gate failures | 0 |
| Fill gate failures | 0 |
| Blank-tail failures | 0 |
| Rich fixture sections | 9 |

## Per-template page 1

| Template | Major sections | Fill % | Blank tail % | Exp role | Compact tools |
|----------|----------------|--------|--------------|----------|---------------|
| ats | 7 | 61.5% | 83% | yes | yes |
| ats-elite | 8 | 57.1% | 90% | yes | yes |
| swiss-editorial | 8 | 65.3% | 91% | yes | yes |
| creative-director | 7 | 95.5% | 76% | yes | yes |
| art-director-portfolio | 7 | 97.2% | 74% | yes | yes |
| executive-luxury | 8 | 90.4% | 83% | yes | yes |
| visual-timeline | 5 | 80.9% | 80% | yes | yes |
| tech-structured | 7 | 62.6% | 84% | yes | yes |
| startup-builder | 7 | 51.9% | 82% | yes | yes |
| agency-designer | 7 | 63.1% | 86% | yes | yes |
| editorial-magazine | 7 | 61.4% | 77% | yes | yes |

## Verify

```bash
npm run qa:template-density-polish
npm run template-density-polish-report
```
