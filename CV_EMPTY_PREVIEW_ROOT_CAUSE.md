# HIRELY P0 — CV Empty Preview Root Cause

**Result:** PASS
**Generated:** 2026-06-10T15:59:06.317Z

## Problem

Extraction detects data and the review queue holds items, but the template preview can look empty — a release blocker.

## Pipeline audited

`reviewQueue` → `finalResumeData` → `template renderer`

Per section: **DETECTED_DATA_COUNT** · **FINAL_DATA_COUNT** · **RENDERED_DATA_COUNT**

## Root causes found

### RC1 — finalResumeData

**Issue:** School-only education lines (e.g. LISAA) were dropped by `polishEducation` when no degree marker was present — even when `EDUCATION_SIGNAL_RE` matched.

**Fix:** Keep school-only lines when `EDUCATION_SIGNAL_RE` matches known schools/programs.

**File:** `src/core/validation/final-cv-readability.js`

### RC2 — templateRenderer

**Issue:** Production templates hid `classificationPendingSection` / `unsortedSection` — gated review-queue data never appeared in preview.

**Fix:** Added `pendingReviewSection` (À vérifier) in production stacks; wired from `getPendingReviewQueue()` in `renderCVInner`.

**File:** `src/ui/templates/cv-templates.js`

### RC3 — templateRenderer

**Issue:** Object-shaped `experience` entries were stringified to `[object Object]` and filtered out when `experiences` plural was absent.

**Fix:** Recover structured experience from `src.experience` objects via `experiencesFromStructured`.

**File:** `src/ui/templates/cv-templates.js`

### RC4 — finalResumeData

**Issue:** Education objects became `[object Object]` strings in cvData mapping.

**Fix:** Format education objects as `degree — school — dates` lines.

**File:** `src/core/parsing/simple-cv-mapper.js`

## Fixture: mvp-sample

Preview density: **139%** (target ≥ 80%) · Template: `editorial` · HTML: 2931 chars

| Section | DETECTED | FINAL | RENDERED | Loss (final) | Loss (render) |
|---------|----------|-------|----------|--------------|---------------|
| identity | 4 | 4 | 4 | 0 | 0 |
| experiences | 6 | 3 | 6 | 3 | 0 |
| education | 1 | 1 | 1 | 0 | 0 |
| skills | 4 | 6 | 7 | 0 | 0 |
| tools | 3 | 1 | 2 | 2 | 0 |

**Where data disappeared:**

- `experiences` — 3 item(s) at **finalResumeData**
- `tools` — 2 item(s) at **finalResumeData**

Pending review in queue: 5 · Rendered pending block: 5

## Fixture: review-rich

Preview density: **97%** (target ≥ 80%) · Template: `editorial` · HTML: 3639 chars

| Section | DETECTED | FINAL | RENDERED | Loss (final) | Loss (render) |
|---------|----------|-------|----------|--------------|---------------|
| identity | 4 | 4 | 4 | 0 | 0 |
| summary | 2 | 0 | 1 | 2 | 0 |
| experiences | 8 | 4 | 7 | 4 | 0 |
| education | 1 | 1 | 1 | 0 | 0 |
| skills | 11 | 6 | 7 | 5 | 0 |
| tools | 3 | 1 | 2 | 2 | 0 |
| languages | 2 | 2 | 2 | 0 | 0 |

**Where data disappeared:**

- `summary` — 2 item(s) at **finalResumeData**
- `experiences` — 4 item(s) at **finalResumeData**
- `skills` — 5 item(s) at **finalResumeData**
- `tools` — 2 item(s) at **finalResumeData**

Pending review in queue: 6 · Rendered pending block: 6

## Rules enforced

- Detected data must never silently vanish.
- Review-queue data shows as **À vérifier** pending in production preview.
- `finalResumeData` content renders in templates.
- No empty pages / giant white areas when data exists.

## Acceptance

**PASS** — Preview density ≥ 80% of detected CV content on audited fixtures.

## Run

```bash
npm run test:cv-empty-preview-root-cause
```
