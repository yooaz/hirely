# V1 Smoke Test

**Status:** **PASS**
**Run:** 2026-06-16T07:29:10.913Z

## Scope

| # | Flow | Expected |
|---|------|----------|
| 1 | TXT | Review → Style → Export |
| 2 | DOCX | Review → Style → Export |
| 3 | Text PDF | Review → Style → Export |
| 4 | Paste text | Review → Style → Export |
| 5 | Scanned PDF | Paste panel (no OCR) |

## Results

| Flow | Pass | Import | Review | Style | Export | Notes |
|------|------|--------|--------|-------|--------|-------|
| txt | PASS | 332ms | ✓ | ✓ | ✓ | Review → Style → Export (332ms import) |
| docx | PASS | 185ms | ✓ | ✓ | ✓ | Review → Style → Export (185ms import) |
| text_pdf | PASS | 1471ms | ✓ | ✓ | ✓ | Review → Style → Export (1471ms import) |
| paste_text | PASS | 1263ms | ✓ | ✓ | ✓ | Review → Style → Export (1263ms import) |
| scanned_pdf | PASS | 486ms | — | — | — | Paste panel in 486ms (no OCR) |

## Verification

```bash
npm run v1-smoke-test
```

Raw JSON: `tests/output/v1-smoke-test/report.json`
