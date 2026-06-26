# Import Quality Score Report

**Generated:** 2026-06-08T16:41:50.017Z
**Engine:** IMPORT_QUALITY_SCORE_V1
**Result:** PASS

## Problem

A single opaque CV score (e.g. 79/100) hid whether extraction, parsing, or completeness drove the result.

## Metrics (real signals, not static)

| Metric | Source signals |
|--------|----------------|
| **Extraction Quality** | `assessImportQuality`, retention %, extraction stage score, readable/corrupt line ratios |
| **Parser Quality** | `assessFieldCompleteness` utilization %, section confidence, review queue, parser-fail flags |
| **CV Completeness** | `structuredCompleteness`, field checks, recruiter checklist coverage |

## Sample (mvp-sample fixture)

| Metric | Score |
|--------|-------|
| Extraction | 89% |
| Parser | 40% |
| CV Completeness | 80% |
| Weighted overall | 70% |
| Recruiter score (separate) | 51/100 |

## Display

After import, metrics panel shows:

```
Extraction 89%
Parser 40%
Completeness 80%
```

## Pipeline hooks

- `src/core/validation/import-quality-score.js` — compute + breakdown
- `src/core/pipeline/production-pipeline.js` — `audit.importQualityScore`
- `index.html` — metrics panel via `buildImportQualityMetricRows`

## QA

```bash
npm run qa:import-quality-score
npm run import-quality-score-report
```

