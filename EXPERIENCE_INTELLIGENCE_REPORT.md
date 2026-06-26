# EXPERIENCE INTELLIGENCE REPORT

Generated: 2026-06-07T23:01:52.156Z
Engine: `experienceNormalizer` (`EXPERIENCE_INTELLIGENCE`)
Pipeline: production import + experience intelligence + `sanitizeResumeForDisplay`

## Goal

**Experience recall > 90%** across acceptance CVs and fragmented OCR.

### Goal status: **MET**

## Capabilities

- `detectExperienceRole` — role from fragmented lines
- `detectExperienceCompany` — company / agency detection
- `detectExperienceDates` — date range extraction
- `detectFreelanceMission` — freelance / independent classification
- `detectInternship` — internship / stage classification
- `mergeFragmentedExperienceEntries` — merge OCR-split sparse rows
- `mergeFragmentedExperienceBlocks` — block-level OCR merge (via normalizer)

## Unit examples

| Example | Merged | Role | Company | Dates | Engagement |
|---------|-------:|------|---------|-------|------------|
| McCann fragmented OCR | 1 | Designer | McCann G Agency | 2011–2014 | employment |
| Freelance fragmented OCR | 1 | Illustrator | Independent / Freelance | 2011–2022 | freelance |

## Acceptance fixtures

| Fixture | Expected | Detected | TP | FN | FP | Recall | Precision |
|---------|----------:|---------:|---:|---:|---:|-------:|----------:|
| Developer CV | 2 | 5 | 2 | 0 | 3 | **100%** | 40% |
| Creative CV | 1 | 1 | 1 | 0 | 0 | **100%** | 100% |
| Marketing CV | 2 | 5 | 2 | 0 | 3 | **100%** | 40% |
| Consultant CV | 2 | 3 | 2 | 0 | 1 | **100%** | 66.7% |
| Fragmented OCR sample | 9 | 9 | 9 | 0 | 0 | **100%** | 100% |

**Aggregate recall:** 100% (16/16 experiences matched)

## Per-fixture detail

### Developer CV (`developer-cv`)

- Recall: **100%**, precision 40%
- Normalized experiences:
  - **Software Engineer** @ Stripe (2019–Present)
  - **Software Engineer** @ Dropbox (2015–2019)
  - **Software Engineer** @ Software Engineer (2019–Present)
  - **English** @ fluent (2019–Present)
  - **Software Engineer** @ Software Engineer (2015–2019)

### Creative CV (`creative-cv`)

- Recall: **100%**, precision 100%
- Normalized experiences:
  - **Freelance Illustrator / Graphic Designer** @ Independent / Freelance (2011–2022) [freelance]

### Marketing CV (`marketing-cv`)

- Recall: **100%**, precision 40%
- Normalized experiences:
  - **Digital Marketing Manager** @ GrowthLab (2020–Present)
  - **Marketing Executive** @ Unilever (2016–2020)
  - **Digital Marketing Manager** @ Digital Marketing Manager (2020–Present)
  - **Manager, Canva, Excel** @ native (2020–Present)
  - **Marketing Executive** @ Marketing Executive (2016–2020)

### Consultant CV (`consultant-cv`)

- Recall: **100%**, precision 66.7%
- Normalized experiences:
  - **Consultant** @ Strategy firm (2018–Present) [freelance]
  - **Executive Workshops With 12** @ Deloitte (2014–2018)
  - **Freelance Illustrator / Graphic Designer** @ Independent / Freelance (2018–Present) [freelance]

### Fragmented OCR sample (`yoaz-pdf-live-fragmented`)

- Recall: **100%**, precision 100%
- Normalized experiences:
  - **Freelance Illustrator / Graphic Designer** @ Independent / Freelance (2011–2022) [freelance]
  - **Designer** @ McCann G. Agency (2011–2014)
  - **Art Director Illustrator** @ Publicis Conseil (2014–2016)
  - **Illustrator** @ Havas Paris (2016–2018)
  - **Freelance Illustrator / Graphic Designer** @ Independent / Freelance (2018–2020) [freelance]
  - **Illustrator / Designer** @ BETC (2020–2021)
  - **Designer** @ DDB Paris (2021–2022)
  - **Designer** @ AKQA Paris (2022–2023)
  - **Creative Director** @ — (2023–Present)

## Run

```bash
npm run qa:experience-intelligence
npm run experience:intelligence-report
```
