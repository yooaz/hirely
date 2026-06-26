# PDF EXPORT AUDIT

Generated: 2026-06-06T15:30:56.368Z
Data source: **Yoaz OCR**
Export engine: **Playwright print-to-PDF** (production vector path)
Templates audited: **6** (ats, executive, swiss, creativedirector, productdesigner, agencyportfolio)
A4 preview spec: **794×1123px** (794×1123 CSS px)

## Verdict

# FAIL

**Failure reasons:**
- resumeData → cvData section loss
- cvData content missing or truncated in exported PDF

## Audit scope

Verify exported PDF matches:

1. **A4 preview** — Playwright-rendered export HTML at 794px width
2. **ATS data** — `formatCvAsStructuredText(cvData)` + `analyzeAts(cvData)`
3. **resumeData** — canonical pipeline output via `buildResumeData`
4. **No missing sections** — all cvData items visible in PDF plain text
5. **No hidden content** — no clipped `overflow:hidden` or hidden `.cvSection` nodes
6. **No layout overflow** — content height fits within PDF page capacity

## Global ATS baseline

- ATS score: **n/a** (n/a)
- Identity: Nom à confirmer · —
- Structured text length: 653 chars

## Summary by template

| Template | Pages | A4 | Preview W | Content H | Est. pages | PDF issues | Pass |
|----------|------:|:--:|----------:|----------:|-----------:|-----------:|:----:|
| ATS Elite (`ats`) | 1 | ✓ | 794px | 591px | 1 | 2 | ✗ |
| Executive (`executive`) | 1 | ✓ | 794px | 644px | 1 | 2 | ✗ |
| Swiss Editorial (`swiss`) | 1 | ✓ | 794px | 458px | 1 | 2 | ✗ |
| Creative Director (`creativedirector`) | 1 | ✓ | 794px | 635px | 1 | 2 | ✗ |
| Product Designer (`productdesigner`) | 1 | ✓ | 794px | 663px | 1 | 2 | ✗ |
| Agency Portfolio (`agencyportfolio`) | 1 | ✓ | 794px | 673px | 1 | 2 | ✗ |

## Section matrix (Yoaz → PDF)

| Template | Section | resumeData | cvData | Preview | PDF | ATS | Status |
|----------|---------|----------:|-------:|--------:|----:|----:|--------|
| ats | Experiences | 2 | 2 | 2 | 2 | 2 | ok |
| ats | Education | 4 | 4 | 4 | 4 | 4 | ok |
| ats | Clients | 8 | 8 | 8 | 8 | 8 | ok |
| ats | Skills | 4 | 4 | 4 | 4 | 4 | ok |
| ats | Tools | 2 | 2 | 1 | 1 | 2 | truncated_pdf |
| ats | Languages | 2 | 1 | 1 | 1 | 1 | resume_cv_loss |
| executive | Experiences | 2 | 2 | 2 | 2 | 2 | ok |
| executive | Education | 4 | 4 | 4 | 4 | 4 | ok |
| executive | Clients | 8 | 8 | 8 | 8 | 8 | ok |
| executive | Skills | 4 | 4 | 4 | 4 | 4 | ok |
| executive | Tools | 2 | 2 | 1 | 1 | 2 | truncated_pdf |
| executive | Languages | 2 | 1 | 1 | 1 | 1 | resume_cv_loss |
| swiss | Experiences | 2 | 2 | 2 | 2 | 2 | ok |
| swiss | Education | 4 | 4 | 4 | 4 | 4 | ok |
| swiss | Clients | 8 | 8 | 8 | 8 | 8 | ok |
| swiss | Skills | 4 | 4 | 4 | 4 | 4 | ok |
| swiss | Tools | 2 | 2 | 1 | 1 | 2 | truncated_pdf |
| swiss | Languages | 2 | 1 | 1 | 1 | 1 | resume_cv_loss |
| creativedirector | Experiences | 2 | 2 | 2 | 2 | 2 | ok |
| creativedirector | Education | 4 | 4 | 4 | 4 | 4 | ok |
| creativedirector | Clients | 8 | 8 | 8 | 8 | 8 | ok |
| creativedirector | Skills | 4 | 4 | 4 | 4 | 4 | ok |
| creativedirector | Tools | 2 | 2 | 1 | 1 | 2 | truncated_pdf |
| creativedirector | Languages | 2 | 1 | 1 | 1 | 1 | resume_cv_loss |
| productdesigner | Experiences | 2 | 2 | 2 | 2 | 2 | ok |
| productdesigner | Education | 4 | 4 | 4 | 4 | 4 | ok |
| productdesigner | Clients | 8 | 8 | 8 | 8 | 8 | ok |
| productdesigner | Skills | 4 | 4 | 4 | 4 | 4 | ok |
| productdesigner | Tools | 2 | 2 | 1 | 1 | 2 | truncated_pdf |
| productdesigner | Languages | 2 | 1 | 1 | 1 | 1 | resume_cv_loss |
| agencyportfolio | Experiences | 2 | 2 | 2 | 2 | 2 | ok |
| agencyportfolio | Education | 4 | 4 | 4 | 4 | 4 | ok |
| agencyportfolio | Clients | 8 | 8 | 8 | 8 | 8 | ok |
| agencyportfolio | Skills | 4 | 4 | 4 | 4 | 4 | ok |
| agencyportfolio | Tools | 2 | 2 | 1 | 1 | 2 | truncated_pdf |
| agencyportfolio | Languages | 2 | 1 | 1 | 1 | 1 | resume_cv_loss |

## Missing or truncated in PDF

### ats — Tools
- cvData items: 2
- PDF visible: 1
- Missing tokens:
  - `Adobe`

### executive — Tools
- cvData items: 2
- PDF visible: 1
- Missing tokens:
  - `Adobe`

### swiss — Tools
- cvData items: 2
- PDF visible: 1
- Missing tokens:
  - `Adobe`

### creativedirector — Tools
- cvData items: 2
- PDF visible: 1
- Missing tokens:
  - `Adobe`

### productdesigner — Tools
- cvData items: 2
- PDF visible: 1
- Missing tokens:
  - `Adobe`

### agencyportfolio — Tools
- cvData items: 2
- PDF visible: 1
- Missing tokens:
  - `Adobe`


## A4 preview vs PDF mismatch

_None._

## Layout overflow

_None._

## Hidden / clipped content in export preview

_None._

## resumeData → cvData loss (upstream)

### ats — Languages
- resumeData: 2
- cvData: 1
- Lost: 1

### executive — Languages
- resumeData: 2
- cvData: 1
- Lost: 1

### swiss — Languages
- resumeData: 2
- cvData: 1
- Lost: 1

### creativedirector — Languages
- resumeData: 2
- cvData: 1
- Lost: 1

### productdesigner — Languages
- resumeData: 2
- cvData: 1
- Lost: 1

### agencyportfolio — Languages
- resumeData: 2
- cvData: 1
- Lost: 1


## Per-template detail

### ATS Elite (`ats`)

- PDF: `tests/output/pdf-export-audit/yoaz-ats.pdf` (78930 bytes, 1 page(s), A4=true)
- Layout: 591px content · est. 1 pg · overflow 0px
- ATS export score: n/a (n/a)
- Identity in PDF: yes

- **Experiences:** resume=2 cv=2 preview=2 pdf=2 ats=2 · ok
- **Education:** resume=4 cv=4 preview=4 pdf=4 ats=4 · ok
- **Clients:** resume=8 cv=8 preview=8 pdf=8 ats=8 · ok
- **Skills:** resume=4 cv=4 preview=4 pdf=4 ats=4 · ok
- **Tools:** resume=2 cv=2 preview=1 pdf=1 ats=2 · truncated_pdf
- **Languages:** resume=2 cv=1 preview=1 pdf=1 ats=1 · resume_cv_loss

### Executive (`executive`)

- PDF: `tests/output/pdf-export-audit/yoaz-executive.pdf` (74187 bytes, 1 page(s), A4=true)
- Layout: 644px content · est. 1 pg · overflow 0px
- ATS export score: n/a (n/a)
- Identity in PDF: yes

- **Experiences:** resume=2 cv=2 preview=2 pdf=2 ats=2 · ok
- **Education:** resume=4 cv=4 preview=4 pdf=4 ats=4 · ok
- **Clients:** resume=8 cv=8 preview=8 pdf=8 ats=8 · ok
- **Skills:** resume=4 cv=4 preview=4 pdf=4 ats=4 · ok
- **Tools:** resume=2 cv=2 preview=1 pdf=1 ats=2 · truncated_pdf
- **Languages:** resume=2 cv=1 preview=1 pdf=1 ats=1 · resume_cv_loss

### Swiss Editorial (`swiss`)

- PDF: `tests/output/pdf-export-audit/yoaz-swiss.pdf` (31340 bytes, 1 page(s), A4=true)
- Layout: 458px content · est. 1 pg · overflow 0px
- ATS export score: n/a (n/a)
- Identity in PDF: yes

- **Experiences:** resume=2 cv=2 preview=2 pdf=2 ats=2 · ok
- **Education:** resume=4 cv=4 preview=4 pdf=4 ats=4 · ok
- **Clients:** resume=8 cv=8 preview=8 pdf=8 ats=8 · ok
- **Skills:** resume=4 cv=4 preview=4 pdf=4 ats=4 · ok
- **Tools:** resume=2 cv=2 preview=1 pdf=1 ats=2 · truncated_pdf
- **Languages:** resume=2 cv=1 preview=1 pdf=1 ats=1 · resume_cv_loss

### Creative Director (`creativedirector`)

- PDF: `tests/output/pdf-export-audit/yoaz-creativedirector.pdf` (58489 bytes, 1 page(s), A4=true)
- Layout: 635px content · est. 1 pg · overflow 0px
- ATS export score: n/a (n/a)
- Identity in PDF: yes

- **Experiences:** resume=2 cv=2 preview=2 pdf=2 ats=2 · ok
- **Education:** resume=4 cv=4 preview=4 pdf=4 ats=4 · ok
- **Clients:** resume=8 cv=8 preview=8 pdf=8 ats=8 · ok
- **Skills:** resume=4 cv=4 preview=4 pdf=4 ats=4 · ok
- **Tools:** resume=2 cv=2 preview=1 pdf=1 ats=2 · truncated_pdf
- **Languages:** resume=2 cv=1 preview=1 pdf=1 ats=1 · resume_cv_loss

### Product Designer (`productdesigner`)

- PDF: `tests/output/pdf-export-audit/yoaz-productdesigner.pdf` (60954 bytes, 1 page(s), A4=true)
- Layout: 663px content · est. 1 pg · overflow 0px
- ATS export score: n/a (n/a)
- Identity in PDF: yes

- **Experiences:** resume=2 cv=2 preview=2 pdf=2 ats=2 · ok
- **Education:** resume=4 cv=4 preview=4 pdf=4 ats=4 · ok
- **Clients:** resume=8 cv=8 preview=8 pdf=8 ats=8 · ok
- **Skills:** resume=4 cv=4 preview=4 pdf=4 ats=4 · ok
- **Tools:** resume=2 cv=2 preview=1 pdf=1 ats=2 · truncated_pdf
- **Languages:** resume=2 cv=1 preview=1 pdf=1 ats=1 · resume_cv_loss

### Agency Portfolio (`agencyportfolio`)

- PDF: `tests/output/pdf-export-audit/yoaz-agencyportfolio.pdf` (61013 bytes, 1 page(s), A4=true)
- Layout: 673px content · est. 1 pg · overflow 0px
- ATS export score: n/a (n/a)
- Identity in PDF: yes

- **Experiences:** resume=2 cv=2 preview=2 pdf=2 ats=2 · ok
- **Education:** resume=4 cv=4 preview=4 pdf=4 ats=4 · ok
- **Clients:** resume=8 cv=8 preview=8 pdf=8 ats=8 · ok
- **Skills:** resume=4 cv=4 preview=4 pdf=4 ats=4 · ok
- **Tools:** resume=2 cv=2 preview=1 pdf=1 ats=2 · truncated_pdf
- **Languages:** resume=2 cv=1 preview=1 pdf=1 ats=1 · resume_cv_loss

## Pipeline notes

- **Export path:** `hirely-pdf-export.js` (browser html2pdf) and Playwright `page.pdf()` share A4 constants from `pdf-export-config.js`.
- **Preview parity:** Audit uses full-width 794px export HTML (not UI zoom 0.82) — matches `applyExportMode` / `cv--pdf-export`.
- **PDF text extraction:** `pdfjs-dist` `getTextContent` per page; token overlap ≥45% counts as visible.
- **Known upstream gaps (Yoaz):** Tools `Adobe` filtered by `fieldRenderable`; Languages corrupt line dropped resumeData→cvData — both propagate to preview and PDF.
- **Artifacts:** `tests/output/pdf-export-audit/yoaz-*.pdf`
