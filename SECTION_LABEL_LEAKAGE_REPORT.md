# HIRELY P0 — Remove Section Label Leakage

**Result:** PASS
**Generated:** 2026-06-10T18:30:51.648Z

## Problem

Parser section headers were leaking into CV body content as list items or paragraphs:
- `experiences`
- `clients`
- `summary`
- `tools`
- `Market Reviews` (OCR/parser metadata)

## Rules (locked)

Forbidden as **content lines** (section titles only):
`experiences`, `experience`, `clients`, `client`, `summary`, `tools`, `skills`, `education`, `formation`, `languages`, `projects`

## Root causes fixed

| Layer | Issue | Fix |
|-------|-------|-----|
| `section-label-leakage-guard.js` | — | New P0 guard: exact-match label detection + strip |
| `final-resume-data-cleanup.js` | Labels survived readability pass | `stripSectionLabelLeakage` before finalResumeData commit |
| `data-sanitization-layer.js` | Template/PDF cvData path unguarded | `stripSectionLabelLeakageFromCvData` on flat cvData |
| `undetected-label.js` | Export audit missed bare section words | Extended `FABRICATED_EXPORT_PATTERNS` |

## Audited modules

- Final builder — `buildFinalResumeData` → `applyFinalResumeDataCleanup`
- Display sanitize — `sanitize-resume-display.js`
- Template/PDF — `resumeDataToCvData` → `applyDataSanitizationLayer`
- Header cleaner — identity fields (existing) + body guard (new)

## Fixture results

| Fixture | Skills | Clients | Label hits | Clean |
|---------|-------:|--------:|------------|:-----:|
| creative-cv | 6 | 7 | — | ✓ |
| yoaz-cv | 6 | 7 | — | ✓ |
| creative-experience-rich | 2 | 6 | — | ✓ |
| designer-cv-rich | 2 | 4 | — | ✓ |

## Acceptance

**PASS** — No raw section labels in CV content. No parser metadata in preview or PDF path.

## Run

```bash
npm run test:section-label-leakage
```
