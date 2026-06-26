# Hirely RC1 Report

**Generated:** 2026-06-16T07:38:40.078Z
**Release:** RC1 — stability only
**Verdict:** **PASS**

## Success criteria

| Criterion | RC1 status | Evidence |
|-----------|------------|----------|
| TXT import works | **PASS** | `v1-release-test` |
| DOCX import works | **PASS** | `v1-release-test` |
| Paste works | **PASS** | `v1-release-test` |
| PDF text works | **PASS** | Native PDF.js extract, no OCR |
| Review works | **PASS** | `review-screen-guarantee` + matrix |
| Templates work | **PASS** | `template-isolation` + matrix |
| Export works | **PASS** | `export-rewrite` + matrix |
| No OCR in product path | **PASS** | `V1_OCR_DISABLED`, `rewriteImportFromFile` native-only |
| No AI in import path | **PASS** | `createResumeFromText` text-first; no AI in import/ |
| No ATS intelligence gates | **PASS** | Export/review/template isolation |

## Out of RC1 scope

- Scanned/image PDFs → **paste fallback** (not OCR). Verified ≤7s in `v1-release-test`.
- Recruiter audit panel (lazy-loaded) — informational only; **does not block** review/template/export.
- Cover letter AI — separate feature; not on RC1 critical path.
- `REAL_WORLD_IMPORT_TRUTH` messy corpus — quality benchmark, not RC1 gate.

## Architecture (RC1)

```
file / paste → extract text (native PDF / mammoth / txt)
           → createResumeFromText
           → review (resume object exists → never block)
           → template (resume-only input)
           → export (resume object + live preview)
```

Browser flags (`index.html`): `HIRELY_V1_IMPORT`, `HIRELY_SIMPLE_IMPORT_MODE`, `HIRELY_UNBLOCK_EVERYTHING`.
Tesseract lazy loader **skipped** when V1 flags are set.

## QA gates

| Gate | Result |
|------|--------|
| Core boot | **PASS** |
| V1 browser release (TXT/DOCX/PDF/paste) | **PASS** |
| Test matrix (import→export) | **PASS** |
| Review guarantee | **PASS** |
| Template isolation | **PASS** |
| Export rewrite | **PASS** |

## V1 browser release

| Flow | ms | CV preview | Paste | Style/Export |
|------|-----|------------|-------|--------------|
| txt | 321 | 609 chars | no | unlocked |
| docx | 189 | 609 chars | no | unlocked |
| text_pdf | 1330 | 476 chars | no | unlocked |
| paste_text | 1371 | 431 chars | no | unlocked |
| scanned_pdf | 173 | 0 chars | yes | n/a |

## Test matrix (`tests/fixtures/hirely-test-lab/`)

| File | Import | Review | Template | Export |
|------|--------|--------|----------|--------|
| `paste.txt` | **PASS** | **PASS** | **PASS** | **PASS** |
| `txt.txt` | **PASS** | **PASS** | **PASS** | **PASS** |
| `docx.docx` | **PASS** | **PASS** | **PASS** | **PASS** |
| `bad.pdf` | **PASS** | **PASS** | **PASS** | **PASS** |
| `scan.pdf` | **PASS** | **PASS** | **PASS** | **PASS** |
| `good.pdf` | **PASS** | **PASS** | **PASS** | **PASS** |

## Verification

```bash
npm run rc1-report
# or manually:
npm run test:core-boot
npm run v1-release-test
npm run qa:hirely-test-matrix
node src/tests/qa-review-screen-guarantee.mjs
node src/tests/qa-template-isolation.mjs
node src/tests/qa-export-rewrite.mjs
```

## RC1 ship checklist

- [x] All RC1 gates PASS
- [x] Text-first import engine
- [x] Review / template / export isolation (no ATS/parser gates)
- [x] OCR disabled in V1 browser path
- [ ] Manual smoke: upload real TXT/DOCX/text-PDF, export PDF

