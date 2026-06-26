# FINAL_DATA_SOURCE_REPORT

**Result:** PASS
**Date:** 2026-06-07T15:03:33.487Z

## Mission

Single UI read surface: **`finalResumeData`**. All visible product UI derives display data from the locked final resume object — never raw OCR, debug graph, legacy `resumeData`, or cached `cvData`.

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

## UI surfaces (product)

| Surface | Entry | Reader | Locked |
|---------|-------|--------|--------|
| CV preview | `renderCVInner` | getFinalCvData() ← finalResumeData | yes |
| Suggestions | `collectProductSuggestions` | finalResumeData.suggestions | yes |
| Smart Repair | `buildStudioSuggestionsPayload` | getFinalCvData() + suggestions | yes |
| Recruiter score | `computeProductScoreReport` | getChecklistCvData() ← getFinalResumeData() | yes |
| Recruiter review | `renderRecruiterReview` | getChecklistCvData() + getFinalResumeData() | yes |
| Cover letter | `getCoverLetterCvData` | getFinalCvData() | yes |
| PDF export | `prepareLockedCvExport` | getFinalCvData() + validateExportLock(finalResumeData) | yes |
| TXT export | `downloadTXT` | getFinalCvData() | yes |
| Email export | `emailCV` | getFinalCvData() | yes |

## Forbidden in visible UI

| Source | Status |
|--------|--------|
| state.rawText | blocked |
| state.cleanText | blocked |
| state.structuredResume | blocked |
| state.cvData | blocked |
| state.resumeData | blocked |
| unsorted direct | blocked |
| debug graph | blocked |

## finalResumeData fields

- `identity`
- `summary`
- `experiences`
- `education`
- `skills`
- `tools`
- `languages`
- `clients`
- `projects`
- `suggestions`
- `quality`
- `metaSafe`

## Read helpers

- `getFinalResumeData()` — returns `state.finalResumeData`
- `finalResumeDisplayToResumeData(frd)` — maps display lock → mapper input
- `getFinalCvData()` — derives template cvData from `finalResumeData` only
- `getChecklistCvData()` — ATS/score profile from `finalResumeData`
- `getToClassifyItems()` — reads `finalResumeData.suggestions` only

## Gates

- qa-final-resume-contract: PASS
- qa-final-data-source: PASS

## Sample build

```json
{
  "renderable": true,
  "name": "Nom à confirmer",
  "suggestions": 1,
  "hasMetaRaw": false,
  "cvName": "Nom à confirmer"
}
```
