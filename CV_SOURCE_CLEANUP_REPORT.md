# CV Source Cleanup

**Generated:** 2026-06-16T07:06:33.467Z
**Status:** **PASS** (17/17 checks)
**Version:** `ONE_CV_SOURCE_V1` (`cv-source-v1`)

## Goal

All product screens use **one canonical source**:

```
import → resumeData → review | templates | export
```

Derived **template cvData** is an adapter only (`resumeDataToCvData` / `buildTemplateInputFromResume`). It is not stored as a parallel truth on the product path.

## Removed / bypassed on product path

| Competing source | Status |
| --- | --- |
| `finalResumeData` | Not built when `HIRELY_ONE_CV_SOURCE=true`; `getFinalResumeData()` aliases `resumeData` |
| `state.cvData` | Cache only via `syncDerivedCvDataFromFinal()` from `resumeData` adapter |
| `structuredResume` | Pipeline/debug only — not read by review/template/export |
| Parser confidence gates | Skipped in one-source commit (no `buildFinalResumeData` semantic gate) |
| ATS / review-before-template blockers | Bypassed via `HIRELY_V1_NO_ATS_BLOCKERS` + V1 gates |

## Runtime flag

```javascript
HIRELY_ONE_CV_SOURCE = true  // also enabled when HIRELY_V1_SCOPE_LOCK = true
```

## Read API (index.html)

| Function | One-source behavior |
| --- | --- |
| `getResumeData()` | Returns `state.resumeData` |
| `getFinalResumeData()` | Alias → `getResumeData()` |
| `isFinalResumeValid()` | `resumeDataIsRenderable(resumeData)` |
| `mapFinalResumeToCvData()` | `resumeDataToCvData(resumeData)` only |
| `getFinalSectionCounts()` | Counts from `resumeData` |
| `commitResumeData()` | Writes `resumeData`; skips `buildFinalResumeData` |

## Module map

| File | Role |
| --- | --- |
| `src/core/resume/resume-data-source.js` | `isOneCvSourceEnabled`, `templateCvFromResumeData`, section counts |
| `src/core/resume-data.js` | Normalize + `resumeDataToCvData` adapter |
| `index.html` | `oneCvSourceActive()`, unified getters, commit path |

## Adapters kept (derived only)

- `resumeDataToCvData(resumeData)` — template / PDF export flat shape
- `buildTemplateInputFromResume(resumeData)` — optional richer template input
- `normalizeCvDataForTemplate(cv)` — strips parser leak keys

## Static checks

| Check | Status | Detail |
| --- | --- | --- |
| file:resume-data-source-js | PASS | — |
| core:exports-resume-data-source | PASS | — |
| flag:HIRELY_ONE_CV_SOURCE | PASS | — |
| fn:oneCvSourceActive | PASS | — |
| fn:getResumeData | PASS | — |
| read:getFinalResumeData-aliases-resumeData | PASS | — |
| valid:isFinalResumeValid-resumeData | PASS | — |
| adapter:mapFinalResumeToCvData-one-source | PASS | — |
| cache:syncDerivedCvFromResumeData | PASS | — |
| commit:skips-buildFinalResumeData | PASS | — |
| counts:getFinalSectionCounts-resumeData | PASS | — |
| module:isOneCvSourceEnabled | PASS | — |
| module:templateCvFromResumeData | PASS | — |
| module:ONE_CV_SOURCE_VERSION | PASS | — |
| product:renderCV-no-structuredResume | PASS | — |
| product:renderCV-uses-getFinalCvData | PASS | — |
| gates:v1-ats-bypass | PASS | — |

## Verification

```bash
npm run cv-source-cleanup-report
npm run v1-release-test
```

## Debug-only (allowed)

`structuredResume`, `confidenceReport`, and `finalResumeData` may still appear in DEBUG panels or legacy tests. Product UI must not branch on them when `oneCvSourceActive()` is true.

## Pipeline note

Import still produces `structuredResume` internally during extraction; it is folded into `resumeData` at commit. UI never reads `structuredResume` for review, templates, or export in one-source mode.
