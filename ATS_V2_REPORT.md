# ATS Score V2 Report

**Generated:** 2026-06-08T17:34:17.805Z
**Engine:** `HIRELY_ATS_SCORE_V2`
**Realism gate:** PASS
**Legacy V2 gate:** PASS
**Verdict:** PASS

## Model

Rewards: email, phone, LinkedIn, experience, education, skills, tools, languages, summary.
Penalties: missing title, empty experience, missing dates, duplicate content, bad formatting.

## Composite scores (0–100)

| Tier | Overall | Content | Experience | Readability | ATS | Band |
|------|---------|---------|------------|-------------|-----|------|
| real | 84 | 95 | 78 | 70 | 82 | Excellent |
| average | 73 | 54 | 88 | 92 | 82 | Good |
| poor | 0 | 0 | 0 | 33 | 0 | Needs improvement |

## Acceptance bands

| Tier | Target | Result |
|------|--------|--------|
| Real CV | 80–95 | PASS (84) |
| Average CV | 60–80 | PASS (73) |
| Poor CV | <60 | PASS (0) |

## Category weights

- **Identity** — max 15
- **Contact** — max 10
- **Experience** — max 24
- **Education** — max 10
- **Skills** — max 12
- **Tools** — max 8
- **Languages** — max 8
- **Summary** — max 8
- **Formatting** — max 5

## Penalties (sample)

**real:** Repeated role or company tokens (−8)
**poor:** Missing job title (−12), Empty experience section (−22)

## Files

- `src/core/validation/recruiter-score-v2.js` — `computeRecruiterScoreV2()`
- `src/core/validation/ats-engine.js` — panel metrics facade
- `src/tests/qa-ats-v2-realism.mjs` — tier band gate

## Commands

```bash
npm run qa:ats-v2-realism
npm run ats-v2-report
```
