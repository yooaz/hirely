# ROOT_CAUSE_REPORT

**Audit date:** 2026-06-15  
**Scope:** End-to-end import pipeline (file → Review → Templates → Export)  
**Mode audited:** V1 (`HIRELY_V1_IMPORT` / `simpleModeActive()` — OCR disabled, native text only)  
**Action taken:** Trace only — no code changes

---

## One root cause

**The workflow breaks at Extraction** because V1 routes all file imports through native-text-only extraction (`simpleExtractTextFromFile`) and never runs OCR. For scanned or image-only PDFs, `extractNativePdfLines` returns zero characters, `canContinueWithRawText(raw)` is false, and the pipeline terminates with `IMPORT_NEEDS_PASTE` before Cleaning, Parsing, or CV generation run.

| Field | Value |
|-------|--------|
| **First failing step** | Extraction |
| **File** | `src/core/import/simple-import-mode.js` |
| **Function** | `simpleCanonicalImportFromFile` |
| **Exact condition** | `!canContinueWithRawText(raw)` where `raw = String(extracted.rawText \|\| '').trim()` and `canContinueWithRawText` requires `raw.length > 100` (`SIMPLE_IMPORT_MIN_CHARS`) |
| **Upstream cause** | `simpleExtractTextFromFile` PDF branch calls `extractNativePdfLines(pdf)` only; `ocrAttempted: false` is hard-coded; `buildPdfExtractionDebug` sets `pasteReason: 'PDF_IMAGE_OCR_DISABLED'` when `pdfJsTotalLength === 0` |

UI re-enforces the same gate (does not reach Parsing):

| Field | Value |
|-------|--------|
| **File** | `index.html` |
| **Function** | `handleFileImport` → inner `pipeline()` |
| **Exact condition** | `simpleModeActive() && !canContinueWithRawText(rawText)` (after `canonicalImportFromFile` returns) |

**Evidence (browser, 2026-06-15):** Scanned PDF `cv2022 yohann azancot copie.pdf` → paste panel in ~149–320ms; `IMPORT_DECISION` logs `rawTextLength: 0`, `pdfJsTotalLength: 0`, `reasonForPasteMode: PDF_IMAGE_ONLY`. V1 release test marks this **PASS** (paste fallback is the designed terminal state, not auto-import).

---

## Pipeline map (code path)

```
User selects file (#fileInput / drop)
  → handleFileImport()                    [index.html]
  → detectDocumentType(file)
  → core.canonicalImportFromFile(file)
       → isSimpleImportMode() ? simpleCanonicalImportFromFile : full OCR path
  → [V1] simpleExtractTextFromFile(file)  [simple-import-mode.js]
       pdf  → pdf.js getDocument → extractNativePdfLines (no OCR)
       docx → extractDocxWithRecovery
       txt  → file.text()
       image → empty text + V1_IMAGE_UNSUPPORTED
  → [V1] if raw > 100: normalize + optional runHirelyImportFromText in core
       if raw ≤ 100: return IMPORT_NEEDS_PASTE (STOPS HERE for scans)
  → handleFileImport pipeline():
       if simple + raw > 100 → simpleImportDone → ensureRawTextCvPreview
       if simple + raw ≤ 100 → showImportPasteFallback (STOPS HERE in UI)
       else → applyImportResult → finishCvImportDisplay → ensureImportReviewVisible
  → setDocStep('edit')  [Review]
  → setDocStep('style') [Templates] when user navigates
  → export PDF          [isExportReady + download handler]
```

---

## Step-by-step status

### A. Reference success — V1 text PDF (`pdf-selectable-yoaz.pdf`)

Verified: `npm run v1-release-test` **PASS** (2026-06-15, 1871 CV chars, Review + Style/Export unlocked).

| Step | Status | Handler | Notes |
|------|--------|---------|-------|
| 1. File selected | **PASS** | `handleFileImport` (`index.html` ~7831) | `FILE_SELECTED`, `beginImportRun`, `detectDocumentType` → `pdf` |
| 2. Extraction | **PASS** | `simpleExtractTextFromFile` → PDF branch (`simple-import-mode.js` ~251–317) | `extractNativePdfLines` returns text; `extractionMethod: 'native_pdf'` |
| 3. Cleaning | **PASS** | `normalizePipelineTexts` / `cleanRawText` (`simple-import-mode.js` ~368–369) | Whitespace normalization on extracted text |
| 4. Parsing | **SKIPPED** (UI) / **PASS** (core, discarded) | Core: `runHirelyImportFromText` inside `simpleCanonicalImportFromFile` (~376–393). UI: `simpleImportDone` (~7985–7987) bypasses `applyImportResult` | UI uses raw-text fallback, not structured parser output |
| 5. CV generation | **PASS** | `ensureRawTextCvPreview` (`index.html` ~2683–2736) | `fallbackRawTextCvData` + `renderFallbackCv`; `cv--raw-fallback` |
| 6. Review | **PASS** | `ensureRawTextCvPreview` sets `setDocStep('edit')`, unlocks progress nav | `REVIEW_SCREEN_VISIBLE` / `PREVIEW_READY` |
| 7. Templates | **PASS** | `isTemplateReady()` (`index.html` ~3050) | `v1FlowUnlocked()` / `simplePreviewHasText()` → true |
| 8. Export | **PASS** | `isExportReady()` (`index.html` ~3057) | Style/Export buttons not disabled in V1 test |

### B. Failure — V1 scanned / image-only PDF (`cv2022 yohann azancot copie.pdf`)

Verified: V1 release test **PASS** for paste fallback; full auto pipeline **FAIL** at step 2.

| Step | Status | Handler | Notes |
|------|--------|---------|-------|
| 1. File selected | **PASS** | `handleFileImport` | File accepted, import run started |
| 2. Extraction | **FAIL** | `simpleExtractTextFromFile` PDF branch + `simpleCanonicalImportFromFile` (~347–365) | `pdfJsTotalLength: 0`, `rawText: ''`, `pasteReason: 'PDF_IMAGE_OCR_DISABLED'` |
| 3. Cleaning | **SKIPPED** | `normalizePipelineTexts` | Never reached — no text to clean |
| 4. Parsing | **SKIPPED** | `runHirelyImportFromText` / `applyImportResult` | Blocked by empty raw text |
| 5. CV generation | **SKIPPED** | `ensureRawTextCvPreview` / `renderCV` | No preview until user pastes |
| 6. Review | **SKIPPED** | `ensureImportReviewVisible` | Paste panel shown instead (`showImportPasteFallback`) |
| 7. Templates | **SKIPPED** | `isTemplateReady` | Locked until paste flow completes |
| 8. Export | **SKIPPED** | `isExportReady` | Locked until paste flow completes |

**Recovery path (manual paste):** `applyPasteFirstFlow` → `ensureRawTextCvPreview` → steps 5–8 **PASS** (~42ms–1.7s in tests).

---

## Exact failure chain (scanned PDF)

1. `canonicalImportFromFile` delegates to V1:

```248:250:src/core/import/canonical-import.js
export async function canonicalImportFromFile(file, opts = {}) {
  if (isSimpleImportMode()) {
    return simpleCanonicalImportFromFile(file, opts);
```

2. Native-only PDF extraction (no OCR call):

```290:301:src/core/import/simple-import-mode.js
    const native = await extractNativePdfLines(pdf);
    const lines = native.pages.flatMap((p) => p.lines || []);
    const text = lines
      .map((l) => String(l.cleanedText || l.text || '').trim())
      .filter(Boolean)
      .join('\n')
      .trim();
    const extractionDebug = await buildPdfExtractionDebug(file, {
      rawText: text,
      ocrAttempted: false,
      ocrResultLength: 0,
```

3. Text gate fails → terminal paste state (first hard stop):

```347:365:src/core/import/simple-import-mode.js
  if (!canContinueWithRawText(raw)) {
    return {
      file: { name: file.name, type: file.type || '', size: file.size || 0 },
      rawText: raw,
      cleanedText: clean,
      importState: IMPORT_STATE.IMPORT_NEEDS_PASTE,
      importStatus: 'PASTE_FALLBACK_REQUIRED',
      ...
      pasteReason: extractionDebug.pasteReason,
```

4. `canContinueWithRawText` definition:

```44:46:src/core/import/simple-import-mode.js
export function canContinueWithRawText(rawText) {
  return String(rawText || '').trim().length > SIMPLE_IMPORT_MIN_CHARS;
}
```

5. OCR disabled by design in V1 (`probeOcrAvailability`):

```27:31:src/core/extraction/pdf-extraction-debug.js
  let ocrDisabledReason = null;
  if (simpleImportMode) ocrDisabledReason = 'SIMPLE_IMPORT_MODE';
  ...
  const ocrAvailable = !simpleImportMode && tesseractLazy;
```

6. Paste reason when PDF has no text layer:

```70:73:src/core/extraction/pdf-extraction-debug.js
export function resolveImportNeedsPasteReason(pdfJsTotal, rawLen, ocr) {
  if (pdfJsTotal === 0 && !ocr.ocrAttempted) {
    if (!ocr.ocrAvailable || ocr.simpleImportMode) return 'PDF_IMAGE_OCR_DISABLED';
```

7. UI short-circuit (Parsing never invoked):

```7985:7996:index.html
   if(simpleModeActive()&&canContinueWithRawText(rawText)){
    simpleImportDone(rawText);
    return endImport(IMPORT_STATE.IMPORT_READY,{simple:true});
   }
   if(simpleModeActive()&&!canContinueWithRawText(rawText)){
    ...
    return endImport(terminal,{...,reason:extractionDebug?.pasteReason||...});
```

---

## Gate report context (not additional root causes)

| Report | Status | Relation to this audit |
|--------|--------|------------------------|
| `V1_RELEASE_TEST_REPORT.md` | PASS | Text PDF, DOCX, TXT, paste, scanned→paste all behave as V1 spec |
| `IMPORT_REALITY_CHECK_REPORT.md` | PASS | Full OCR path (non-V1 harness) — separate from V1 native-only path |
| `LOCAL_OCR_CSP_FIX_REPORT.md` | PASS | OCR assets exist but are **not invoked** in V1 |
| `REAL_WORLD_IMPORT_TRUTH_REPORT.md` | FAIL | Headless corpus harness (2026-06-15) reports `selected: 0` for all files — environment/harness mismatch with browser V1 path, not a second product root cause |

---

## Conclusion

There is **one** first break point for the automatic file-import workflow in current V1: **Extraction** in `simpleCanonicalImportFromFile` when native PDF text length is ≤ 100 characters because OCR is intentionally disabled. Every downstream step is correctly skipped; paste recovery is the only path to Review, Templates, and Export for scanned PDFs.

To restore automatic import for scanned PDFs (out of scope for this audit), OCR would need to run inside the Extraction step before the `canContinueWithRawText` gate — that is a product decision, not a Parsing or Review bug.

---

## Verify

```bash
# V1 browser paths (success + scanned paste)
npm run v1-release-test

# Console trace on scanned PDF (browser devtools)
# Upload scanned PDF → IMPORT_DECISION group → reasonForPasteMode: PDF_IMAGE_ONLY
```
