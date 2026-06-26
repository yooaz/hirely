# HIRELY DATA CONTRACT

**Version:** `data-contract-v1`  
**Enforced in:** `src/core/validation/resume-data-contract.js`

---

## Purpose

Every imported CV must materialize as a single canonical object — `resumeData` — before any UI, template, ATS, or export code runs. Raw OCR text is an extraction input only. It must never reach renderers, templates, or scoring.

---

## Required sections

Every `resumeData` object **must** contain these top-level keys:

| Section | Type | Empty allowed |
|---------|------|---------------|
| `identity` | `object` | yes (fields may be blank / uncertain) |
| `summary` | `string` | yes |
| `experiences` | `array` | yes |
| `education` | `array` | yes |
| `skills` | `array` | yes |
| `tools` | `array` | yes |
| `languages` | `array` | yes |
| `clients` | `array` | yes |
| `projects` | `array` | yes |
| `unsorted` | `array` | yes |

**Missing key** → `CONTRACT_MISSING_SECTION:{name}` warning  
**Empty section** → `CONTRACT_EMPTY_SECTION:{name}` warning  
**Invalid type** → `CONTRACT_INVALID_SECTION_TYPE:{name}` warning

Warnings are written to `resumeData.meta.warnings` and logged with `[HIRELY_DATA_CONTRACT]`. **Never silent.**

---

## Consumer rules

| Consumer | Allowed input | Forbidden |
|----------|---------------|-----------|
| Renderer (`renderCV`) | `resumeData` → `resumeDataToCvData()` | `state.rawText`, `state.text`, `state.cleanText` in product mode |
| Templates (`HirelyTemplates.render`) | sanitized `cvData` derived from `resumeData` | `rawText`, `cleanText`, `raw`, `_enterprise`, `reviewQueue` |
| ATS (`computeAtsScore`) | `resolveChecklistProfile({ resumeData })` | any raw OCR payload on input object |
| PDF export | `#cvDoc` DOM from template render | direct OCR text injection |

### Forbidden keys on consumer inputs

```
raw, rawText, cleanText, cleanedText, ocrText, rawOcr, rawExtraction,
_sourceLines, _enterprise
```

Plus template-specific forbidden keys in `hirely-flow-lock.js:FORBIDDEN_TEMPLATE_CV_KEYS`.

---

## Pipeline flow

```
File upload
  → OCR / extraction (raw text — internal only)
  → parsing pipeline
  → buildResumeData()          ← contract applied here
  → normalizeResumeData()      ← sections guaranteed + warnings
  → commitResumeData()         ← warnings merged to meta
  → resumeDataToCvData()       ← strip forbidden keys
  → renderCV / ATS / export    ← validateConsumerDataSource()
```

---

## Validation API

```javascript
import {
  validateResumeDataContract,
  applyResumeDataContractWarnings,
  validateConsumerDataSource,
  REQUIRED_RESUME_DATA_SECTIONS,
} from './src/core/validation/resume-data-contract.js';

// After import
const { resumeData, check } = applyResumeDataContractWarnings(rd);
// check.warnings — all section issues

// Before template / ATS
const guard = validateConsumerDataSource(cvData, 'TEMPLATE');
// guard.ok === false → raw OCR leak detected
```

---

## Integration points

| Location | Behavior |
|----------|----------|
| `resume-data.js:normalizeResumeData` | Applies contract warnings on every normalize |
| `resume-data.js:buildResumeData` | Applies contract warnings after import build |
| `resume-data.js:resumeDataToCvData` | Asserts template flow lock (no raw keys) |
| `ats-engine.js:computeAtsScore` | Validates consumer input |
| `product-score.js:computeProductScore` | Validates ATS profile source |
| `index.html:commitResumeData` | Re-applies contract warnings on commit |
| `index.html:renderCV` | Product mode: no raw OCR render path; template guard on `safe` |

---

## Audit

```bash
node scripts/data-contract-audit.mjs
```

Output: `DATA_CONTRACT_AUDIT.md` + stdout `PASS` or `FAIL`.

---

## Non-goals

- Empty sections are **not** errors — they emit warnings so the UI can prompt completion.
- `unsorted` preserves OCR lines not yet classified; it is a required section, not a leak.
- DEBUG mode may still display raw OCR in forensic panels; product mode (`!DEBUG_MODE`) is contract-bound.
