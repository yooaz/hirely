# CV Parse Benchmark Report

**Version:** `{{VERSION}}`  
**Generated:** {{GENERATED_AT}}  
**Registry:** `{{REGISTRY_PATH}}`  
**Overall:** {{OVERALL_STATUS}}

## Pass / fail summary

| Fixture | Runner | Status | Time | Contact | Sections | Experience | Education dedup | Skills purity | Unclassified | Portfolio leak |
|---------|--------|--------|-----:|--------:|---------:|-----------:|----------------:|--------------:|-------------:|---------------:|
{{FIXTURE_ROWS}}

**Totals:** {{PASSED_COUNT}} / {{TOTAL_COUNT}} fixtures passed ({{PASS_RATE_PCT}})  
**Average parsing time:** {{AVG_PARSING_TIME_MS}} ms {{AVG_PARSING_TIME_STATUS}}

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

{{REGRESSION_RISKS}}

## Next bottlenecks

{{NEXT_BOTTLENECKS}}

## Per-fixture detail

{{FIXTURE_DETAILS}}

---

*Regenerate: `npm run qa:cv-parse-benchmark && npm run cv-parse-benchmark-report`*
