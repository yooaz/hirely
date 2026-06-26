# DOCX_STRUCTURE_RECOVERY_REPORT

**Status:** PASS
**Retention target:** ≥ 90% visible content
**Generated:** 2026-06-10T23:58:34.329Z

## Problem

DOCX resumes were losing content from headers, footers, tables, columns, text boxes, lists, and links when only Mammoth raw text was used.

## Audit coverage

| Element | Recovery |
|---------|----------|
| Headers | OOXML `word/header*.xml` |
| Footers | OOXML `word/footer*.xml` |
| Tables | `w:tbl` → row/cell join |
| Columns | `w:cols` detected; body order preserved |
| Text boxes | `w:txbxContent` |
| Lists | `w:numPr` → bullet prefix |
| Links | `w:hyperlink` + rels target URL |

## Recovered sections

Identity, experience, education, skills, clients, and portfolio content are retained in plain text before parsing.

## Pipeline

1. Unzip DOCX (JSZip)
2. Walk OOXML parts (document + headers + footers)
3. Extract tables, text boxes, lists, hyperlinks
4. Merge with Mammoth HTML + raw text (richest union)
5. Score retention vs visible OOXML corpus

## Code

- `src/core/extraction/docx-structure-recovery.js` — OOXML recovery engine
- `src/core/extraction/docx-extract.js` — Mammoth + recovery merge
- `src/core/extraction/document-extract.js` — metadata: `docxRetentionPct`, `docxRecovery`
- `index.html` — lazy-load JSZip for browser DOCX imports

## Structured rich DOCX

| Metric | Value |
|--------|-------|
| Retention | 100% |
| Headers | ✓ |
| Footers | ✓ |
| Tables | ✓ |
| Columns | ✓ |
| Text boxes | ✓ |
| Lists | ✓ |
| Links | ✓ |
| Experiences parsed | 21 |
| Education parsed | 3 |

## Yoaz fixture DOCX

- Retention: **100%**
- Experiences: 17
- Education: 3

## Simple fixture DOCX

- Retention: **100%**
- Extracted chars: 406

## Verify

```bash
npm run qa:docx-structure-recovery
npm run docx-structure-recovery-report
```
