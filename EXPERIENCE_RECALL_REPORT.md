# EXPERIENCE RECALL REPORT

Generated: 2026-06-07T23:00:17.145Z
Engine: `EXPERIENCE_RECONSTRUCTION`
Pipeline: production import + experience reconstruction + `sanitizeResumeForDisplay`

## Goal

**Experience recall ≥ 90%** on Developer, Creative, Marketing, and Consultant CVs.

### Goal status: **NOT MET**

## Rules enforced

- Rebuild `role`, `company`, `dates`, `description`, `confidence` from date-anchored line groups
- Reject education, skills, clients, and languages as experience sources
- Merge nearby lines when date fragments repeat on adjacent groups
- Infer missing company only when confidence > 80%

## Acceptance fixtures

| Fixture | Expected | Detected | TP | FN | FP | Recall | Precision |
|---------|----------:|---------:|---:|---:|---:|-------:|----------:|
| Developer CV | 2 | 3 | 2 | 0 | 1 | **100%** | 66.7% |
| Creative CV | 1 | 1 | 1 | 0 | 0 | **100%** | 100% |
| Marketing CV | 2 | 3 | 2 | 0 | 1 | **100%** | 66.7% |
| Consultant CV | 2 | 2 | 2 | 0 | 0 | **100%** | 100% |
| Fragmented OCR sample | 9 | 8 | 8 | 1 | 0 | **88.9%** | 100% |

**Aggregate recall:** 93.8% (15/16 experiences matched)

## Per-fixture detail

### Developer CV (`developer-cv`)

- Recall: **100%**, precision 66.7%
- False positives:
  - `Software Engineer — Software Engineer — 2019–Present`
- Reconstructed experiences:
  - **Software Engineer** @ Stripe (2019–Present) — confidence — — Led migration of billing microservices to Kubernetes, improving deployment frequ
  - **Software Engineer** @ Dropbox (2015–2019) — confidence — — Delivered shipped file-sync performance improvements reducing latency by 30%.
  - **Software Engineer** @ Software Engineer (2019–Present) — confidence — — Designed and delivered creative work for Software Engineer.

### Creative CV (`creative-cv`)

- Recall: **100%**, precision 100%
- Reconstructed experiences:
  - **Freelance Illustrator / Graphic Designer** @ Independent / Freelance (2011–2022) — confidence — — Posters, packaging, logos, visual identity.

### Marketing CV (`marketing-cv`)

- Recall: **100%**, precision 66.7%
- False positives:
  - `Digital Marketing Manager — Digital Marketing Manager — 2020–Present`
- Reconstructed experiences:
  - **Digital Marketing Manager** @ GrowthLab (2020–Present) — confidence — — Delivered scaled paid social spend to £2m arr with 3.2x roas. Launched email nur
  - **Marketing Executive** @ Unilever (2016–2020) — confidence — — Managed integrated campaigns across UK and Benelux markets.
  - **Digital Marketing Manager** @ Digital Marketing Manager (2020–Present) — confidence — — Delivered growth marketer with 7 years driving acquisition, brand campaigns, and

### Consultant CV (`consultant-cv`)

- Recall: **100%**, precision 100%
- Reconstructed experiences:
  - **Consultant** @ Strategy firm (2018–Present) — confidence — — Led €40M cost transformation program for European retailer. Delivered facilitate
  - **Executive Workshops With 12** @ Deloitte (2014–2018) — confidence — — Built financial models supporting M&A due diligence.

### Fragmented OCR sample (`yoaz-pdf-live-fragmented`)

- Recall: **88.9%**, precision 100%
- False negatives:
  - `Senior Illustrator — Havas Paris — 2016 — 2018`
- Reconstructed experiences:
  - **Freelance Illustrator / Graphic Designer** @ Independent / Freelance (2011–2022) — confidence — — Posters, packaging, logos, visual identity.
  - **Designer** @ McCann G. Agency (2011–2014) — confidence — — Creative work for campaigns and brand assets.
  - **Art Director Illustrator** @ Publicis Conseil (2014–2016) — confidence — — Designed and delivered creative work for Publicis Conseil.
  - **Freelance Illustrator / Graphic Designer** @ Independent / Freelance (2018–2020) — confidence — — Posters, packaging, logos, visual identity.
  - **Illustrator / Designer** @ BETC (2020–2021) — confidence — — Designed and delivered creative work for BETC.
  - **Designer** @ DDB Paris (2021–2022) — confidence — — Designed and delivered creative work for DDB Paris.

## Fragmented OCR sample

- Fixture: `tests/fixtures/yoaz-pdf-live/ocr-fragmented.txt`
- Expected roles: **9**
- Experiences recovered: **8**
- Recall: **88.9%** (TP 8 / FN 1)
- False negatives:
  - `Senior Illustrator — Havas Paris — 2016 — 2018`
- Reconstructed experiences:
  - **Freelance Illustrator / Graphic Designer** @ Independent / Freelance (2011–2022)
  - **Designer** @ McCann G. Agency (2011–2014)
  - **Art Director Illustrator** @ Publicis Conseil (2014–2016)
  - **Freelance Illustrator / Graphic Designer** @ Independent / Freelance (2018–2020)
  - **Illustrator / Designer** @ BETC (2020–2021)
  - **Designer** @ DDB Paris (2021–2022)
  - **Designer** @ AKQA Paris (2022–2023)
  - **Creative Director** @ — (2023–Present)

## Run

```bash
npm run qa:experience-reconstruction
npm run experience:recall-report
```
