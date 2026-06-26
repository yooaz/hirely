# SCORING V2 REPORT

Generated: 2026-06-07T23:14:55.419Z
Engine: `HIRELY_RECRUITER_SCORE_V2`

## Overview

Recruiter Score V2 replaces the legacy checklist model with **seven weighted sections** (total 100). Each run returns **score**, **strengths**, **weaknesses**, and **recommendations** — all deterministic from `cvData` signals.

## Category weights

| Category | Max points | ID |
| --- | --- | --- |
| Identity | 15 | `identity` |
| Contact | 10 | `contact` |
| Experience | 30 | `experience` |
| Education | 10 | `education` |
| Skills | 15 | `skills` |
| Tools | 10 | `tools` |
| Languages | 10 | `languages` |

## Return shape

```json
{
  "score": 82,
  "total": 82,
  "band": {
    "label": "Excellent"
  },
  "breakdown": [
    {
      "id": "identity",
      "points": 15,
      "max": 15
    }
  ],
  "strengths": [
    "Identity : 15/15 — solide pour un recruteur."
  ],
  "weaknesses": [
    "Languages : 0/10 — section à renforcer."
  ],
  "recommendations": [
    {
      "id": "languages",
      "issue": "Langues absentes",
      "fix": "...",
      "priority": "high"
    }
  ]
}
```

## Sample scores

| Profile | Score | Band | Strengths | Weaknesses | Recommendations |
| --- | --- | --- | --- | --- | --- |
| strong | 84 | Excellent | 5 | 1 | 4 |
| partial | 32 | Needs improvement | 1 | 5 | 6 |
| empty | 0 | Needs improvement | 1 | 5 | 6 |

## Strong profile breakdown

| Category | Points | Max | % |
| --- | --- | --- | --- |
| Identity | 15 | 15 | 100 |
| Contact | 10 | 10 | 100 |
| Experience | 18 | 30 | 60 |
| Education | 8 | 10 | 80 |
| Skills | 15 | 15 | 100 |
| Tools | 8 | 10 | 80 |
| Languages | 10 | 10 | 100 |

### Strengths

- Identity : 15/15 — solide pour un recruteur.
- Contact : 10/10 — solide pour un recruteur.
- Education : 8/10 — solide pour un recruteur.
- Skills : 15/15 — solide pour un recruteur.
- Tools : 8/10 — solide pour un recruteur.

### Weaknesses

- Aucune section critique — affinez selon le poste visé.

### Recommendations

- **Experience** (medium): Few action verbs in experience → Listez vos postes avec dates, verbes d'action et résultats chiffrés.
- **Experience** (medium): No measurable results → Listez vos postes avec dates, verbes d'action et résultats chiffrés.
- **Education** (medium): Single education entry only → Ajoutez diplômes, écoles et années de formation.
- **Tools** (medium): Add more software tools → Ajoutez les logiciels que vous maîtrisez (Figma, Photoshop, etc.).

## Integration

| Consumer | Entry point |
|----------|-------------|
| Product UI | `computeProductScore(cvData)` |
| ATS analyzer | `computeAtsScore(cvData)` → V2 |
| Recruiter audit | `runRecruiterAudit()` exposes strengths/weaknesses/recommendations |

## Module map

| File | Role |
|------|------|
| `src/core/validation/recruiter-score-v2.js` | V2 scoring engine |
| `src/core/validation/ats-engine.js` | Facade / panel helpers |
| `src/core/validation/product-score.js` | Product entry + profile resolution |
| `src/core/validation/recruiter-checklist-source.js` | `resumeData` → checklist profile |
| `src/tests/qa-recruiter-score-v2.mjs` | Acceptance QA |

## Verification

```bash
npm run qa:recruiter-score-v2
npm run scoring:v2-report
npm run qa:ats-pipeline
```

Product-score path (strong): **84**/100
