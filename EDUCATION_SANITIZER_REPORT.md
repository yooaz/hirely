# Education Sanitizer — QA Report

**Result:** PASS

**Generated:** 2026-06-08T15:50:45.097Z

## Scope

P1 education sanitizer: reject contaminated education rows and require school or degree.

## Problem

Instagram URLs, emails, phone numbers, and client lists were appearing inside education.

## Rules

Reject education rows containing:

- `@`
- `http`
- `www`
- `instagram`
- `linkedin`
- email addresses
- phone numbers
- client brand lists

Rejected rows are moved to `rejectedLines`.

Education requires **school OR degree**.

## Acceptance

| Check | Status |
|-------|--------|
| Instagram never appears in education | PASS |
| Contaminated rows → rejectedLines | PASS |
| Valid school/degree rows kept | PASS |

## Implementation

- `src/core/parsing/education-sanitizer.js` — `EDUCATION_SANITIZER`
- `sanitizeEducationRows()` — pre-filter before quality engine
- Wired into `applyEducationQuality()` and `normalizeCvData()`

## QA command

```bash
npm run qa:education-sanitizer
```

## Console output

```
OK instagram URL forbidden
OK instagram word forbidden
OK linkedin forbidden
OK @ symbol forbidden
OK http forbidden
OK www forbidden
OK phone forbidden
OK client list forbidden
OK school row accepted
OK degree row accepted
OK noise without school/degree rejected
OK sanitizer engine id
OK keeps valid rows (2)
OK rejects contaminated rows (5)
OK instagram row in rejectedLines
OK accepted education has no forbidden tokens
OK quality engine keeps two education entries (2)
OK quality rejectedLines populated (5)
OK Instagram never appears in education output
OK cvData education count (2)
OK cvData rejectedLines (5)
OK cvData education has no instagram
OK normalizeCvData education (2)
OK normalizeCvData strips forbidden education rows

EDUCATION_SANITIZER QA PASS
```
