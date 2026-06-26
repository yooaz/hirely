# RECRUITER_QUALITY_REPORT

Generated: 2026-06-06
Engine: `HIRELY_RECRUITER_QUALITY_V1`

## Summary

- Fixtures audited: **11**
- Checks run on **extracted cvData only** — no invented fields
- Panel: recruiter mode → 6 quality dimensions + prioritized fixes

## Quality dimensions

| Check | Description |
| --- | --- |
| Missing dates | Experience rows without year/range in extracted data |
| Missing contact | Email, phone, LinkedIn, location gaps |
| Timeline gaps | >1 year between dated roles (from parsed years) |
| Duplicate roles | Same role+company key repeated |
| Weak descriptions | Short lines, few action verbs, no metrics |
| ATS compatibility | Weighted ATS score from `ats-engine.js` |

## Aggregate check status (fixtures)

| Check | OK | Warn | Fail | Skip |
| --- | --- | --- | --- | --- |
| Missing dates | 11 | 0 | 0 | 0 |
| Missing contact info | 0 | 9 | 2 | 0 |
| Timeline gaps | 8 | 0 | 0 | 3 |
| Duplicate roles | 8 | 3 | 0 | 0 |
| Weak descriptions | 3 | 8 | 0 | 0 |
| ATS compatibility | 11 | 0 | 0 | 0 |

## Fixture results

### creative-cv — Designer CV (creative paste)

- Score: **81** (Excellent)
- Fixes: 10

| Check | Status | Count |
| --- | --- | --- |
| Missing dates | ok | 0 |
| Missing contact info | warn | 2 |
| Timeline gaps | ok | 0 |
| Duplicate roles | warn | 1 |
| Weak descriptions | warn | 2 |
| ATS compatibility | ok | 0 |

**Top fixes**
- [high] Nom manquant — Ajoutez votre nom complet en haut du CV.
- [high] Intitulé de poste manquant — Indiquez clairement votre métier (ex. Graphiste senior).
- [high] Email manquant ou invalide — Ajoutez une adresse email professionnelle.
- [high] Résumé faible ou absent — Rédigez 2–3 phrases sur votre profil et votre valeur.
- [high] Expériences absentes — Listez au moins une expérience professionnelle.

### yoaz-cv — Designer CV (Yoaz clean paste)

- Score: **75** (Good)
- Fixes: 10

| Check | Status | Count |
| --- | --- | --- |
| Missing dates | ok | 0 |
| Missing contact info | warn | 2 |
| Timeline gaps | ok | 0 |
| Duplicate roles | warn | 3 |
| Weak descriptions | warn | 5 |
| ATS compatibility | ok | 1 |

**Top fixes**
- [high] Nom manquant — Ajoutez votre nom complet en haut du CV.
- [high] Intitulé de poste manquant — Indiquez clairement votre métier (ex. Graphiste senior).
- [high] Email manquant ou invalide — Ajoutez une adresse email professionnelle.
- [high] Résumé faible ou absent — Rédigez 2–3 phrases sur votre profil et votre valeur.
- [high] Expériences absentes — Listez au moins une expérience professionnelle.

### developer-cv — Developer CV

- Score: **82** (Excellent)
- Fixes: 8

| Check | Status | Count |
| --- | --- | --- |
| Missing dates | ok | 0 |
| Missing contact info | warn | 2 |
| Timeline gaps | ok | 0 |
| Duplicate roles | ok | 0 |
| Weak descriptions | warn | 1 |
| ATS compatibility | ok | 0 |

**Top fixes**
- [high] Nom manquant — Ajoutez votre nom complet en haut du CV.
- [high] Intitulé de poste manquant — Indiquez clairement votre métier (ex. Graphiste senior).
- [high] Email manquant ou invalide — Ajoutez une adresse email professionnelle.
- [high] Expériences absentes — Listez au moins une expérience professionnelle.
- [medium] Descriptions d'expérience faibles — Détaillez chaque poste avec verbes d'action et résultats mesurables.

### marketing-cv — Marketing CV

- Score: **68** (Good)
- Fixes: 7

| Check | Status | Count |
| --- | --- | --- |
| Missing dates | ok | 0 |
| Missing contact info | fail | 3 |
| Timeline gaps | skip | 0 |
| Duplicate roles | ok | 0 |
| Weak descriptions | ok | 0 |
| ATS compatibility | ok | 1 |

**Top fixes**
- [high] Nom manquant — Ajoutez votre nom complet en haut du CV.
- [high] Intitulé de poste manquant — Indiquez clairement votre métier (ex. Graphiste senior).
- [high] Email manquant ou invalide — Ajoutez une adresse email professionnelle.
- [high] Expériences absentes — Listez au moins une expérience professionnelle.
- [medium] Téléphone absent — Ajoutez un numéro de téléphone.

### recruiter-cv — Recruiter CV

- Score: **63** (Good)
- Fixes: 9

| Check | Status | Count |
| --- | --- | --- |
| Missing dates | ok | 0 |
| Missing contact info | warn | 1 |
| Timeline gaps | ok | 0 |
| Duplicate roles | ok | 0 |
| Weak descriptions | warn | 2 |
| ATS compatibility | ok | 2 |

**Top fixes**
- [high] Nom manquant — Ajoutez votre nom complet en haut du CV.
- [high] Intitulé de poste manquant — Indiquez clairement votre métier (ex. Graphiste senior).
- [high] Email manquant ou invalide — Ajoutez une adresse email professionnelle.
- [high] Résumé faible ou absent — Rédigez 2–3 phrases sur votre profil et votre valeur.
- [high] Expériences absentes — Listez au moins une expérience professionnelle.

### consultant-cv — Consultant CV

- Score: **70** (Good)
- Fixes: 8

| Check | Status | Count |
| --- | --- | --- |
| Missing dates | ok | 0 |
| Missing contact info | warn | 2 |
| Timeline gaps | ok | 0 |
| Duplicate roles | ok | 0 |
| Weak descriptions | warn | 3 |
| ATS compatibility | ok | 1 |

**Top fixes**
- [high] Nom manquant — Ajoutez votre nom complet en haut du CV.
- [high] Intitulé de poste manquant — Indiquez clairement votre métier (ex. Graphiste senior).
- [high] Email manquant ou invalide — Ajoutez une adresse email professionnelle.
- [high] Expériences absentes — Listez au moins une expérience professionnelle.
- [medium] Descriptions d'expérience faibles — Détaillez chaque poste avec verbes d'action et résultats mesurables.

### text-pdf — Native PDF (selectable text)

- Score: **68** (Good)
- Fixes: 8

| Check | Status | Count |
| --- | --- | --- |
| Missing dates | ok | 0 |
| Missing contact info | warn | 2 |
| Timeline gaps | ok | 0 |
| Duplicate roles | ok | 0 |
| Weak descriptions | warn | 2 |
| ATS compatibility | ok | 1 |

**Top fixes**
- [high] Nom manquant — Ajoutez votre nom complet en haut du CV.
- [high] Intitulé de poste manquant — Indiquez clairement votre métier (ex. Graphiste senior).
- [high] Email manquant ou invalide — Ajoutez une adresse email professionnelle.
- [high] Expériences absentes — Listez au moins une expérience professionnelle.
- [medium] Descriptions d'expérience faibles — Détaillez chaque poste avec verbes d'action et résultats mesurables.

### scanned-pdf — Scanned PDF (OCR text)

- Score: **40** (Needs improvement)
- Fixes: 8

| Check | Status | Count |
| --- | --- | --- |
| Missing dates | ok | 0 |
| Missing contact info | fail | 3 |
| Timeline gaps | skip | 0 |
| Duplicate roles | ok | 0 |
| Weak descriptions | ok | 0 |
| ATS compatibility | ok | 3 |

**Top fixes**
- [high] Nom manquant — Ajoutez votre nom complet en haut du CV.
- [high] Intitulé de poste manquant — Indiquez clairement votre métier (ex. Graphiste senior).
- [high] Email manquant ou invalide — Ajoutez une adresse email professionnelle.
- [high] Résumé faible ou absent — Rédigez 2–3 phrases sur votre profil et votre valeur.
- [high] Expériences absentes — Listez au moins une expérience professionnelle.

### docx — DOCX export

- Score: **68** (Good)
- Fixes: 8

| Check | Status | Count |
| --- | --- | --- |
| Missing dates | ok | 0 |
| Missing contact info | warn | 2 |
| Timeline gaps | ok | 0 |
| Duplicate roles | ok | 0 |
| Weak descriptions | warn | 2 |
| ATS compatibility | ok | 1 |

**Top fixes**
- [high] Nom manquant — Ajoutez votre nom complet en haut du CV.
- [high] Intitulé de poste manquant — Indiquez clairement votre métier (ex. Graphiste senior).
- [high] Email manquant ou invalide — Ajoutez une adresse email professionnelle.
- [high] Expériences absentes — Listez au moins une expérience professionnelle.
- [medium] Descriptions d'expérience faibles — Détaillez chaque poste avec verbes d'action et résultats mesurables.

### two-column-cv — Two-column PDF layout

- Score: **52** (Needs improvement)
- Fixes: 8

| Check | Status | Count |
| --- | --- | --- |
| Missing dates | ok | 0 |
| Missing contact info | warn | 2 |
| Timeline gaps | skip | 0 |
| Duplicate roles | ok | 0 |
| Weak descriptions | ok | 0 |
| ATS compatibility | ok | 3 |

**Top fixes**
- [high] Nom manquant — Ajoutez votre nom complet en haut du CV.
- [high] Intitulé de poste manquant — Indiquez clairement votre métier (ex. Graphiste senior).
- [high] Email manquant ou invalide — Ajoutez une adresse email professionnelle.
- [high] Résumé faible ou absent — Rédigez 2–3 phrases sur votre profil et votre valeur.
- [high] Expériences absentes — Listez au moins une expérience professionnelle.

### mvp-sample — Plain TXT (MVP sample)

- Score: **75** (Good)
- Fixes: 10

| Check | Status | Count |
| --- | --- | --- |
| Missing dates | ok | 0 |
| Missing contact info | warn | 2 |
| Timeline gaps | ok | 0 |
| Duplicate roles | warn | 1 |
| Weak descriptions | warn | 3 |
| ATS compatibility | ok | 1 |

**Top fixes**
- [high] Nom manquant — Ajoutez votre nom complet en haut du CV.
- [high] Intitulé de poste manquant — Indiquez clairement votre métier (ex. Graphiste senior).
- [high] Email manquant ou invalide — Ajoutez une adresse email professionnelle.
- [high] Résumé faible ou absent — Rédigez 2–3 phrases sur votre profil et votre valeur.
- [high] Expériences absentes — Listez au moins une expérience professionnelle.

## Safety

- All findings include `evidence` from existing cvData strings
- No LLM inference; no synthetic experience or contact fields
- `hallucinationSafe: true` on every audit result

## Verification

```bash
node src/tests/recruiter-quality-test.mjs
node src/tests/qa-ats-pipeline.mjs
npm run recruiter:quality-report
```

