# ATS Scoring Audit — P2 Real ATS Score

**Result:** PASS

**Generated:** 2026-06-08T16:13:25.733Z

## Requirement

Score must depend on real CV data — not placeholders, not static defaults.

### Core dimensions (required signals)

- Identity (max 15)
- Experience (max 30)
- Education (max 10)
- Skills (max 15)
- Languages (max 10)

### Rules

- No placeholder identity (`Nom à compléter`, `John Doe`, `Your Name`, `—`, etc.)
- No static score — different profiles produce different totals
- Breakdown points sum to total (max 100)

## Canonical pipeline

```
cvData / resumeData
  → resolveChecklistProfile()
  → computeProductScore()
  → computeRecruiterScoreV2()  [REAL ATS]
  → computeAtsScore() / analyzeAts()
```

**Engine:** `src/core/validation/recruiter-score-v2.js` (`HIRELY_RECRUITER_SCORE_V2`)

## Sample scores

| Profile | Total | Band |
|---------|-------|------|
| Full sample CV | 69 | Good |
| Empty CV | 0 | Needs improvement |

## Full breakdown (sample)

| Category | Points | Max |
|----------|--------|-----|
| Identity | 15 | 15 |
| Contact | 6 | 10 |
| Experience | 20 | 30 |
| Education | 8 | 10 |
| Skills | 10 | 15 |
| Tools | 0 | 10 |
| Languages | 10 | 10 |

## Core dimension audit

| Dimension | Points | Max | Status |
|-----------|--------|-----|--------|
| Identity | 15 | 15 | PASS |
| Experience | 20 | 30 | PASS |
| Education | 8 | 10 | PASS |
| Skills | 10 | 15 | PASS |
| Languages | 10 | 10 | PASS |

## Acceptance

| Check | Status |
|-------|--------|
| Identity affects score | PASS |
| Experience affects score | PASS |
| Education affects score | PASS |
| Skills affect score | PASS |
| Languages affect score | PASS |
| Placeholders rejected | PASS |
| Not static (varies by data) | PASS |

## Legacy paths (not canonical)

| Path | Issue |
|------|-------|
| `index.html` `computeRecruiterScores()` | DEBUG-only; clamps 35–92 |
| `index.html` `computeProductScoreInline()` | Fallback if module import fails |

Production UI uses `computeProductScoreReport()` → `computeProductScore()` when module loads.

## QA command

```bash
npm run qa:ats-scoring-audit
npm run qa:ats-pipeline
```

## Console output

```
OK five core ATS dimensions defined
OK core dimension in categories (identity)
OK core dimension in categories (experience)
OK core dimension in categories (education)
OK core dimension in categories (skills)
OK core dimension in categories (languages)
OK full CV produces score
OK full CV total in range (84)
OK breakdown sums to total
OK identity contributes (15)
OK experience contributes (30)
OK education contributes (8)
OK skills contributes (10)
OK languages contributes (10)
OK empty scores lower than full (0 < 84)
OK empty CV below Good threshold (0)
OK placeholder name rejected
OK placeholder title rejected
OK placeholders lower score (69 < 84)
OK generic placeholders do not inflate score
OK removing experience lowers score (54 < 84)
OK experience points drop when section removed
OK removing education lowers score (76 < 84)
OK education points drop when section removed
OK removing skills lowers score (69 < 84)
OK skills points drop when section removed
OK removing languages lowers score (74 < 84)
OK languages points drop when section removed
OK removing identity lowers score (69 < 84)
OK identity points drop when name/title removed
OK more skills never lowers score
OK skills points scale with data
OK product score reads experience from resumeData
OK product score reads education from resumeData
OK product score reads skills from resumeData
OK product score reads languages from resumeData
OK resumeData-backed score above empty (55)
OK deterministic for same input
OK different data yields different score (not static)
OK category weights sum to 100 (100)

ATS_SCORING_AUDIT QA PASS
```
