# HIRELY P7 — 20 CV Stress Test

**Engine:** HIRELY_P7_STRESS_V1
**Generated:** 2026-06-08 17:55:15 UTC
**Fixtures:** 20 CV types

## Success summary

| Metric | Rate | Pass |
|--------|------|------|
| Import success | 100% | 20/20 |
| Parser success | 100% | 20/20 |
| Review success | 100% | 20/20 |
| Ats success | 100% | 20/20 |
| Pdf success | 100% | 20/20 |
| **Full pipeline** | **100%** | **20/20** |
| Failure rate | 0% | 0/20 |

## Per-CV results

| CV | Archetype | Import | Parser | Review | ATS | PDF | Status |
|----|-----------|--------|--------|--------|-----|-----|--------|
| Designer CV (creative) | designer | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Designer CV (Yoaz) | designer | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Designer CV (image layout) | designer | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Designer CV (plain TXT) | designer | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Developer CV | developer | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Developer CV (OCR sim) | developer | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Marketing CV | marketing | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Marketing CV (OCR sim) | marketing | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Sales CV | sales | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Student CV | student | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Executive CV | executive | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Academic CV | academic | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Recruiter CV | recruiter | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Consultant CV | consultant | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Two-column layout CV | layout | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Native PDF text CV | product | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Scanned PDF (OCR) | product | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| DOCX export CV | product | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Sales CV (OCR sim) | sales | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Executive CV (OCR sim) | executive | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |

## ATS quality gaps (engine OK, score < 55)

- Designer CV (creative): score 42
- Designer CV (Yoaz): score 42
- Designer CV (image layout): score 34
- Designer CV (plain TXT): score 32
- Developer CV: score 13
- Developer CV (OCR sim): score 13
- Marketing CV: score 54
- Marketing CV (OCR sim): score 54
- Sales CV: score 44
- Student CV: score 35
- Executive CV: score 39
- Academic CV: score 54
- Consultant CV: score 37
- Two-column layout CV: score 29
- Native PDF text CV: score 36
- DOCX export CV: score 36
- Sales CV (OCR sim): score 44
- Executive CV (OCR sim): score 39

## Remaining blockers

_No blockers — all 20 CVs passed the full pipeline._

## Priority order

Remediation order (highest impact first):

1. _None — ship ready._

## Detail

### Designer CV (creative) (`creative-cv`)

- Source: `creative-cv/fixture.txt`
- Template: `creative`
- Parser recall: 100% · ATS score: 42 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Designer CV (Yoaz) (`yoaz-cv`)

- Source: `yoaz-cv/fixture.txt`
- Template: `creative`
- Parser recall: 90% · ATS score: 42 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Designer CV (image layout) (`image-cv`)

- Source: `image-cv/fixture.txt`
- Template: `creative`
- Parser recall: 100% · ATS score: 34 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Designer CV (plain TXT) (`mvp-sample`)

- Source: `mvp-sample.txt`
- Template: `creative`
- Parser recall: 92% · ATS score: 32 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Developer CV (`developer-cv`)

- Source: `developer-cv/fixture.txt`
- Template: `ats`
- Parser recall: 100% · ATS score: 13 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Developer CV (OCR sim) (`developer-cv-ocr`)

- Source: `developer-cv/fixture.txt`
- Template: `ats`
- Parser recall: 100% · ATS score: 13 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Marketing CV (`marketing-cv`)

- Source: `marketing-cv/fixture.txt`
- Template: `ats`
- Parser recall: 98% · ATS score: 54 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Marketing CV (OCR sim) (`marketing-cv-ocr`)

- Source: `marketing-cv/fixture.txt`
- Template: `ats`
- Parser recall: 98% · ATS score: 54 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Sales CV (`sales-cv`)

- Source: `sales-cv/fixture.txt`
- Template: `ats`
- Parser recall: 100% · ATS score: 44 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Student CV (`student-cv`)

- Source: `student-cv/fixture.txt`
- Template: `ats`
- Parser recall: 88% · ATS score: 35 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Executive CV (`executive-cv`)

- Source: `executive-cv/fixture.txt`
- Template: `executive-minimal`
- Parser recall: 94% · ATS score: 39 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Academic CV (`academic-cv`)

- Source: `academic-cv/fixture.txt`
- Template: `executive-minimal`
- Parser recall: 100% · ATS score: 54 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Recruiter CV (`recruiter-cv`)

- Source: `recruiter-cv/fixture.txt`
- Template: `ats`
- Parser recall: 100% · ATS score: 55 · Review: 100%

### Consultant CV (`consultant-cv`)

- Source: `consultant-cv/fixture.txt`
- Template: `executive-minimal`
- Parser recall: 94% · ATS score: 37 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Two-column layout CV (`two-column-cv`)

- Source: `two-column-cv/fixture.txt`
- Template: `ats`
- Parser recall: 75% · ATS score: 29 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Native PDF text CV (`text-pdf`)

- Source: `text-pdf/fixture.txt`
- Template: `ats`
- Parser recall: 83% · ATS score: 36 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Scanned PDF (OCR) (`scanned-pdf`)

- Source: `scanned-pdf/fixture.txt`
- Template: `ats`
- Parser recall: 67% · ATS score: 0 · Review: 100%

### DOCX export CV (`docx`)

- Source: `docx/fixture.txt`
- Template: `ats`
- Parser recall: 83% · ATS score: 36 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Sales CV (OCR sim) (`sales-cv-ocr`)

- Source: `sales-cv/fixture.txt`
- Template: `ats`
- Parser recall: 100% · ATS score: 44 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

### Executive CV (OCR sim) (`executive-cv-ocr`)

- Source: `executive-cv/fixture.txt`
- Template: `executive-minimal`
- Parser recall: 94% · ATS score: 39 · Review: 100%
- ATS quality note: score below 55 (engine OK, content gap)

