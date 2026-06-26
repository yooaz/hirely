# REAL_WORLD_IMPORT_TRUTH_REPORT

**Status:** FAIL
**Engine:** `REAL_WORLD_IMPORT_TRUTH_V1`
**Generated:** 2026-06-15T17:05:45.446Z

## Why this exists

Controlled import fixtures can PASS while real user CVs fail. This benchmark uses messy corpus variants (Canva/InDesign layouts, column DOCX, scanned image PDFs, legacy DOC, image CVs) plus optional files in `tests/real-world-corpus/`.

## Corpus coverage

| Category | Target | Built |
|----------|--------|-------|
| Selectable PDF | 5 | 5 |
| Scanned PDF | 5 | 5 |
| Canva/InDesign PDF | 5 | 5 |
| DOCX columns/tables | 5 | 5 |
| DOC legacy | 3 | 3 |
| Image CV | 3 | 3 |
| TXT / paste | 3 | 3 |
| User corpus (optional) | — | 1 |

Drop real failing CVs into `tests/real-world-corpus/` to extend the benchmark.

## PASS rules

- No crash, no stuck import, no fake success
- If `selectedTextLength < 300` → status must be `IMPORT_NEEDS_PASTE`, `IMPORT_UNSUPPORTED`, or `IMPORT_FAILED`
- If status is `IMPORT_READY` → preview must have structured content (experience/education/skills + identity)

## Outcome distribution

- **IMPORT_FAILED**: 21
- **IMPORT_NEEDS_PASTE**: 9

## Category pass rate

| Category | Pass | Fail | Total |
|----------|------|------|-------|
| pdf_selectable | 0 | 5 | 5 |
| pdf_scanned | 0 | 5 | 5 |
| pdf_design_export | 0 | 5 | 5 |
| docx_columns | 0 | 5 | 5 |
| doc_legacy | 0 | 3 | 3 |
| image_cv | 0 | 3 | 3 |
| txt_paste | 0 | 3 | 3 |
| user_pdf | 0 | 1 | 1 |

## Per-file results

| fileName | fileType | native | ocr | docx | selected | source | identity | exp | edu | preview | queue | status | Pass |
|----------|----------|--------|-----|------|----------|--------|----------|-----|-----|---------|-------|--------|------|
| selectable-developer.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 757 | 0 | **IMPORT_FAILED** | ✗ |
| selectable-designer.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 0 | 0 | **IMPORT_NEEDS_PASTE** | ✗ |
| selectable-consultant.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 794 | 0 | **IMPORT_FAILED** | ✗ |
| selectable-executive.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 551 | 0 | **IMPORT_FAILED** | ✗ |
| selectable-marketing.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 814 | 0 | **IMPORT_FAILED** | ✗ |
| scanned-freelancer.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 0 | 0 | **IMPORT_NEEDS_PASTE** | ✗ |
| scanned-nurse.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 0 | 0 | **IMPORT_NEEDS_PASTE** | ✗ |
| scanned-student.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 0 | 0 | **IMPORT_NEEDS_PASTE** | ✗ |
| scanned-teacher.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 0 | 0 | **IMPORT_NEEDS_PASTE** | ✗ |
| scanned-yoaz.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 0 | 0 | **IMPORT_NEEDS_PASTE** | ✗ |
| canva-developer.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 847 | 0 | **IMPORT_FAILED** | ✗ |
| canva-designer.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 854 | 0 | **IMPORT_FAILED** | ✗ |
| canva-marketing.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 904 | 0 | **IMPORT_FAILED** | ✗ |
| indesign-consultant.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 793 | 0 | **IMPORT_FAILED** | ✗ |
| indesign-executive.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 551 | 0 | **IMPORT_FAILED** | ✗ |
| columns-twoColumn.docx | docx | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 373 | 0 | **IMPORT_FAILED** | ✗ |
| columns-creative.docx | docx | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 1054 | 0 | **IMPORT_FAILED** | ✗ |
| columns-developer.docx | docx | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 778 | 0 | **IMPORT_FAILED** | ✗ |
| columns-marketing.docx | docx | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 824 | 0 | **IMPORT_FAILED** | ✗ |
| columns-engineer.docx | docx | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 567 | 0 | **IMPORT_FAILED** | ✗ |
| developer-legacy.doc | doc | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 778 | 0 | **IMPORT_FAILED** | ✗ |
| designer-legacy.doc | doc | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 807 | 0 | **IMPORT_FAILED** | ✗ |
| yoaz-legacy.doc | doc | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 1054 | 0 | **IMPORT_FAILED** | ✗ |
| cv-developer.png | image | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 0 | 0 | **IMPORT_NEEDS_PASTE** | ✗ |
| cv-designer.png | image | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 0 | 0 | **IMPORT_NEEDS_PASTE** | ✗ |
| cv-consultant.png | image | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 0 | 0 | **IMPORT_NEEDS_PASTE** | ✗ |
| yoaz.txt | txt | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 2606 | 0 | **IMPORT_FAILED** | ✗ |
| developer.txt | txt | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 789 | 0 | **IMPORT_FAILED** | ✗ |
| academic.txt | txt | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 919 | 0 | **IMPORT_FAILED** | ✗ |
| fixture.pdf | pdf | 0 | 0 | 0 | 0 | — | ✗ | 0 | 0 | 604 | 0 | **IMPORT_FAILED** | ✗ |

## Failures detail

- **selectable-developer.pdf** (pdf_selectable): IMPORT_FAILED — import_not_recovered
- **selectable-designer.pdf** (pdf_selectable): IMPORT_NEEDS_PASTE — paste_fallback_not_success
- **selectable-consultant.pdf** (pdf_selectable): IMPORT_FAILED — import_not_recovered
- **selectable-executive.pdf** (pdf_selectable): IMPORT_FAILED — import_not_recovered
- **selectable-marketing.pdf** (pdf_selectable): IMPORT_FAILED — import_not_recovered
- **scanned-freelancer.pdf** (pdf_scanned): IMPORT_NEEDS_PASTE — paste_fallback_not_success
- **scanned-nurse.pdf** (pdf_scanned): IMPORT_NEEDS_PASTE — paste_fallback_not_success
- **scanned-student.pdf** (pdf_scanned): IMPORT_NEEDS_PASTE — paste_fallback_not_success
- **scanned-teacher.pdf** (pdf_scanned): IMPORT_NEEDS_PASTE — paste_fallback_not_success
- **scanned-yoaz.pdf** (pdf_scanned): IMPORT_NEEDS_PASTE — paste_fallback_not_success
- **canva-developer.pdf** (pdf_design_export): IMPORT_FAILED — import_not_recovered
- **canva-designer.pdf** (pdf_design_export): IMPORT_FAILED — import_not_recovered
- **canva-marketing.pdf** (pdf_design_export): IMPORT_FAILED — import_not_recovered
- **indesign-consultant.pdf** (pdf_design_export): IMPORT_FAILED — import_not_recovered
- **indesign-executive.pdf** (pdf_design_export): IMPORT_FAILED — import_not_recovered
- **columns-twoColumn.docx** (docx_columns): IMPORT_FAILED — import_not_recovered
- **columns-creative.docx** (docx_columns): IMPORT_FAILED — import_not_recovered
- **columns-developer.docx** (docx_columns): IMPORT_FAILED — import_not_recovered
- **columns-marketing.docx** (docx_columns): IMPORT_FAILED — import_not_recovered
- **columns-engineer.docx** (docx_columns): IMPORT_FAILED — import_not_recovered
- **developer-legacy.doc** (doc_legacy): IMPORT_FAILED — import_not_recovered
- **designer-legacy.doc** (doc_legacy): IMPORT_FAILED — import_not_recovered
- **yoaz-legacy.doc** (doc_legacy): IMPORT_FAILED — import_not_recovered
- **cv-developer.png** (image_cv): IMPORT_NEEDS_PASTE — paste_fallback_not_success
- **cv-designer.png** (image_cv): IMPORT_NEEDS_PASTE — paste_fallback_not_success
- **cv-consultant.png** (image_cv): IMPORT_NEEDS_PASTE — paste_fallback_not_success
- **yoaz.txt** (txt_paste): IMPORT_FAILED — import_not_recovered
- **developer.txt** (txt_paste): IMPORT_FAILED — import_not_recovered
- **academic.txt** (txt_paste): IMPORT_FAILED — import_not_recovered
- **fixture.pdf** (user_pdf): IMPORT_FAILED — import_not_recovered

## Forbidden totals

| Check | Count |
|-------|-------|
| IMPORT_CRASH | 0 |
| IMPORT_STUCK | 0 |
| Fake success | 0 |
| Thin text wrong status | 0 |
| READY without structure | 0 |

## Verify

```bash
npm run setup:vendor-tesseract
npm run qa:real-world-import-truth
npm run real-world-import-truth-report
```

## QA console (tail)

```
OK fixture count 30 (min 29)
OK pdf_selectable 5
OK pdf_scanned 5
OK pdf_design_export 5
OK docx_columns 5
OK doc_legacy 3
OK image_cv 3
OK txt_paste 3
OK no crash (0)
OK no stuck (0)
OK no fake success (0)

Wrote /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/tests/output/real-world-import-truth/report.json

30 gate failures — REAL WORLD IMPORT TRUTH FAIL

(node:16848) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/vendor/tesseract-runtime.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
FAIL pdf_sel_developer → IMPORT_FAILED sel=0 exp=0 (3089ms)
  reasons: import_not_recovered
FAIL pdf_sel_designer → IMPORT_NEEDS_PASTE sel=0 exp=0 (10258ms)
  reasons: paste_fallback_not_success
FAIL pdf_sel_consultant → IMPORT_FAILED sel=0 exp=0 (7539ms)
  reasons: import_not_recovered
FAIL pdf_sel_executive → IMPORT_FAILED sel=0 exp=0 (4318ms)
  reasons: import_not_recovered
FAIL pdf_sel_marketing → IMPORT_FAILED sel=0 exp=0 (7103ms)
  reasons: import_not_recovered
FAIL pdf_scan_freelancer → IMPORT_NEEDS_PASTE sel=0 exp=0 (1262ms)
  reasons: paste_fallback_not_success
FAIL pdf_scan_nurse → IMPORT_NEEDS_PASTE sel=0 exp=0 (1668ms)
  reasons: paste_fallback_not_success
FAIL pdf_scan_student → IMPORT_NEEDS_PASTE sel=0 exp=0 (9601ms)
  reasons: paste_fallback_not_success
FAIL pdf_scan_teacher → IMPORT_NEEDS_PASTE sel=0 exp=0 (3590ms)
  reasons: paste_fallback_not_success
FAIL pdf_scan_yoaz → IMPORT_NEEDS_PASTE sel=0 exp=0 (1418ms)
  reasons: paste_fallback_not_success
FAIL pdf_canva_developer → IMPORT_FAILED sel=0 exp=0 (1818ms)
  reasons: import_not_recovered
FAIL pdf_canva_designer → IMPORT_FAILED sel=0 exp=0 (1849ms)
  reasons: import_not_recovered
FAIL pdf_canva_marketing → IMPORT_FAILED sel=0 exp=0 (1648ms)
  reasons: import_not_recovered
FAIL pdf_indesign_consultant → IMPORT_FAILED sel=0 exp=0 (3024ms)
  reasons: import_not_recovered
FAIL pdf_indesign_executive → IMPORT_FAILED sel=0 exp=0 (1206ms)
  reasons: import_not_recovered
FAIL docx_col_twoColumn → IMPORT_FAILED sel=0 exp=0 (754ms)
  reasons: import_not_recovered
FAIL docx_col_creative → IMPORT_FAILED sel=0 exp=0 (807ms)
  reasons: import_not_recovered
FAIL docx_col_developer → IMPORT_FAILED sel=0 exp=0 (885ms)
  reasons: import_not_recovered
FAIL docx_col_marketing → IMPORT_FAILED sel=0 exp=0 (835ms)
  reasons: import_not_recovered
FAIL docx_col_engineer → IMPORT_FAILED sel=0 exp=0 (969ms)
  reasons: import_not_recovered
FAIL doc_developer → IMPORT_FAILED sel=0 exp=0 (782ms)
  reasons: import_not_recovered
FAIL doc_designer → IMPORT_FAILED sel=0 exp=0 (1317ms)
  reasons: import_not_recovered
FAIL doc_yoaz → IMPORT_FAILED sel=0 exp=0 (1963ms)
  reasons: import_not_recovered
FAIL img_developer → IMPORT_NEEDS_PASTE sel=0 exp=0 (1137ms)
  reasons: paste_fallback_not_success
FAIL img_designer → IMPORT_NEEDS_PASTE sel=0 exp=0 (971ms)
  reasons: paste_fallback_not_success
FAIL img_consultant → IMPORT_NEEDS_PASTE sel=0 exp=0 (1055ms)
  reasons: paste_fallback_not_success
FAIL txt_yoaz → IMPORT_FAILED sel=0 exp=0 (2990ms)
  reasons: import_not_recovered
FAIL txt_developer → IMPORT_FAILED sel=0 exp=0 (1457ms)
  reasons: import_not_recovered
FAIL txt_academic → IMPORT_FAILED sel=0 exp=0 (3355ms)
  reasons: import_not_recovered
FAIL user_real_pdf → IMPORT_FAILED sel=0 exp=0 (1500ms)
  reasons: import_not_recovered
```
