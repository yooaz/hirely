# PIPELINE_LOCK — Single Pipeline (P1)

## Import gate (P0 — blocks all product UI)

**No templates, photo, section order, pricing, design, or animations** until both reports are **PASS**:

| Report | Command |
|--------|---------|
| `LOCAL_OCR_CSP_FIX_REPORT.md` | `npm run local-ocr-csp-fix-report` |
| `IMPORT_REALITY_CHECK_REPORT.md` | `npm run import-reality-check-report` |
| `REAL_WORLD_IMPORT_TRUTH_REPORT.md` | `npm run real-world-import-truth-report` |

Product is not usable until import works. See **`NO_FAKE_PASS_IMPORT_POLICY.md`** — no PASS for crash-free UI alone; scanned/image unread → `IMPORT_NEEDS_PASTE`, not PASS. Drop real CVs in `tests/real-world-corpus/`. If either report fails, fix extraction/import only.

## Canonical flow

```
Import → Extract text → Clean text → Build blocks → Classify facts
  → Build resumeData → Safety gate → Review → Style → Export
```

Implemented in `src/core/pipeline/hirely-flow-lock.js` (`HIRELY_FLOW_STAGES`).

## Rules

| Rule | Enforcement |
|------|-------------|
| No raw OCR → template | `stripTemplateCvData`, `FORBIDDEN_TEMPLATE_CV_KEYS` |
| No debug inside resumeData | `lockResumeDataShape`, `FORBIDDEN_RESUME_DATA_KEYS` |
| No fallback parser when core works | `runHirelyImportFromText` catch; `forceRenderFromRawText` blocked unless `HIRELY_ALLOW_PRODUCT_FALLBACK` |
| Single import handler | `handleFileImport` → `canonicalImportFromFile` / `runHirelyImportFromFile` → `applyImportResult` |
| No fake identity | `sanitizeIdentity`, `assertResumeDataContract` |

## resumeData shape (product)

Allowed top-level keys only:

`identity`, `summary`, `experiences`, `education`, `skills`, `tools`, `languages`, `clients`, `projects`, `unsorted`, `meta`

Creative-only fields (`exhibitions`, `awards`, `publications`, `portfolioLinks`, `blocks`) are folded into `unsorted` or dropped.

## Separated artifacts

| Artifact | Storage |
|----------|---------|
| `resumeData` | `state.resumeData` — product truth |
| `structuredResume` | `state.structuredResume` — parser output, max 20 000 chars JSON |
| `debugReport` | `state.debugReport` — never in resumeData |
| `reviewQueue` | `state.reviewQueue` — never in resumeData |
| `lastPipeline` / audit | `state.lastPipeline`, `state.lastAudit` |

## Entry points

| UI | Core |
|----|------|
| File drop / picker | `handleFileImport` → `runHirelyImportFromFile` |
| Paste | `applyCvPipeline` → `runHirelyImportFromText` |
| Sample | `applyCvPipeline` |

Legacy `applyImportResult` non-`HirelyImportResult` path is **debug-only**.

## QA

```bash
npm run qa:pipeline-lock
npm run qa:flow-lock
npm run qa:core-import
```

Expected: `PIPELINE_LOCK_OK`, `CORE_BOOT_OK`, no `FALLBACK_BLOCKED` in normal import.

## Debug override

```js
globalThis.HIRELY_ALLOW_PRODUCT_FALLBACK = true; // emergency fallback only
globalThis.HIRELY_FLOW_LOCK = false;           // disable lock (tests)
```
