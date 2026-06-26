# CV Parse Benchmark Report

**Version:** `CV_PARSE_BENCHMARK_V2`  
**Generated:** 2026-06-16T19:04:57.017Z  
**Registry:** `tests/benchmarks/cv-parse-benchmark.registry.json`  
**Overall:** **PASS**

## Pass / fail summary

| Fixture | Runner | Status | Time | Contact | Sections | Experience | Education dedup | Skills purity | Unclassified | Portfolio leak |
|---------|--------|--------|-----:|--------:|---------:|-----------:|----------------:|--------------:|-------------:|---------------:|
| Yohann Azancot PDF — sidebar layout + portfolio page 2 | spatial_pipeline | PASS | 3117ms | 100% ✓ | 100% ✓ | 100% ✓ | 100% ✓ | 100% ✓ | 6.9% ✓ | 0% ✓ |
| Developer corporate CV (text-only) | text_pipeline | PASS | 685ms | 100% ✓ | 100% ✓ | 100% ✓ | 100% ✓ | 100% ✓ | 13.3% ✓ | 0% ✓ |
| Student CV (text-only, internship) | text_pipeline | PASS | 280ms | 100% ✓ | 100% ✓ | 100% ✓ | 100% ✓ | 100% ✓ | 13.3% ✓ | 0% ✓ |

**Totals:** 3 / 3 fixtures passed (100%)  
**Average parsing time:** 1361 ms (≤ 20000ms ✓)

## Metric definitions

| Metric | Direction | Meaning |
|--------|-----------|---------|
| contact_accuracy | higher | Name, email, phone, address checks vs fixture expectations |
| section_detection_accuracy | higher | Expected CV headings detected in segmentation |
| experience_segmentation_accuracy | higher | Golden role/company/date match or minimum count |
| education_deduplication_success | higher | Count in range + no duplicate school/degree/date keys |
| skills_purity | higher | Share of skills not flagged as pollution/portfolio bleed |
| unclassified_block_rate | lower | Content segments left as `OTHER` / unassigned |
| portfolio_leakage_rate | lower | Portfolio captions appearing in experience/education/skills |
| average_parsing_time | lower | Mean wall-clock ms per fixture (`detectSectionBlocks` end-to-end) |

## Regression risks

- **yoaz-pdf-benchmark** — `education_deduplication_success` near threshold (1 vs min 1)
- **yoaz-pdf-benchmark** — `skills_purity` near threshold (1 vs min 1)
- **developer-cv** — `education_deduplication_success` near threshold (1 vs min 1)
- **developer-cv** — `skills_purity` near threshold (1 vs min 0.9)

## Next bottlenecks

1. **yoaz-pdf-benchmark** / `education_deduplication_success` — headroom 0 (value 1, threshold 1)
2. **yoaz-pdf-benchmark** / `skills_purity` — headroom 0 (value 1, threshold 1)
3. **yoaz-pdf-benchmark** / `portfolio_leakage_rate` — headroom 0 (value 0, threshold 0)
4. **developer-cv** / `education_deduplication_success` — headroom 0 (value 1, threshold 1)
5. **developer-cv** / `portfolio_leakage_rate` — headroom 0 (value 0, threshold 0)
6. **student-cv** / `portfolio_leakage_rate` — headroom 0 (value 0, threshold 0)
7. **developer-cv** / `skills_purity` — headroom 0.1 (value 1, threshold 0.9)
8. **student-cv** / `skills_purity` — headroom 0.15 (value 1, threshold 0.85)

## Per-fixture detail

### Yohann Azancot PDF — sidebar layout + portfolio page 2 (`yoaz-pdf-benchmark`)

- Status: **PASS**
- Parsing time: 3117ms
- Counts: experience 3, education 4, skills 6
- Parse confidence: 0.812 | Review hints: 2
- Production ready: no | Validation issues: 1

- Portfolio pages excluded: 2 (5 items)
**Failures / gaps:**
- All metrics within thresholds

### Developer corporate CV (text-only) (`developer-cv`)

- Status: **PASS**
- Parsing time: 685ms
- Counts: experience 2, education 1, skills 1
- Parse confidence: 0.831 | Review hints: 1
- Production ready: no | Validation issues: 1

**Failures / gaps:**
- All metrics within thresholds

### Student CV (text-only, internship) (`student-cv`)

- Status: **PASS**
- Parsing time: 280ms
- Counts: experience 2, education 2, skills 1
- Parse confidence: 0.801 | Review hints: 1
- Production ready: no | Validation issues: 1

**Failures / gaps:**
- All metrics within thresholds


---

*Regenerate: `npm run qa:cv-parse-benchmark && npm run cv-parse-benchmark-report`*
