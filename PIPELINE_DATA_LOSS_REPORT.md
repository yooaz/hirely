# HIRELY P0 — Full Data Pipeline Audit

**Result:** PASS
**Generated:** 2026-06-10T16:09:42.844Z

## Problem

Data is detected and the review queue holds items, but the final CV preview looks 30–40% complete and templates can appear empty.

## Pipeline audited

```
RAW_TEXT
  ↓
OCR (cleanedText)
  ↓
PARSER (structuredResume)
  ↓
NORMALIZATION (resumeData)
  ↓
REVIEW_QUEUE
  ↓
FINAL_RESUME_DATA
  ↓
TEMPLATE_RENDERER
  ↓
PDF_EXPORT
```

Per field: **DETECTED** · **NORMALIZED** · **REVIEWED** · **COMMITTED** · **RENDERED** · **EXPORTED**

Fields: `name` `title` `summary` `experience` `education` `skills` `tools` `languages` `clients` `projects` `awards` `portfolio` `linkedin`

## Executive summary

| Fixture | Template lock | Field coverage | Review queue | Loss events |
|---------|---------------|----------------|--------------|-------------|
| mvp-sample | 100% | 100% | 5 | 2 |
| review-rich | 100% | 100% | 8 | 8 |

**Primary loss stage:** `NORMALIZED → COMMITTED` via semantic confidence gate — uncertain lines move to review queue instead of `finalResumeData`.
**Recovery path:** Pending items render under **À vérifier** (`cvSection--pendingReview`) so preview is not blank.

## Fixture: mvp-sample

Template lock: **100%** · Field coverage: **100%** · Template: `portfolio-artist` · Review queue: 5

| Field | DETECTED | NORMALIZED | REVIEWED | COMMITTED | RENDERED | EXPORTED |
|-------|----------|------------|----------|-----------|----------|----------|
| name | 1 | 1 | 0 | 1 | 1 | 1 |
| title | 1 | 1 | 0 | 1 | 1 | 1 |
| experience | 2 | 3 | 3 | 3 | 6 | 6 |
| education | 1 | 1 | 0 | 1 | 1 | 1 |
| skills | 1 | 3 | 1 | 6 | 7 | 7 |
| tools | 0 | 3 | 1 | 1 | 2 | 2 |

### Intermediate stages

| Field | OCR (text) | PARSER (structured) |
|-------|------------|---------------------|
| name | 1 | 1 |
| title | 1 | 1 |
| experience | 2 | 3 |
| education | 1 | 1 |
| skills | 1 | 0 |
| tools | 0 | 1 |

### Where fields were lost

- **tools** — 2 item(s): Normalization → finalResumeData (semantic gate / cleanup) (`NORMALIZED` → `COMMITTED`)
- **tools** — 1 item(s): Semantic confidence gate / pending review (`REVIEW_QUEUE` → `COMMITTED`)
## Fixture: review-rich

Template lock: **100%** · Field coverage: **100%** · Template: `portfolio-artist` · Review queue: 8

| Field | DETECTED | NORMALIZED | REVIEWED | COMMITTED | RENDERED | EXPORTED |
|-------|----------|------------|----------|-----------|----------|----------|
| name | 1 | 1 | 0 | 1 | 1 | 1 |
| title | 1 | 1 | 0 | 1 | 1 | 1 |
| summary | 0 | 1 | 1 | 0 | 1 | 1 |
| experience | 2 | 5 | 5 | 4 | 9 | 9 |
| education | 1 | 1 | 0 | 1 | 1 | 1 |
| skills | 1 | 9 | 1 | 6 | 7 | 7 |
| tools | 1 | 3 | 1 | 1 | 2 | 2 |
| languages | 1 | 2 | 0 | 2 | 2 | 2 |

### Intermediate stages

| Field | OCR (text) | PARSER (structured) |
|-------|------------|---------------------|
| name | 1 | 1 |
| title | 1 | 1 |
| summary | 0 | 1 |
| experience | 2 | 5 |
| education | 1 | 2 |
| skills | 1 | 3 |
| tools | 1 | 0 |
| languages | 1 | 2 |

### Where fields were lost

- **summary** — 1 item(s): Normalization → finalResumeData (semantic gate / cleanup) (`NORMALIZED` → `COMMITTED`)
- **summary** — 1 item(s): Semantic confidence gate / pending review (`REVIEW_QUEUE` → `COMMITTED`)
- **experience** — 1 item(s): Normalization → finalResumeData (semantic gate / cleanup) (`NORMALIZED` → `COMMITTED`)
- **experience** — 5 item(s): Semantic confidence gate / pending review (`REVIEW_QUEUE` → `COMMITTED`)
- **skills** — 3 item(s): Normalization → finalResumeData (semantic gate / cleanup) (`NORMALIZED` → `COMMITTED`)
- **skills** — 1 item(s): Semantic confidence gate / pending review (`REVIEW_QUEUE` → `COMMITTED`)
- **tools** — 2 item(s): Normalization → finalResumeData (semantic gate / cleanup) (`NORMALIZED` → `COMMITTED`)
- **tools** — 1 item(s): Semantic confidence gate / pending review (`REVIEW_QUEUE` → `COMMITTED`)
## Root loss patterns (code)

| Stage transition | Typical cause | File |
|------------------|---------------|------|
| PARSER → NORMALIZATION | Section mapping / experience builder | `src/core/resume-data.js` |
| NORMALIZATION → COMMITTED | Semantic confidence gate removes uncertain lines | `src/core/validation/semantic-confidence-gate.js` |
| NORMALIZATION → COMMITTED | School-only education dropped in readability pass | `src/core/validation/final-cv-readability.js` |
| COMMITTED → RENDERED | Production template hid pending / unsorted sections | `src/ui/templates/cv-templates.js` |
| COMMITTED → RENDERED | `_pendingReview` stripped in `normalizeProfile` | `src/ui/templates/cv-templates.js` |
| RENDERED → EXPORTED | PDF uses same `#cvDoc` HTML — loss should be **0** if render is complete | `src/core/export/pdf-export-config.js` |

## Rules

- Detected data must never silently vanish.
- Review-queue items surface as **À vérifier** in production preview.
- `finalResumeData` content must render in templates.
- EXPORTED mirrors RENDERED (print/PDF of same DOM).

## Acceptance

**PASS** — Pipeline audit complete; field loss documented per stage with render completeness ≥ 70% on fixtures.

## Run

```bash
npm run test:pipeline-data-loss
```
