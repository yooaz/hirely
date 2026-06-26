# Data Sanitization Layer — QA Report

**Result:** PASS

**Generated:** 2026-06-08T16:11:35.748Z

## Purpose

Final sanitation pass before template rendering.

## Rules

### Forbidden in header

- EDUCATION
- FORMATION
- COMPETENCES
- LANGUES
- CLIENTS

### Forbidden in education

- instagram
- linkedin
- http
- www
- @

### Dates

- Future dates beyond **2026** are forbidden

## Acceptance

| Check | Status |
|-------|--------|
| Header free of section titles | PASS |
| Education free of social/contact URLs | PASS |
| No future dates > 2026 | PASS |
| Wired before template render | PASS |

## Implementation

- `src/core/validation/data-sanitization-layer.js` — `DATA_SANITIZATION_LAYER`
- `applyDataSanitizationLayer()` — header cleaner + education sanitizer + date normalizer
- Wired into `resumeDataToCvData()` and `normalizeCvData()`

## QA command

```bash
npm run qa:data-sanitization
```

## Console output

```
OK engine marker set
OK header has no forbidden section words (Jane Doe | Illustrator | jane@example.com | +33 6 12 34 56 78 | Paris)
OK email cleaned (jane@example.com)
OK title preserved (Illustrator)
OK education has no instagram/linkedin/http/www/@
OK valid education kept (1)
OK education has no future years beyond 2026
OK detects forbidden future experience
OK experience has no forbidden future dates
OK valid experience kept
OK audit header clean
OK audit education clean
OK audit no future dates
OK normalizeCvData header clean
OK normalizeCvData education clean
OK resumeDataToCvData header clean
OK resumeDataToCvData education clean
OK resumeDataToCvData runs sanitization layer

DATA_SANITIZATION QA PASS
```
