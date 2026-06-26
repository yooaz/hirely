# Real World Stress Test Report (P0)

**Generated:** 2026-06-13T11:04:11.894Z
**Engine:** HIRELY_REAL_WORLD_STRESS_P0
**Goal:** **95%+** extraction accuracy before further UI work

## Executive summary

| Metric | Value | Goal | Status |
| --- | --- | --- | --- |
| **Overall extraction accuracy** | **86.4%** | ≥ 95% | FAIL |
| **Success rate** (per-CV pass) | **22%** (11/50) | — | FAIL |
| **Failure rate** | **78%** (39/50) | — | — |
| Identity accuracy | 98% | ≥ 95% | PASS |
| Email accuracy | 100% | ≥ 95% | PASS |
| Phone accuracy | 88% | ≥ 95% | FAIL |
| Experience accuracy | 76.9% | ≥ 95% | FAIL |
| Education accuracy | 90% | ≥ 95% | FAIL |
| Skills accuracy | 65.8% | ≥ 95% | FAIL |

## Catalog

**50 real CVs** across 10 roles × 5 format variants:

| Role | Formats per role |
| --- | --- |
| Designer | TXT, PDF-text, PDF-scan, DOCX, PNG |
| Engineer | TXT, PDF-text, PDF-scan, DOCX, JPG |
| Marketing | TXT, PDF-text, PDF-scan, DOCX, PNG |
| Sales | TXT, PDF-text, PDF-scan, DOCX, JPG |
| Student | TXT, PDF-text, PDF-scan, DOCX, PNG |
| Executive | TXT, PDF-text, PDF-scan, DOCX, JPG |
| Consultant | TXT, PDF-text, PDF-scan, DOCX, PNG |
| Creative Director | TXT, PDF-text, PDF-scan, DOCX, PNG |
| Freelancer | TXT, PDF-text, PDF-scan, DOCX, JPG |
| Artist | TXT, PDF-text, PDF-scan, DOCX, PNG |

Formats: **PDF text**, **PDF scan** (OCR sim), **DOCX**, **TXT**, **PNG/JPG** (image OCR sim).

Catalog: `tests/lib/real-world-stress-catalog.mjs`

## Results by role

| Role | Cases | Pass rate | Avg accuracy |
| --- | --- | --- | --- |
| designer | 5 | 40% | 90.6% |
| engineer | 5 | 0% | 76.7% |
| marketing | 5 | 0% | 93.3% |
| sales | 5 | 80% | 96.1% |
| student | 5 | 0% | 65.8% |
| executive | 5 | 0% | 91.7% |
| consultant | 5 | 0% | 91% |
| creative-director | 5 | 60% | 94.6% |
| freelancer | 5 | 20% | 82.3% |
| artist | 5 | 20% | 82.4% |

## Results by format

| Format | Cases | Pass rate | Avg accuracy |
| --- | --- | --- | --- |
| TXT | 10 | 20% | 86.5% |
| PDF-text | 10 | 20% | 88.8% |
| PDF-scan | 10 | 20% | 85.5% |
| DOCX | 10 | 40% | 87.5% |
| PNG | 6 | 0% | 81.6% |
| JPG | 4 | 25% | 87.5% |

## Root causes (failing cases)

| Root cause | Count |
| --- | --- |
| skills_recall_low | 29 |
| experience_recall_low | 16 |
| identity_phone | 8 |
| identity_name | 1 |

## Per-CV results

| ID | Role | Format | Overall | Identity | Email | Phone | Exp | Edu | Skills | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rw-01-designer-txt | designer | TXT | 88.9% | 100% | 100% | 100% | 33.3% | 100% | 100% | FAIL |
| rw-02-designer-pdftext | designer | PDF-text | 100% | 100% | 100% | 100% | 100% | 100% | 100% | PASS |
| rw-03-designer-pdfscan | designer | PDF-scan | 88.9% | 100% | 100% | 100% | 33.3% | 100% | 100% | FAIL |
| rw-04-designer-docx | designer | DOCX | 100% | 100% | 100% | 100% | 100% | 100% | 100% | PASS |
| rw-05-designer-png | designer | PNG | 75% | 100% | 100% | 100% | 0% | 100% | 50% | FAIL |
| rw-06-engineer-txt | engineer | TXT | 83.3% | 100% | 100% | 100% | 0% | 100% | 100% | FAIL |
| rw-07-engineer-pdftext | engineer | PDF-text | 66.7% | 100% | 100% | 0% | 100% | 0% | 100% | FAIL |
| rw-08-engineer-pdfscan | engineer | PDF-scan | 83.3% | 100% | 100% | 100% | 0% | 100% | 100% | FAIL |
| rw-09-engineer-docx | engineer | DOCX | 66.7% | 100% | 100% | 0% | 100% | 0% | 100% | FAIL |
| rw-10-engineer-jpg | engineer | JPG | 83.3% | 100% | 100% | 100% | 0% | 100% | 100% | FAIL |
| rw-11-marketing-txt | marketing | TXT | 93.3% | 100% | 100% | 100% | 100% | 100% | 60% | FAIL |
| rw-12-marketing-pdftext | marketing | PDF-text | 93.3% | 100% | 100% | 100% | 100% | 100% | 60% | FAIL |
| rw-13-marketing-pdfscan | marketing | PDF-scan | 93.3% | 100% | 100% | 100% | 100% | 100% | 60% | FAIL |
| rw-14-marketing-docx | marketing | DOCX | 93.3% | 100% | 100% | 100% | 100% | 100% | 60% | FAIL |
| rw-15-marketing-png | marketing | PNG | 93.3% | 100% | 100% | 100% | 100% | 100% | 60% | FAIL |
| rw-16-sales-txt | sales | TXT | 100% | 100% | 100% | 100% | 100% | 100% | 100% | PASS |
| rw-17-sales-pdftext | sales | PDF-text | 80.6% | 100% | 100% | 100% | 50% | 100% | 33.3% | FAIL |
| rw-18-sales-pdfscan | sales | PDF-scan | 100% | 100% | 100% | 100% | 100% | 100% | 100% | PASS |
| rw-19-sales-docx | sales | DOCX | 100% | 100% | 100% | 100% | 100% | 100% | 100% | PASS |
| rw-20-sales-jpg | sales | JPG | 100% | 100% | 100% | 100% | 100% | 100% | 100% | PASS |
| rw-21-student-txt | student | TXT | 62.5% | 100% | 100% | 0% | 50% | 100% | 25% | FAIL |
| rw-22-student-pdftext | student | PDF-text | 83.3% | 0% | 100% | 100% | 100% | 100% | 100% | FAIL |
| rw-23-student-pdfscan | student | PDF-scan | 62.5% | 100% | 100% | 0% | 50% | 100% | 25% | FAIL |
| rw-24-student-docx | student | DOCX | 58.3% | 100% | 100% | 0% | 50% | 100% | 0% | FAIL |
| rw-25-student-png | student | PNG | 62.5% | 100% | 100% | 0% | 50% | 100% | 25% | FAIL |
| rw-26-executive-txt | executive | TXT | 91.7% | 100% | 100% | 100% | 100% | 100% | 50% | FAIL |
| rw-27-executive-pdftext | executive | PDF-text | 91.7% | 100% | 100% | 100% | 100% | 100% | 50% | FAIL |
| rw-28-executive-pdfscan | executive | PDF-scan | 91.7% | 100% | 100% | 100% | 100% | 100% | 50% | FAIL |
| rw-29-executive-docx | executive | DOCX | 91.7% | 100% | 100% | 100% | 100% | 100% | 50% | FAIL |
| rw-30-executive-jpg | executive | JPG | 91.7% | 100% | 100% | 100% | 100% | 100% | 50% | FAIL |
| rw-31-consultant-txt | consultant | TXT | 93.3% | 100% | 100% | 100% | 100% | 100% | 60% | FAIL |
| rw-32-consultant-pdftext | consultant | PDF-text | 93.3% | 100% | 100% | 100% | 100% | 100% | 60% | FAIL |
| rw-33-consultant-pdfscan | consultant | PDF-scan | 93.3% | 100% | 100% | 100% | 100% | 100% | 60% | FAIL |
| rw-34-consultant-docx | consultant | DOCX | 81.7% | 100% | 100% | 100% | 50% | 100% | 40% | FAIL |
| rw-35-consultant-png | consultant | PNG | 93.3% | 100% | 100% | 100% | 100% | 100% | 60% | FAIL |
| rw-36-creative-director-txt | creative-director | TXT | 96.7% | 100% | 100% | 100% | 100% | 100% | 80% | PASS |
| rw-37-creative-director-pdftext | creative-director | PDF-text | 88.9% | 100% | 100% | 100% | 33.3% | 100% | 100% | FAIL |
| rw-38-creative-director-pdfscan | creative-director | PDF-scan | 96.7% | 100% | 100% | 100% | 100% | 100% | 80% | PASS |
| rw-39-creative-director-docx | creative-director | DOCX | 100% | 100% | 100% | 100% | 100% | 100% | 100% | PASS |
| rw-40-creative-director-png | creative-director | PNG | 90.7% | 100% | 100% | 100% | 44.4% | 100% | 100% | FAIL |
| rw-41-freelancer-txt | freelancer | TXT | 83.3% | 100% | 100% | 100% | 100% | 100% | 0% | FAIL |
| rw-42-freelancer-pdftext | freelancer | PDF-text | 100% | 100% | 100% | 100% | 100% | 100% | 100% | PASS |
| rw-43-freelancer-pdfscan | freelancer | PDF-scan | 70% | 100% | 100% | 100% | 0% | 100% | 20% | FAIL |
| rw-44-freelancer-docx | freelancer | DOCX | 83.3% | 100% | 100% | 100% | 100% | 100% | 0% | FAIL |
| rw-45-freelancer-jpg | freelancer | JPG | 75% | 100% | 100% | 100% | 0% | 100% | 50% | FAIL |
| rw-46-artist-txt | artist | TXT | 72.2% | 100% | 100% | 100% | 100% | 0% | 33.3% | FAIL |
| rw-47-artist-pdftext | artist | PDF-text | 90% | 100% | 100% | 100% | 100% | 100% | 40% | FAIL |
| rw-48-artist-pdfscan | artist | PDF-scan | 75% | 100% | 100% | 100% | 100% | 0% | 50% | FAIL |
| rw-49-artist-docx | artist | DOCX | 100% | 100% | 100% | 100% | 100% | 100% | 100% | PASS |
| rw-50-artist-png | artist | PNG | 75% | 100% | 100% | 100% | 100% | 0% | 50% | FAIL |

## QA output

```
FAIL rw-13-marketing-pdfscan: extraction=93.3% identity=100% email=100% phone=100% exp=100% skills=60%
FAIL rw-14-marketing-docx: extraction=93.3% identity=100% email=100% phone=100% exp=100% skills=60%
FAIL rw-15-marketing-png: extraction=93.3% identity=100% email=100% phone=100% exp=100% skills=60%
FAIL rw-17-sales-pdftext: extraction=80.6% identity=100% email=100% phone=100% exp=50% skills=33.3%
FAIL rw-21-student-txt: extraction=62.5% identity=100% email=100% phone=0% exp=50% skills=25%
FAIL rw-22-student-pdftext: extraction=83.3% identity=0% email=100% phone=100% exp=100% skills=100%
FAIL rw-23-student-pdfscan: extraction=62.5% identity=100% email=100% phone=0% exp=50% skills=25%
FAIL rw-24-student-docx: extraction=58.3% identity=100% email=100% phone=0% exp=50% skills=0%
FAIL rw-25-student-png: extraction=62.5% identity=100% email=100% phone=0% exp=50% skills=25%
FAIL rw-26-executive-txt: extraction=91.7% identity=100% email=100% phone=100% exp=100% skills=50%
FAIL rw-27-executive-pdftext: extraction=91.7% identity=100% email=100% phone=100% exp=100% skills=50%
FAIL rw-28-executive-pdfscan: extraction=91.7% identity=100% email=100% phone=100% exp=100% skills=50%
FAIL rw-29-executive-docx: extraction=91.7% identity=100% email=100% phone=100% exp=100% skills=50%
FAIL rw-30-executive-jpg: extraction=91.7% identity=100% email=100% phone=100% exp=100% skills=50%
FAIL rw-31-consultant-txt: extraction=93.3% identity=100% email=100% phone=100% exp=100% skills=60%
FAIL rw-32-consultant-pdftext: extraction=93.3% identity=100% email=100% phone=100% exp=100% skills=60%
FAIL rw-33-consultant-pdfscan: extraction=93.3% identity=100% email=100% phone=100% exp=100% skills=60%
FAIL rw-34-consultant-docx: extraction=81.7% identity=100% email=100% phone=100% exp=50% skills=40%
FAIL rw-35-consultant-png: extraction=93.3% identity=100% email=100% phone=100% exp=100% skills=60%
FAIL rw-37-creative-director-pdftext: extraction=88.9% identity=100% email=100% phone=100% exp=33.3% skills=100%
FAIL rw-40-creative-director-png: extraction=90.7% identity=100% email=100% phone=100% exp=44.4% skills=100%
FAIL rw-41-freelancer-txt: extraction=83.3% identity=100% email=100% phone=100% exp=100% skills=0%
FAIL rw-43-freelancer-pdfscan: extraction=70% identity=100% email=100% phone=100% exp=0% skills=20%
FAIL rw-44-freelancer-docx: extraction=83.3% identity=100% email=100% phone=100% exp=100% skills=0%
FAIL rw-45-freelancer-jpg: extraction=75% identity=100% email=100% phone=100% exp=0% skills=50%
FAIL rw-46-artist-txt: extraction=72.2% identity=100% email=100% phone=100% exp=100% skills=33.3%
FAIL rw-47-artist-pdftext: extraction=90% identity=100% email=100% phone=100% exp=100% skills=40%
FAIL rw-48-artist-pdfscan: extraction=75% identity=100% email=100% phone=100% exp=100% skills=50%
FAIL rw-50-artist-png: extraction=75% identity=100% email=100% phone=100% exp=100% skills=50%

```

## Re-run

```bash
npm run qa:real-world-stress
npm run real-world-stress-report
```

Artifacts: `tests/output/real-world-stress/report.json`
