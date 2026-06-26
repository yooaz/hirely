# HIRELY DATA CONTRACT AUDIT

Generated: 2026-06-06T15:20:42.886Z
Contract: `data-contract-v1`

## Result: **PASS**

| Check | Result | Detail |
|-------|--------|--------|
| Contract version defined | PASS | data-contract-v1 |
| Required sections list complete | PASS | identity, summary, experiences, education, skills, tools, languages, clients, projects, unsorted |
| emptyResumeData has all sections | PASS | ok |
| emptyResumeData emits empty warnings | PASS | 9 empty sections |
| normalizeResumeData guarantees sections | PASS | ok |
| Yoaz import: all sections present | PASS | {"identity":"object","summary":"empty","experiences":1,"education":2,"skills":4,"tools":2,"languages":2,"clients":9,"projects":0,"unsorted":2} |
| Yoaz import: no raw OCR on resumeData | PASS | ok |
| Yoaz import: warnings surfaced | PASS | 2 warnings |
| cvData stripped of raw OCR keys | PASS | ok |
| Template consumer guard passes | PASS | ok |
| ATS reads resumeData-derived profile only | PASS | ok |
| ATS score computable from contract data | PASS | score=57 |
| Consumer guard detects raw OCR leak | PASS | TEMPLATE_TEST_READS_RAW_OCR:rawText, TEMPLATE_TEST_FORBIDDEN_CV_KEY:rawText, TEMPLATE_TEST_FORBIDDEN_CV_KEY:raw_text_payload |
| Template render from cvData only | PASS | 1499 chars |
| Template file does not reference raw OCR state | PASS | — |
| ATS engine does not read raw OCR state | PASS | — |
| Renderer uses resumeData path | PASS | index.html renderCV / commitResumeData |
| Product render gated away from DEBUG raw fallback | PASS | DEBUG-only raw path present |

## Required sections

- `identity`
- `summary`
- `experiences`
- `education`
- `skills`
- `tools`
- `languages`
- `clients`
- `projects`
- `unsorted`

## Rules

- No renderer may read raw OCR
- No template may read raw OCR
- No ATS may read raw OCR
- Everything must read resumeData (or resumeData-derived cvData)
- Missing/empty sections → warning (never silent)
