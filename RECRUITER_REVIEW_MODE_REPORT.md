# HIRELY H12 — Recruiter Review Mode

**Result:** PASS
**Generated:** 2026-06-08T21:57:25.561Z

## Principle

When classification confidence is low or ambiguous, Hirely **never auto-places** content in CV sections.
Instead, recruiter review cards show multiple hypotheses and the user chooses.

## Card actions

| Action | Behavior |
|--------|----------|
| **Accept** | Place using the top detected category |
| **Move** | Place in the section selected in the picker |
| **Edit** | Edit text, then place |
| **Ignore** | Exclude from CV |

## Example — ambiguous line

```
visual communication

Detected as:
- Skill 55%
- Education 42%
```

User must choose before the line appears in skills or education.

## Module

- `src/core/parsing/recruiter-review-mode.js`
- `src/core/parsing/semantic-classifier-v2.js` (multi-hypothesis alternatives)
- Review UI: suggestions panel + verify review cards (`index.html`)

## Regression — visual communication

- Line: `visual communication`
- Needs review: **yes**
- SKILL: 55%
- EDUCATION: 42%
- Auto-corruption blocked: **yes**

## P7 stress — low-confidence CV integrity

**20/20** CVs with zero pending review leakage into section arrays (100%)

| Fixture | Status | Pending | Issues |
|---------|--------|---------|--------|
| creative-cv | PASS | 0 | 0 |
| yoaz-cv | PASS | 14 | 0 |
| image-cv | PASS | 7 | 0 |
| mvp-sample | PASS | 1 | 0 |
| developer-cv | PASS | 3 | 0 |
| developer-cv-ocr | PASS | 1 | 0 |
| marketing-cv | PASS | 3 | 0 |
| marketing-cv-ocr | PASS | 1 | 0 |
| sales-cv | PASS | 3 | 0 |
| student-cv | PASS | 5 | 0 |
| executive-cv | PASS | 4 | 0 |
| academic-cv | PASS | 4 | 0 |
| recruiter-cv | PASS | 3 | 0 |
| consultant-cv | PASS | 2 | 0 |
| two-column-cv | PASS | 2 | 0 |
| text-pdf | PASS | 1 | 0 |
| scanned-pdf | PASS | 0 | 0 |
| docx | PASS | 1 | 0 |
| sales-cv-ocr | PASS | 2 | 0 |
| executive-cv-ocr | PASS | 2 | 0 |

## Gates

| Gate | Status |
|------|--------|
| qa-recruiter-review-mode | PASS |
| qa-semantic-classifier-v2 (H11 lock) | PASS |
