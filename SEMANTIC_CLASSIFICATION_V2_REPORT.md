# HIRELY H11 — Semantic Classification V2

**Result:** PASS
**Generated:** 2026-06-08T21:51:47.735Z

## Engine

- Module: `src/core/parsing/semantic-classifier-v2.js`
- Auto-place threshold: confidence > 80
- Below threshold → review queue (`UNKNOWN` / `unsorted`)

## Semantic types

| Type | Auto-place when |
|------|-----------------|
| PERSON_NAME | Valid person name, not section/portfolio/title |
| JOB_TITLE | Role line with dictionary/role signals |
| SUMMARY | Long prose only (never company/school/program) |
| EXPERIENCE | Dated role/employment lines |
| COMPANY / CLIENT | Agencies, brands (McCann, JB Impressions, …) |
| EDUCATION | Schools (LISAA, Parsons, MIT) + program lines |
| SKILL / TOOL / LANGUAGE | Specialty V2 with contracts |
| LINK | Email, phone, portfolio URLs |

## Regression cases (H11 examples)

| Case | Line | Result | Status |
|------|------|--------|--------|
| expertise_not_name | Expertise Specialized | UNKNOWN (55) | PASS |
| jb_not_summary | JB Impressions | CLIENT (96) | PASS |
| visual_comm_not_skill | visual communication | EDUCATION (84) | PASS |
| market_reviews_not_school | Market Reviews | CLIENT (96) | PASS |
| mccann_company | McCann G. Agency (Internship) | CLIENT (96) | PASS |
| lisaa_education | 2011 2012 : LISAA, web and motion design | EDUCATION (98) | PASS |
| parsons_education | Parsons School of Design — BFA | EDUCATION (95) | PASS |

## P7 stress suite — semantic audit

**20/20** CVs with zero semantic misclassification (100%)

| Fixture | Status | Issues |
|---------|--------|--------|
| creative-cv | PASS | — |
| yoaz-cv | PASS | — |
| image-cv | PASS | — |
| mvp-sample | PASS | — |
| developer-cv | PASS | — |
| developer-cv-ocr | PASS | — |
| marketing-cv | PASS | — |
| marketing-cv-ocr | PASS | — |
| sales-cv | PASS | — |
| student-cv | PASS | — |
| executive-cv | PASS | — |
| academic-cv | PASS | — |
| recruiter-cv | PASS | — |
| consultant-cv | PASS | — |
| two-column-cv | PASS | — |
| text-pdf | PASS | — |
| scanned-pdf | PASS | — |
| docx | PASS | — |
| sales-cv-ocr | PASS | — |
| executive-cv-ocr | PASS | — |

## Acceptance rules

- No title becomes candidate name
- No company becomes summary
- No school/program becomes skill
- No portfolio/agency label becomes education

## Command gates

| Command | Status |
|---------|--------|
| `node src/tests/qa-semantic-classifier-v2.mjs` | PASS |
| `npm run qa:p7-stress-test` | PASS |

## Remaining blockers

_None — semantic V2 ready._

## Run

```bash
npm run semantic-classification-v2-report
```
