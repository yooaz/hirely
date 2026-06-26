# Hirely Universal Import — Format Matrix

**Version:** `IMPORT_MATRIX_V1`  
**Status:** Spec + live inventory (extends `UNIVERSAL_IMPORT_PIPELINE_V1`, `LINKEDIN_IMPORT_V1`)  
**Goal:** One import surface for **every CV source** — honest outcomes per format, no fake success.

---

## 1. Scope

**Universal Import** accepts a file (or LinkedIn bundle), extracts text, gates on quality, parses to `resumeData`, and surfaces recovery when extraction is thin.

### 1.1 Supported sources (V1 matrix)

| # | Source | Input | Status |
|---|--------|-------|--------|
| 1 | **PDF** (selectable text) | `.pdf` | Production |
| 2 | **DOCX** | `.docx` | Production |
| 3 | **LinkedIn Export** | `.json`, `.csv`, `.zip` + optional PDF | Production |
| 4 | **Behance PDF** | Portfolio PDF from Behance export | Partial — routed as creative PDF |
| 5 | **Portfolio PDF** | Design portfolio / case-study PDF | Partial — routed as creative PDF |
| 6 | **Scanned Resume** | Scan-only PDF | Production (OCR path) |
| 7 | **Image Resume** | `.png`, `.jpg`, `.webp`, … | Production (OCR path) |
| 8 | **Multi-page Resume** | 2+ page PDF (native, mixed, or OCR) | Production |

**Also accepted:** `.txt`, `.doc`, `.rtf` — same pipeline, lower priority in marketing matrix.

### 1.2 Universal rules (locked)

| Rule | Value | Module |
|------|-------|--------|
| Min chars to parse | **300** | `REAL_CV_IMPORT_MIN_CHARS` |
| Below threshold | `IMPORT_NEEDS_PASTE` | `universal-import-pipeline.js` |
| Never fake success | No `resumeData` on thin extract | `canonical-import.js` |
| Never silent fail | `UNIVERSAL_IMPORT_PIPELINE` log | `extract-file.js` |
| Never IMPORT_STUCK | Race timeout → terminal state | `pdf-extraction-timeout.js` |

---

## 2. Pipeline overview

```
User drops file(s)
        │
        ▼
detectInputFileType()              ◄── file-type-detect.js
        │
        ├─ PDF ──► classifyPdfForExtraction() + routePdfExtraction()
        ├─ DOCX ─► mammoth + docx-structure-recovery
        ├─ Image ► Tesseract OCR (single canvas)
        ├─ TXT ──► plain read
        └─ LinkedIn bundle ─► linkedin-import-engine (multi-source merge)
        │
        ▼
extractDocument() / enterprise-engine
        │
        ▼
collectUniversalImportMetrics()    ◄── native/ocr/selected lengths, pages, scanned
        │
        ▼
selectedTextLength >= 300 ?
        │
   yes ├─► canonical import → parse → resumeData
   no  └─► IMPORT_NEEDS_PASTE + paste fallback UX
        │
        ▼
creative / linkedin / portfolio detectors (post-parse)
```

---

## 3. Import matrix (master table)

| Source | Detection | Extraction route | Parser mode | Min chars | Typical outcome | Fallback |
|--------|-----------|------------------|-------------|-----------|-----------------|----------|
| **PDF (text)** | `pdf_text`, selectable layer ≥80 chars | Native pdf.js | Corporate default | 300 | `IMPORT_READY` | Paste |
| **DOCX** | `.docx` / word MIME | Mammoth raw text | Corporate default | 300 | `IMPORT_READY` | Paste |
| **LinkedIn Export** | `.json`/`.csv` + Profile keys | `linkedin-export-parser` | LinkedIn merge | 300* | `IMPORT_READY` | Add resume PDF |
| **LinkedIn PDF** | LinkedIn markers in text | Native PDF | LinkedIn merge | 300 | `IMPORT_READY` | Paste |
| **Behance PDF** | `behance.net` in text; sparse jobs | Native or OCR | **Creative** + portfolio | 300 | `IMPORT_READY`† | Paste; manual links |
| **Portfolio PDF** | Multi-column; project-led; few dates | Native / hybrid | **Creative** + projects | 300 | `IMPORT_READY`† | Paste |
| **Scanned Resume** | `pdf_scanned`, no text layer | Full-document OCR | OCR cleanup | 300 | `IMPORT_READY` or paste | Paste / rescan |
| **Image Resume** | `image/*` MIME | Image → OCR | OCR cleanup | 300 | `IMPORT_READY` or paste | Paste |
| **Multi-page Resume** | `pageCount > 1` | Per-page native + OCR on weak pages | Full pipeline | 300 | `IMPORT_READY` | Partial paste |

\* JSON export may yield structured fields before char count — merge still gated on combined text.  
† Creative PDFs may score lower on corporate ATS but activate Portfolio Mode.

---

## 4. Format specifications

### 4.1 PDF (selectable text)

| Attribute | Spec |
|-----------|------|
| Extensions | `.pdf` |
| Detection | `classifyPdfForExtraction()` → `pdf_text` |
| Router | `routePdfExtraction()` → `native_pdf` |
| Engine | `extractPdfEnterprise()` → pdf.js text layer |
| OCR | **Off** when selectable text present |
| Quality | `assessPdfTextLayer()` — min 80 chars, 25 words |
| Pages | All pages concatenated with native extract |
| UI copy | “Reading your CV…” (no “OCR” jargon) |

**QA fixture:** `yoaz-selectable.pdf` — 1769 chars, `IMPORT_READY`

---

### 4.2 DOCX

| Attribute | Spec |
|-----------|------|
| Extensions | `.docx` (`.doc` limited) |
| Detection | `kind: docx` |
| Engine | `extractDocxWithRecovery()` + mammoth |
| OCR | Never |
| Structure | `auditDocxStructureRecovery()` — headings preserved |
| Failure | < 20 chars → throw, paste UX |

**QA fixture:** `yoaz.docx` — 2490 chars, `IMPORT_READY`

---

### 4.3 LinkedIn Export

| Attribute | Spec |
|-----------|------|
| Inputs | LinkedIn data export `.json`/`.csv`; optional `.zip` |
| Companion | LinkedIn profile PDF and/or resume PDF/DOCX (multi-drop) |
| Detection | `detectLinkedInSource()` → `linkedin_export` |
| Parser | `parseLinkedInExportText()` / `resumeDataFromLinkedInExport()` |
| Merge | `linkedin-import-engine.js` — score sources, pick best fields, dedupe experience |
| Weights | Export wins skills; resume PDF wins bullets; export wins identity URL |

**Multi-file drop** (`index.html` `#linkedinImportBlock`):

```
LinkedIn PDF + Profile.json + resume.pdf → merged resumeData
```

| Field | Typical winner |
|-------|----------------|
| name, title, linkedin | LinkedIn export |
| experience bullets | Resume PDF |
| skills | LinkedIn export |

**Commands:** `npm run qa:linkedin-import`

---

### 4.4 Behance PDF

Behance “Save to PDF” / portfolio exports are **not a separate MIME type** — classified as PDF with **creative portfolio signals**.

| Attribute | Spec |
|-----------|------|
| Detection heuristics | `behance.net` in extracted text; `PORTFOLIO_HOST_RE`; few dated job rows; high project/visual density |
| File type label | `pdf_text` or `pdf_scanned` (if export is image-heavy) |
| Extraction | Same as PDF — prefer native text if layer exists |
| Post-parse | `PORTFOLIO_MODE` / `CREATIVE_CV_MODE` activation |
| Portfolio links | `PORTFOLIO_EXTRACTION_ENGINE` harvests Behance URL |
| Experience rule | Client names → `clients[]`, not fake jobs (`creative-client-project-recovery`) |
| Template bias | `creative-director`, `behance-showcase`, `art-director-portfolio` |

**Expected structure after import:**

```
identity.creativeLinks.behance
clients[] — brand names from portfolio
projects[] — case studies
experiences[] — only if role + date + company present
```

**Risk:** Behance PDFs with **image-only** pages → OCR path; may fall below 300 chars → paste.

**Phase 2:** `detectPortfolioPdfKind()` — filename + layout classifier tag `behance_pdf`.

---

### 4.5 Portfolio PDF

Design portfolio PDFs (personal site export, InDesign, Figma PDF) — **visual-first, job-second**.

| Attribute | Spec |
|-----------|------|
| Detection | `layout-detection` multi-column; `CREATIVE_SECTION` headers; `PROJECTS_ENGINE` density; low experience date coverage |
| Subtypes | Case-study PDF · Agency portfolio · Architecture portfolio |
| Extraction | Native if text layer; `pdf_mixed` if cover scan + inner text |
| Parser | `creative-parsing-mode.js` — clients/projects first-class |
| Links | Website, Behance, Dribbble, Instagram from contact block |
| OCR | Per-page on scanned spreads only (`pdf_mixed`) |

**Matrix row differences vs corporate PDF:**

| Signal | Corporate PDF | Portfolio PDF |
|--------|---------------|---------------|
| Section order | Experience first | Clients → Projects → Experience |
| Dates | Per role | Often missing — projects use year |
| Skills | List section | Tools + embedded in projects |
| ATS path | ATS Clean default | Creative templates default |

---

### 4.6 Scanned Resume

PDF or image where **no usable text layer** exists.

| Attribute | Spec |
|-----------|------|
| Detection | `pdf_scanned`, `inferIsScanned()`, `route: ocr` |
| Engine | `ocrPdfPages()` or `extractImageEnterprise()` |
| Preprocess | `ocr-preprocess.js` — rotation, best-pass, fusion (flags) |
| Quality gate | `evaluateOcrParserGate()` — `OCR_QUALITY_FAIL_MSG` |
| Timeout | `PDF_EXTRACTION_MAX_MS` → partial cache or paste |
| User message | Plain language — “We couldn't read this file automatically” |

**Outcomes:**

| OCR chars | State |
|-----------|-------|
| ≥ 300 | `IMPORT_READY` + `extractionMethod: ocr` |
| < 300 | `IMPORT_NEEDS_PASTE` |
| Timeout | `ocr_timeout` + paste |

**QA:** `blank-scan.pdf`, `cv-scan.png` → `IMPORT_NEEDS_PASTE` (honest)

---

### 4.7 Image Resume

Phone photo or scan saved as image.

| Attribute | Spec |
|-----------|------|
| Extensions | `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`, `.tiff` |
| Detection | `kind: image` → `fileType: image`, `isScanned: true` |
| Engine | `extractImageEnterprise()` → single-page OCR |
| Tesseract | `ensureTesseract()` in browser |
| Rotation | `ocr-rotation-select.js` |
| Multi-page images | **Not supported** — one image = one OCR pass; user should use PDF for multi-page |

---

### 4.8 Multi-page Resume

Not a separate file type — **routing overlay** on PDF (and OCR PDF).

| Attribute | Spec |
|-----------|------|
| Detection | `pageCount > 1` in `collectUniversalImportMetrics()` |
| Native all pages | `pdf_text` — concatenate native text per page |
| Mixed | `pdf_mixed` — native on text pages, OCR on scan pages (`ocrMode: per_page`) |
| Full scan | `ocrPdfPages()` — `concatPageOcrTexts()` with `\n\n` separator |
| Reading order | `reading-order.js` / `layout-detector` for column CVs |
| CV export | Multi-page **preview** via `.cvA4Stack`; PDF export clones each sheet |

**Page strategies:**

| PDF kind | Strategy |
|----------|----------|
| `native_pdf` | All pages native |
| `pdf_mixed` | Hybrid per `pdf-router.js` |
| `pdf_scanned` | OCR all pages sequentially |

**Risk:** Page 2+ only contains references → may dilute char quality; parser uses full concatenated blob.

---

## 5. Decision tree

```
                    ┌─────────────┐
                    │  File drop  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           .pdf         .docx      image/txt
              │            │            │
              ▼            │            │
        Text layer?        │            │
         ┌────┴────┐       │            │
        yes       no        │            │
         │         │        │            │
    native pdf   OCR/full   mammoth    OCR/txt
         │         │        │            │
         └────┬────┘        └─────┬──────┘
              ▼                   ▼
      selectedTextLength
              │
         ┌────┴────┐
       ≥300      <300
         │         │
   IMPORT_READY  NEEDS_PASTE
         │
         ▼
   LinkedIn merge? (if bundle)
         │
         ▼
   Creative/Portfolio detect
         │
         ▼
   canonical-import → resumeData
```

---

## 6. Outcome states

| State | Meaning | User UX |
|-------|---------|---------|
| `IMPORT_READY` | ≥300 chars, parse succeeded | Workspace reveal |
| `IMPORT_NEEDS_PASTE` | Thin / empty / protected / OCR fail | Paste fallback panel |
| `IMPORT_READING` | In flight | Progress rail (Import Flow V2) |
| `ocr_timeout` | PDF OCR exceeded budget | Cached partial or paste |
| `ocr_quality` | OCR garbled | Paste + rescan tip |
| Protected PDF | Encrypted | Paste — cannot extract |

**Log shape** (`buildUniversalImportLog`):

```json
{
  "version": "UNIVERSAL_IMPORT_PIPELINE_V1",
  "fileName": "cv.pdf",
  "nativeTextLength": 1769,
  "ocrTextLength": 0,
  "selectedTextLength": 1769,
  "fileType": "pdf_text",
  "pageCount": 2,
  "isScanned": false,
  "isProtected": false,
  "status": "IMPORT_READY",
  "shouldParse": true
}
```

---

## 7. Post-import classification

After text extraction, **secondary classifiers** steer parser and UI:

| Classifier | Triggers | Effect |
|------------|----------|--------|
| `detectLinkedInSource` | LinkedIn markers | Merge weights |
| `detectCreativeParsingMode` | Creative role, layout | Creative sections |
| `runPortfolioExtraction` | Links, clients, projects | Portfolio-first |
| `detectDesignerCvMode` | Designer title | Section weights |
| `inferIsScanned` | OCR method | Confidence baseline ↓ |

---

## 8. UI surfacing

| Element | Behavior |
|---------|----------|
| Drop zone | `PDF · DOCX · TXT · images` + LinkedIn multi-file |
| Import Flow V2 | 5 micro beats — no format jargon |
| Paste fallback | After 8s or `IMPORT_NEEDS_PASTE` |
| `importAnalysisStages` | Reading → Extracting → Sections → Recruiter → Building |
| Recovery panel | Scanned / thin / protected reasons |
| Format badge (new) | “Imported from: Scanned PDF” / “LinkedIn merge” |

**i18n examples:**

| Key | EN |
|-----|-----|
| `importFormatPdf` | PDF resume |
| `importFormatDocx` | Word document |
| `importFormatLinkedIn` | LinkedIn export |
| `importFormatPortfolio` | Portfolio PDF |
| `importFormatScanned` | Scanned document |
| `importFormatImage` | Photo of resume |
| `importFormatMultiPage` | {n}-page document |

---

## 9. Architecture map

| Module | Path | Role |
|--------|------|------|
| File router | `extract-file.js` | Entry + timeout + universal log |
| Document router | `document-extract.js` | PDF/DOCX/image/txt |
| Type detect | `file-type-detect.js` | Extension + PDF classify |
| PDF router | `pdf-router.js` | native / hybrid / OCR |
| PDF pages | `pdf-ocr-pages.js` | Multi-page OCR |
| DOCX | `docx-extract.js` | Mammoth + recovery |
| Enterprise | `enterprise-engine.js` | PDF/image enterprise extract |
| Universal pipeline | `universal-import-pipeline.js` | Metrics + decision |
| Canonical import | `canonical-import.js` | 300-char gate |
| LinkedIn | `linkedin-import-engine.js` | Multi-source merge |
| Hirely import | `hirely-import.js` | Production orchestrator |
| Real CV root | `real-cv-import-root.js` | `selectedImportTextLength` |

---

## 10. QA matrix

| Test | Command / fixture | Expected |
|------|-------------------|----------|
| PDF text | `qa:universal-import-pipeline` / yoaz-selectable.pdf | READY, pdf_text |
| DOCX | yoaz.docx | READY |
| TXT | yoaz.txt | READY |
| Scanned PDF | blank-scan.pdf | NEEDS_PASTE |
| Protected PDF | protected-scan.pdf | NEEDS_PASTE, isProtected |
| PNG scan | cv-scan.png | NEEDS_PASTE, isScanned |
| JPG scan | cv-scan.jpg | NEEDS_PASTE |
| LinkedIn merge | `qa:linkedin-import` | Merged fields, dedupe |
| Full PDF import | `qa:full-import-pdf` | End-to-end |
| Scanned master | `qa:scanned-pdf-master` | OCR corpus |
| Real-world truth | `qa:real-world-import-truth` | No fake READY |
| Import reality | `qa:import-reality-check` | Honest outcomes |

```bash
npm run qa:universal-import-pipeline
npm run qa:linkedin-import
npm run qa:full-import-pdf
npm run qa:scanned-pdf-master
# Future
npm run qa:import-matrix
npm run import-matrix-report
```

---

## 11. Gaps & roadmap

| Gap | Priority | Spec |
|-----|----------|------|
| Explicit `behance_pdf` / `portfolio_pdf` fileType tag | P1 | `detectPortfolioPdfKind()` in `file-type-detect.js` |
| Multi-image upload (2+ photos) | P2 | Stitch OCR pages |
| Google Docs export | P3 | `.docx` download route |
| Apple Pages | P3 | User export to PDF/DOCX |
| Password-protected PDF unlock | — | Out of scope — paste only |
| HEIC iPhone photos | P2 | Convert or reject with message |

---

## 12. Acceptance criteria

| # | Criterion |
|---|-----------|
| 1 | PDF text, DOCX, TXT reach `IMPORT_READY` on corpus fixtures |
| 2 | Scanned/protected/image unreadable → `IMPORT_NEEDS_PASTE` — never fake READY |
| 3 | No `IMPORT_STUCK` in QA matrix |
| 4 | LinkedIn JSON + resume PDF merge picks field winners |
| 5 | Multi-page PDF sets `pageCount > 1` and concatenates text |
| 6 | Portfolio PDF activates creative/portfolio mode when signals fire |
| 7 | Behance URL recovered from Behance PDF imports |
| 8 | `selectedTextLength` uses max(native, ocr) honestly |
| 9 | Universal log emitted per import |
| 10 | `npm run qa:universal-import-pipeline` passes |

---

## 13. Before / after (user mental model)

### Before

“Hirely imports PDFs.”

### After (Universal Import)

| I have… | Hirely… |
|---------|---------|
| Word CV | Reads DOCX directly |
| LinkedIn PDF + export | Merges best of both |
| Behance portfolio PDF | Structures clients + projects |
| Paper scan | OCR → review → paste if weak |
| Phone photo | Image OCR |
| 3-page PDF | Page-by-page extract + full story |

One drop zone. Honest result. Correct path per format.

---

## 14. Summary

| Source | Route | Parser | Fallback |
|--------|-------|--------|----------|
| PDF | Native / hybrid / OCR | Corporate or creative | Paste |
| DOCX | Mammoth | Corporate | Paste |
| LinkedIn Export | JSON + merge | LinkedIn engine | Add files |
| Behance PDF | PDF + creative detect | Portfolio mode | Paste |
| Portfolio PDF | PDF + layout detect | Portfolio mode | Paste |
| Scanned Resume | OCR | OCR cleanup | Paste |
| Image Resume | OCR | OCR cleanup | Paste |
| Multi-page Resume | Per-page strategy | Full pipeline | Partial paste |

---

*Matrix `IMPORT_MATRIX_V1` — canonical reference for `UNIVERSAL_IMPORT_PIPELINE_V1` and `LINKEDIN_IMPORT_V1`.*
