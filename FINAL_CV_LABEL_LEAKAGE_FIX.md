# HIRELY P0 — Forbid Internal Labels in Final CV

**Result:** PASS
**Generated:** 2026-06-10T20:41:05.038Z
**Guard:** SECTION_LABEL_LEAKAGE_GUARD_V2

## Problem

Parser section headers and internal metadata were leaking into CV body content:

- `clients`, `experiences`, `education`, `summary`, `tools`, `skills`, `languages`, `identity`, `projects`
- OCR/parser metadata (`Market Reviews`, `à classer`, etc.)

These words must **only** appear as template-controlled section titles — never as content lines in preview or PDF.

## Fix

1. **`sanitizeFinalCvLabelsBeforeCommit()`** — final gate in `buildFinalResumeData()` before contract commit.
2. **`stripSectionLabelLeakage()`** — strips standalone labels from experiences, education, skills, tools, languages, clients, projects, summary, identity.
3. **Rejected labels → `metaSafe.debug.sectionLabelLeakage` only** — never rendered.
4. **Template/PDF path** — `normalizeCvDataForTemplate()` now runs `stripSectionLabelLeakageFromCvData()` on `_fromResumeData` / `_fromFinalResumeData` cvData.

## Forbidden content lines (acceptance)

- `clients`
- `client`
- `experiences`
- `experience`
- `education`
- `formation`
- `summary`
- `tools`
- `skills`
- `languages`
- `identity`
- `projects`
- `project`

## Fixture audit

| Fixture | finalResumeData hits | cvData hits | template HTML hits | labels rejected to debug |
| --- | --- | --- | --- | --- |
| creative-cv | — | — | ✓ | 0 |
| yoaz-cv | — | — | ✓ | 0 |
| creative-experience-rich | — | — | ✓ | 0 |
| designer-cv-rich | — | — | ✓ | 0 |

## Verification

```bash
npm run qa:final-cv-label-leakage
npm run test:final-cv-label-leakage
```

## Files

- `src/core/validation/section-label-leakage-guard.js` — `SECTION_LABEL_LEAKAGE_GUARD_V2`, `sanitizeFinalCvLabelsBeforeCommit`
- `src/core/validation/final-resume-contract.js` — pre-commit sanitizer wired
- `src/core/resume-data.js` — template cvData label strip on final/resume path
- `src/core/display/undetected-label.js` — export guard includes `identity`
- `src/tests/qa-final-cv-label-leakage.mjs` — QA gate + template HTML check

