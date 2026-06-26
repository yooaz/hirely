# CV parse confidence, validation & review hints

## Purpose

Never silently output low-quality structured data. Scores attach at global, section, item, and field levels; validation catches structural issues; review hints are actionable for the UI.

## Modules

| Module | Export | Version |
|--------|--------|---------|
| `cv-parse-confidence.js` | `scoreCvParseBundle`, `applyValidationConfidenceAdjustments` | `CV_PARSE_CONFIDENCE_V2` |
| `cv-parse-validation.js` | `validateCvParseBundle` | `CV_PARSE_VALIDATION_V2` |
| `cv-review-hints.js` | `generateCvReviewHints`, `buildCvParseResponsePayload` | `CV_REVIEW_HINTS_V2` |

Wired in `section-detect-v2.js` → `parseConfidence`, `parseValidation`, `reviewHints`, `parseResponse`.

## Scores

| Level | Examples |
|-------|----------|
| Global | Weighted average of populated sections minus validation penalty |
| Section | `contact`, `summary`, `experience`, `education`, `skills`, `page_classification` |
| Item | Per experience / education / skill row |
| Field | `contact.email`, `experience.*.start_date`, etc. |

## Validation (`validateCvParseBundle`)

| Code | Severity | Example message |
|------|----------|-----------------|
| `invalid_dates` | error | Experience/education has invalid dates |
| `duplicate_education_entry` | warning | This education entry may be duplicated |
| `duplicate_experience_entry` | warning | This experience entry may be duplicated |
| `polluted_skill` | error | Nike / portfolio text in skills |
| `empty_critical_field` | error/warning | Missing email, company, school |
| `page_leakage_suspected` | error | Content from excluded portfolio page |
| `weak_date_confidence` | warning | This experience has weak date confidence |
| `unclassified_block` | warning | This block could not be classified safely |

`production_ready` is true only when no errors and no warnings.

## Thresholds (`LOW_CONFIDENCE_THRESHOLDS`)

- global: 0.55
- section: 0.60
- item: 0.55
- field: 0.65

## Hint types

- `portfolio_page_excluded` — page classified as portfolio, excluded from resume parsers
- `duplicate_education_entry` / `duplicate_experience_entry`
- `weak_date_confidence` / `missing_dates`
- `polluted_skill` / `page_leakage_suspected`
- `unclassified_block` / `ambiguous_school`

## Quality gate (`parseResponse.quality_gate`)

```javascript
{
  needs_review,
  suppress_silent_low_quality,
  validation_errors,
  validation_warnings,
  production_ready
}
```

## Sample payload

`tests/output/parse-confidence-yoaz/sample-parse-response.json` — `npm run qa:parse-confidence-yoaz`
