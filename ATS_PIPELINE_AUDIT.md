# ATS Pipeline Audit

**Date:** 2026-06-03  
**Status:** Recovered — data-driven ATS score restored with weighted breakdown

## Symptom

ATS score disappeared or showed inconsistent values in the studio UI and recruiter review panel.

## Pipeline map

```
Import / edit
    ↓
cvData (structured)
    ↓
┌─────────────────────────────────────────────────────────────┐
│  ats-engine.js        computeAtsScore() — canonical scorer  │
│       ↑                                                     │
│  ats-analyzer.js      analyzeAts() — pipeline wrapper      │
│       ↑                                                     │
│  product-score.js       computeProductScore() — UI export   │
│       ↑                                                     │
│  recruiter-review.js  buildRecruiterReview() — fixes list   │
│       ↑                                                     │
│  recruiter-audit.js   runRecruiterAudit() — score + fixes   │
└─────────────────────────────────────────────────────────────┘
    ↓
index.html
  computeProductScoreReport() → renderScorePanel()
  renderRecruiterReview() → #recruiterAtsScore
    ↓
production-pipeline.js
  score field now uses computeProductScore (not legacy scoreCV)
```

## Root causes

### 1. No dedicated ATS engine

There were no modules named `ats-engine`, `ats-analyzer`, or `recruiter-audit`. Scoring lived in `product-score.js` as a **checklist percentage** (6 boolean checks → 0–100%), not a weighted ATS model.

### 2. Split score semantics

| Surface | Before | Problem |
|---------|--------|---------|
| `#studioScore` | `report.total` (avg of 4 checklist %) | OK but weak signal |
| `#recruiterAtsScore` | `score.ats.score` (checklist % only) | **Not the same as total** — looked like ATS “disappeared” when switching modes |
| `state.score` (pipeline) | `scoreCV()` additive heuristic | Fake-ish, not tied to UI breakdown |

### 3. Missing breakdown

UI showed 4 percentage bars (ATS, Readability, Completeness, Recruiter readiness) with no **points/max** breakdown (e.g. Experience 24/30).

### 4. Band label mismatch

Product score used **Strong** (≥55). Requirement: **Excellent / Good / Needs improvement**.

## Fix

### New modules

| File | Role |
|------|------|
| `src/core/validation/ats-engine.js` | Weighted 0–100 scorer from cvData signals |
| `src/core/validation/ats-analyzer.js` | Pipeline entry + metadata |
| `src/core/validation/recruiter-audit.js` | ATS + recruiter fixes bundle |

### Scoring model (data-driven, max 100)

| Category | Max | Signals |
|----------|-----|---------|
| Completeness | 15 | title, education, summary, experience section |
| Contact | 10 | name, email, phone |
| Experience | 30 | entries, action verbs, metrics, line length |
| Skills | 20 | skill/tool count and density |
| Formatting | 15 | text volume, OCR artifacts, identity header |
| Recruiter readability | 10 | header hierarchy, summary length, scannable skills, export-ready contact |

**Total** = sum of category points (never fabricated).

### Bands

| Score | Label |
|-------|-------|
| ≥ 80 | Excellent |
| ≥ 55 | Good |
| < 55 | Needs improvement |

### UI

- `#studioScore` — 0–100 total from `computeAtsScore`
- `#studioMetrics` — 6-row breakdown (`Experience 24/30` format)
- `#studioAtsChecklist` — 6 checklist items (unchanged)
- `#recruiterAtsScore` — same total as studio ring (fixed)

### Pipeline

`production-pipeline.js` now emits `score.overall = computeProductScore(cvData).total` with `breakdown` attached.

## Verification

```bash
npm run qa:ats-pipeline      # unit tests — engine, analyzer, audit
npm run qa:product-recovery  # browser — studio score + 6-row breakdown
```

### Expected UI

- Studio score ring shows a number 0–100 (not `—`)
- Breakdown rows: `Completeness`, `Contact`, `Experience`, `Skills`, `Formatting`, `Recruiter readability`
- Each row: `points/max` (e.g. `24/30`)
- Band: Excellent, Good, or Needs improvement

## Files changed

- `src/core/validation/ats-engine.js` (new)
- `src/core/validation/ats-analyzer.js` (new)
- `src/core/validation/recruiter-audit.js` (new)
- `src/core/validation/product-score.js` — delegates to engine
- `src/core/validation/recruiter-review.js` — `atsScore` = total
- `src/core/validation/index.js` — exports
- `src/core/pipeline/production-pipeline.js` — uses product score
- `index.html` — breakdown rendering, band fix, scoreReportFromCore
- `src/tests/qa-ats-pipeline.mjs` (new)
- `src/tests/qa-product-recovery.mjs` — expects 6 breakdown rows
