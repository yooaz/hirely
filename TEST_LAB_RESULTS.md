# Hirely Test Lab Results

**Generated:** 2026-06-14
**Engine:** `HIRELY_TEST_LAB_V1`
**CVs tested:** 50
**QA gate:** PASS
**Overall pass:** NO

## Environment

| Asset | Path |
|-------|------|
| Catalog | `tests/lib/hirely-test-lab-catalog.mjs` |
| Metrics | `tests/lib/hirely-test-lab-metrics.mjs` |
| Runner | `src/tests/lib/hirely-test-lab-suite.mjs` |
| Dashboard | `test-lab/index.html` |
| JSON report | `tests/output/hirely-test-lab/report.json` |

## Coverage matrix

| Dimension | Variants |
|-----------|----------|
| Countries | FR, DE, US, UK, NL, CH, CA |
| Languages | fr, de, en, nl |
| Layouts | word, pages, canva, indesign, creative-portfolio, linkedin |
| Categories | graphic-designer, developer, marketing, sales, student, executive, consultant, linkedin |
| Source types | text, docx, scanned-pdf (OCR sim), LinkedIn PDF/export/merge |
| Roles | designer, developer, engineer, executive, consultant, student, marketing, sales, freelancer, artist |

## Measured dimensions

| Metric | Description | Goal | Result |
|--------|-------------|------|--------|
| Import success | Pipeline completes without fatal errors | 90% | **96%** |
| Extraction accuracy | Weighted name/contact/experience/education/skills recall | 80% | **82.1%** |
| Template quality | Product score + scan-zone proxy for assigned V3 template | 70 | **64** |
| ATS score accuracy | ATS score meets expected minimum from ground truth | 75% | **86.5%** |
| PDF quality | Export-lock readiness (finalResume + contract) | 85% | **100%** |

## Goals met

- **extractionAccuracy**: PASS
- **templateQuality**: FAIL
- **atsScoreAccuracy**: PASS
- **pdfQuality**: PASS
- **importSuccess**: PASS

## By category

| Category | Count | Extraction | Template | ATS pass | PDF |
|----------|-------|------------|----------|----------|-----|
| graphic-designer | 5 | 66.8% | 66.7 | 0% | 100% |
| developer | 15 | 87.4% | 65.5 | 0% | 100% |
| marketing | 5 | 96% | 67.3 | 20% | 100% |
| sales | 5 | 87% | 62.4 | 0% | 100% |
| student | 5 | 69% | 58.8 | 0% | 100% |
| executive | 5 | 91% | 62.7 | 0% | 100% |
| consultant | 5 | 97% | 67.7 | 0% | 100% |
| linkedin | 5 | 52% | 57.9 | 20% | 100% |

## By country

| Country | Count | Extraction | Template | ATS pass | PDF |
|---------|-------|------------|----------|----------|-----|
| FR | 6 | 60.7% | 60.3 | 0% | 100% |
| DE | 6 | 90% | 62.5 | 0% | 100% |
| US | 12 | 90.4% | 66.8 | 16.7% | 100% |
| UK | 11 | 89.5% | 65.1 | 0% | 100% |
| NL | 5 | 69% | 58.8 | 0% | 100% |
| CH | 5 | 91% | 62.7 | 0% | 100% |
| CA | 5 | 66.3% | 67.4 | 0% | 100% |

## Scanned PDF / OCR

- **canva** (9): extraction 83.2%, PDF 100%
- **indesign** (5): extraction 76.9%, PDF 100%
- **creative-portfolio** (4): extraction 96.3%, PDF 100%

## LinkedIn

- **linkedin** (5): extraction 52%, template 57.9

## Lowest extraction scores

| ID | Role | Country | Layout | Extraction | Notes |
|----|------|---------|--------|------------|-------|
| lab-47-linkedin-export-en | marketing | US | linkedin | 10% | — |
| lab-46-linkedin-pdf-fr | designer | FR | linkedin | 30% | — |
| lab-22-student-pdftext | student | NL | pages | 45% | — |
| lab-05-designer-pdfprotected | designer | FR | indesign | 56.3% | — |
| lab-45-freelancer-pdfprotected | freelancer | CA | indesign | 56.3% | — |
| lab-01-designer-txt | designer | FR | word | 58.8% | — |
| lab-03-designer-pdfscan | designer | FR | canva | 58.8% | — |
| lab-02-designer-pdftext | designer | FR | pages | 60% | — |

## Verification

```bash
npm run qa:hirely-test-lab
npm run hirely-test-lab-report
```

Open `test-lab/index.html` (serve repo root) to browse the JSON dashboard.

