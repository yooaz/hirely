# CV Hell Benchmark (P5)

**Status:** FAIL  
**Generated:** 2026-06-11T11:05:00.883Z  
**Fixtures:** 50 real-world layout variants  
**Engine:** `HIRELY_P5_CV_HELL_BENCH_V1`

## Purpose

Stress-test Hirely import across **50 real CV layouts** — Canva, InDesign, Figma, Word, Pages, LinkedIn export, Europass, creative portfolios, agency designers, developers, and executives.

Ground truth is taken from canonical fixture text; each case re-formats content with a layout transformer then runs the full import pipeline.

## Accuracy summary

| Dimension | Result | PASS threshold |
|-----------|--------|----------------|
| **Name** | **76%** | > 95% |
| **Contact** | **100%** | > 95% |
| **Experience** | **80%** | > 90% |
| **Education** | **71%** | > 85% |
| **Skills** | **48.6%** | > 85% |
| Tools | 36.6% | (reported) |
| Languages | 88% | (reported) |

## Layout coverage

| Layout | Cases | Name accuracy | Experience accuracy |
|--------|-------|---------------|-------------------|
| canva | 5 | 0% | 80% |
| indesign | 5 | 100% | 76.7% |
| figma | 5 | 80% | 90% |
| word | 5 | 100% | 80% |
| pages | 5 | 80% | 76.7% |
| linkedin | 5 | 60% | 70% |
| europass | 5 | 100% | 80% |
| creative-portfolio | 5 | 100% | 76.7% |
| agency-designer | 3 | 100% | 83.3% |
| developer | 4 | 100% | 75% |
| executive | 3 | 0% | 100% |

## Lowest experience recall (debug)

| ID | Layout | Name | Experience | Education |
|----|--------|------|------------|-----------|
| p5-hell-01-canva | canva | 0% | 0% | 0% |
| p5-hell-16-word | word | 100% | 0% | 0% |
| p5-hell-28-linkedin | linkedin | 0% | 0% | 0% |
| p5-hell-31-europass | europass | 100% | 0% | 0% |
| p5-hell-46-developer | developer | 100% | 0% | 0% |
| p5-hell-10-indesign | indesign | 100% | 33.3% | 100% |
| p5-hell-25-pages | pages | 100% | 33.3% | 100% |
| p5-hell-40-creative-portfolio | creative-portfolio | 100% | 33.3% | 100% |

## Modules

| File | Role |
|------|------|
| `tests/lib/p5-cv-hell-layouts.mjs` | Canva / InDesign / Figma / Word / Pages / LinkedIn / Europass transforms |
| `tests/lib/p5-cv-hell-bench-catalog.mjs` | 50-case catalog |
| `tests/lib/p5-cv-hell-bench-metrics.mjs` | Accuracy aggregation |
| `src/tests/lib/p5-cv-hell-bench-suite.mjs` | Suite runner |

## Run

```bash
npm run qa:cv-hell-benchmark
npm run cv-hell-benchmark-report
```
