# Quality Validation Report

**Generated:** 2026-06-14
**Engine:** `QUALITY_VALIDATOR_V1`
**QA gate:** PASS

## Mission

Run **automated pre-export checks** before PDF download. Export is **blocked** when any critical issue is detected.

## Checks

| ID | Critical | Label |
|----|----------|-------|
| `name_exists` | yes | Name present |
| `email_exists` | yes | Email present |
| `experience_exists` | yes | Experience present |
| `education_exists` | yes | Education present |
| `dates_valid` | yes | Dates valid |
| `no_overlap` | yes | No date overlap |
| `no_missing_sections` | yes | Required sections complete |
| `photo_valid` | yes | Photo valid (when enabled) |
| `pdf_render_valid` | yes | PDF preview render valid |

## Blocking rules

- **name_exists** — non-empty, non-placeholder name (2–80 chars)
- **email_exists** — valid email format
- **experience_exists** — ≥1 experience line
- **education_exists** — ≥1 education line
- **dates_valid** — each experience has a year/range; no future years; start ≤ end
- **no_overlap** — parsed experience ranges must not overlap
- **no_missing_sections** — name, email, experience, education, skills
- **photo_valid** — when photo enabled: valid data URL, baked crop (zoom=1), V2 safe wrap
- **pdf_render_valid** — live `#cvDoc` metrics: cv--live, non-empty, A4 width, sections visible

## Integration

| Layer | Role |
|-------|------|
| `src/core/validation/quality-validator.js` | Core engine |
| `validateExportLock()` | Merges quality into export lock |
| `downloadPDF()` | Blocks + shows first critical message |
| `isExportReady()` | Disables download when quality fails |

## Fixture results

### strong

- **Export allowed:** yes
- **Score:** 100/100
- **Confidence:** high (100)
- **Critical:** none

### weak

- **Export allowed:** **no**
- **Score:** 44/100
- **Confidence:** blocked (44)
- **Critical:**
  - `name_exists`: Name missing or uncertain
  - `email_exists`: Valid email required before export
  - `experience_exists`: At least one experience entry required
  - `education_exists`: At least one education entry required
  - `no_missing_sections`: Missing: name, email, experience, education, skills

### overlap

- **Export allowed:** **no**
- **Score:** 89/100
- **Confidence:** blocked (55)
- **Critical:**
  - `no_overlap`: Overlapping experience date ranges

## QA

```bash
npm run qa:quality-validator
npm run quality-validation-report
```
