# CV Completeness Audit (P3)

**Status:** PASS  
**Generated:** 2026-06-11T10:53:40.578Z  
**Coverage target:** 80%+  
**QA checks:** 16/16

## Problem

After parsing, imported **raw text** must appear in **finalResumeData** (preview). Silent loss is unacceptable.

Example:

| Metric | Value |
|--------|-------|
| Raw text | 1500 chars |
| Preview | 700 chars |
| Coverage | **46%** — not acceptable |

## Solution — CV completeness audit

**Module:** `src/core/validation/cv-completeness-audit.js`

| Function | Role |
|----------|------|
| `auditCvCompleteness(rawText, finalResumeData)` | Compare raw vs preview; line + char coverage |
| `flattenFinalResumePreviewText` | Flatten finalResumeData for preview char count |
| `findUnclassifiedLines` | Orphan lines not in structured fields |
| `buildCompletenessReviewItems` | Push orphans into review queue |

**Target:** `CV_COMPLETENESS_TARGET_PCT = 80`

**Below target:**

- French message: **« Une partie du CV n'a pas été classifiée »**
- Review queue opened (`openReviewQueue: true`)
- Unclassified lines → `finalResumeData.suggestions` (to-classify panel)
- Banner in UI (`renderCvIncompleteBanner`)

### Pipeline hook

`buildFinalResumeData` runs the audit after shaping and attaches:

- `quality.completeness` on finalResumeData
- `completenessAudit` on build result
- Merged `reviewItems` for review panel

### UI

- `commitResumeData` passes `rawText` / `cleanText` into builder
- `state.completenessAudit` drives banner + product experience gate
- Review studio shows « Relecture requise » when coverage &lt; 80%

## Acceptance (QA)

| Fixture | Expected |
|---------|----------|
| Sparse finalResumeData vs rich raw | Coverage &lt; 80%, review items queued |
| Rich Yoaz-like resume | Coverage ≥ 80% |
| Char ratio example (1500 → ~700) | ~46% char coverage |

### Latest run

| Case | rawChars | previewChars | coveragePct |
|------|----------|--------------|-------------|
| Sparse | 496 | 75 | 15.1% |
| Rich | — | — | 100% (PASS) |

## Commands

```bash
npm run qa:cv-completeness-audit
npm run cv-completeness-audit-report
```

## Checks

- [x] **target-80** — 80
- [x] **french-message** — Une partie du CV n'a pas été classifiée
- [x] **sparse-raw-chars** — 496
- [x] **sparse-preview-smaller**
- [x] **sparse-below-target** — 15.1%
- [x] **sparse-fails-target**
- [x] **sparse-french-msg**
- [x] **sparse-opens-review**
- [x] **sparse-review-items** — 17
- [x] **sparse-unclassified-lines**
- [x] **char-example-preview-len** — 704
- [x] **char-ratio-example** — 46.9%
- [x] **build-final-resume**
- [x] **rich-meets-target** — 100%
- [x] **rich-passes-target**
- [x] **build-merges-review** — 1
