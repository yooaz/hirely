# HIRELY MASTER AUDIT

**Generated:** 2026-06-06  
**Scope:** Full product pipeline — Import → OCR → Extraction → Parsing → resumeData → cvData → Suggestions → ATS → Template render → PDF export  
**Method:** Read-only trace of `src/core/`, `index.html`, existing audit reports, and live QA scripts. **No code changes.**

**Golden fixture:** Yoaz PDF (`cv2022 yohann azancot copie.pdf`)

---

## Executive summary

Hirely’s **infrastructure layers** (import orchestration, OCR routing, enterprise extraction, template render, browser PDF export) are largely production-capable on the Yoaz reference PDF. The **product fidelity layer** (parsing → structured fields → recruiter-ready CV) is the primary gap: **~59% OCR text is not retained in cvData**, identity contact is incomplete, and strict acceptance tests still fail on preview completeness.

| QA artifact | Verdict | What it measures |
|-------------|---------|------------------|
| `PRODUCT_PASS_QA.md` (browser, pro mode) | **PASS** | UI layout, suggestions cap, export click, cover letter panel |
| `RELEASE_REPORT.md` (2026-06-03) | **PASS** | Gate scripts: OCR, import, parser, templates, PDF |
| `scripts/final-acceptance-test.mjs` | **FAIL** | Strict Yoaz field + preview needle checklist |
| `DATA_LOSS_REPORT.md` | **59.1% loss** | OCR tokens not present in final cvData |
| `CONFIDENCE_REJECTION_REPORT.md` | **23 rejections** | 80% fact threshold + confidence gates |

**Bottom line:** Hirely behaves like a **demo-ready CV studio** with a working export path, but not yet a **production-grade CV reconstruction product** on scanned creative PDFs without manual header/contact repair.

---

## Pipeline trace

```
index.html:handleFileImport
  → canonical-import.js:canonicalImportFromFile
    → extract-file.js:extractFromFileDetailed
      → document-extract.js:extractDocument
        → enterprise-engine.js:extractPdfEnterprise
          → pdf-router.js:planPdfExtraction / routePdfExtraction
            → pdf-ocr-run.js:runCachedTimedPdfOcr
              → ocr-pipeline.js:runOcrOnCanvas
    → ocr-parser-gate.js:assessOcrBeforeParser
    → hirely-import.js:runHirelyImportFromText
      → production-pipeline.js:runProductionExtractionPipeline
        → structured-resume-from-blocks.js:buildStructuredResumeFromDocumentBlocks
        → section-engine-v2.js (classify + field extract)
        → fact-pipeline / cv-from-facts.js:partitionFactsByConfidence
        → resume-data.js:buildResumeData
  → index.html:applyImportResult → commitResumeData
    → resume-data.js:resumeDataToCvData → state.cvData
  → index.html:renderCV → HirelyTemplates.render (#cvDoc)
  → suggestion-confidence-score.js:filterProductSuggestions (UI)
  → ats-engine.js:computeAtsScore
  → index.html:downloadPDF → hirely-pdf-export.js:exportCvToPdf
```

---

## Stage audit

### 1. Import

| | |
|---|---|
| **Status** | **WORKING** |
| **Entry** | `index.html:handleFileImport` (~5140) |
| **Core** | `src/core/import/canonical-import.js:canonicalImportFromFile` |
| **Orchestration** | `src/core/pipeline/hirely-import.js:runHirelyImportFromFile`, `runHirelyImportFromText` |
| **Guards** | `import-run-guard.js`, `import-status.js`, `import-render-guard.js` |

**Evidence**
- `PRODUCT_PASS_QA.md`: `IMPORT_READY`, advances to `docStep: edit`
- `RELEASE_REPORT.md`: Import PASS
- `PDF_TIMEOUT_ROOT_CAUSE.md`: Yoaz import completes ~15–20s without timeout

**Failure modes (non-blocking on Yoaz)**
- `CORE_BOOT_FAILED` if `src/core/index.js` bundle fails (`index.html:getHirelyCore`)
- `PDF_OCR_TIMEOUT` / `IMPORT_NEEDS_PASTE` → paste fallback (`canonical-import.js:extractTextFromFile`)
- `IMPORT_STUCK_TIMEOUT` on hung pipeline (`index.html:importRaceTimeout`)
- `PARSER_EMPTY` / `PARSER_FAIL` after extraction (`index.html:handleFileImport`)

---

### 2. OCR

| | |
|---|---|
| **Status** | **PARTIAL** |
| **Router** | `src/core/extraction/pdf-router.js:routePdfExtraction`, `planPdfExtraction` |
| **Pipeline** | `src/core/extraction/ocr-pipeline.js:runOcrOnCanvas`, `tryVisionApi` |
| **Runner** | `src/core/extraction/pdf-ocr-run.js:runCachedTimedPdfOcr` |
| **Timeout** | `src/core/extraction/pdf-extraction-timeout.js:withExtractionTimeout` (30s outer) |

**Evidence**
- Yoaz: Tesseract path, ~1292 chars, ~14s OCR (`PDF_TIMEOUT_ROOT_CAUSE.md`)
- `EXTRACTION_FREEZE.md` / `PROJECT_STATE.md`: reliability, fusion, preprocess QA pass

**Gaps**
- 30s hard ceiling can abort multipass/rotation on slow or multi-page scans
- Cloud Vision (`tryVisionApi`) only when `/api/ocr` deployed — local dev defaults to Tesseract
- Double OCR pass (rotation trial) adds latency on scanned PDFs

---

### 3. Extraction

| | |
|---|---|
| **Status** | **WORKING** |
| **Router** | `src/core/extraction/extract-file.js:extractFromFileDetailed` |
| **Engine** | `src/core/extraction/enterprise-engine.js:extractPdfEnterprise` |
| **Document** | `src/core/extraction/document-extract.js:extractDocument` |
| **Lines** | `src/core/extraction/pdf-lines-native.js`, `pdf-post-extract.js` |

**Evidence**
- Enterprise path produces line archive + `rawExtraction` / `cleanedText`
- `npm run test:extract`: **0 FAIL**, 11 NEEDS_REVIEW (`PROJECT_STATE.md`)
- Native PDF probe skips full-doc OCR when text layer is usable

**Gaps**
- Hybrid PDF routing complexity increases failure surface on mixed documents
- `extraction-lock.js:shouldRunOcrForTextLength` can skip OCR when native text looks sufficient but quality is poor

---

### 4. Parsing

| | |
|---|---|
| **Status** | **PARTIAL** |
| **Orchestrator** | `src/core/pipeline/production-pipeline.js:runProductionExtractionPipeline` |
| **Blocks** | `src/core/parsing/structured-resume-from-blocks.js:buildStructuredResumeFromDocumentBlocks` |
| **Sections** | `src/core/parsing/section-engine-v2.js` |
| **Experience** | `src/core/parsing/experience-builder-v2.js` |
| **Facts** | `src/core/parsing/cv-from-facts.js:partitionFactsByConfidence` |
| **Flow lock** | `src/core/pipeline/hirely-flow-lock.js` |

**Evidence**
- Pipeline runs end-to-end; `RELEASE_REPORT.md` Parser PASS (with 57% retention noted non-blocking)
- `DATA_LOSS_REPORT.md`: **40.9% text preserved**, **59.1% lost** vs OCR
- `CONFIDENCE_REJECTION_REPORT.md`: **23 rejections** at 80% threshold; after section-engine: `experiences=0`, `unsorted=31`
- `EXPERIENCE_AUDIT.md`: 2 experiences detected, **1 in final resumeData** (McCann internship dropped)
- `PROJECT_STATE.md`: typical **40–69%** cleaned text retained in structured fields

**Root causes**
- Aggressive fact confidence threshold (80%) rejects lines at 79% (`fact-types.js` + `partitionFactsByConfidence`)
- Section misclassification (e.g. McCann → summary at 79%)
- Creative OCR layout breaks section contracts (`classification-engine-v2.js`, `fact-classifier.js`)

---

### 5. resumeData

| | |
|---|---|
| **Status** | **PARTIAL** |
| **Builder** | `src/core/resume-data.js:buildResumeData` |
| **Normalizer** | `src/core/resume-data.js:normalizeResumeData` |
| **Storage** | `index.html` `state.resumeData` (~1778) via `commitResumeData` (~3522) |

**Evidence**
- Canonical source-of-truth model is sound; flow lock strips debug fields
- `RENDER_AUDIT.md` Yoaz counts: exp 1, edu 2, skills 4, clients 9, **unsorted 3**, **identity_email 0**, identity_phone 1
- Name often uncertain → UI shows "Nom à confirmer" (`resume-data.js:NAME_UNCERTAIN_LABEL`)

**Gaps**
- `buildResumeData` can return sparse structure when gates reject facts
- `validation/confidence-gate.js:applyConfidenceGate` drops fields below per-section thresholds (identity 95%, experience 85%)
- Large `unsorted` backlog never becomes editable sections without user action

---

### 6. cvData

| | |
|---|---|
| **Status** | **PARTIAL** |
| **Mapper** | `src/core/resume-data.js:resumeDataToCvData` |
| **Sanitize** | `src/core/validation/sanitize-resume-display.js:sanitizeResumeForDisplay` |
| **Structured map** | `src/core/parsing/simple-cv-mapper.js:simpleCvDataFromStructured` |
| **Storage** | `index.html` `state.cvData` derived in `commitResumeData` |

**Evidence**
- `RENDER_AUDIT.md`: **unsorted 3 → 0** at mapper; **languages 2 → 1**; tools 1 → 2 (sanitize adds)
- Round-trip stable for counts that survive parsing
- Template input renderable: yes (1499 chars HTML)

**Gaps**
- `resumeDataToCvData` explicitly clears `unsorted`, `toClassify`, `unknownExperience` (lines 410–412) — content invisible in preview/export
- `index.html:applyImportResult` cvData round-trip (~3731) can reshape experiences
- Dual-model (`resumeData` vs `cvData`) confuses metrics/debug paths

---

### 7. Suggestions

| | |
|---|---|
| **Status** | **PARTIAL** |
| **Queue** | `src/core/parsing/review-queue.js:buildBlockReviewItems` |
| **UI filter** | `src/core/parsing/suggestion-confidence-score.js:filterProductSuggestions`, `classifySuggestionNoise` |
| **UI render** | `index.html:collectProductSuggestions` (~1828), `renderSuggestionsPanel` (~1924) |

**Evidence**
- **Browser (product UI):** `PRODUCT_PASS_QA.md` — 3 suggestions, garbage hidden, max 5, categories correct
- **Headless (pipeline-only):** `final-acceptance-test.mjs` — 5 visible items including McCann, `designer edition, logos...`, Be.net noise

**Gaps**
- UI filter hides garbage; **pipeline still generates noisy review items** not surfaced consistently
- `index.html:downloadPDF` blocks export when `getPendingReviewQueue().length` (unless `RESCUE_MODE`)
- 31+ unsorted lines after section-engine never become actionable suggestions (`CONFIDENCE_REJECTION_REPORT.md`)

---

### 8. ATS (Analyse recruteur)

| | |
|---|---|
| **Status** | **WORKING** (scorer); **PARTIAL** (product outcome on Yoaz) |
| **Engine** | `src/core/validation/ats-engine.js:computeAtsScore` |
| **Product wrapper** | `src/core/validation/product-score.js:computeProductScore` |
| **Checklist source** | `src/core/validation/recruiter-checklist-source.js:resolveChecklistProfile` |
| **UI** | `index.html:computeProductScoreReport` (~4639), `renderMetrics` (~4670) |

**Evidence**
- Weighted 0–100 model restored (`ATS_PIPELINE_AUDIT.md`)
- Yoaz: **53/100**; checklist — Nom ○, Email ○, Téléphone ✓, Expérience ✓, Formation ✓, Compétences ✓
- `PRODUCT_PASS_QA.md`: score lead visible, checklist actionable

**Gaps**
- Low scores reflect **missing identity email/name**, not scorer failure
- Inline fallback scorer in `index.html:computeProductScoreInline` weaker if module lazy-load fails
- `exportReady` checklist tied to field presence, not user-confirmed header edits

---

### 9. Template render

| | |
|---|---|
| **Status** | **WORKING** |
| **Registry** | `src/ui/templates/production-template-ids.mjs` — **6** templates |
| **Renderer** | `src/ui/templates/cv-templates.js` → `HirelyTemplates.render` |
| **UI** | `index.html:renderCV` (~4763), `layoutCvA4WhenReady` |
| **A4** | `src/ui/export/a4-viewport.js:apply`, `HirelyA4Pages.layoutCvA4Pages` |

**Evidence**
- `PRODUCT_PASS_QA.md`: A4 zoom **0.82**, 45/30/25 layout, header bar visible
- `RENDER_AUDIT.md`: renderable yes, 9 sections in HTML
- `RELEASE_REPORT.md`: all template scenarios PASS (report references 8 — doc drift)

**Gaps**
- Documentation says 8/14 templates; registry has **6** (`production-template-ids.mjs` vs `PROJECT_STATE.md`)
- Premium templates locked without Pro (`index.html:renderCV` ~4776)
- Experience DOM count 0 in audit despite cvData.experience=1 (ATS template flattens layout — audit artifact)

---

### 10. PDF export

| | |
|---|---|
| **Status** | **WORKING** |
| **UI** | `index.html:downloadPDF` (~5418) |
| **Engine** | `src/ui/export/hirely-pdf-export.js:exportCvToPdf` |
| **Fallback** | html2pdf inline in `downloadPDF` |
| **Config** | `src/core/export/pdf-export-config.js` |

**Evidence**
- `PRODUCT_PASS_QA.md`: Export PDF ✓ after click
- `RELEASE_REPORT.md`: one-page, two-page, creative-portfolio PDF PASS
- Uses same `#cvDoc.cv-page` DOM as preview (A4 794×1123)

**Gaps**
- Pro gate: `index.html:requirePro`
- Pending review queue gate (non-RESCUE_MODE)
- Browser html2canvas/font timing edge cases (`hirely-pdf-export.js:prepareFonts`)
- Server-side Playwright PDF deferred (`PROJECT_STATE.md` P1)

---

## Stage summary table

| Stage | Status | Yoaz evidence |
|-------|--------|---------------|
| Import | **WORKING** | IMPORT_READY, gate PASS |
| OCR | **PARTIAL** | Works 1-page; 30s risk multi-page |
| Extraction | **WORKING** | 0 FAIL extract tests |
| Parsing | **PARTIAL** | 59% data loss, 1/2 experiences |
| resumeData | **PARTIAL** | Sparse identity, unsorted backlog |
| cvData | **PARTIAL** | unsorted cleared, mapper drops |
| Suggestions | **PARTIAL** | UI OK; pipeline noisy |
| ATS | **WORKING** / outcome **PARTIAL** | 53/100, scorer OK |
| Template render | **WORKING** | A4 preview, 6 templates |
| PDF export | **WORKING** | Download succeeds in QA |

---

## Top 20 blockers — production CV product

Ranked by impact on a user expecting a **complete, recruiter-ready CV** from a scanned creative PDF without manual repair.

### P0 — Ship blockers

| # | Blocker | File | Function |
|---|---------|------|----------|
| 1 | **59% OCR text not mapped to CV fields** — user sees hollow CV vs source PDF | `src/core/pipeline/production-pipeline.js` | `runProductionExtractionPipeline` |
| 2 | **80% fact confidence rejects valid lines at 79%** (McCann, tools, skills fragments) | `src/core/parsing/cv-from-facts.js` | `partitionFactsByConfidence` |
| 3 | **Section-engine zeroes experiences before recovery** (`experiences=0`, `unsorted=31`) | `src/core/parsing/section-engine-v2.js` | `extractFieldsFromSectionBlocks` |
| 4 | **Identity name + email not extracted on Yoaz** → "Nom à confirmer", ATS Nom/Email ○ | `src/core/parsing/identity-extraction.js` | `extractLockedIdentity` |
| 5 | **30s PDF extraction timeout** aborts slow multipass OCR on heavy scans | `src/core/extraction/pdf-extraction-timeout.js` | `withExtractionTimeout` |
| 6 | **Strict acceptance FAIL** — Adobe/tools not in rendered preview text | `src/core/resume-data.js` + `src/ui/templates/cv-templates.js` | `resumeDataToCvData` / template render |

### P1 — Major product gaps

| # | Blocker | File | Function |
|---|---------|------|----------|
| 7 | **Second experience (McCann internship) detected but not promoted** | `src/core/parsing/experience-builder-v2.js` | experience merge / promotion |
| 8 | **unsorted content cleared from cvData** — invisible in preview/export | `src/core/resume-data.js` | `resumeDataToCvData` (lines 410–412) |
| 9 | **Export blocked by pending review queue** (non-rescue builds) | `index.html` | `downloadPDF` |
| 10 | **OCR quality gate can block parser** → empty CV / paste fallback | `src/core/import/ocr-parser-gate.js` | `assessOcrBeforeParser` |
| 11 | **Per-section confidence gates drop fields** (identity 95%, exp 85%) | `src/core/validation/confidence-gate.js` | `applyConfidenceGate` |
| 12 | **Multi-column / creative layout reading order** mis-orders blocks | `src/core/layout/reading-order.js` | reading-order sort |
| 13 | **Suggestion pipeline vs UI filter divergence** — headless shows garbage McCann/edition lines | `src/core/parsing/suggestion-confidence-score.js` | `filterProductSuggestions` (UI-only path) |
| 14 | **ATS score ~53 masks parsing gaps** — looks "working" but contact incomplete | `src/core/validation/ats-engine.js` | `hasName`, `hasEmail` |
| 15 | **Template/registry documentation drift** (6 live vs 8 documented) | `src/ui/templates/production-template-ids.mjs` | `PRODUCTION_TEMPLATE_IDS` |
| 16 | **Cover letter grounded on sparse cvData** — limited personalization | `src/core/export/cover-letter-engine.js` | `buildCoverLetterDraft` |

### P2 — Polish / scale / ops

| # | Blocker | File | Function |
|---|---------|------|----------|
| 17 | **Pro gate blocks PDF** on non-localhost without unlock | `index.html` | `requirePro` |
| 18 | **Vision OCR unavailable locally** — lower quality Tesseract only | `src/core/extraction/ocr-pipeline.js` | `tryVisionApi` |
| 19 | **No server-side Playwright PDF** — browser-only export quality variance | `PROJECT_STATE.md` (deferred) | — |
| 20 | **html2canvas font/layout timing** on complex templates | `src/ui/export/hirely-pdf-export.js` | `prepareFonts` / `exportCvToPdf` |

---

## QA divergence (why PASS and FAIL coexist)

| Test | Result | Why |
|------|--------|-----|
| `product-pass-qa-yoaz.mjs` | PASS | Browser UI: garbage filtered, zoom 0.82, rescue export, pro URL |
| `final-acceptance-test.mjs` | FAIL | Pipeline-only: requires **Adobe** in preview text; shows unfiltered suggestions |
| `RELEASE_REPORT.md` | PASS | Gate tolerates 57% parser retention as non-blocking |
| `DATA_LOSS_REPORT.md` | 59% loss | Token-level OCR → cvData comparison |

**Interpretation:** Product QA validates **studio usability**; acceptance QA validates **CV completeness**. Both are correct; they measure different bars.

---

## File index (canonical entry points)

| Concern | Primary file | Primary function |
|---------|--------------|------------------|
| UI import | `index.html` | `handleFileImport` |
| Canonical import | `src/core/import/canonical-import.js` | `canonicalImportFromFile` |
| PDF OCR route | `src/core/extraction/pdf-router.js` | `routePdfExtraction` |
| OCR execution | `src/core/extraction/ocr-pipeline.js` | `runOcrOnCanvas` |
| Extract wrapper | `src/core/extraction/extract-file.js` | `extractFromFileDetailed` |
| Enterprise PDF | `src/core/extraction/enterprise-engine.js` | `extractPdfEnterprise` |
| Parser orchestrator | `src/core/pipeline/production-pipeline.js` | `runProductionExtractionPipeline` |
| resumeData build | `src/core/resume-data.js` | `buildResumeData` |
| cvData map | `src/core/resume-data.js` | `resumeDataToCvData` |
| Suggestions filter | `src/core/parsing/suggestion-confidence-score.js` | `filterProductSuggestions` |
| ATS score | `src/core/validation/ats-engine.js` | `computeAtsScore` |
| Template render | `index.html` + `src/ui/templates/cv-templates.js` | `renderCV` / `HirelyTemplates.render` |
| PDF export | `index.html` + `src/ui/export/hirely-pdf-export.js` | `downloadPDF` / `exportCvToPdf` |

---

## Master verdict

| Dimension | Verdict |
|-----------|---------|
| **Pipeline infrastructure** | **WORKING** — import, extract, render, export path is real |
| **CV reconstruction fidelity** | **PARTIAL** — major field loss on creative scanned PDFs |
| **Recruiter-ready without edits** | **BROKEN** — name, email, tools, second experience, Adobe line missing |
| **Studio UX (post product pass)** | **WORKING** — review layout, suggestions cap, export, letter panel |
| **Production CV product** | **NOT READY** — P0 parsing/identity blockers remain |

**Recommended focus order:** P0 #2–#4 (confidence + section + identity) before new features. Extraction/OCR is not the bottleneck on Yoaz; **parsing and mapping are**.

---

*Audit only. No fixes applied. Re-run: `node scripts/product-pass-qa-yoaz.mjs`, `node scripts/final-acceptance-test.mjs`.*
