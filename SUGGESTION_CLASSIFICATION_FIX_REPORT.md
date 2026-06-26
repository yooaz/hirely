# HIRELY P1 — Suggestion Classification Fix

**Result:** PASS
**Generated:** 2026-06-10T13:22:15.266Z

## Problem

Review suggestions misclassified employment and discipline lines:

| Line | Was | Should be |
|------|-----|-----------|
| Independent / Freelance | Compétences | Expérience |
| Company à confirmer | Compétences | Expérience (review) |
| Marketing | Identité | Compétence (unless full title) |
| Visual communication | Mixed | Formation or Compétence by context |

## Rules

- Employment / freelance lines never surface as **skill**.
- `Company à confirmer` → experience, confidence &lt; 80 → **À valider** (no auto-place).
- Standalone `Marketing` → skill, not identity title.
- `Visual communication` alone → skill @ 72% (review); with school → education.
- Confidence &lt; 80 → category `unknown`, `needsReview: true`.

## Implementation

| Module | Role |
|--------|------|
| `src/core/parsing/suggestion-classification-fix.js` | P1 rules + `resolveSuggestionCategory()` |
| `src/core/parsing/classification-engine-v2.js` | `scoreEmploymentStrict`, removed bare `identity` skill marker |
| `src/core/parsing/semantic-classifier-v2.js` | Block standalone disciplines from `JOB_TITLE` |
| `src/core/parsing/review-queue-categories.js` | Employment lines: experience/client only |
| `index.html` | Suggestion panel uses `resolveSuggestionCategory` |

## QA

```bash
npm run test:suggestion-classification-fix
```

## Case results

| Line | V2 type | Predicted | Category shown |
|------|---------|-----------|----------------|
| Independent / Freelance | experience | experience | experience |
| Company à confirmer | unknown | experience | unknown |
| Marketing | — | skill | skill |
| Marketing Coordinator | — | unknown | unknown |
| Visual communication | education | skill | unknown |
| Créapole — Master Visual Communication | education | education | education |
| Freelance — Nike, Apple — 2012–2018 | experience | experience | experience |

## Acceptance

- [x] No company/freelance line suggested as skill
- [x] P1 QA suite
- [ ] Classification engine v2 regression (informational)
