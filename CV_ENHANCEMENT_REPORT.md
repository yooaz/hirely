# CV Enhancement Report

Generated: 2026-06-14
Engine: `CV_ENHANCEMENT_ENGINE_V2`

## Goal

After extraction, automatically improve CV quality with recruiter-grade wording.
Detect weak descriptions, repetitions, missing action verbs, bad formatting, and missing achievements.
Produce **before/after** versions without inventing information — only rewrite existing content.

## Issue types

- `weak_description` — weak description
- `repetition` — repetition
- `missing_action_verb` — missing action verb
- `bad_formatting` — bad formatting
- `missing_achievement` — missing achievement

## Corpus summary

| Fixture | Issues detected | Issues fixed | Changes | Status |
|---------|-----------------|--------------|---------|--------|
| Developer CV | 2 | 2 | 3 | PASS |
| Creative CV | 2 | 1 | 0 | PASS |
| Marketing CV | 2 | 2 | 2 | PASS |
| Consultant CV | 2 | 2 | 3 | PASS |

**Totals:** 8 issues detected, 7 fixed, 8 before/after changes.

## Fragment example (no invention)

Before:
```
Graphic designer. Posters. Packaging.
```

After:
```
Created posters and packaging and related visual deliverables.
```

## Before / After samples

### Developer CV

**Software Engineer. · Software Engineer. Stripe Present. · 2019–Present** (weak_description)

Before:
```
Served as Software Engineer. at Software Engineer. Stripe Present. (2019–Present).
```

After:
```
Delivered served as software engineer, at software engineer, stripe present, and (2019–present) initiatives.
```

**Software Engineer. · Dropbox · 2015–2019** (weak_description)

Before:
```
Served as Software Engineer. at Dropbox (2015–2019).
```

After:
```
Delivered served as software engineer and at dropbox (2015–2019) initiatives.
```

**Software Engineer. · Stripe · 2019–Present** (weak_description)

Before:
```
Served as Software Engineer. at Stripe (2019–Present).
```

After:
```
Delivered served as software engineer and at stripe (2019–present) initiatives.
```

### Marketing CV

**Digital Marketing Manager. · GrowthLab · 2020–Present** (weak_description)

Before:
```
Served as Digital Marketing Manager. at GrowthLab (2020–Present).
```

After:
```
Delivered work spanning served as digital marketing manager and at growthlab (2020–present).
```

**Marketing Executive. · Unilever · 2016–2020** (weak_description)

Before:
```
Served as Marketing Executive. at Unilever (2016–2020).
```

After:
```
Delivered work spanning served as marketing executive and at unilever (2016–2020).
```

### Consultant CV

**Consultant · Strategy firm. · 2018–Present** (weak_description)

Before:
```
Served as Consultant at Strategy firm. (2018–Present).
```

After:
```
Delivered work spanning (2018–present).
```

**Business Analyst. · Deloitte · 2014–2018** (weak_description)

Before:
```
Served as Business Analyst. at Deloitte (2014–2018).
```

After:
```
Delivered work spanning served as business analyst and at deloitte (2014–2018).
```

**Executive Workshops With 12. · country leadership teams. Business Analyst. · 2014–2018** (weak_description)

Before:
```
Served as Executive Workshops With 12. at country leadership teams. Business Analyst. (2014–2018).
```

After:
```
Served as Executive Workshops With 12. Delivered work spanning at country leadership teams, business analyst, and (2014–2018).
```

## Pipeline integration

- `src/core/parsing/cv-enhancement-engine.js` — detection + enhancement orchestrator
- `src/core/parsing/cv-experience-rewrite.js` — experience description rewrite
- `src/core/parsing/safe-rewrite-validation.js` — blocks invented facts
- `src/core/parsing/resume-output-quality.js` — runs `runCvEnhancementEngine` post-extraction
- `resumeData.meta.cvEnhancement` — before/after snapshots + issue counts

## Run QA

```bash
npm run qa:cv-enhancement
npm run cv:enhancement-report
```