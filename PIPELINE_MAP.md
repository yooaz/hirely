# Hirely Pipeline Map

**Mode:** Stabilization reference — no feature work.  
**Goal:** Import any CV → extract → `resumeData` → `cvData` → render → export PDF.

**Canonical product flow** (`HIRELY_FLOW_LOCK_V3` in `src/core/pipeline/hirely-flow-lock.js`):

```
IMPORT → EXTRACT_TEXT → CLEAN_TEXT → BUILD_BLOCKS → CLASSIFY_FACTS
  → BUILD_RESUME_DATA → SAFETY_GATE → REVIEW → STYLE → EXPORT
```

**UI entry:**

```
handleFileImport(file)  [index.html]
  → runHirelyImportFromFile()     [src/core/pipeline/hirely-import.js]
  → applyImportResult()           [index.html]
  → commitResumeData()            [index.html]
  → renderCV() + renderMetrics() + downloadPDF()
```

---

## End-to-end diagram

```mermaid
flowchart TD
  subgraph S1["1 — OCR"]
    OCR_IN[Canvas / PDF page / Image]
    OCR_OUT[text + ExtractedLine[]]
  end

  subgraph S2["2 — Extraction"]
    EXT_IN[File | paste string]
    EXT_OUT[EnterpriseExtractionResult]
  end

  subgraph S3["3 — Classification"]
    CLS_IN[cleanedText + layout blocks]
    CLS_OUT[SectionBlockV2[] + ResumeFact[]]
  end

  subgraph S4["4 — StructuredResume"]
    SR_IN[classified blocks + facts]
    SR_OUT[structuredResume object]
  end

  subgraph S5["5 — ResumeData"]
    RD_IN[structuredResume + import context]
    RD_OUT[resumeData — product SSOT]
  end

  subgraph S6["6 — CVData"]
    CV_IN[resumeData]
    CV_OUT[cvData — flat template shape]
  end

  subgraph S7["7 — RenderCV"]
    REN_IN[cvData + template + spacing]
    REN_OUT[#cvDoc HTML]
  end

  subgraph S8["8 — ATS"]
    ATS_IN[sanitized resumeData profile]
    ATS_OUT[score + checklist + export gates]
  end

  subgraph S9["9 — PDF"]
    PDF_IN[#cvDoc live DOM]
    PDF_OUT[hirely-name.pdf blob/file]
  end

  File[User file / paste] --> EXT_IN
  EXT_IN --> OCR_IN
  OCR_OUT --> EXT_OUT
  EXT_OUT --> CLS_IN
  CLS_IN --> SR_IN
  SR_IN --> RD_IN
  RD_IN --> CV_IN
  CV_IN --> REN_IN
  RD_IN --> ATS_IN
  REN_IN --> PDF_IN
```

---

## Stage 1 — OCR

**Purpose:** Convert scanned PDF pages or images into text and per-line confidence. Runs as a **sub-path of Extraction**, not a standalone product stage.

### Input

| Source | Shape |
|--------|--------|
| PDF (scanned / mixed) | `pdfjsLib.PDFDocumentProxy` → rendered `HTMLCanvasElement` |
| Image upload | `File` → canvas |
| Vision API | `Blob` (PNG from canvas) |
| Options | `{ lang, file, page, viewportWidth/Height, rotationDeg, deadlineAt }` |

**Triggered when:** `planPdfExtraction()` returns `route: 'ocr'` or `'mixed'` (`pdf-router.js`).

### Output

| Function | Shape |
|----------|--------|
| `runOcrOnCanvas()` | `string` |
| `runOcrOnCanvasWithLines()` | `{ text, lines[], provider }` |
| `ocrPdfPageToLines()` | `{ text, lines: ExtractedLine[] }` |
| `runCachedTimedPdfOcr()` | `{ text, lines, recoveredAfterTimeout? }` |

**`ExtractedLine`** (`src/core/extraction/extracted-line.js`):

```js
{ text, rawExtraction?, cleanedText?, confidence, source: 'native'|'ocr',
  page, line, x, y, columnId?, region?, zone? }
```

### Dependencies

- `cloud-ocr.js` — cloud proxy
- `ocr-tesseract.js` — local fallback
- `ocr-preprocess.js`, `ocr-multipass.js`, `ocr-rotation-select.js`
- `ocr-quality-score.js` — `evaluateOcrParserGate()`
- `api/ocr.js` — serverless Vision endpoint
- `runtime/static-mode.js` — `shouldSkipRemoteOcr()`

### Files

| File | Role |
|------|------|
| `src/core/extraction/ocr-pipeline.js` | Unified OCR: Vision → cloud → Tesseract |
| `src/core/extraction/ocr-lines.js` | Page/canvas → lines + postprocess |
| `src/core/extraction/pdf-ocr-run.js` | Timed, cached full-document PDF OCR |
| `src/core/extraction/pdf-ocr-render.js` | PDF page → canvas |
| `src/core/extraction/pdf-ocr-cache.js` | OCR result cache |
| `src/core/extraction/ocr-preprocess.js` | Canvas preprocessing |
| `src/core/extraction/ocr-multipass.js` | Multi-pass fusion |
| `src/core/extraction/ocr-rotation-select.js` | Best rotation |
| `src/core/extraction/ocr-tesseract.js` | Tesseract wrapper |
| `src/core/extraction/cloud-ocr.js` | Cloud OCR proxy |
| `src/core/extraction/ocr-quality-score.js` | Quality gates |
| `api/ocr.js` | `/api/ocr` Vision endpoint |

### Functions

| Function | File |
|----------|------|
| `runOcrOnCanvas(canvas, opts)` | `ocr-pipeline.js` |
| `runOcrOnCanvasWithLines(canvas, opts)` | `ocr-pipeline.js` |
| `tryVisionApi(blob, opts)` | `ocr-pipeline.js` |
| `ocrCanvasToLines(canvas, opts)` | `ocr-lines.js` |
| `ocrPdfPageToLines(pdf, pageNumber, opts)` | `ocr-lines.js` |
| `ocrPdfAllPagesToLines(pdf, opts)` | `ocr-lines.js` |
| `runCachedTimedPdfOcr(pdf, file, opts)` | `pdf-ocr-run.js` |
| `runOcrWithFusion(canvas, opts)` | `ocr-multipass.js` |
| `selectBestOcrRotation(canvas, opts)` | `ocr-rotation-select.js` |
| `evaluateOcrParserGate(text, lines)` | `ocr-quality-score.js` |

---

## Stage 2 — Extraction

**Purpose:** File or paste → raw text, cleaned text, line archive, layout metadata. **No parsing.**

### Input

| Entry | Shape |
|-------|--------|
| File import | `File` — PDF, DOCX, TXT, image |
| Paste / TXT | `string` via `extractPlainTextEnterprise(text, method)` |
| PDF internal | `PDFDocumentProxy` + `ArrayBuffer` |

File type: `detectInputFileType(file)` → `{ kind: 'pdf'|'docx'|'txt'|'image'|'unknown' }`.

### Output

**`extractFromFileDetailed(file)`** →

```js
{
  text, importState, importStatus, method, fileType, fileTypeLabel,
  enterprise: EnterpriseExtractionResult,
  pdfExtraction, lines: ExtractedLine[], metadata
}
```

**`EnterpriseExtractionResult`** (`enterprise-engine.js`):

```js
{
  rawExtraction, cleanedText, text, lines: ExtractedLine[],
  layoutMemory, method, metadata, documentBlocks[], pdfExtraction
}
```

**Format routes:**

| Format | Method | Path |
|--------|--------|------|
| PDF text layer | `native_pdf` | `extractNativePdfLines` |
| PDF scanned | `ocr` | Stage 1 OCR → `buildResult` |
| PDF mixed | `mixed` | Native + per-page OCR |
| DOCX | `docx` | `docx-extract.js` |
| TXT | `txt` | `file.text()` |
| Image | `ocr` | `extractImageEnterprise` |
| Paste | `paste` | `extractPlainTextEnterprise` |

### Dependencies

- `pdf-router.js` — route planning
- `pdf-lines-native.js` — native PDF text
- `pdf-post-extract.js` — layout / reading order
- `extraction-line-enrich.js` — raw/clean from lines
- `layout/layout-memory.js` — column memory
- `stages/document-detection.js`, `stages/layout-detection.js`, `stages/extraction-archive.js`
- `import/import-status.js` — `resolveImportStatus`, `IMPORT_STATE`
- `extraction-session.js` — session cache

### Files

| File | Role |
|------|------|
| `src/core/extraction/extract-file.js` | Top-level file entry |
| `src/core/extraction/document-extract.js` | Format router |
| `src/core/extraction/enterprise-engine.js` | Core engine |
| `src/core/extraction/pdf-router.js` | PDF route planning |
| `src/core/extraction/pdf-lines-native.js` | Native PDF lines |
| `src/core/extraction/pdf-post-extract.js` | Post-extract layout |
| `src/core/extraction/docx-extract.js` | DOCX text |
| `src/core/extraction/file-type-detect.js` | MIME / extension detect |
| `src/core/extraction/extracted-line.js` | Line model |
| `src/core/extraction/extraction-line-enrich.js` | Text builders |
| `src/core/extraction/stages/document-detection.js` | Doc classification |
| `src/core/extraction/stages/layout-detection.js` | Layout type |
| `src/core/extraction/stages/extraction-archive.js` | Line archive |
| `src/core/pipeline/hirely-import.js` | `runHirelyImportFromFile` |
| `src/core/import/canonical-import.js` | `canonicalImportFromFile` |

### Functions

| Function | File |
|----------|------|
| `extractFromFileDetailed(file)` | `extract-file.js` |
| `extractFromFile(file)` | `extract-file.js` |
| `extractDocument(file)` | `document-extract.js` |
| `extractPdfEnterprise(pdf, buffer, ctx)` | `enterprise-engine.js` |
| `extractPlainTextEnterprise(text, method)` | `enterprise-engine.js` |
| `planPdfExtraction(pages, allNativeText, opts)` | `pdf-router.js` |
| `routePdfExtraction(classification, opts)` | `pdf-router.js` |
| `applyPdfOcrPolicy(enterprise)` | `document-extract.js` |
| `buildExtractionArchiveStage(enterprise, rawFallback)` | `stages/extraction-archive.js` |
| `runHirelyImportFromFile(file, opts)` | `pipeline/hirely-import.js` |
| `runHirelyImportFromText(text, opts)` | `pipeline/hirely-import.js` |

**Handoff:** `runHirelyImportFromText` → `runProductionExtractionPipeline(raw, { enterpriseExtraction, … })`.

---

## Stage 3 — Classification

**Purpose:** Assign semantic types to document blocks, section blocks, and atomic facts.

### Input

| Source | Shape |
|--------|--------|
| Cleaned text + layout | `string` + `layoutMemory`, `extractionLines`, `headerLines` |
| Document blocks | `DocumentBlock[]` from `block-builder-v1.js` |
| Section blocks | `SectionBlockV2[]` from `detectSectionBlocks()` |

### Output

| Layer | Shape |
|-------|--------|
| Classified blocks | `SectionBlockV2[]` with `type`, `classifiedConfidence`, `classifyReason` |
| Classified document blocks | `DocumentBlock[]` with `classifiedType`, `classifier: 'SECTION_CLASSIFIER_V1'` |
| Classified facts | `ResumeFact[]`: `{ id, type, value, confidence, sourceLine, classifierReason }` |

**Thresholds:** `CLASSIFICATION_CONFIDENCE_MIN` (80), `FACT_CONFIDENCE_THRESHOLD` (0.8).

### Dependencies

- `src/data/dictionaries/*` — entity catalogs, `json-dictionary-match.js`
- `classification-engine-v2.js`, `section-sanity.js`, `line-cleaner.js`
- `cv-section-contract.js` — section contracts
- `creative-cv-mode.js`, `creative-parsing-mode.js`
- `block-builder-v1.js`, `block-classifier.js` (P0 pipeline)

### Files

| File | Role |
|------|------|
| `src/core/parsing/section-detect-v2.js` | `detectSectionBlocks()` |
| `src/core/parsing/section-classify-v2.js` | `classifySectionBlocks()` |
| `src/core/parsing/section-classifier-v1.js` | `classifyDocumentBlocksV1()` |
| `src/core/parsing/section-engine-v2.js` | `runSectionEngineV2()` — orchestrator |
| `src/core/parsing/fact-extraction.js` | `extractFactsFromSectionBlocks()` |
| `src/core/parsing/fact-classifier.js` | `classifyFactStrict()` |
| `src/core/parsing/classification-engine-v2.js` | `classifySpecialtyLineV2()` |
| `src/core/parsing/block-builder-v1.js` | P0 document blocks |
| `src/core/parsing/block-classifier.js` | Block-level classification |
| `src/core/pipeline/production-pipeline.js` | `runP0Pipeline`, block stages |
| `src/core/parsing/parser-enterprise.js` | **Legacy** — `parseCV` path only |

### Functions

| Function | File |
|----------|------|
| `runSectionEngineV2(opts)` | `section-engine-v2.js` |
| `detectSectionBlocks(text, opts)` | `section-detect-v2.js` |
| `classifyDocumentBlocksV1(blocks, opts)` | `section-classifier-v1.js` |
| `classifySectionBlocks(blocks)` | `section-classify-v2.js` |
| `extractFactsFromSectionBlocks(blocks, opts)` | `fact-extraction.js` |
| `classifyFactStrict(fact)` | `fact-classifier.js` |
| `classifySpecialtyLineV2(line)` | `classification-engine-v2.js` |
| `runProductionExtractionPipeline(rawText, opts)` | `production-pipeline.js` |
| `runP0Pipeline(opts)` | `p0-pipeline.js` |

**Flow inside `runSectionEngineV2`:**

1. `resolveParserLayoutInput()` → `detectSectionBlocks()`
2. If `documentBlocks`: `classifyDocumentBlocksV1()` → `documentBlocksToSectionBlocks()`
3. Else: `classifySectionBlocks()`
4. Optional creative mode overlay
5. Handoff to Stage 4 via `extractFieldsFromSectionBlocks()` → `runFactPipeline()`

---

## Stage 4 — StructuredResume

**Purpose:** Build canonical `structuredResume` — editor/review intermediate model.

### Input

| Source | Shape |
|--------|--------|
| Classified section blocks | `SectionBlockV2[]` from Stage 3 |
| Options | `{ rawText, creativeMode, headerLines, classifiedBlocks }` |
| P0 blocks | Accepted `DocumentBlock[]` (`confidence ≥ 70`) |

### Output

**`structuredResume`** (`emptyStructuredResume()` in `structured-resume.js`):

```js
{
  identity: { name, title, email, phone, location, website, linkedin },
  summary, experiences[], education[], clients[], skills[], tools[],
  languages[], projects[], awards[], publications[], interests[],
  unsorted[], needsReview[], reviewQueue[], factReviewQueue[],
  nameCandidates[], titleCandidates[], metadata, rawExtraction, ...
}
```

Also: `resumeJson` (graph), `sectionBlocks`, `report` (coverage).

### Dependencies

- Stage 3 outputs
- `fact-pipeline.js` → `cv-from-facts.js`
- `experience-builder-v2.js`, `experience-rebuilder.js`, `experience-recovery.js`
- `resume-graph-engine.js`, `build-resume-graph.js`
- `zero-text-loss.js`, `no-data-loss.js`
- `review-queue-merge.js`, `review-queue-categories.js`
- `pipeline-contract.js` — `slimStructuredResume`, `guardStructuredResumeSize`

### Files

| File | Role |
|------|------|
| `src/core/parsing/structured-resume.js` | Schema, `emptyStructuredResume()`, `structuredToCvData()` |
| `src/core/parsing/structured-resume-from-blocks.js` | **Production entry** — `buildStructuredResumeFromBlocks()` |
| `src/core/parsing/fact-pipeline.js` | `runFactPipeline()` |
| `src/core/parsing/cv-from-facts.js` | `buildCvFromFacts()` |
| `src/core/parsing/section-field-extract-v2.js` | `extractFieldsFromSectionBlocks()` |
| `src/core/parsing/experience-rebuilder.js` | Experience recovery |
| `src/core/parsing/experience-recovery.js` | Fallback experience |
| `src/core/parsing/resume-graph-engine.js` | Graph JSON |
| `src/core/parsing/universal-parse-pipeline.js` | Alt entry (flow lock off) |
| `src/core/pipeline/production-pipeline.js` | Calls `buildStructuredResumeFromDocumentBlocks()` |
| `src/core/pipeline/hirely-import.js` | `finalizeStructuredResumeForProduct()` |

### Functions

| Function | File |
|----------|------|
| `buildStructuredResumeFromBlocks(blocks, opts)` | `structured-resume-from-blocks.js` |
| `buildStructuredResumeFromDocumentBlocks(blocks, opts)` | `structured-resume-from-blocks.js` |
| `runFactPipeline(blocks, opts)` | `fact-pipeline.js` |
| `buildCvFromFacts(facts, blocks, opts)` | `cv-from-facts.js` |
| `extractFieldsFromSectionBlocks(blocks, opts)` | `section-field-extract-v2.js` |
| `runExperienceRebuilder(sr, opts)` | `experience-rebuilder.js` |
| `runExperienceRecovery(sr, opts)` | `experience-recovery.js` |
| `runResumeGraphEngine(sr, opts)` | `resume-graph-engine.js` |
| `finalizeStructuredResumeForProduct(sr, opts)` | `hirely-import.js` |
| `slimStructuredResume(sr)` | `pipeline-contract.js` |
| `guardStructuredResumeSize(sr, text)` | `pipeline-contract.js` |

**Post-fact sequence in `runSectionEngineV2`:**

`sanitizeStrictExperiences` → `runExperienceRebuilder` → `runExperienceRecovery` → `applyZeroTextLossMode` → `runResumeGraphEngine`

---

## Stage 5 — ResumeData

**Purpose:** Product single source of truth (`resumeData`) for editor, templates, ATS profile, export.

### Input

| Source | Shape |
|--------|--------|
| `structuredResume` | Slimmed via `finalizeStructuredResumeForProduct()` |
| `HirelyImportResult` | `{ structuredResume, rawText, cleanedText, warnings, errors, rejectedLines, reviewQueue }` |
| Editor changes | In-memory `ResumeData` mutations |

### Output

**`resumeData`** (`emptyResumeData()`):

```js
{
  identity, summary, experiences[], education[], clients[], projects[],
  exhibitions[], awards[], publications[], portfolioLinks[],
  skills[], tools[], languages[], unsorted[],
  meta: { fileName, fileType, extractionMethod, confidence, warnings, creativeMode, ... }
}
```

Stripped by `lockResumeDataShape()`: no `reviewQueue`, `structuredResume`, `rawText`, debug payloads.

### Dependencies

- Stage 4 `structuredResume`
- `import-repair.js` — `repairResumeDataFromRaw()`
- `suggestion-auto-accept.js` — auto-accept safe lines
- `line-source-dedup.js` — dedupe against consumed lines
- `no-data-loss.js` — text retention
- `creative-resume-mode.js` — creative section reconcile
- `confidence-gate.js` — `applyConfidenceGate()`
- `sanitize-resume-display.js` — display contract
- `resume-output-quality.js` — `polishResumeOutput()`
- `hirely-flow-lock.js` — `lockResumeDataShape()`, `assertResumeDataFlowLock()`

### Files

| File | Role |
|------|------|
| `src/core/resume-data.js` | **Primary** — `buildResumeData`, `normalizeResumeData` |
| `src/core/import/canonical-import.js` | `canonicalImportFromFile/Text` |
| `src/core/pipeline/hirely-import.js` | `productionToHirelyImportResult()` |
| `src/core/parsing/import-repair.js` | Raw-text experience repair |
| `src/core/parsing/suggestion-auto-accept.js` | Auto-accept suggestions |
| `src/core/parsing/line-source-dedup.js` | Source-line dedup |
| `src/core/parsing/resume-output-quality.js` | Output polish |
| `src/core/validation/confidence-gate.js` | Confidence gate |
| `src/core/validation/sanitize-resume-display.js` | Display sanitize |
| `src/core/pipeline/hirely-flow-lock.js` | Shape lock |
| `index.html` | `commitResumeData()` |

### Functions

| Function | File |
|----------|------|
| `buildResumeData({ structured, importResult, rawText, cleanedText, … })` | `resume-data.js` |
| `normalizeResumeData(data)` | `resume-data.js` |
| `resumeDataFromStructured(structured)` | `resume-data.js` |
| `resumeDataFromImport(importResult)` | `resume-data.js` |
| `repairResumeDataFromRaw(rd, opts)` | `import-repair.js` |
| `reconcileTextRetention(rd, opts)` | `resume-data.js` |
| `applyConfidenceGate(rd)` | `confidence-gate.js` |
| `sanitizeResumeForDisplay(rd)` | `sanitize-resume-display.js` |
| `polishResumeOutput(rd)` | `resume-output-quality.js` |
| `lockResumeDataShape(rd)` | `hirely-flow-lock.js` |
| `assertResumeDataContract(rd)` | `resume-data.js` |
| `commitResumeData(rd)` | `index.html` |

**`buildResumeData()` sequence:**

```
emptyResumeData
  → resumeDataFromImport / resumeDataFromStructured
  → repairResumeDataFromRaw
  → autoAcceptSafeSuggestions (×2)
  → reconcileTextRetention
  → reconcileCreativeSections
  → normalizeResumeData
  → assertResumeDataContract
  → dedupeSuggestionsAgainstResumeData
```

**`normalizeResumeData()` sequence:**

```
sanitizeIdentity → polishResumeOutput → capUnsortedWithArchive
  → applyConfidenceGate → sanitizeResumeForDisplay
  → assertResumeDataFlowLock → lockResumeDataShape
```

---

## Stage 6 — CVData

**Purpose:** Flat, template-safe JSON derived from `resumeData`. No raw OCR, no debug payloads.

### Input

- **`ResumeData`** from `commitResumeData()` / `buildResumeData()`
- Alternate: `structuredResume` → `structuredToCvData()` (pipeline before commit)

### Output

**`cvData`** — flat display/export shape:

```js
{
  name, title, email, phone, linkedin, portfolio, location, summary,
  experience[], education[], skills[], tools[], languages[], clients[], projects[],
  reviewQueue?, needsReview?, _heldSections?, sectionConfidence?
}
```

Stripped by `stripTemplateCvData()`: `rawText`, `cleanedText`, `unsorted`, `structuredResume`, etc.

### Dependencies

- `simple-cv-mapper.js` — `simpleCvDataFromStructured()`
- `rich-parser.js` — `normalizeCvData()`, `emptyCVData()`
- `hirely-flow-lock.js` — `stripTemplateCvData()`
- `pipeline-contract.js` — `stripCvDataForTemplate()`
- `corruption-detector.js` — `isLineCorruptedForExport()`
- `review-queue.js` — `applyReviewQueueToCvData()` (display gate)
- `render-pipeline-trace.js` — count logging

### Files

| File | Role |
|------|------|
| `src/core/resume-data.js` | `resumeDataToCvData()`, `resumeDataFromCvData()` |
| `src/core/parsing/simple-cv-mapper.js` | Structured → flat mapper |
| `src/core/parsing/structured-resume.js` | `structuredToCvData()` |
| `src/core/parsing/rich-parser.js` | `normalizeCvData()` |
| `src/core/pipeline/hirely-flow-lock.js` | Template key strip |
| `src/core/pipeline/pipeline-contract.js` | Contract assert |
| `src/core/parsing/review-queue.js` | Review gate on cvData |
| `index.html` | `commitResumeData()`, `getDisplayCvData()`, `applyReviewGateToCv()` |

### Functions

| Function | File |
|----------|------|
| `resumeDataToCvData(data)` | `resume-data.js` |
| `simpleCvDataFromStructured(structured)` | `simple-cv-mapper.js` |
| `legacyExperienceLineToEntry(line)` | `simple-cv-mapper.js` |
| `structuredToCvData(structured)` | `structured-resume.js` |
| `stripTemplateCvData(cvData)` | `hirely-flow-lock.js` |
| `stripCvDataForTemplate(cvData)` | `pipeline-contract.js` |
| `normalizeCvData(p)` | `rich-parser.js` |
| `resumeDataFromCvData(cvData)` | `resume-data.js` |
| `applyReviewQueueToCvData(cvData, queue)` | `review-queue.js` |
| `getDisplayCvData()` | `index.html` — review-gated cvData |
| `getChecklistCvData()` | `index.html` — ATS profile source |

**Import wiring** (`hirely-import.js`):

```js
result.templateData = stripCvDataForTemplate(resumeDataToCvData(result.resumeData));
```

**UI round-trip** (`applyImportResult` in `index.html`):

`commitResumeData` → review gate on cvData → optional `resumeDataFromCvData` round-trip → `state.cvData`.

---

## Stage 7 — RenderCV

**Purpose:** Render sanitized `cvData` into live HTML in `#cvDoc`.

### Input

| Source | Notes |
|--------|--------|
| `cvData` | Arg, `state.cvData`, or `resumeDataToCvData(state.resumeData)` |
| Display path | `getDisplayCvData()` — review-gated |
| UI state | `state.template`, `state.spacing`, `state.photo`, `state.pro` |

### Output

- **DOM:** `#cvDoc` — classes `cv cv-page template-{id} spacing-{spacing} cv--live`
- **Side effects:** A4 pagination (`HirelyA4Pages.layoutCvA4Pages`), trace logs
- **Empty state:** placeholder when `!cvDataIsRenderable(active)`

### Dependencies

- `src/ui/templates/cv-templates.js` — `HirelyTemplates.render()`
- `src/ui/templates/cv-templates-professional.css`
- `src/ui/templates/production-template-ids.mjs` — template registry
- `HirelyA4Pages` / `HirelyA4Viewport` — pagination / scale
- `cv-templates.js` (root) — **deprecated** loader redirect

### Files

| File | Role |
|------|------|
| `index.html` | `renderCV()`, `initHirelyTemplates()`, `layoutCvA4WhenReady()` |
| `src/ui/templates/cv-templates.js` | 14 production templates |
| `src/ui/templates/cv-templates-professional.css` | Template CSS |
| `src/ui/templates/production-template-ids.mjs` | ID registry |
| `src/core/parsing/rich-parser.js` | `cvDataIsRenderable()` |
| `src/core/runtime/render-pipeline-trace.js` | `TEMPLATE_COUNTS` logging |

### Functions

| Function | File |
|----------|------|
| `renderCV(cvData, templateId)` | `index.html` |
| `initHirelyTemplates(deps)` | `cv-templates.js` |
| `HirelyTemplates.render(p, templateId)` | `cv-templates.js` |
| `normalizeProfile(p)` | `cv-templates.js` |
| `HirelyTemplates.resolve(id)` | `cv-templates.js` |
| `layoutCvA4WhenReady()` | `index.html` |
| `finishCvImportDisplay(cvData, …)` | `index.html` — post-import render |
| `cvDataIsRenderable(d)` | `rich-parser.js` |

**`normalizeProfile()` applies:** field filtering, OCR-block rules, section confidence gates, experience fallback, `mergeStructuredResume`.

---

## Stage 8 — ATS

**Purpose:** Weighted 0–100 recruiter score, checklist, export readiness gates. **Does not mutate data.**

### Input

| Source | Notes |
|--------|--------|
| Checklist profile | `getChecklistCvData()` → `resolveChecklistProfile({ resumeData, cvData })` |
| Sanitized counts | `_resumeCounts` on profile |
| Extras | `toClassifyCount`, prior `atsScore` / `atsBand` |

### Output

| Artifact | Shape |
|----------|--------|
| ATS score | `{ total, band, breakdown[6], checklist[], checks, panel }` |
| Readiness report | `{ gates, exportReady, completionPct, missingSections, … }` |
| UI | `#studioScore`, `#reviewV2Checklist`, `state.lastScoreReport`, `state.reviewReadiness` |

**Scoring categories (max 100):** Completeness 15, Contact 10, Experience 30, Skills 20, Formatting 15, Recruiter readability 10.

**Export gate:** identity + experience + education + skills (`review-readiness.js`).

### Dependencies

- `ats-engine.js` — canonical scorer
- `product-score.js` — facade
- `recruiter-checklist-source.js` — profile from sanitized `resumeData`
- `review-readiness.js` — export gates
- `suggestion-confidence-score.js` — suggestions filter (parallel, not ATS)
- `sanitize-resume-display.js` — pre-score sanitize

### Files

| File | Role |
|------|------|
| `src/core/validation/ats-engine.js` | `computeAtsScore` |
| `src/core/validation/product-score.js` | `computeProductScore` |
| `src/core/validation/review-readiness.js` | `buildReviewReadinessReport` |
| `src/core/validation/recruiter-checklist-source.js` | `resolveChecklistProfile` |
| `src/core/validation/ats-analyzer.js` | Pipeline wrapper |
| `src/core/validation/recruiter-review.js` | Fix suggestions |
| `src/core/pipeline/production-pipeline.js` | Import-time score |
| `index.html` | `renderMetrics()`, `computeProductScoreReport()` |

### Functions

| Function | File |
|----------|------|
| `computeAtsScore(cvData)` | `ats-engine.js` |
| `computeProductScore(cvData, { resumeData })` | `product-score.js` |
| `resolveChecklistProfile({ resumeData, cvData })` | `recruiter-checklist-source.js` |
| `buildReviewReadinessReport(cvData, opts)` | `review-readiness.js` |
| `isExportReady(report)` | `review-readiness.js` |
| `buildRecruiterPanelMetrics(scoreResult)` | `ats-engine.js` |
| `buildRecruiterChecklist(scoreResult, exportReady)` | `ats-engine.js` |
| `computeProductScoreReport()` | `index.html` |
| `getReviewReadinessReport()` | `index.html` |
| `renderMetrics()` | `index.html` |
| `renderScorePanel(report)` | `index.html` |
| `renderReviewStudioV2()` | `index.html` |

---

## Stage 9 — PDF

**Purpose:** Capture rendered DOM (or plain text) to downloadable files.

### Input

| Export | Input |
|--------|--------|
| CV PDF | Live `#cvDoc` after `renderCV()` + `layoutCvA4WhenReady()` |
| Preconditions | Pro gate, `isExportReady()`, review queue clear (non-rescue) |
| TXT | `state.cvData` via `formatCvAsStructuredText()` |
| Cover letter PDF | Letter text → `downloadLetterPdf()` |

### Output

| Export | Output |
|--------|--------|
| CV PDF | `hirely-{name}.pdf` via html2pdf |
| CV blob | `exportCvToPdfBlob()` — email attachment |
| TXT | Structured plain-text CV |
| Letter | `.txt`, clipboard, `.pdf` |

### Dependencies

- `html2pdf.js` (CDN) — DOM → PDF
- `hirely-pdf-export.js` — A4 sizing, export mode
- `pdf-export-config.js` — A4 constants, break-avoid selectors
- `format-cv.js` — structured plain text
- `letter-exporter.js` — cover letter exports
- `cv-pdf-export.css` — export-mode styles
- `api/send-cv-email.js` — email backend

### Files

| File | Role |
|------|------|
| `src/ui/export/hirely-pdf-export.js` | `exportCvToPdf`, `exportCvToPdfBlob` |
| `src/core/export/format-cv.js` | `formatCvAsStructuredText` |
| `src/core/export/letter-exporter.js` | Letter TXT/PDF/clipboard |
| `src/core/export/pdf-export-config.js` | A4 config |
| `src/core/export/index.js` | Export re-exports |
| `src/ui/templates/cv-pdf-export.css` | PDF styles |
| `index.html` | `downloadPDF()`, `downloadTXT()`, `emailCV()` |
| `api/send-cv-email.js` | Email API |

### Functions

| Function | File |
|----------|------|
| `downloadPDF()` | `index.html` |
| `exportCvToPdf(cvEl, filename)` | `hirely-pdf-export.js` |
| `exportCvToPdfBlob(cvEl, filename)` | `hirely-pdf-export.js` |
| `buildHtml2PdfOptions(cvEl, filename)` | `hirely-pdf-export.js` |
| `applyExportMode(cvEl)` / `clearExportMode(cvEl)` | `hirely-pdf-export.js` |
| `formatCvAsStructuredText(cv)` | `format-cv.js` |
| `formatCvAsText(p)` | `index.html` |
| `downloadTXT()` | `index.html` |
| `emailCV()` | `index.html` |
| `downloadLetterPdf(text, filename)` | `letter-exporter.js` |

**PDF sequence:**

1. `HirelyLazy.ensureHtml2pdf()` — load CDN
2. `renderCV()` — ensure DOM current
3. `layoutCvA4WhenReady()` — paginate
4. `HirelyPdfExport.exportCvToPdf($('cvDoc'), filename)` — 794×1123px A4

---

## Parallel paths (not in main 9 stages)

| Path | When | Files |
|------|------|-------|
| **Suggestions filter** | After import, Review Studio | `suggestion-confidence-score.js`, `collectProductSuggestions()` in `index.html` |
| **Review queue gate** | Before display cvData | `review-queue.js`, `applyReviewQueueToCvData()` |
| **Legacy parseCV** | `DEBUG_MODE` / flow lock off | `rich-parser.js`, `parser-enterprise.js` |
| **Universal parse** | Flow lock off | `universal-parse-pipeline.js` |
| **AI reconstruction** | Optional enrichment | `ai-reconstruction-engine.js`, `api/ai-reconstruct.js` |
| **Cover letter** | Export step | `cover-letter-engine.js`, `letter-ai-generation.js` |

---

## UI state map

| `state` field | Set at | Consumed by |
|---------------|--------|-------------|
| `resumeData` | `commitResumeData()` | Editor, ATS profile, `resumeDataToCvData` |
| `cvData` | `commitResumeData()`, `applyImportResult()` | Render, display, TXT export |
| `structuredResume` | Import pipeline | Debug, trace panels |
| `reviewQueue` | Import, review actions | Display gate, suggestions |
| `suggestionArchive` | `collectProductSuggestions()` | Hidden low-confidence lines |
| `template`, `spacing` | User UI | Stage 7 |
| `lastScoreReport` | `renderScorePanel()` | Stage 8 cache |
| `reviewReadiness` | `renderReviewStudioV2()` | Export gate |

---

## Key orchestrators

| Function | File | Stages touched |
|----------|------|----------------|
| `runHirelyImportFromFile(file)` | `hirely-import.js` | 2 → 3 → 4 → 5 → 6 |
| `runProductionExtractionPipeline(raw, opts)` | `production-pipeline.js` | 3 → 4 |
| `buildResumeData(opts)` | `resume-data.js` | 5 |
| `productionToHirelyImportResult(pipe)` | `hirely-import.js` | 4 → 5 → 6 |
| `applyImportResult(result, rawText, opts)` | `index.html` | 5 → 6 → 7 → 8 |
| `commitResumeData(rd)` | `index.html` | 5 → 6 |
| `renderCV(cvData, tpl)` | `index.html` | 7 |
| `renderMetrics()` | `index.html` | 8 |
| `downloadPDF()` | `index.html` | 9 |

---

## Stabilization notes

1. **Single SSOT:** `resumeData` is canonical; `cvData` is a derived view. Never render from raw OCR text in product mode (`FORBIDDEN_TEMPLATE_CV_KEYS`).
2. **Major drop points:** `normalizeResumeData()` inside `buildResumeData()` — `applyConfidenceGate` + `sanitizeResumeForDisplay`. Experiences often need `repairResumeDataFromRaw()`.
3. **Display vs checklist:** CV preview uses review-gated `cvData`; ATS checklist uses sanitized `resumeData` via `resolveChecklistProfile()`.
4. **Round-trip risk:** `applyImportResult` may call `resumeDataFromCvData(state.cvData)` after review gate — can drop structured experiences if mapper is incomplete.
5. **OCR is not a product stage** — it is invoked inside `extractPdfEnterprise` when PDF routing demands it.
6. **Flow lock:** When `isHirelyFlowLocked()` is true, legacy `parseCV` / `universal-parse-pipeline` must not run on successful imports.

---

## Verification commands (stabilization QA)

```bash
node src/tests/qa-suggestion-confidence.mjs    # suggestions filter
node src/tests/qa-ats-score-panel.mjs          # ATS scoring
node src/tests/qa-final-ui-sync-yoaz.mjs       # full UI import (Yoaz PDF)
npm run test:yoaz-pdf-regression               # Node regression
node src/tests/qa-p7-final-lock.mjs            # full product flow
```

---

*Generated for stabilization mode. Last mapped against `HIRELY_FLOW_LOCK_V3`.*
