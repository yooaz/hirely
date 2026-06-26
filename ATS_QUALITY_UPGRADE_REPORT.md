# HIRELY H8 — ATS Quality Upgrade

**Engine:** HIRELY_ATS_H8
**Generated:** 2026-06-08 20:08:54 UTC

## Audit summary

Root causes of low P7 scores (V2):

1. **Template sanitization** removed flat `experience` lines while structured `experiences` still existed.
2. **Heavy penalties** (−12 title, −22 empty experience) on usable partial CVs.
3. **No archetype context** — designers penalized for portfolio-heavy layouts; students penalized for short experience.
4. **Education treated as mandatory** even when optional for senior/designer profiles.

## Three-layer model

| Layer | Meaning |
|-------|---------|
| `engine.ran` | Scorer executed and returned a valid structured result |
| `cvQuality.score` | Content richness (experience, skills, education, summary) |
| `atsReadiness.score` | Identity + contact + formatting readiness for ATS export |
| `total` | Holistic recruiter score (category sum − soft penalties) |

## Acceptance

| Check | Result |
|-------|--------|
| Good CV band (80–95) | 88 (good) |
| Stress CVs ≥ 60 | 18/20 |
| Stress CVs ≥ 80 | 3/20 |
| Deterministic | same input → same score |

## P7 stress scores (before → after H8)

| CV | Archetype | Before | After | Tier | CV Quality | ATS Ready |
|----|-----------|--------|-------|------|------------|-----------|
| Designer CV (creative) | designer | 79 | 85 | good | 65 | 93 |
| Designer CV (Yoaz) | designer | 79 | 85 | good | 65 | 93 |
| Designer CV (image layout) | designer | 75 | 81 | good | 58 | 93 |
| Designer CV (plain TXT) | designer | 46 | 79 | average | 57 | 93 |
| Developer CV | developer | 29 | 66 | average | 53 | 78 |
| Developer CV (OCR sim) | developer | 29 | 66 | average | 53 | 78 |
| Marketing CV | marketing | 68 | 68 | average | 55 | 78 |
| Marketing CV (OCR sim) | marketing | 68 | 68 | average | 55 | 78 |
| Sales CV | sales | 68 | 68 | average | 54 | 78 |
| Student CV | student | 65 | 65 | average | 51 | 78 |
| Executive CV | executive | 63 | 63 | average | 45 | 78 |
| Academic CV | academic | 68 | 68 | average | 55 | 78 |
| Recruiter CV | recruiter | 69 | 69 | average | 54 | 78 |
| Consultant CV | consultant | 68 | 68 | average | 55 | 78 |
| Two-column layout CV | general | 58 | 58 | weak | 39 | 78 |
| Native PDF text CV | general | 60 | 60 | average | 43 | 78 |
| Scanned PDF (OCR) | general | 20 | 57 | weak | 43 | 68 |
| DOCX export CV | general | 60 | 60 | average | 43 | 78 |
| Sales CV (OCR sim) | sales | 68 | 68 | average | 54 | 78 |
| Executive CV (OCR sim) | executive | 63 | 63 | average | 45 | 78 |

## Sample output shape

```json
{
  "score": 88,
  "strengths": [
    "Identity: 15/15",
    "Contact: 8/10",
    "Experience: 24/24"
  ],
  "missingFields": [],
  "nextActions": [],
  "engine": {
    "ran": true,
    "version": "HIRELY_ATS_H8",
    "valid": true
  },
  "cvQuality": {
    "score": 69,
    "band": {
      "label": "Good",
      "labelKey": "bandGood",
      "tier": "average"
    }
  },
  "atsReadiness": {
    "score": 93,
    "band": {
      "label": "Excellent",
      "labelKey": "bandExcellent",
      "tier": "good"
    }
  }
}
```

## Per-CV actions (top gaps)

### Designer CV (creative)

- Score: **85** · Archetype: `designer`

### Designer CV (Yoaz)

- Score: **85** · Archetype: `designer`

### Designer CV (image layout)

- Score: **81** · Archetype: `designer`

### Designer CV (plain TXT)

- Score: **79** · Archetype: `designer`
- Missing: portfolio
- Next actions:
  1. Highlight 3–6 client or project names to show creative reach.

### Developer CV

- Score: **66** · Archetype: `developer`
- Missing: title, skills
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. List 5–8 role-relevant skills or tools.

### Developer CV (OCR sim)

- Score: **66** · Archetype: `developer`
- Missing: title, skills
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. List 5–8 role-relevant skills or tools.

### Marketing CV

- Score: **68** · Archetype: `marketing`
- Missing: title, skills
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. List 5–8 role-relevant skills or tools.

### Marketing CV (OCR sim)

- Score: **68** · Archetype: `marketing`
- Missing: title, skills
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. List 5–8 role-relevant skills or tools.

### Sales CV

- Score: **68** · Archetype: `sales`
- Missing: title
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. Expand skills and software tools relevant to your target role.

### Student CV

- Score: **65** · Archetype: `student`
- Missing: title, education, skills
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. List your degree, school, and expected graduation.
  1. List 5–8 role-relevant skills or tools.

### Executive CV

- Score: **63** · Archetype: `executive`
- Missing: title
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. Expand skills and software tools relevant to your target role.

### Academic CV

- Score: **68** · Archetype: `academic`
- Missing: title, skills
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. List 5–8 role-relevant skills or tools.

### Recruiter CV

- Score: **69** · Archetype: `recruiter`
- Missing: title, skills
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. List 5–8 role-relevant skills or tools.

### Consultant CV

- Score: **68** · Archetype: `consultant`
- Missing: title, skills
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. List 5–8 role-relevant skills or tools.

### Two-column layout CV

- Score: **58** · Archetype: `general`
- Missing: title, skills
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. List 5–8 role-relevant skills or tools.

### Native PDF text CV

- Score: **60** · Archetype: `general`
- Missing: title, skills
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. List 5–8 role-relevant skills or tools.

### Scanned PDF (OCR)

- Score: **57** · Archetype: `general`
- Missing: title, phone, skills
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. Add a phone number recruiters can reach.
  1. List 5–8 role-relevant skills or tools.

### DOCX export CV

- Score: **60** · Archetype: `general`
- Missing: title, skills
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. List 5–8 role-relevant skills or tools.

### Sales CV (OCR sim)

- Score: **68** · Archetype: `sales`
- Missing: title
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. Expand skills and software tools relevant to your target role.

### Executive CV (OCR sim)

- Score: **63** · Archetype: `executive`
- Missing: title
- Next actions:
  1. Add a clear job title or headline matching your target role.
  1. Expand skills and software tools relevant to your target role.

## Commands

```bash
npm run qa:ats-quality-h8
npm run ats-quality-upgrade-report
```
