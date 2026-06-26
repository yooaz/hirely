# EDUCATION_QUALITY_REPORT

Generated: 2026-06-08T11:47:38.304Z
Verdict: **PASS**
Checks: **22/22**

## P3 — Education Quality Engine

Produces clean structured education entries:

```json
{ "school": "", "degree": "", "startYear": "", "endYear": "" }
```

### Reject
- Social links (`instagram`, `linkedin`, `behance`, etc.)
- URLs (`http`, `www`)
- Phone numbers
- Emails
- OCR garbage fragments

### Validate
- `startYear <= endYear`
- `endYear <= currentYear + 1`
- Duration `<= 10` years

## Acceptance criteria

- ✓ No corrupted education entries in batch
- ✓ normalizeCvData keeps only clean education
- ✓ Contact leaks stripped from valid rows
- ✓ Structured school/degree/startYear/endYear metadata
- ✓ Impossible future dates rejected

## Module

- `src/core/parsing/education-quality-engine.js`
- Wired into `normalizeAllEducation()` and `normalizeCvData()`

## Run

```bash
npm run qa:education-quality-engine
npm run education-quality-report
npm run qa:education-normalization
```