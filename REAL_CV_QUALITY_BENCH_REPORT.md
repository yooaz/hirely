# Real CV Quality Benchmark Report (H15)

**Verdict:** PASS

## Goal

Realistic 20-CV quality bench measuring extraction accuracy and CV preview cleanliness across document types and career profiles.

## Catalog

`tests/lib/h15-real-cv-bench-catalog.mjs` — 20 cases:

| Category | Cases |
|----------|-------|
| clean-pdf | native PDF text + DOCX export |
| scanned-pdf | scanned OCR + developer OCR sim |
| image-cv | sparse image layout + designer OCR sim |
| two-column | PDF two-column + sales paste |
| portfolio | creative + Yoaz designer portfolios |
| student | student + academic |
| developer | clean + OCR sim |
| marketing | clean + OCR sim |
| freelance | corpus freelancer + designer freelance |
| executive | clean + OCR sim |

## Metrics (per case)

| Metric | Description |
|--------|-------------|
| Name accuracy | Strict match vs fixture header name |
| Contact accuracy | Email + phone match vs fixture contact line |
| Experience accuracy | Section recall vs ground truth |
| Education accuracy | Section recall vs ground truth |
| Skills accuracy | Section recall vs ground truth |
| Garbage leakage | Critical parser/OCR garbage in `finalResumeData` |
| Manual review count | Pending items in review queue (À valider) |
| Clean CV preview | No gated low-confidence text + zero critical garbage |

## PASS thresholds

| Gate | Threshold | Result |
|------|-----------|--------|
| Name accuracy | ≥ 90% | **100%** |
| Contact accuracy | ≥ 95% | **100%** |
| Critical garbage | = 0 | **0** |
| Clean CV preview | 20/20 | **20/20** |

Review items are allowed; CV preview must stay clean.

## Aggregate scores

| Dimension | Score |
|-----------|-------|
| Experience accuracy (avg) | 79.7% |
| Education accuracy (avg) | 77.5% |
| Skills accuracy (avg) | 96.2% |
| Languages accuracy (avg) | 95% |
| Manual review (avg / total) | 8.2 / 163 |

## By category

| Category | Cases | Name hits | Clean preview | Garbage |
|----------|-------|-----------|---------------|---------|
| clean-pdf | 2 | 2/2 names | 2/2 clean | 0 garbage |
| scanned-pdf | 2 | 2/2 names | 2/2 clean | 0 garbage |
| image-cv | 2 | 2/2 names | 2/2 clean | 0 garbage |
| two-column | 2 | 2/2 names | 2/2 clean | 0 garbage |
| portfolio | 2 | 2/2 names | 2/2 clean | 0 garbage |
| student | 2 | 2/2 names | 2/2 clean | 0 garbage |
| developer | 2 | 2/2 names | 2/2 clean | 0 garbage |
| marketing | 2 | 2/2 names | 2/2 clean | 0 garbage |
| freelance | 2 | 2/2 names | 2/2 clean | 0 garbage |
| executive | 2 | 2/2 names | 2/2 clean | 0 garbage |

## Per-case results

| ID | Category | Name | Contact | Exp | Edu | Skills | Garbage | Review | Clean |
|----|----------|------|---------|-----|-----|--------|---------|--------|-------|
| h15-01-clean-pdf | clean-pdf | 100% | 100% | 100% | 0% | 100% | 0 | 7 | yes |
| h15-02-clean-docx | clean-pdf | 100% | 100% | 100% | 0% | 100% | 0 | 7 | yes |
| h15-03-scanned-pdf | scanned-pdf | 100% | 100% | 0% | 100% | 100% | 0 | 5 | yes |
| h15-04-scanned-dev | scanned-pdf | 100% | 100% | 100% | 100% | 100% | 0 | 7 | yes |
| h15-05-image-cv | image-cv | 100% | 100% | 100% | 100% | 100% | 0 | 5 | yes |
| h15-06-image-yoaz | image-cv | 100% | 100% | 22.2% | 100% | 83.3% | 0 | 17 | yes |
| h15-07-two-column | two-column | 100% | 100% | 50% | 0% | 100% | 0 | 11 | yes |
| h15-08-two-column-sales | two-column | 100% | 100% | 100% | 100% | 100% | 0 | 7 | yes |
| h15-09-portfolio-creative | portfolio | 100% | 100% | 100% | 100% | 100% | 0 | 5 | yes |
| h15-10-portfolio-yoaz | portfolio | 100% | 100% | 22.2% | 100% | 100% | 0 | 21 | yes |
| h15-11-student | student | 100% | 100% | 50% | 50% | 100% | 0 | 14 | yes |
| h15-12-academic | student | 100% | 100% | 100% | 100% | 100% | 0 | 9 | yes |
| h15-13-developer | developer | 100% | 100% | 100% | 100% | 100% | 0 | 6 | yes |
| h15-14-developer-ocr | developer | 100% | 100% | 100% | 100% | 100% | 0 | 7 | yes |
| h15-15-marketing | marketing | 100% | 100% | 100% | 100% | 80% | 0 | 7 | yes |
| h15-16-marketing-ocr | marketing | 100% | 100% | 100% | 100% | 80% | 0 | 5 | yes |
| h15-17-freelance | freelance | 100% | 100% | 100% | 100% | 80% | 0 | 8 | yes |
| h15-18-freelance-designer | freelance | 100% | 100% | 100% | 100% | 100% | 0 | 5 | yes |
| h15-19-executive | executive | 100% | 100% | 100% | 50% | 100% | 0 | 6 | yes |
| h15-20-executive-ocr | executive | 100% | 100% | 50% | 50% | 100% | 0 | 4 | yes |

## QA output

```
  clients: 0,
  projects: 0,
  unsorted: 0
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 2,
  education: 1,
  skills: 5,
  tools: 0,
  languages: 1,
  clients: 0,
  projects: 0,
  unsorted: 0
}
OK fixture count 20/20
OK name accuracy 100% >= 90%
OK contact accuracy 100% >= 95%
OK critical garbage 0 === 0
OK clean CV preview 20/20
H15 bench: name 100% · contact 100% · garbage 0 · review avg 8.2 · clean preview 100%
(node:93420) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/pipeline/hirely-import.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```

## Acceptance checklist

- [x] 20 realistic CV cases executed
- [x] Name accuracy ≥ 90%
- [x] Contact accuracy ≥ 95%
- [x] Zero critical garbage leakage
- [x] Clean CV preview on all cases
- [ ] Review count tracked (informational — 163 pending total)

---

*Generated 2026-06-08T23:59:58.829Z*
