# V1 Release Test Report

**Status:** PASS
**Run:** 2026-06-16T07:38:29.459Z

## Scope

V1 supported flows only. **No OCR.** Scanned PDF must show honest paste fallback.

| # | Flow | Fixture | Expected |
|---|------|---------|----------|
| 1 | Text PDF | `hirely-test-lab/good.pdf` | Review + preview |
| 2 | DOCX | `cv-yoaz.docx` | Review + preview |
| 3 | TXT | `yoaz.txt` | Review + preview |
| 4 | Paste | `yoaz.txt` via paste panel | Review &lt; 1s |
| 5 | Scanned PDF | `hirely-test-lab/scan.pdf` | Paste fallback ≤ 10s (no OCR) |

## Results

| Flow | Pass | Time | CV chars | Notes |
|------|------|------|----------|-------|
| txt | PASS | 321ms | 609 | Review + Style/Export unlocked |
| docx | PASS | 189ms | 609 | Review + Style/Export unlocked |
| text_pdf | PASS | 1330ms | 476 | Review + Style/Export unlocked |
| paste_text | PASS | 1371ms | 431 | Review + Style/Export unlocked |
| scanned_pdf | PASS | 173ms | 0 | Scanned PDF → paste fallback in 173ms (V1 — no OCR) |

## Acceptance

- **txt**: PASS — Review + Style/Export unlocked
- **docx**: PASS — Review + Style/Export unlocked
- **text_pdf**: PASS — Review + Style/Export unlocked
- **paste_text**: PASS — Review + Style/Export unlocked
- **scanned_pdf**: PASS — Scanned PDF → paste fallback in 173ms (V1 — no OCR)

## Raw JSON

`tests/output/v1-release-test/report.json`
