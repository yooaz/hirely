# CV parse benchmark suite

Objective regression metrics for the block-parser pipeline (`detectSectionBlocks`).

## Run

```bash
npm run qa:cv-parse-benchmark
npm run cv-parse-benchmark-report
```

Run a single fixture:

```bash
node src/tests/qa-cv-parse-benchmark.mjs yoaz-pdf-benchmark
```

Outputs:

| Artifact | Path |
|----------|------|
| JSON metrics | `tests/output/cv-parse-benchmark/report.json` |
| Baseline snapshot | `tests/benchmarks/baseline-metrics.json` |
| Markdown report | `CV_PARSE_BENCHMARK_REPORT.md` |
| Template | `tests/benchmarks/CV_PARSE_BENCHMARK_REPORT.template.md` |
| Registry | `tests/benchmarks/cv-parse-benchmark.registry.json` |

## Register a fixture

Add an entry to `cv-parse-benchmark.registry.json`:

- **`spatial_pipeline`** — positioned `linesJson` files (PDF/OCR benchmarks)
- **`text_pipeline`** — `textFixture` only (synthetic single-column layout)

Optional `goldens` paths point at `tests/golden/*.expected.json` for experience segmentation scoring.

Per-fixture `expect` block sets quality thresholds. Registry-level `summary_thresholds.avg_parsing_time_ms_max` caps mean parse duration across all fixtures.

## Metrics

| Metric | Pass direction |
|--------|----------------|
| contact_accuracy | ≥ threshold |
| section_detection_accuracy | ≥ threshold |
| experience_segmentation_accuracy | ≥ threshold |
| education_deduplication_success | ≥ threshold |
| skills_purity | ≥ threshold |
| unclassified_block_rate | ≤ threshold |
| portfolio_leakage_rate | ≤ threshold |
| average_parsing_time | ≤ `summary_thresholds.avg_parsing_time_ms_max` |

## Primary fixture

**`yoaz-pdf-benchmark`** — Yohann Azancot two-page CV (sidebar + portfolio page 2). Uses page coordinate JSON and golden block-parser expectations for experience, education, and skills.
