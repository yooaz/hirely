# DATA LOSS AUDIT

**Verdict:** PASS
**CV:** developer-cv
**Method:** paste
**Date:** 2026-06-07T22:19:07.319Z

## Pipeline trace

OCR → cleanText → canonicalImport → universalParser → resumeData → finalResumeData → templateRender

## Stage counts

| Stage | Sections | Experience | Education | Skills | Tools | Languages |
|-------|----------|------------|-----------|--------|-------|-----------|
| INPUT (fixture) | 8 | 2 | 1 | 5 | 9 | 2 |
| OCR | 8 | 2 | 1 | 5 | 9 | 2 |
| cleanText | 8 | 2 | 1 | 5 | 9 | 2 |
| canonicalImport (blocks) | 10 | 1 | 1 | 5 | 9 | 2 |
| canonicalImport (structuredResume) | 4 | 1 | 2 | 0 | 0 | 0 |
| canonicalImport (validatedCVData) | 3 | 0 | 2 | 0 | 0 | 0 |
| canonicalImport | 4 | 1 | 2 | 0 | 0 | 0 |
| universalParser | 4 | 1 | 1 | 0 | 0 | 0 |
| resumeData | 5 | 2 | 1 | 0 | 0 | 2 |
| finalResumeData | 5 | 2 | 1 | 0 | 0 | 2 |
| templateRender | 3 | 2 | 1 | 0 | 0 | 2 |

## Stage transitions (INPUT → OUTPUT → LOSS%)

| From | To | Field | INPUT_COUNT | OUTPUT_COUNT | LOSS_PERCENT |
|------|-----|-------|-------------|--------------|--------------|
| cleanText | canonicalImport | experience | 2 | 0 | 100% |
| cleanText | canonicalImport | education | 1 | 2 | -100% |
| cleanText | canonicalImport | skills | 5 | 0 | 100% |
| cleanText | canonicalImport | tools | 9 | 0 | 100% |
| cleanText | canonicalImport | languages | 2 | 0 | 100% |
| canonicalImport | universalParser | experience | 0 | 1 | -100% |
| canonicalImport | universalParser | education | 2 | 1 | 50% |
| universalParser | resumeData | experience | 1 | 2 | -100% |
| universalParser | resumeData | languages | 0 | 2 | -100% |

## Internal canonicalImport transitions

| From | To | Field | INPUT_COUNT | OUTPUT_COUNT | LOSS_PERCENT |
|------|-----|-------|-------------|--------------|--------------|
| cleanText | canonicalImport (blocks) | experience | 2 | 1 | 50% |
| canonicalImport (blocks) | canonicalImport (structuredResume) | education | 1 | 2 | -100% |
| canonicalImport (blocks) | canonicalImport (structuredResume) | skills | 5 | 0 | 100% |
| canonicalImport (blocks) | canonicalImport (structuredResume) | tools | 9 | 0 | 100% |
| canonicalImport (blocks) | canonicalImport (structuredResume) | languages | 2 | 0 | 100% |
| canonicalImport (structuredResume) | canonicalImport (validatedCVData) | experience | 1 | 0 | 100% |
| canonicalImport (validatedCVData) | resumeData | experience | 0 | 2 | -100% |
| canonicalImport (validatedCVData) | resumeData | education | 2 | 1 | 50% |
| canonicalImport (validatedCVData) | resumeData | languages | 0 | 2 | -100% |

## Loss locations identified

- experience: first loss at canonicalImport (structuredResume) → canonicalImport (validatedCVData) (1 → 0, 100% loss)
- education: first loss at canonicalImport (validatedCVData) → resumeData (2 → 1, 50% loss)
- skills: first loss at canonicalImport (blocks) → canonicalImport (structuredResume) (5 → 0, 100% loss)
- tools: first loss at canonicalImport (blocks) → canonicalImport (structuredResume) (9 → 0, 100% loss)
- languages: first loss at canonicalImport (blocks) → canonicalImport (structuredResume) (2 → 0, 100% loss)

### Experience

- **Loss:** cleanText → canonicalImport (blocks) (2 → 1, 50%)
- **Loss:** canonicalImport (structuredResume) → canonicalImport (validatedCVData) (1 → 0, 100%)
- **Loss:** cleanText → canonicalImport (2 → 0, 100%)
- **structuredResume:** Software Engineer @ Stripe
- **validatedCVData:** —
- **resumeData (recovered):** Software Engineer @ Stripe | Software Engineer @ Dropbox
- **Misclassified blocks:**
  - `blk-6` type=`identity` conf=92: Software Engineer — Dropbox — 2015 – 2019

### Education

- **First drop:** canonicalImport (validatedCVData) → resumeData (2 → 1)

### Skills / Tools / Languages

- **skills:** first loss at canonicalImport (blocks) → canonicalImport (structuredResume) (5 → 0, 100%)
- **tools:** first loss at canonicalImport (blocks) → canonicalImport (structuredResume) (9 → 0, 100%)
- **languages:** first loss at canonicalImport (blocks) → canonicalImport (structuredResume) (2 → 0, 100%)
- **skills blocks in classifier:** Skills | System design, API design, distributed systems, mentoring, code review
- **tools blocks in classifier:** Tools | TypeScript, Python, Go, React, PostgreSQL, Redis, Docker, Kubernetes, AWS
- **structuredResume.skills:** —
- **structuredResume.tools:** —

## Root cause summary

1. **Skills/Tools/Languages** — blocks carry full lists (5 skills, 9 tools, 2 languages) but `buildStructuredResumeFromDocumentBlocks` drops them to zero.
2. **Experience (Dropbox)** — `Software Engineer — Dropbox — 2015 – 2019` misclassified as `identity` block (`blk-6`), so blocks→structuredResume loses 1 of 2 entries.
3. **Experience (validation)** — `structuredResume` (1 entry) → `validatedCVData` (0 entries) via `sanitizeCvDataForExport` / review gate; `resumeData` repair then recovers 2 entries from cleanText.
4. **resumeData repair** — `repairResumeDataFromRaw` / `import-repair` restores experience from cleanText but does not restore skills/tools.
5. **templateRender** — renders what `finalResumeData` contains; skills/tools/languages sections omitted when arrays are empty.
