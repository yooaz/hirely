# DOM_CONTRACT_REPORT

**Status:** PASS
**Generated:** 2026-06-15T10:35:26.483Z
**Source:** `src/ui/runtime/dom-contract.js`

## Policy

- **Boot stops** only when `validateDomContract().valid === false` (missing **required** IDs).
- Missing **optional** IDs are traced (`MISSING_OPTIONAL_DOM`) and recorded in `__HIRELY_MISSING_DOM__` — boot continues.

## validateDomContract()

```javascript
{
  valid: boolean,           // true when missingRequired.length === 0
  missingRequired: string[],
  missingOptional: string[]
}
```

### Runtime result (browser)

```json
{
  "valid": true,
  "missingRequired": [],
  "missingOptional": [
    "auditPanelInner",
    "auditPanel",
    "linkedinPanel",
    "letterPanel",
    "linkedinText",
    "letterText",
    "hirelyDebugPanel",
    "hirelyForensicPanel",
    "importDebugPanel",
    "extractionGate",
    "extractionAlert",
    "exportFinalPanel",
    "hirelyTestClickBtn",
    "hirelyTestImport",
    "resultFlow",
    "templateGallery",
    "rawDetails"
  ]
}
```

## requiredIds

| ID | HTML element | Boot |
|----|--------------|------|
| `app` | yes | required — boot OK |
| `docNav` | yes | required — boot OK |
| `wsImport` | yes | required — boot OK |
| `drop` | yes | required — boot OK |
| `fileInput` | yes | required — boot OK |
| `cvPreview` | yes | required — boot OK | `#cvDoc`

**missingRequired (static):** none

## optionalIds

| ID | HTML element | Boot impact |
|----|--------------|-------------|
| `auditPanelInner` | no (subtracted) | warn only |
| `auditPanel` | no (subtracted) | warn only |
| `linkedinPanel` | no (subtracted) | warn only |
| `letterPanel` | no (subtracted) | warn only |
| `linkedinText` | no (subtracted) | warn only |
| `letterText` | no (subtracted) | warn only |
| `hirelyDebugPanel` | no (subtracted) | warn only |
| `hirelyForensicPanel` | no (subtracted) | warn only |
| `pipelineReportPanel` | yes | warn only |
| `importDebugPanel` | no (subtracted) | warn only |
| `extractionGate` | no (subtracted) | warn only |
| `extractionAlert` | no (subtracted) | warn only |
| `exportFinalPanel` | no (subtracted) | warn only |
| `hirelyTestClickBtn` | no (subtracted) | warn only |
| `hirelyTestImport` | no (subtracted) | warn only |
| `recruiterReviewPanel` | yes | warn only |
| `studioScorePanel` | yes | warn only |
| `wsInsights` | yes | warn only |
| `coverLetterWorkspace` | yes | warn only |
| `resultFlow` | no (subtracted) | warn only |
| `templateGallery` | no (subtracted) | warn only |
| `rawDetails` | no (subtracted) | warn only |
| `workspace` | yes | warn only |
| `workspaceGrid` | yes | warn only |
| `wsProduct` | yes | warn only |
| `cvPanel` | yes | warn only |
| `cvDoc` | yes | warn only |
| `importPasteFallback` | yes | warn only |
| `statusText` | yes | warn only |
| `progress` | yes | warn only |
| `progressBar` | yes | warn only |

**missingOptional (static):** 17 — expected after P0 subtraction

## API surface (`window.HirelyDomContract`)

| Export | Role |
|--------|------|
| `requiredIds` | Canonical required list |
| `optionalIds` | Canonical optional list |
| `validateDomContract()` | Full validation result |
| `validateRequiredDom()` | Legacy — returns `missingRequired` only |
| `setHTML` / `setText` / `setElHTML` | Null-safe DOM writes |
| `byId` / `$` | Lookup with `cvPreview` → `cvDoc` alias |

## Boot integration

1. `dom-contract.js` loads after `boot-trace.js` + `dom-safe.js`.
2. On load: `validateDomContract()` → `DOM_CONTRACT_READY` trace.
3. If `!valid`: `HirelyBootTrace.fail` — boot stops.
4. `index.html` calls `validateDomContract()` at DOM_VALIDATED (via `validateRequiredDom` shim).
5. `HirelyEngineHealth` uses `missingRequired` only for `FAILED` state.
