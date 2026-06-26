# FINAL RESUME CONTRACT REPORT

Generated: 2026-06-08T16:51:37.356Z
Contract version: **final-resume-v2**
Gate status: **PASS**

## Mission

Single UI read surface: `finalResumeData`. No visible section reads raw OCR, raw extraction, debug graph, or parser internals directly.

### P1 strict sections

Allowed on final display: `identity`, `summary`, `experiences`, `education`, `skills`, `tools`, `languages`, `clients`, `projects`.

Stripped before render: `unknownExperience`, `toClassify`, `unsorted`, `_enterprise`, `_parserReview`, `_extractionReview`.

## Pipeline

```
ocr
→ normalizedText
→ structuredResume
→ resumeData
→ finalResumeData
→ cvData
→ ui
```

## Contract validation

- `buildFinalResumeData(resumeData)` — normalize → sanitize → lock → validate
- `validateFinalResumeContract(finalResumeData)` — section contract + consumer guard + renderability
- Invalid contract → empty CV preview fallback (no partial garbage)

## UI surfaces

| Surface | Entry | Data source | Wired |
|---------|-------|-------------|-------|
| CV preview | `renderCV` | getFinalCvData() + isFinalResumeValid() | ✓ |
| Suggestions / Smart Repair | `buildStudioSuggestionsPayload` | getFinalCvData() + finalResumeData.unsorted | ✓ |
| ATS score | `computeProductScoreReport` | getChecklistCvData() ← getFinalResumeData() | ✓ |
| Cover letter | `getCoverLetterCvData` | getFinalCvData() | ✓ |
| PDF export | `downloadPDF` | renderCV() ← getFinalCvData() | ✓ |
| Recruiter review | `renderRecruiterReview` | getChecklistCvData() ← finalResumeData | ✓ |

## Forbidden UI reads (product mode)

| Source | Status |
|--------|--------|
| state.rawText in renderCV | enforced |
| state.structuredResume in renderCV | enforced |
| resumeDataFromCvData round-trip in applyImportResult | enforced |
| getToClassifyItems reads finalResumeData.unsorted | enforced |
| commitResumeData builds finalResumeData | enforced |

## Sample build

```json
{
  "contractOk": true,
  "renderable": true,
  "reasons": [],
  "cvName": "Alex Martin",
  "sections": {
    "identity": "object",
    "summary": "nonempty",
    "experiences": 2,
    "education": 0,
    "skills": 10,
    "tools": 2,
    "languages": 0,
    "clients": 0,
    "projects": 0,
    "unsorted": 2
  }
}
```

## Gate checks

- Total checks: 43
- Passed: 43
- Failed: 0

## Acceptance

**PASS** — All visible sections use `finalResumeData` (via `getFinalResumeData` / `getFinalCvData`).

## Files

- `src/core/validation/final-resume-contract.js` — contract builder + validator (v2 strict strip)
- `src/core/resume-data.js` — `foldParserLeakFields`, `normalizeCvDataForTemplate`
- `index.html` — `commitResumeData`, `getFinalResumeData`, `getFinalCvData`, UI consumers
- `src/tests/qa-final-resume-contract.mjs` — automated gate
- `tests/output/final-resume-contract/report.json` — machine-readable output