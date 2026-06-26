# TEXT_RECONSTRUCTION_ENGINE_REPORT

**Status:** PASS
**Engine:** `TEXT_RECONSTRUCTION_ENGINE_V2`
**Generated:** 2026-06-11T00:24:06.735Z

## Problem

Extracted text was present but badly reconstructed:

| Artifact | Example |
|----------|---------|
| Duplicate dates | `2011 - 2011-2011` |
| Merge glitch | `Contributed as at Present` |
| OCR glue | `Fluent analyse` |
| Parser labels | `Company à confirmer` |
| Section bleed | `Experience` glued into job lines |

## TEXT_RECONSTRUCTION_ENGINE responsibilities

- merge broken lines
- preserve section boundaries
- repair date ranges
- remove duplicated dates
- prevent unrelated line concatenation
- keep client lists as clients
- keep education as education
- keep tools as tools

## API

| Function | Role |
|----------|------|
| `smartLineMerge()` | Merge continuation fragments only |
| `smartParagraphMerge()` | Merge broken paragraph blocks |
| `preserveSectionBoundaries()` | Split embedded section headers |
| `normalizeReconstructedDates()` | Repair / dedupe date ranges |
| `stripParserLabelsFromLine()` | Remove `à confirmer` placeholders |
| `inferLineSection()` | Prevent cross-section merges |
| `reconstructExtractedText()` | Full pre-parser reconstruction |

## Acceptance

| Criterion | Result |
|-----------|--------|
| No fake sentences | ✓ |
| No duplicated dates | ✓ |
| No parser labels in final CV | ✓ |

## Integration

- `src/core/parsing/text-reconstruction.js`
- `src/core/extraction/extraction-audit.js` → `sanitizeParserInput()`
- `src/core/parsing/clean.js` → `safeClean()`
- `src/core/validation/data-sanitization-layer.js` → experience line normalize

## Fixes verified

- 2011 - 2011-2011 → single range
- Contributed as at Present → Contributed at Present
- Fluent analyse → Fluent
- Company à confirmer stripped
- Section labels isolated from content
- Clients / education / tools not cross-merged

## Yoaz fixture

- Experiences: 26
- Education: 4
- Clients: 12
- Tools: 6
- Parser label leak: 0
- Fake sentences: 0

## Verify

```bash
npm run qa:text-reconstruction-engine
npm run text-reconstruction-engine-report
```

---

### Console

```
OK engine version V2
OK collapse 2011-2011 duplicate years
OK fix Contributed as at Present
OK fix Fluent analyse
OK strip Company à confirmer
OK placeholder is fake sentence
OK split embedded section header
OK skills header isolated
OK skills content preserved
OK experience not merged with education
OK client list typed
OK tools typed
OK education typed
OK date fragments merge
OK no duplicated dates
OK range preserved
OK experience header alone
OK education header alone
OK clients preserved
OK tools preserved
OK no section label mix in one line
OK sanitize no duplicate dates
OK sanitize no parser labels
OK sanitize no Fluent analyse
OK safeClean dedupes entities
OK yoaz experiences
OK no parser labels in CV (0)
OK no fake sentences (0)
OK no duplicated dates in experience
Wrote /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/tests/output/text-reconstruction-engine/report.json

(node:259) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/parsing/text-reconstruction.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
