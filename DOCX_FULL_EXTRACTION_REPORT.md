# DOCX_FULL_EXTRACTION_REPORT

**Status:** PASS
**Engine:** `DOCX_FULL_EXTRACTION_V2`
**Retention target:** ≥ 90% visible text
**Generated:** 2026-06-11T00:21:11.362Z

## Problem

Word CVs were losing text from tables, columns, headers, footers, and text boxes when only Mammoth paragraph extraction ran.

## Extraction sources

| Source | Handling |
|--------|----------|
| Paragraphs | `w:p` runs, tabs → column separators |
| Tables | `w:tbl` rows; cells joined with ` | ` |
| Nested tables | Recursive cell walk |
| Headers | `word/header*.xml` first in merge order |
| Footers | `word/footer*.xml` after body |
| Text boxes | VML `w:txbxContent` + DrawingML `wps:txbx` |
| Drawing shapes | `w:drawing` / `a:t` text |
| Hyperlinks | `w:hyperlink` label + rel URL |
| Bullet lists | `w:numPr` → `•` prefix |
| Columns | `w:cols` detected; XML reading order preserved |

## Rules enforced

| Rule | Implementation |
|------|----------------|
| Never paragraph-only when tables exist | OOXML table lines forced into merge |
| Never drop columns | Document-order walk; tab → ` | ` |
| Never drop header/footer contact | Headers first, footers last; contact lines required |

## Acceptance

DOCX extraction retains **≥ 90%** of visible text (word-token match on OOXML corpus).

## Test results

| Fixture | Retention | Headers | Footers | Tables | Nested | Text boxes | Lists | Links |
|---------|-----------|---------|---------|--------|--------|------------|-------|-------|
| Full structure | 100% | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Yoaz CV DOCX | 100% | — | — | — | — | — | — | — |

### Parsed sections (full structure fixture)

- Experiences: 15
- Education: 3
- Skills: 0
- Clients: 5

## Code

- `src/core/extraction/docx-structure-recovery.js` — OOXML full extraction engine
- `src/core/extraction/docx-extract.js` — Mammoth merge + export
- `src/core/extraction/document-extract.js` — product DOCX route

## Verify

```bash
npm run qa:docx-full-extraction
npm run docx-full-extraction-report
```

---

### Console

```
OK engine version V2
OK nested table inner row 1
OK nested table inner row 2
OK drawing shape text recovered
OK flat table row
OK bullet lists
OK headers extracted
OK footers extracted
OK tables extracted
OK nested tables detected
OK columns detected
OK textboxes extracted
OK lists extracted
OK links extracted
OK retention 100% >= 90%
OK header contact email
OK footer contact phone
OK nested table experience
OK nested table experience 2
OK bullet list skill
OK textbox clients
OK drawing shape tools
OK hyperlink url
OK parsed nested table experiences
OK parsed education
OK merged text not paragraph-only shrink
OK table content not dropped
OK yoaz retention 100%
OK yoaz experiences parsed
Wrote /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/tests/output/docx-full-extraction/report.json

(node:91209) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/extraction/docx-structure-recovery.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:91209) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
HIRELY extraction dedupe { removedLines: 7, removedPages: 0, before: 41, after: 34 }
```
