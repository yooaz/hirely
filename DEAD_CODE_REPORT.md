# Hirely Dead Code Audit

**Generated:** 2026-06-15  
**Scope:** parsers, legacy OCR, duplicate validators, ATS rules, orphan imports  
**Production path:** `simple-import-mode` → `file-import-rewrite` → `createResumeFromText` (V1, OCR disabled in browser)

## Summary

| Category | Deleted | Kept (documented) |
|----------|---------|-------------------|
| Orphan parsers / stages | 3 files | Full pipeline behind `isSimpleImportMode()` |
| Legacy validator bodies | ~700 lines in `recruiter-score-v2.js` | H8 facade retained |
| Deprecated root shims | 5 files | — |
| Deprecated aliases | `computeAtsScoreV2`, `block-pipeline.js` | — |
| Legacy OCR stack | 0 files | Gate/QA + non-simple import still reference |

---

## Deleted in this audit

| File | Reason |
|------|--------|
| `src/core/parsing/stages/block-classification.js` | Zero imports; `runBlockClassificationStage` never called |
| `src/core/parsing/stages/dictionary-boost-stage.js` | Zero imports; dictionary logic lives in `entity-dictionaries.js` |
| `src/core/parsing/identity-name-phone-v2.js` | Thin re-export; only QA used `extractNameAndPhoneV2` |
| `src/core/pipeline/block-pipeline.js` | Deprecated alias → callers use `p0-pipeline.js` |
| `core/pipeline.js` | Orphan shim (no consumers) |
| `core/extraction.js` | Orphan shim |
| `core/clean.js` | Orphan shim |
| `core/ocr.js` | Orphan shim |
| `core/stats.js` | Orphan shim |

### In-file removals

| Location | Removed |
|----------|---------|
| `src/core/validation/recruiter-score-v2.js` | `computeRecruiterScoreV2Legacy` + ~600 lines of unused V2 scoring helpers |
| `src/core/validation/ats-engine.js` | `computeAtsScoreV2` deprecated alias |
| `index.html` | `./core/pipeline.js` debug import fallback |

---

## Unused parsers (kept — flag-gated / QA)

Default browser import **does not** run these. They remain for `runProductionExtractionPipeline`, parser-lab, and gate scripts.

| Module | Status | Notes |
|--------|--------|-------|
| `parsing/section-first-parser.js` | QA + export | `@deprecated`; wraps `section-engine-v2` |
| `parsing/cv-parser.js` | QA re-export | Thin facade over `rich-parser.js` |
| `parsing/universal-parse-pipeline.js` | Debug / flow-lock off | `universal-parser-gate.mjs` |
| `parsing/pipeline.js` | Full-import facade | Skipped when `SIMPLE_IMPORT_MODE` |
| `pipeline/production-pipeline.js` | Full-import | `hirely-import.js` when simple mode off |
| `parsing/parser-accuracy-report.js` | Node QA only | `qa-parser-enterprise.mjs` |
| `lib/cv-parser.js` | Server only | `api/analyze.js` (~900 lines, separate from core) |

**Live chain when simple mode is off:**  
`hirely-import` → `production-pipeline` → `p0-pipeline` → `section-engine-v2` → `resume-graph-engine`

---

## Legacy OCR (kept — not deleted)

V1 browser path: **`V1_OCR_DISABLED = true`**, `rewriteImportFromFile` uses native PDF text only.

| Module | Role | Delete risk |
|--------|------|-------------|
| `extraction/ocr-tesseract.js` | Tesseract worker | Breaks gate reports |
| `extraction/ocr.js` | Browser OCR facade | Non-simple import |
| `extraction/pdf-ocr-*.js` | PDF page OCR | `enterprise-engine`, QA |
| `extraction/ocr-pipeline.js` | Boot contract export | `core/index.js` |
| `extraction/cloud-ocr.js` | Remote OCR fallback | Optional path in pipeline |
| `import/ocr-parser-gate.js` | Blocks parser on bad OCR | `canonical-import.js` |
| `parsing/ocr-postprocess.js`, `ocr-cleanup.js` | OCR text repair | Full pipeline |

**Recommendation:** Keep until import gates permanently PASS with simple-only policy and OCR QA scripts are retired.

---

## Duplicate validators

| Module | Production UI | Action |
|--------|---------------|--------|
| `validation/product-score.js` | **Canonical** (`index.html` lazy import) | Keep |
| `validation/trust-score.js` | Via product-score | Keep |
| `validation/ats-quality-h8.js` | Core ATS math | Keep |
| `validation/recruiter-score-v2.js` | Facade → H8 | **Trimmed** (legacy body removed) |
| `validation/score.js` | `production-pipeline.js` only | Keep until pipeline retired |
| `validation/ats-engine.js` | Indirect / tests | Keep; alias removed |
| `index.html` `computeProductScoreInline` | Fallback duplicate | Document only |

---

## ATS rules (live — not deleted)

| Module | Wired via |
|--------|-----------|
| `ats-quality-h8.js` | `trust-score` → `product-score` |
| `ats-engine-pro.js` | Recruiter command center |
| `ats-analyzer.js` | `recruiter-audit.js` (lazy panel) |
| `recruiter-command-center.js` | `index.html` |
| `recruiter-audit.js` | `index.html` |
| `parsing/designer-cv-mode.js` | `DESIGNER_ATS_ADJUSTMENTS` (parser path) |

Main score panel uses **`computeProductScore`**, not direct `analyzeAts()`.

---

## Orphan imports (resolved)

Root `core/*.js` shims had **zero** importers after `src/core/` migration. Removed.

`document-block.js` and `parsing/index.js` now import `runP0Pipeline` directly instead of `block-pipeline.js`.

---

## Verification

```bash
npm run test:core-boot
node src/tests/qa-name-phone-rewrite.mjs
node src/tests/qa-recruiter-score-v2.mjs
node src/tests/qa-ats-scoring-audit.mjs
node src/tests/qa-hirely-test-matrix.mjs
```

---

## Future deletion candidates (medium confidence)

1. `lib/cv-parser.js` + `api/analyze.js` if server analyze endpoint is retired  
2. `validation/score.js` after `production-pipeline` is removed from all paths  
3. Entire OCR stack after permanent simple-import-only policy + gate script retirement  
4. `section-first-parser.js`, `universal-parse-pipeline.js` after parser-lab deprecation  

Do **not** delete `production-pipeline` / `section-engine-v2` while `HIRELY_SIMPLE_IMPORT_MODE` can be toggled off or import gate scripts still exercise full extraction.
