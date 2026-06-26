# Hirely Test Matrix

**Generated:** 2026-06-15T17:53:07.584Z
**Engine:** `HIRELY_TEST_MATRIX_V1`
**Fixtures:** `tests/fixtures/hirely-test-lab/`
**Overall:** PASS (6/6 files all-green)
**QA gate:** PASS

## Fixture pack

| File | Role |
|------|------|
| `good.pdf` | Selectable text PDF — full CV import |
| `bad.pdf` | Corrupt PDF — must route to paste |
| `scan.pdf` | Image-only PDF — must route to paste |
| `docx.docx` | Word document — native extract |
| `txt.txt` | Plain text CV |
| `paste.txt` | Paste fallback / recovery text |

## Matrix

| File | Import | Review | Template | Export | Row | Notes |
|------|--------|--------|----------|--------|-----|-------|
| `paste.txt` | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | — |
| `txt.txt` | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | — |
| `docx.docx` | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | — |
| `bad.pdf` | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | Import → paste; review/template/export use paste.txt recovery |
| `scan.pdf` | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | Import → paste; review/template/export use paste.txt recovery |
| `good.pdf` | **PASS** | **PASS** | **PASS** | **PASS** | **PASS** | — |

## Stage totals

| Stage | Pass |
|-------|------|
| Import | 6/6 |
| Review | 6/6 |
| Template | 6/6 |
| Export | 6/6 |

## Import detail

| File | State | ms | Paste chained |
|------|-------|-----|---------------|
| `paste.txt` | `IMPORT_READY` | 1 | no |
| `txt.txt` | `IMPORT_READY` | 7 | no |
| `docx.docx` | `IMPORT_READY` | 73 | no |
| `bad.pdf` | `IMPORT_NEEDS_PASTE` | 76 | yes |
| `scan.pdf` | `IMPORT_NEEDS_PASTE` | 33 | yes |
| `good.pdf` | `IMPORT_READY` | 68 | no |

## Verification

```bash
npm run qa:hirely-test-matrix
npm run hirely-test-matrix-report
```

Fixtures live in `tests/fixtures/hirely-test-lab/`. `good.pdf`, `scan.pdf`, and `docx.docx` are generated on first run if missing.

