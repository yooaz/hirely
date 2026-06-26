# IDENTITY_SOURCE_PRIORITY_REPORT

**Status:** PASS
**Engine:** `IDENTITY_SOURCE_PRIORITY_V1`
**Generated:** 2026-06-12T09:46:58.719Z
**QA:** 15/15 checks

## Problem

Identity (`name` / `title`) was sometimes taken from random OCR lines anywhere in the document — including experience bullets, client lists, education entries, and footer noise.

## Priority order (strict)

| Rank | Source | Reason tag | Confidence |
|------|--------|------------|------------|
| 1 | Top **15%** of first page | `top15pct` | 93 |
| 2 | Lines near email / phone (±2 lines, first page) | `contact_neighbor` | 88 |
| 3 | Largest valid name-like block in header zone | `largest_header_block` | 86 |
| 4 | Manual review | *(empty name)* | &lt; 80 → hidden |

## Never take identity from

- **Experience** section (from header through next major section)
- **Clients** section
- **Education** section
- **Footer** zone (last 15% of lines + page markers)
- **OCR garbage** (merged tokens, tool fragments, corruption patterns)

## Code changes

| Module | Change |
|--------|--------|
| `src/core/parsing/identity-extraction.js` | `buildForbiddenIdentityIndices`, `isOcrGarbageIdentityLine`, top-15% first-page scan, priority sort, confidence by source |
| `src/core/parsing/index.js` | Export new identity source priority symbols |
| `src/tests/qa-identity-source-priority.mjs` | Regression suite for priority + forbidden zones |

## Sample outcomes

- **Header name:** `Yohann Azancot` ← `top15pct`
- **Near email:** `Marie Dubois` ← `top15pct`
- **Largest header block:** `Julie Martin` ← `largest_header_block`
- **No auto identity:** `(empty — review)`

## Verification

```bash
npm run qa:identity-source-priority
npm run qa:identity-false-name
npm run identity-source-priority-report
```

## QA output

```
PASS constants_top15_pct
PASS constants_priority_order
PASS ocr_garbage_rejected
PASS forbidden_experience_zone
PASS forbidden_clients_zone
PASS forbidden_footer_zone
PASS priority_top15_name
PASS priority_not_experience
PASS priority_source_top15pct
PASS priority_confidence_min
PASS priority_contact_neighbor
PASS priority_not_publicis
PASS priority_largest_header_block
PASS priority_manual_review_empty
PASS candidates_exclude_forbidden

PASS identity-source-priority (15/15)

(node:92765) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/parsing/identity-extraction.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
