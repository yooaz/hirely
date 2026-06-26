# HIRELY P0 — Review Panel Consistency

**Result:** PASS
**Generated:** 2026-06-10T13:15:16.095Z

## Rule

The review panel must read from **`finalResumeData` only** — never contradict the live CV preview.

| Section | Checklist OK when |
|---------|-------------------|
| Formation / Education | `education.length > 0` |
| Expérience | `experiences.length > 0` |
| Compétences | `skills` or `tools` present |
| Langues | `languages` present (row shown only if data exists) |

Suggestions must exclude text already rendered in the CV.

## Browser snapshot

| Check | Value |
|-------|-------|
| Preview text length | 593 |
| finalResumeData education | 1 |
| finalResumeData experiences | 3 |
| finalResumeData skills | 6 |
| finalResumeData tools | 1 |
| finalResumeData languages | 2 |

## Implementation

| Change | Location |
|--------|----------|
| `buildReviewChecklistFromFinalResume` | `src/core/validation/review-consistency.js` |
| Education object lines in checklist profile | `recruiter-checklist-source.js` |
| Trusted review uses `_resumeCounts` | `trusted-cv-review-engine.js` |
| Product checklist from finalResumeData | `buildProductChecklist()` in `index.html` |
| Suggestions filter rendered content | `collectProductSuggestions()` + `suggestion-confidence-score.js` |

## Gate

```bash
npm run test:review-consistency
```

## QA output

```
OK unit education count
OK unit experiences count
OK unit checklist education OK
OK unit checklist experience OK
OK unit checklist skills OK
OK unit checklist languages OK
OK trusted review no false education missing
OK trusted review no false experience missing
OK trusted review education strength
OK suggestions drop rendered skills
OK education school detected as rendered
OK unit contradiction audit
OK preview live (593 chars)
OK UI checklist Formation OK when education present
OK no education in review missing list
OK UI checklist Expérience OK when experiences present
OK no duplicate suggestions in panel

PASS review-consistency

(node:2686) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/validation/review-consistency.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```

