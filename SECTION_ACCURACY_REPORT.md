# SECTION ACCURACY REPORT

Generated: 2026-06-06T23:16:38.861Z
Pipeline: production import + `sanitizeResumeForDisplay`
Fixtures evaluated: **12**

## Goal

**Precision > 90%** for each section (Experience, Education, Skill, Language, Tool, Client).

### Goal status: **NOT MET** (5/6 sections ≥ 90% precision)

## Aggregate precision (all fixtures)

| Section | Expected | Detected | TP | FP | FN | Precision | Recall | Goal |
|---------|----------:|---------:|---:|---:|---:|----------:|-------:|:----:|
| Experience | 35 | 28 | 26 | 2 | 9 | **92.9%** | 74.3% | ✓ |
| Education | 17 | 16 | 14 | 2 | 3 | **87.5%** | 82.4% | ✗ |
| Skill | 73 | 58 | 58 | 0 | 15 | **100%** | 79.5% | ✓ |
| Language | 15 | 15 | 15 | 0 | 0 | **100%** | 100% | ✓ |
| Tool | 38 | 36 | 36 | 0 | 2 | **100%** | 94.7% | ✓ |
| Client | 30 | 22 | 21 | 1 | 9 | **95.5%** | 70% | ✓ |

### Definitions

- **TP** — detected item matches a ground-truth item in the same section (fuzzy token match)
- **FP (false positives)** — detected items with no ground-truth match in that section
- **FN (false negatives)** — ground-truth items not recovered in that section
- **Precision** = TP / (TP + FP) = TP / Detected
- **Recall** = TP / (TP + FN) = TP / Expected

## Per-fixture breakdown

| Fixture | Experience | Education | Skill | Language | Tool | Client |
|---------|------------|-----------|-------|----------|------|--------|
| creative-cv | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 3) |
| yoaz-cv | 100% (FP 0, FN 3) | 100% (FP 0, FN 0) | 100% (FP 0, FN 2) | 100% (FP 0, FN 0) | 100% (FP 0, FN 1) | 87.5% (FP 1, FN 3) |
| developer-cv | 100% (FP 0, FN 1) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) |
| marketing-cv | 50% (FP 1, FN 1) | 50% (FP 2, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) |
| recruiter-cv | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) |
| consultant-cv | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) |
| text-pdf | 100% (FP 0, FN 0) | 0% (FP 0, FN 1) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) |
| scanned-pdf | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 0% (FP 0, FN 4) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) |
| docx | 100% (FP 0, FN 0) | 0% (FP 0, FN 1) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) |
| two-column-cv | 100% (FP 0, FN 1) | 0% (FP 0, FN 1) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) |
| mvp-sample | 0% (FP 0, FN 1) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) | 100% (FP 0, FN 0) |
| yoaz-pdf-live | 87.5% (FP 1, FN 2) | 100% (FP 0, FN 0) | 100% (FP 0, FN 9) | 100% (FP 0, FN 0) | 100% (FP 0, FN 1) | 100% (FP 0, FN 3) |

## Per-fixture detail

### Designer CV (creative paste) (`creative-cv`)

- **File:** `creative-cv/fixture.txt`
- **Experience:** precision 100%, FP 0, FN 0, recall 100%
- **Education:** precision 100%, FP 0, FN 0, recall 100%
- **Skill:** precision 100%, FP 0, FN 0, recall 100%
- **Language:** precision 100%, FP 0, FN 0, recall 100%
- **Tool:** precision 100%, FP 0, FN 0, recall 100%
- **Client:** precision 100%, FP 0, FN 3, recall 70%
  - False negatives: `Adobe`, `McCann`, `Arte`

### Designer CV (Yoaz clean paste) (`yoaz-cv`)

- **File:** `yoaz-cv/fixture.txt`
- **Experience:** precision 100%, FP 0, FN 3, recall 66.7%
  - False negatives: `Publicis Conseil — Art Director — 2014 — 2016`, `DDB Paris — Visual Designer — 2021 — 2022`, `AKQA Paris — Lead Visual Designer — 2022 — 2023`
- **Education:** precision 100%, FP 0, FN 0, recall 100%
- **Skill:** precision 100%, FP 0, FN 2, recall 83.3%
  - False negatives: `Illustration`, `Packaging`
- **Language:** precision 100%, FP 0, FN 0, recall 100%
- **Tool:** precision 100%, FP 0, FN 1, recall 80%
  - False negatives: `Affinity Designer`
- **Client:** precision 87.5%, FP 1, FN 3, recall 70%
  - False positives: `AKQA`
  - False negatives: `Adobe`, `Arte`, `McCann`

### Developer CV (`developer-cv`)

- **File:** `developer-cv/fixture.txt`
- **Experience:** precision 100%, FP 0, FN 1, recall 50%
  - False negatives: `Senior Software Engineer — Stripe — 2019 — Present`
- **Education:** precision 100%, FP 0, FN 0, recall 100%
- **Skill:** precision 100%, FP 0, FN 0, recall 100%
- **Language:** precision 100%, FP 0, FN 0, recall 100%
- **Tool:** precision 100%, FP 0, FN 0, recall 100%
- **Client:** precision 100%, FP 0, FN 0, recall 100%

### Marketing CV (`marketing-cv`)

- **File:** `marketing-cv/fixture.txt`
- **Experience:** precision 50%, FP 1, FN 1, recall 50%
  - False positives: `Manager — GrowthLab — 2020–Present`
  - False negatives: `Digital Marketing Manager — GrowthLab — 2020 — Present`
- **Education:** precision 50%, FP 2, FN 0, recall 100%
  - False positives: `MSc Marketing`, `BA Communications`
- **Skill:** precision 100%, FP 0, FN 0, recall 100%
- **Language:** precision 100%, FP 0, FN 0, recall 100%
- **Tool:** precision 100%, FP 0, FN 0, recall 100%
- **Client:** precision 100%, FP 0, FN 0, recall 100%

### Recruiter CV (`recruiter-cv`)

- **File:** `recruiter-cv/fixture.txt`
- **Experience:** precision 100%, FP 0, FN 0, recall 100%
- **Education:** precision 100%, FP 0, FN 0, recall 100%
- **Skill:** precision 100%, FP 0, FN 0, recall 100%
- **Language:** precision 100%, FP 0, FN 0, recall 100%
- **Tool:** precision 100%, FP 0, FN 0, recall 100%
- **Client:** precision 100%, FP 0, FN 0, recall 100%

### Consultant CV (`consultant-cv`)

- **File:** `consultant-cv/fixture.txt`
- **Experience:** precision 100%, FP 0, FN 0, recall 100%
- **Education:** precision 100%, FP 0, FN 0, recall 100%
- **Skill:** precision 100%, FP 0, FN 0, recall 100%
- **Language:** precision 100%, FP 0, FN 0, recall 100%
- **Tool:** precision 100%, FP 0, FN 0, recall 100%
- **Client:** precision 100%, FP 0, FN 0, recall 100%

### Native PDF (selectable text) (`text-pdf`)

- **File:** `text-pdf/fixture.txt`
- **Experience:** precision 100%, FP 0, FN 0, recall 100%
- **Education:** precision 0%, FP 0, FN 1, recall 0%
  - False negatives: `HEC Paris — MBA 2018`
- **Skill:** precision 100%, FP 0, FN 0, recall 100%
- **Language:** precision 100%, FP 0, FN 0, recall 100%
- **Tool:** precision 100%, FP 0, FN 0, recall 100%
- **Client:** precision 100%, FP 0, FN 0, recall 100%

### Scanned PDF (OCR text) (`scanned-pdf`)

- **File:** `scanned-pdf/fixture.txt`
- **Experience:** precision 100%, FP 0, FN 0, recall 100%
- **Education:** precision 100%, FP 0, FN 0, recall 100%
- **Skill:** precision 0%, FP 0, FN 4, recall 0%
  - False negatives: `Product strategy`, `Agile`, `SQL`, `User research`
- **Language:** precision 100%, FP 0, FN 0, recall 100%
- **Tool:** precision 100%, FP 0, FN 0, recall 100%
- **Client:** precision 100%, FP 0, FN 0, recall 100%

### DOCX export (`docx`)

- **File:** `docx/fixture.txt`
- **Experience:** precision 100%, FP 0, FN 0, recall 100%
- **Education:** precision 0%, FP 0, FN 1, recall 0%
  - False negatives: `HEC Paris — MBA 2018`
- **Skill:** precision 100%, FP 0, FN 0, recall 100%
- **Language:** precision 100%, FP 0, FN 0, recall 100%
- **Tool:** precision 100%, FP 0, FN 0, recall 100%
- **Client:** precision 100%, FP 0, FN 0, recall 100%

### Two-column PDF layout (`two-column-cv`)

- **File:** `two-column-cv/fixture.txt`
- **Experience:** precision 100%, FP 0, FN 1, recall 50%
  - False negatives: `Product Manager — Beta Corp — 2015 — 2019`
- **Education:** precision 0%, FP 0, FN 1, recall 0%
  - False negatives: `HEC Paris — MBA — 2018`
- **Skill:** precision 100%, FP 0, FN 0, recall 100%
- **Language:** precision 100%, FP 0, FN 0, recall 100%
- **Tool:** precision 100%, FP 0, FN 0, recall 100%
- **Client:** precision 100%, FP 0, FN 0, recall 100%

### Plain TXT (MVP sample) (`mvp-sample`)

- **File:** `mvp-sample.txt`
- **Experience:** precision 0%, FP 0, FN 1, recall 0%
  - False negatives: `Freelance Illustrator / Graphic Designer — Independent — 2011 — `
- **Education:** precision 100%, FP 0, FN 0, recall 100%
- **Skill:** precision 100%, FP 0, FN 0, recall 100%
- **Language:** precision 100%, FP 0, FN 0, recall 100%
- **Tool:** precision 100%, FP 0, FN 0, recall 100%
- **Client:** precision 100%, FP 0, FN 0, recall 100%

### Yoaz PDF (live binary) (`yoaz-pdf-live`)

- **File:** `yoaz.pdf (OCR cache)`
- **Experience:** precision 87.5%, FP 1, FN 2, recall 77.8%
  - False positives: `Freelancer Illustrator, Graphic designer — Independent / Freelan`
  - False negatives: `McCann Paris — Lead Illustrator — 2011 — 2014`, `Studio Yoaz — Creative Director — 2023 — Present`
- **Education:** precision 100%, FP 0, FN 0, recall 100%
- **Skill:** precision 100%, FP 0, FN 9, recall 25%
  - False negatives: `Poster Design`, `Packaging`, `Logo Design`, `Art Direction`, `Print Production`, `Typography`
- **Language:** precision 100%, FP 0, FN 0, recall 100%
- **Tool:** precision 100%, FP 0, FN 1, recall 80%
  - False negatives: `Affinity Designer`
- **Client:** precision 100%, FP 0, FN 3, recall 70%
  - False negatives: `Adobe`, `Arte`, `McCann`

## Run

```bash
npm run stress:sections
```
