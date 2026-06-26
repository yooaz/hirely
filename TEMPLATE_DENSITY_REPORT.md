# TEMPLATE_DENSITY_REPORT

**Status:** PASS
**Generated:** 2026-06-10T21:13:33.649Z

## Goal

Fix visual density so templates never look empty when resume data exists: render every populated section, use balanced spacing for sparse CVs, and paginate long CVs to page 2+.

## Rules

- If a section exists in resumeData → render it in the template.
- Few sections → tighter top-aligned spacing (no giant blank footer).
- Many sections → A4 pagination splits overflow to page 2+.
- QA gate: first A4 page uses ≥55.00000000000001% vertical space when resumeData has 5+ sections.
- No empty-looking preview when data exists (≥80 visible characters).

## Implementation

| Area | Change |
|------|--------|
| `cv-templates.js` | `cvDensity--sparse` / `cvDensity--filled` on `.cvInner` + `data-section-count` |
| `cv-template-density.css` | Top-aligned layout, section rhythm, sparse preview min-height fix |
| `cv-a4-pages.js` | `data-fill-pct` annotation on first sheet after layout |
| `template-density.mjs` | Shared section counting + fill gate helpers for QA |

## QA summary

| Metric | Value |
|--------|-------|
| Rich fixture sections | 9 |
| Sparse fixture sections | 3 |
| Templates audited | 8 |
| Fill gate failures | 0 |
| Completeness failures | 0 |

## Per-template first-page fill

| Template | Sections | Fill % | Text | Completeness |
|----------|----------|--------|------|--------------|
| ats | 9 | 59.8% | 585 | PASS (100%) |
| creative-portfolio | 9 | 78.9% | 575 | PASS (100%) |
| editorial-magazine | 9 | 56.1% | 581 | PASS (100%) |
| luxury-minimal | 9 | 71.8% | 585 | PASS (100%) |
| agency-designer | 9 | 73.4% | 585 | PASS (100%) |
| visual-timeline | 9 | 70.2% | 585 | PASS (100%) |
| tech-structured | 9 | 72.6% | 585 | PASS (100%) |
| art-director-portfolio | 9 | 89.2% | 727 | PASS (100%) |

## Scenarios

- **sparse-ats**: sections=3, sheets=1, text=178
- **long-creative-portfolio**: sections=9, sheets=2, text=2371

## Verify

```bash
node src/tests/qa-template-density.mjs
node scripts/template-density-report.mjs
```
