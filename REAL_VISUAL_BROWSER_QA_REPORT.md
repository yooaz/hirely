# REAL_VISUAL_BROWSER_QA_REPORT

**Status:** PASS
**Generated:** 2026-06-10T23:47:51.478Z
**Screenshots:** `tests/output/visual-browser-qa/`

## Rule

PASS only when the **rendered CV looks complete** in the browser export view — not JSON field counts.

### Visual/DOM checks (per template × real CV)

| Check | Requirement |
|-------|-------------|
| Identity visible | Name/header visible in preview |
| Experience on page 1 | Experience block on first A4 sheet when data exists |
| Clients visible | Clients section in DOM when clients exist |
| Education visible | Education section in DOM when education exists |
| No giant empty page 1 | Page 1 fill ≥ 40%, ≥ 180 chars |
| No internal A4 scroll | No clipped overflow inside A4 sheet surfaces |
| No duplicated sections | Each section type appears once |
| Export shows CV | Export step visible with live A4 CV |
| CV looks complete | Identity + density + experience on P1 |

## Yoaz CV (`yoaz-cv`)

**File:** `/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf`
**Import:** IMPORT_PARTIAL (direct)
**Result:** PASS

| Template | Score | P1 fill | Exp P1 | Export | Screenshots | Pass |
|----------|-------|---------|--------|--------|-------------|------|
| ats | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/ats/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/ats/page1-cv.png) | ✓ |
| ats-executive | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/ats-executive/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/ats-executive/page1-cv.png) | ✓ |
| creative-portfolio | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/creative-portfolio/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/creative-portfolio/page1-cv.png) | ✓ |
| portfolio-artist | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/portfolio-artist/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/portfolio-artist/page1-cv.png) | ✓ |
| behance-showcase | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/behance-showcase/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/behance-showcase/page1-cv.png) | ✓ |
| editorial-magazine | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/editorial-magazine/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/editorial-magazine/page1-cv.png) | ✓ |
| magazine-editorial | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/magazine-editorial/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/magazine-editorial/page1-cv.png) | ✓ |
| luxury-minimal | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/luxury-minimal/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/luxury-minimal/page1-cv.png) | ✓ |
| tech-structured | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/tech-structured/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/tech-structured/page1-cv.png) | ✓ |
| art-director-portfolio | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/art-director-portfolio/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/art-director-portfolio/page1-cv.png) | ✓ |
| luxury-fashion | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/luxury-fashion/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/luxury-fashion/page1-cv.png) | ✓ |
| agency-designer | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/agency-designer/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/agency-designer/page1-cv.png) | ✓ |
| minimal-swiss | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/minimal-swiss/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/minimal-swiss/page1-cv.png) | ✓ |
| visual-timeline | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/visual-timeline/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/visual-timeline/page1-cv.png) | ✓ |
| creative-director | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/creative-director/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/creative-director/page1-cv.png) | ✓ |
| art-director | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/art-director/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/art-director/page1-cv.png) | ✓ |
| illustrator-portfolio | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/yoaz-cv/illustrator-portfolio/export-view.png) · [page1](tests/output/visual-browser-qa/yoaz-cv/illustrator-portfolio/page1-cv.png) | ✓ |

### Screenshot paths

- `tests/output/visual-browser-qa/yoaz-cv/ats/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/ats-executive/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/creative-portfolio/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/portfolio-artist/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/behance-showcase/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/editorial-magazine/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/magazine-editorial/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/luxury-minimal/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/tech-structured/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/art-director-portfolio/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/luxury-fashion/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/agency-designer/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/minimal-swiss/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/visual-timeline/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/creative-director/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/art-director/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/yoaz-cv/illustrator-portfolio/` — export-view.png, page1-cv.png

## Second uploaded CV (`second-uploaded-cv`)

**File:** `/Users/yohannazancot/Documents/yohann azancot cv 2024.pdf`
**Import:** IMPORT_NEEDS_PASTE (browser-acceptance-cache)
**Result:** PASS

| Template | Score | P1 fill | Exp P1 | Export | Screenshots | Pass |
|----------|-------|---------|--------|--------|-------------|------|
| ats | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/ats/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/ats/page1-cv.png) | ✓ |
| ats-executive | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/ats-executive/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/ats-executive/page1-cv.png) | ✓ |
| creative-portfolio | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/creative-portfolio/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/creative-portfolio/page1-cv.png) | ✓ |
| portfolio-artist | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/portfolio-artist/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/portfolio-artist/page1-cv.png) | ✓ |
| behance-showcase | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/behance-showcase/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/behance-showcase/page1-cv.png) | ✓ |
| editorial-magazine | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/editorial-magazine/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/editorial-magazine/page1-cv.png) | ✓ |
| magazine-editorial | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/magazine-editorial/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/magazine-editorial/page1-cv.png) | ✓ |
| luxury-minimal | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/luxury-minimal/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/luxury-minimal/page1-cv.png) | ✓ |
| tech-structured | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/tech-structured/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/tech-structured/page1-cv.png) | ✓ |
| art-director-portfolio | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/art-director-portfolio/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/art-director-portfolio/page1-cv.png) | ✓ |
| luxury-fashion | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/luxury-fashion/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/luxury-fashion/page1-cv.png) | ✓ |
| agency-designer | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/agency-designer/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/agency-designer/page1-cv.png) | ✓ |
| minimal-swiss | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/minimal-swiss/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/minimal-swiss/page1-cv.png) | ✓ |
| visual-timeline | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/visual-timeline/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/visual-timeline/page1-cv.png) | ✓ |
| creative-director | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/creative-director/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/creative-director/page1-cv.png) | ✓ |
| art-director | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/art-director/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/art-director/page1-cv.png) | ✓ |
| illustrator-portfolio | 100/100 | 100% | ✓ | ✓ | [export](tests/output/visual-browser-qa/second-uploaded-cv/illustrator-portfolio/export-view.png) · [page1](tests/output/visual-browser-qa/second-uploaded-cv/illustrator-portfolio/page1-cv.png) | ✓ |

### Screenshot paths

- `tests/output/visual-browser-qa/second-uploaded-cv/ats/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/ats-executive/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/creative-portfolio/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/portfolio-artist/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/behance-showcase/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/editorial-magazine/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/magazine-editorial/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/luxury-minimal/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/tech-structured/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/art-director-portfolio/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/luxury-fashion/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/agency-designer/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/minimal-swiss/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/visual-timeline/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/creative-director/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/art-director/` — export-view.png, page1-cv.png
- `tests/output/visual-browser-qa/second-uploaded-cv/illustrator-portfolio/` — export-view.png, page1-cv.png

## Verify

```bash
npm run qa:real-visual-browser
npm run real-visual-browser-qa-report
```
