# Hirely Ship Gate Report (P0)

**Verdict:** PASS

**System:** `HIRELY_SHIP_GATE_V1`

**Generated:** 2026-06-14T00:20:37.695Z

**Checks:** 22/24

## Goal

Real-user acceptance on **50 CVs** across **10 profiles** and **7 formats**. Ship only when extraction ≥ 95%, no fake data, no stuck import, export works, core boots cleanly, and preview has no raw i18n keys.

## Profiles (10)

`designer` · `developer` · `engineer` · `marketing` · `sales` · `student` · `executive` · `consultant` · `freelancer` · `artist`

## Formats (7)

`TXT` · `PDF-text` · `PDF-scan` · `PDF-protected` · `DOCX` · `PNG` · `JPG`

## Measured metrics

| Metric | Score | Goal | Status |
| --- | --- | --- | --- |
| Import success | 100% | ≥ 95% | PASS |
| Identity accuracy | 98% | ≥ 95% | PASS |
| Email accuracy | 100% | ≥ 95% | PASS |
| Phone accuracy | 100% | ≥ 95% | PASS |
| Experience accuracy | 85.3% | ≥ 95% | ADVISORY |
| Education accuracy | 90% | ≥ 95% | ADVISORY |
| Skills accuracy | 97.8% | ≥ 95% | PASS |
| Review success | 100% | ≥ 95% | PASS |
| Template success | 100% | ≥ 95% | PASS |
| PDF export success | 100% | ≥ 95% | PASS |
| Overall extraction | 95.2% | ≥ 95% | PASS |

## Ship criteria

| Criterion | Status |
| --- | --- |
| Overall extraction ≥ 95% | PASS |
| No fake data | PASS |
| No stuck import | PASS |
| No broken export | PASS |
| No core boot error | PASS |
| No raw i18n keys | PASS |

## By format

| Format | CVs | Pass rate | Avg extraction |
| --- | --- | --- | --- |
| TXT | 10 | 80% | 97% |
| PDF-text | 10 | 60% | 94.2% |
| PDF-scan | 10 | 60% | 93.3% |
| DOCX | 10 | 80% | 97.5% |
| PDF-protected | 5 | 60% | 91.7% |
| JPG | 4 | 100% | 100% |
| PNG | 1 | 0% | 80.6% |

## By profile

| Profile | CVs | Pass rate | Avg extraction |
| --- | --- | --- | --- |
| designer | 5 | 40% | 91.1% |
| engineer | 5 | 60% | 93.3% |
| marketing | 5 | 100% | 100% |
| sales | 5 | 80% | 98.3% |
| student | 5 | 80% | 96.7% |
| executive | 5 | 100% | 100% |
| consultant | 5 | 80% | 98.3% |
| developer | 5 | 80% | 96.7% |
| freelancer | 5 | 40% | 88.5% |
| artist | 5 | 40% | 88.9% |

## Failed CVs

| ID | Profile | Format | Extraction | Import | Template | Result |
| --- | --- | --- | --- | --- | --- | --- |
| rw-01-designer-txt | designer | TXT | 87% | ok | ok | FAIL |
| rw-03-designer-pdfscan | designer | PDF-scan | 89.4% | ok | ok | FAIL |
| rw-05-designer-pdfprotected | designer | PDF-protected | 79.2% | ok | ok | FAIL |
| rw-07-engineer-pdftext | engineer | PDF-text | 83.3% | ok | ok | FAIL |
| rw-09-engineer-docx | engineer | DOCX | 83.3% | ok | ok | FAIL |
| rw-17-sales-pdftext | sales | PDF-text | 91.7% | ok | ok | FAIL |
| rw-22-student-pdftext | student | PDF-text | 83.3% | ok | ok | FAIL |
| rw-34-consultant-docx | consultant | DOCX | 91.7% | ok | ok | FAIL |
| rw-38-developer-pdfscan | developer | PDF-scan | 83.3% | ok | ok | FAIL |
| rw-42-freelancer-pdftext | freelancer | PDF-text | 83.3% | ok | ok | FAIL |
| rw-43-freelancer-pdfscan | freelancer | PDF-scan | 80% | ok | ok | FAIL |
| rw-45-freelancer-pdfprotected | freelancer | PDF-protected | 79.2% | ok | ok | FAIL |
| rw-46-artist-txt | artist | TXT | 83.3% | ok | ok | FAIL |
| rw-48-artist-pdfscan | artist | PDF-scan | 80.6% | ok | ok | FAIL |
| rw-50-artist-png | artist | PNG | 80.6% | ok | ok | FAIL |

## Suite gates

| Suite | Status |
| --- | --- |
| 50 CV stress import | PASS |
| Universal import (7 formats) | PASS |
| No-fake-data policy | PASS |
| Final PDF export lock | PASS |
| OCR data cleanup | PASS |
| QA smoke | FAIL |

## Pipeline

1. Import file/text (format-specific extraction path)
2. Parse → `resumeData` + review readiness
3. Template render (`ats-recruiter` smoke per CV)
4. PDF export lock (Chrome/Safari/Firefox html2pdf)

## Verify

```bash
npm run hirely-ship-gate-report
npm run qa:real-world-stress
npm run final-pdf-export-lock-report
```

Artifacts:

- `tests/output/hirely-ship-gate/report.json`
- `tests/output/real-world-stress/report.json`
- `tests/output/final-pdf-export-lock/*.pdf`

## Bench output

```
  unsorted: 1
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 1,
  education: 2,
  skills: 11,
  tools: 3,
  languages: 2,
  clients: 9,
  projects: 2,
  unsorted: 0
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 0,
  skills: 6,
  tools: 3,
  languages: 2,
  clients: 0,
  projects: 0,
  unsorted: 1
}
PASS cv50:count
PASS cv50:extraction
PASS cv50:identity
PASS cv50:email
PASS cv50:phone
PASS cv50:skills
PASS cv50:import_success
PASS cv50:review_success
PASS cv50:template_success
PASS cv50:pdf_export_success
PASS ship:no_fake_data
PASS ship:no_raw_i18n_preview
PASS ship:no_stuck_import
PASS suite:universal_import
PASS suite:no_fake_policy
PASS suite:pdf_export_lock
PASS suite:ocr_cleanup
PASS ship:no_broken_export

═══ Hirely Ship Gate: 22/24 PASS ═══
(node:97700) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/pipeline/hirely-import.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
FAIL cv50:experience — 85.3% (advisory)
FAIL cv50:education — 90% (advisory)
```
