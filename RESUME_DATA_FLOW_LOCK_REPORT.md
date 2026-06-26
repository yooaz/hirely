# RESUME_DATA_FLOW_LOCK Report

Generated: 2026-06-08T08:03:19.784Z

## Issue

Import completed (EXTRACTION_DONE, PARSER_DONE, IMPORT_FINAL) but UI stayed on import screen.
Console logged `RESUME_DATA_FLOW_LOCK` with **5 keys** — creative/parser fields present before product shape lock.

## Before — five lock reasons

| # | Key | Source | Function | Condition | Fatal? |
|---|-----|--------|----------|-----------|--------|
| 1 | `exhibitions` | src/core/parsing/creative-cv-mode.js / parser output | `assertResumeDataFlowLock` | Key present on resumeData before lockResumeDataShape folds creative sections | **No** (warning only) |
| 2 | `awards` | src/core/parsing/creative-cv-mode.js / parser output | `assertResumeDataFlowLock` | Key present on resumeData before lockResumeDataShape folds creative sections | **No** (warning only) |
| 3 | `publications` | src/core/parsing/creative-cv-mode.js / parser output | `assertResumeDataFlowLock` | Key present on resumeData before lockResumeDataShape folds creative sections | **No** (warning only) |
| 4 | `portfolioLinks` | src/core/parsing/creative-cv-mode.js / parser output | `assertResumeDataFlowLock` | Key present on resumeData before lockResumeDataShape folds creative sections | **No** (warning only) |
| 5 | `blocks` | src/core/resume-data.js normalizeResumeData (editor blocks) | `assertResumeDataFlowLock` | Transient blocks array on resumeData before lockResumeDataShape strips it | **No** (warning only) |

**Pre-fix behavior:** `normalizeResumeData` asserted flow lock **before** `lockResumeDataShape`, so all five keys logged as `console.error('RESUME_DATA_FLOW_LOCK', …)`. UI gate required `isFinalResumeValid()` / `cvPreviewIsLive()` — partial CVs with valid sections still fell back to import screen.

**Sample pre-shape assert:** warnings=`exhibitions, awards, publications, portfolioLinks, blocks`, fatal=`(none)`

## After — behavior

1. **Shape before assert** — `normalizeResumeData` calls `lockResumeDataShape` before `assertResumeDataFlowLock`; folded keys no longer appear on product resumeData.
2. **Warn vs fatal** — `FLOW_LOCK_FOLD_INTO_UNSORTED_KEYS` (`exhibitions`, `awards`, `publications`, `portfolioLinks`, `blocks`) are **warnings only**; fatal reserved for debug/parser payload keys.
3. **Import minimum** — `resumeDataMeetsImportMinimum`: email, phone, experience, education, skills, or clients → advance to Review.
4. **Partial import** — `IMPORT_PARTIAL` when minimum met but full contract not satisfied; data is **not** deleted.
5. **UI gates** (`index.html`) — `isWorkspaceReady`, `renderCVInner`, `handleFileImport` end path advance when `rawText > 300` + parser done + minimum data.

## Expected flow

```
IMPORT_STARTED → EXTRACTION_DONE → PARSER_DONE → FINAL_RESUME_READY → REVIEW_SCREEN_VISIBLE
```

## QA

```bash
npm run qa:resume-data-flow-lock
```

```
OK five fold-into-unsorted keys defined
OK fold keys match creative parser output
OK pre-shape fold keys are not fatal
OK pre-shape emits five warnings (exhibitions, awards, publications, portfolioLinks, blocks)
OK normalizeResumeData output passes flow lock
OK exhibitions folded after normalize
OK blocks removed after normalize
OK creative lines preserved in unsorted
OK minimum met with email + experience
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 5,
  education: 2,
  skills: 5,
  tools: 0,
  languages: 2,
  clients: 0,
  projects: 0,
  unsorted: 2
}
OK pipeline returns resumeData
OK fixture import passes flow lock after normalize
OK fixture meets import minimum
OK buildFinalResumeData renderable for fixture
OK buildFinalResumeData produces cvData
OK skills-only partial CV meets minimum
OK skills-only is renderable
OK name-only does not meet minimum
RESUME_DATA_FLOW_LOCK_QA_OK
(node:93750) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/pipeline/hirely-import.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```

## Verdict

**PASS**

- Flow lock does not block import when minimum resumeData exists
- Creative fold keys are warnings only
- normalizeResumeData output is product-clean
