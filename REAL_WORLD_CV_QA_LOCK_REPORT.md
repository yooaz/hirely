# Real World CV QA Lock Report

**Verdict:** PASS
**Generated:** 2026-06-08T17:21:20.434Z
**Pass count:** 5/5

## PASS gates (all required per CV)

- No `CORE_BOOT_FAILED`
- No missing export
- No `TEMPLATE_FORBIDDEN_CV_KEY`
- No duplicate education
- No duplicate experience
- No section labels in header
- CV preview visible
- Score visible
- Export button visible

## Summary

| CV | Result | Score | Export |
|----|--------|-------|--------|
| Yoaz scanned PDF | PASS | 83 | ok |
| Designer CV | PASS | 66 | ok |
| Developer CV | PASS | 50 | ok |
| Marketing CV | PASS | 52 | ok |
| Simple text CV | PASS | 53 | ok |

## Per-CV detail

### Yoaz scanned PDF — PASS

- **Source:** `/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf`
- **Boot:** ok
- **Import:** IMPORT_OK
- **Extraction:** IMPORT_READY · method=ocr · quality=good
- **Parser:** ok · contract renderable
- **finalResumeData counts:** exp=2 edu=2 skills=6 tools=2 langs=2 clients=6 suggestions=0
- **Name:** Yohann Azancot
- **Score:** 83 (visible=true)
- **Export readiness:** buttonVisible=true · export=ok
- **Visible CV issues:** none

### Designer CV — PASS

- **Source:** `tests/fixtures/creative-cv/fixture.txt`
- **Boot:** ok
- **Import:** IMPORT_OK
- **Extraction:** IMPORT_READY · method=txt · quality=good
- **Parser:** ok · contract renderable
- **finalResumeData counts:** exp=1 edu=0 skills=6 tools=3 langs=2 clients=7 suggestions=1
- **Name:** Yohann Azancot
- **Score:** 66 (visible=true)
- **Export readiness:** buttonVisible=true · export=ok
- **Visible CV issues:** none

### Developer CV — PASS

- **Source:** `tests/fixtures/developer-cv/fixture.txt`
- **Boot:** ok
- **Import:** IMPORT_OK
- **Extraction:** IMPORT_READY · method=txt · quality=good
- **Parser:** ok · contract renderable
- **finalResumeData counts:** exp=2 edu=1 skills=0 tools=0 langs=2 clients=0 suggestions=2
- **Name:** Alex Chen
- **Score:** 50 (visible=true)
- **Export readiness:** buttonVisible=true · export=ok
- **Visible CV issues:** none

### Marketing CV — PASS

- **Source:** `tests/fixtures/marketing-cv/fixture.txt`
- **Boot:** ok
- **Import:** IMPORT_OK
- **Extraction:** IMPORT_READY · method=txt · quality=good
- **Parser:** ok · contract renderable
- **finalResumeData counts:** exp=3 edu=2 skills=0 tools=0 langs=2 clients=0 suggestions=0
- **Name:** Laura Bennett
- **Score:** 52 (visible=true)
- **Export readiness:** buttonVisible=true · export=ok
- **Visible CV issues:** none

### Simple text CV — PASS

- **Source:** `tests/fixtures/mvp-sample.txt`
- **Boot:** ok
- **Import:** IMPORT_OK
- **Extraction:** IMPORT_READY · method=txt · quality=good
- **Parser:** ok · contract renderable
- **finalResumeData counts:** exp=1 edu=0 skills=6 tools=2 langs=0 clients=0 suggestions=1
- **Name:** Yohann Azancot
- **Score:** 53 (visible=true)
- **Export readiness:** buttonVisible=true · export=ok
- **Visible CV issues:** none

## Remaining blockers

_None._

Artifacts: `tests/output/real-world-cv-qa-lock/`

```bash
npm run qa:real-world-cv-lock
npm run real-world-cv-qa-lock-report
```
