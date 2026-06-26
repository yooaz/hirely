# DEAD_REFERENCE_REPORT

**Generated:** 2026-06-15T10:33:08.072Z
**HTML IDs in index.html:** 220
**References scanned:** 1068 across 1071 files
**BROKEN_REFERENCE flags:** 78

## Severity summary (ranked)

| Severity | Count | Meaning |
|----------|-------|---------|
| CRITICAL | 0 | Required DOM missing + unguarded crash op |
| HIGH | 0 | Optional missing + unguarded crash op, or required missing guarded |
| MEDIUM | 43 | Missing DOM, guarded or non-crash lookup |
| LOW | 35 | Missing unknown DOM, low crash risk |

## Required DOM contract

- `app` — **exists**
- `docNav` — **exists**
- `wsImport` — **exists**
- `drop` — **exists**
- `fileInput` — **exists**
- `cvPreview` → `#cvDoc` — **exists**

## BROKEN_REFERENCE — ranked by crash severity

| Rank | Severity | DOM ID | Required? | Exists? | File | Function | Operation | Guarded? |
|------|----------|--------|-----------|---------|------|----------|-----------|----------|
| 1 | MEDIUM | `hirelyTestResult` | unknown | **no** | `src/tests/qa-hard-reset-import.mjs:83` | main | textContent | **no** |
| 2 | MEDIUM | `exportFinalPanel` | optional | **no** | `index.html:8288` | previewName | classList | yes |
| 3 | MEDIUM | `exportFinalPanel` | optional | **no** | `scripts/product-pass-qa-yoaz.mjs:186` | (module) | classList | yes |
| 4 | MEDIUM | `extractionAlert` | optional | **no** | `src/tests/qa-import-silent.mjs:72` | waitForOutcome | classList | yes |
| 5 | MEDIUM | `extractionAlert` | optional | **no** | `src/tests/qa-import-silent.mjs:151` | onConsole | classList | yes |
| 6 | MEDIUM | `extractionAlert` | optional | **no** | `src/tests/qa-verify-ui.mjs:92` | browserChecks | classList | yes |
| 7 | MEDIUM | `extractionGate` | optional | **no** | `src/tests/qa-final-ui-sync-yoaz.mjs:105` | waitImportDone | classList | yes |
| 8 | MEDIUM | `extractionGate` | optional | **no** | `src/tests/qa-flow-lock-browser.mjs:141` | waitImportDone | classList | yes |
| 9 | MEDIUM | `extractionGate` | optional | **no** | `src/tests/qa-p7-final-lock.mjs:260` | waitImportDone | classList | yes |
| 10 | MEDIUM | `extractionGate` | optional | **no** | `src/tests/qa-pdf-acceptance.mjs:273` | uploadAndCapture | classList | yes |
| 11 | MEDIUM | `extractionGate` | optional | **no** | `src/tests/qa-product-lock.mjs:92` | waitImportDone | classList | yes |
| 12 | MEDIUM | `extractionGate` | optional | **no** | `src/tests/qa-real-user-cv.mjs:174` | waitImportDone | classList | yes |
| 13 | MEDIUM | `extractionGate` | optional | **no** | `src/tests/qa-real-visual-browser.mjs:123` | waitImportDone | classList | yes |
| 14 | MEDIUM | `extractionGate` | optional | **no** | `src/tests/qa-visual-quality-lock.mjs:126` | waitImportDone | classList | yes |
| 15 | MEDIUM | `extractionGate` | optional | **no** | `scripts/final-browser-qa.mjs:120` | waitImportDone | classList | yes |
| 16 | MEDIUM | `extractionGate` | optional | **no** | `scripts/real-browser-qa-lock.mjs:146` | waitForImportLive | classList | yes |
| 17 | MEDIUM | `extractionGate` | optional | **no** | `scripts/real-world-cv-qa-lock.mjs:98` | waitImportDone | classList | yes |
| 18 | MEDIUM | `extractionGate` | optional | **no** | `scripts/visible-qa-yoaz.mjs:77` | waitImportDone | classList | yes |
| 19 | MEDIUM | `hirelyDebugPanel` | optional | **no** | `index.html:3272` | renderExtractionDebug | lookup | **no** |
| 20 | MEDIUM | `hirelyDebugPanel` | optional | **no** | `index.html:3365` | renderParserTracePanel | lookup | yes |
| 21 | MEDIUM | `hirelyDebugPanel` | optional | **no** | `index.html:3400` | renderParserObservability | lookup | yes |
| 22 | MEDIUM | `hirelyDebugPanel` | optional | **no** | `index.html:8316` | previewName | lookup | yes |
| 23 | MEDIUM | `hirelyForensicPanel` | optional | **no** | `index.html:1829` | unlockPageUI | lookup | yes |
| 24 | MEDIUM | `hirelyForensicPanel` | optional | **no** | `index.html:3178` | renderForensicMode | lookup | yes |
| 25 | MEDIUM | `hirelyForensicPanel` | optional | **no** | `index.html:8319` | previewName | innerHTML | yes |
| 26 | MEDIUM | `hirelyTestImport` | optional | **no** | `src/tests/qa-real-product-audit.mjs:242` | (module) | lookup | **no** |
| 27 | MEDIUM | `hirelyTestImport` | optional | **no** | `src/tests/qa-verify-ui.mjs:82` | browserChecks | lookup | **no** |
| 28 | MEDIUM | `hirelyTestImport` | optional | **no** | `src/tests/qa-verify-ui.mjs:148` | browserChecks | lookup | **no** |
| 29 | MEDIUM | `hirelyTestImport` | optional | **no** | `src/tests/qa-verify-ui.mjs:149` | browserChecks | lookup | **no** |
| 30 | MEDIUM | `importDebugPanel` | optional | **no** | `src/ui/product/import-debug-panel.js:90` | (module) | lookup | yes |
| 31 | MEDIUM | `letterText` | optional | **no** | `index.html:6873` | renderCoverLetterPreview | lookup | **no** |
| 32 | MEDIUM | `letterText` | optional | **no** | `index.html:7028` | renderOutputs | value | yes |
| 33 | MEDIUM | `letterText` | optional | **no** | `index.html:7068` | renderOutputs | lookup | yes |
| 34 | MEDIUM | `letterText` | optional | **no** | `index.html:7072` | renderOutputs | lookup | yes |
| 35 | MEDIUM | `letterText` | optional | **no** | `index.html:8229` | name | addEventListener | yes |
| 36 | MEDIUM | `linkedinText` | optional | **no** | `index.html:7027` | renderOutputs | value | yes |
| 37 | MEDIUM | `linkedinText` | optional | **no** | `index.html:7060` | renderOutputs | lookup | yes |
| 38 | MEDIUM | `rawDetails` | optional | **no** | `index.html:8122` | resetExtractionState | lookup | yes |
| 39 | MEDIUM | `rawDetails` | optional | **no** | `src/tests/qa-import-silent.mjs:71` | waitForOutcome | lookup | **no** |
| 40 | MEDIUM | `rawDetails` | optional | **no** | `src/tests/qa-import-silent.mjs:150` | onConsole | lookup | **no** |
| 41 | MEDIUM | `resultFlow` | optional | **no** | `index.html:5518` | updateResultFlow | lookup | yes |
| 42 | MEDIUM | `templateGallery` | optional | **no** | `index.html:1970` | resetImportWorkspaceForFallback | lookup | yes |
| 43 | MEDIUM | `templateGallery` | optional | **no** | `src/tests/qa-ocr-browser-smoke.mjs:160` | (module) | lookup | **no** |
| 44 | LOW | `cvA4MeasureHost` | unknown | **no** | `src/ui/export/cv-a4-pages.js:92` | (module) | lookup | **no** |
| 45 | LOW | `cvA4MeasureHost` | unknown | **no** | `src/ui/export/cv-a4-pages.js:378` | (module) | lookup | **no** |
| 46 | LOW | `exportBackToTemplatesBtn` | unknown | **no** | `src/tests/qa-export-page-full-preview.mjs:128` | setStep | textContent | yes |
| 47 | LOW | `exportFinalCopyCv` | unknown | **no** | `index.html:8196` | (module) | lookup | yes |
| 48 | LOW | `exportFinalCvPdf` | unknown | **no** | `index.html:8192` | (module) | lookup | yes |
| 49 | LOW | `exportFinalCvPdf` | unknown | **no** | `scripts/real-world-cv-qa-lock.mjs:171` | normKey | lookup | **no** |
| 50 | LOW | `exportFinalCvPdf` | unknown | **no** | `scripts/real-world-cv-qa-lock.mjs:413` | (module) | lookup | **no** |
| 51 | LOW | `exportFinalLetterPdf` | unknown | **no** | `index.html:8194` | (module) | lookup | yes |
| 52 | LOW | `exportFinalScore` | unknown | **no** | `index.html:8289` | previewName | textContent | yes |
| 53 | LOW | `exportFinalScore` | unknown | **no** | `scripts/product-pass-qa-yoaz.mjs:187` | (module) | textContent | yes |
| 54 | LOW | `extractionAlertText` | unknown | **no** | `src/tests/qa-verify-ui.mjs:91` | browserChecks | textContent | yes |
| 55 | LOW | `generateBtn` | unknown | **no** | `index.html:5610` | updateGenerateBtnState | lookup | yes |
| 56 | LOW | `hirelyCoreError` | unknown | **no** | `src/tests/qa-h4-end-to-end-flow.mjs:172` | selectTemplateCard | textContent | yes |
| 57 | LOW | `hirelyParserObs` | unknown | **no** | `index.html:3416` | renderParserObservability | lookup | yes |
| 58 | LOW | `hirelyTestDrop` | unknown | **no** | `src/tests/qa-hard-reset-import.mjs:54` | main | lookup | **no** |
| 59 | LOW | `hirelyTestDrop` | unknown | **no** | `src/tests/qa-hard-reset-import.mjs:91` | main | lookup | **no** |
| 60 | LOW | `hirelyTestResult` | unknown | **no** | `index.html:7872` | showTestImportFile | lookup | yes |
| 61 | LOW | `hirelyTestResult` | unknown | **no** | `src/tests/qa-hard-reset-import.mjs:55` | main | lookup | **no** |
| 62 | LOW | `hirelyTestResult` | unknown | **no** | `src/tests/qa-hard-reset-import.mjs:72` | main | textContent | yes |
| 63 | LOW | `hirelyTestResult` | unknown | **no** | `src/tests/qa-hard-reset-import.mjs:93` | main | textContent | yes |
| 64 | LOW | `importClickBtn` | unknown | **no** | `src/tests/qa-hard-reset-import.mjs:53` | main | lookup | **no** |
| 65 | LOW | `importFlowV2ActiveLabel` | unknown | **no** | `src/ui/product/import-flow-v2.js:142` | (module) | lookup | **no** |
| 66 | LOW | `importFlowV2Extract` | unknown | **no** | `src/ui/product/import-flow-v2.js:110` | (module) | lookup | **no** |
| 67 | LOW | `importFlowV2MacroHint` | unknown | **no** | `src/ui/product/import-flow-v2.js:111` | (module) | lookup | **no** |
| 68 | LOW | `importPasteFallbackDocx` | unknown | **no** | `src/tests/qa-import-fallback-ux-lock.mjs:134` | startServer | textContent | yes |
| 69 | LOW | `importPasteFallbackDocx` | unknown | **no** | `src/tests/qa-import-needs-paste-ui.mjs:136` | (module) | textContent | yes |
| 70 | LOW | `importPasteFallbackDocx` | unknown | **no** | `src/tests/qa-pdf-timeout-fallback.mjs:147` | startServer | textContent | yes |
| 71 | LOW | `importPasteFallbackFile` | unknown | **no** | `src/tests/qa-import-fallback-ux-lock.mjs:128` | startServer | textContent | yes |
| 72 | LOW | `importPasteFallbackReason` | unknown | **no** | `src/tests/qa-import-fallback-ux-lock.mjs:130` | startServer | textContent | yes |
| 73 | LOW | `importPasteFallbackRetryOcr` | unknown | **no** | `src/tests/qa-import-fallback-ux-lock.mjs:133` | startServer | textContent | yes |
| 74 | LOW | `importPasteFallbackRetryOcr` | unknown | **no** | `src/tests/qa-import-needs-paste-ui.mjs:135` | startServer | textContent | yes |
| 75 | LOW | `importPasteFallbackRetryOcr` | unknown | **no** | `src/tests/qa-pdf-timeout-fallback.mjs:146` | startServer | textContent | yes |
| 76 | LOW | `importPasteFallbackType` | unknown | **no** | `src/tests/qa-import-fallback-ux-lock.mjs:129` | startServer | textContent | yes |
| 77 | LOW | `openPasteCompactBtn` | unknown | **no** | `src/tests/qa-product-recovery.mjs:146` | (module) | lookup | **no** |
| 78 | LOW | `resetBtn` | unknown | **no** | `index.html:8132` | resetExtractionState | lookup | yes |

## BROKEN_REFERENCE detail

### `hirelyTestResult` — MEDIUM (5 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/tests/qa-hard-reset-import.mjs` | 83 | main | unknown | no | no | textContent |
| `index.html` | 7872 | showTestImportFile | unknown | no | yes | lookup |
| `src/tests/qa-hard-reset-import.mjs` | 55 | main | unknown | no | no | lookup |
| `src/tests/qa-hard-reset-import.mjs` | 72 | main | unknown | no | yes | textContent |
| `src/tests/qa-hard-reset-import.mjs` | 93 | main | unknown | no | yes | textContent |

```
document.getElementById('hirelyTestResult').textContent = '';
```

### `exportFinalPanel` — MEDIUM (2 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `index.html` | 8288 | previewName | optional | no | yes | classList |
| `scripts/product-pass-qa-yoaz.mjs` | 186 | (module) | optional | no | yes | classList |

```
exportPanelVisible:!document.getElementById('exportFinalPanel')?.classList.contains('hidden'),
```

### `extractionAlert` — MEDIUM (3 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/tests/qa-import-silent.mjs` | 72 | waitForOutcome | optional | no | yes | classList |
| `src/tests/qa-import-silent.mjs` | 151 | onConsole | optional | no | yes | classList |
| `src/tests/qa-verify-ui.mjs` | 92 | browserChecks | optional | no | yes | classList |

```
const alert = document.getElementById('extractionAlert')?.classList.contains('show');
```

### `extractionGate` — MEDIUM (12 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/tests/qa-final-ui-sync-yoaz.mjs` | 105 | waitImportDone | optional | no | yes | classList |
| `src/tests/qa-flow-lock-browser.mjs` | 141 | waitImportDone | optional | no | yes | classList |
| `src/tests/qa-p7-final-lock.mjs` | 260 | waitImportDone | optional | no | yes | classList |
| `src/tests/qa-pdf-acceptance.mjs` | 273 | uploadAndCapture | optional | no | yes | classList |
| `src/tests/qa-product-lock.mjs` | 92 | waitImportDone | optional | no | yes | classList |
| `src/tests/qa-real-user-cv.mjs` | 174 | waitImportDone | optional | no | yes | classList |
| `src/tests/qa-real-visual-browser.mjs` | 123 | waitImportDone | optional | no | yes | classList |
| `src/tests/qa-visual-quality-lock.mjs` | 126 | waitImportDone | optional | no | yes | classList |
| `scripts/final-browser-qa.mjs` | 120 | waitImportDone | optional | no | yes | classList |
| `scripts/real-browser-qa-lock.mjs` | 146 | waitForImportLive | optional | no | yes | classList |
| `scripts/real-world-cv-qa-lock.mjs` | 98 | waitImportDone | optional | no | yes | classList |
| `scripts/visible-qa-yoaz.mjs` | 77 | waitImportDone | optional | no | yes | classList |

```
gate: !document.getElementById('extractionGate')?.classList.contains('hidden'),
```

### `hirelyDebugPanel` — MEDIUM (4 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `index.html` | 3272 | renderExtractionDebug | optional | no | no | lookup |
| `index.html` | 3365 | renderParserTracePanel | optional | no | yes | lookup |
| `index.html` | 3400 | renderParserObservability | optional | no | yes | lookup |
| `index.html` | 8316 | previewName | optional | no | yes | lookup |

```
const el=$('hirelyDebugPanel');
```

### `hirelyForensicPanel` — MEDIUM (3 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `index.html` | 1829 | unlockPageUI | optional | no | yes | lookup |
| `index.html` | 3178 | renderForensicMode | optional | no | yes | lookup |
| `index.html` | 8319 | previewName | optional | no | yes | innerHTML |

```
const fp=$('hirelyForensicPanel');
```

### `hirelyTestImport` — MEDIUM (4 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/tests/qa-real-product-audit.mjs` | 242 | (module) | optional | no | no | lookup |
| `src/tests/qa-verify-ui.mjs` | 82 | browserChecks | optional | no | no | lookup |
| `src/tests/qa-verify-ui.mjs` | 148 | browserChecks | optional | no | no | lookup |
| `src/tests/qa-verify-ui.mjs` | 149 | browserChecks | optional | no | no | lookup |

```
const testImport = document.getElementById('hirelyTestImport');
```

### `importDebugPanel` — MEDIUM (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/ui/product/import-debug-panel.js` | 90 | (module) | optional | no | yes | lookup |

```
const host = global.document.getElementById('importDebugPanel');
```

### `letterText` — MEDIUM (5 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `index.html` | 6873 | renderCoverLetterPreview | optional | no | no | lookup |
| `index.html` | 7028 | renderOutputs | optional | no | yes | value |
| `index.html` | 7068 | renderOutputs | optional | no | yes | lookup |
| `index.html` | 7072 | renderOutputs | optional | no | yes | lookup |
| `index.html` | 8229 | name | optional | no | yes | addEventListener |

```
const legacy=$('letterText');
```

### `linkedinText` — MEDIUM (2 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `index.html` | 7027 | renderOutputs | optional | no | yes | value |
| `index.html` | 7060 | renderOutputs | optional | no | yes | lookup |

```
const li=$('linkedinText');if(li){li.value='';status.rendered.push('linkedinText')}else if(isOptionalDomMissing('linkedinText'))status.skipp
```

### `rawDetails` — MEDIUM (3 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `index.html` | 8122 | resetExtractionState | optional | no | yes | lookup |
| `src/tests/qa-import-silent.mjs` | 71 | waitForOutcome | optional | no | no | lookup |
| `src/tests/qa-import-silent.mjs` | 150 | onConsole | optional | no | no | lookup |

```
if($('rawDetails'))$('rawDetails').open=false;
```

### `resultFlow` — MEDIUM (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `index.html` | 5518 | updateResultFlow | optional | no | yes | lookup |

```
const flow=$('resultFlow');
```

### `templateGallery` — MEDIUM (2 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `index.html` | 1970 | resetImportWorkspaceForFallback | optional | no | yes | lookup |
| `src/tests/qa-ocr-browser-smoke.mjs` | 160 | (module) | optional | no | no | lookup |

```
const tg=$('templateGallery');
```

### `cvA4MeasureHost` — LOW (2 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/ui/export/cv-a4-pages.js` | 92 | (module) | unknown | no | no | lookup |
| `src/ui/export/cv-a4-pages.js` | 378 | (module) | unknown | no | no | lookup |

```
const measureHost = global.document.getElementById('cvA4MeasureHost');
```

### `exportBackToTemplatesBtn` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/tests/qa-export-page-full-preview.mjs` | 128 | setStep | unknown | no | yes | textContent |

```
backBtnLabel: (document.getElementById('exportBackToTemplatesBtn')?.textContent || '').trim(),
```

### `exportFinalCopyCv` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `index.html` | 8196 | (module) | unknown | no | yes | lookup |

```
const exportFinalCopyCv=$('exportFinalCopyCv');
```

### `exportFinalCvPdf` — LOW (3 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `index.html` | 8192 | (module) | unknown | no | yes | lookup |
| `scripts/real-world-cv-qa-lock.mjs` | 171 | normKey | unknown | no | no | lookup |
| `scripts/real-world-cv-qa-lock.mjs` | 413 | (module) | unknown | no | no | lookup |

```
const exportFinalCvPdf=$('exportFinalCvPdf');
```

### `exportFinalLetterPdf` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `index.html` | 8194 | (module) | unknown | no | yes | lookup |

```
const exportFinalLetterPdf=$('exportFinalLetterPdf');
```

### `exportFinalScore` — LOW (2 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `index.html` | 8289 | previewName | unknown | no | yes | textContent |
| `scripts/product-pass-qa-yoaz.mjs` | 187 | (module) | unknown | no | yes | textContent |

```
exportScoreText:document.getElementById('exportFinalScore')?.textContent?.trim()||'',
```

### `extractionAlertText` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/tests/qa-verify-ui.mjs` | 91 | browserChecks | unknown | no | yes | textContent |

```
const alert = document.getElementById('extractionAlertText')?.textContent?.includes(msg);
```

### `generateBtn` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `index.html` | 5610 | updateGenerateBtnState | unknown | no | yes | lookup |

```
const btn=$('generateBtn');
```

### `hirelyCoreError` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/tests/qa-h4-end-to-end-flow.mjs` | 172 | selectTemplateCard | unknown | no | yes | textContent |

```
banner: document.getElementById('hirelyCoreError')?.textContent?.trim() || '',
```

### `hirelyParserObs` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `index.html` | 3416 | renderParserObservability | unknown | no | yes | lookup |

```
const prev=$('hirelyParserObs');
```

### `hirelyTestDrop` — LOW (2 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/tests/qa-hard-reset-import.mjs` | 54 | main | unknown | no | no | lookup |
| `src/tests/qa-hard-reset-import.mjs` | 91 | main | unknown | no | no | lookup |

```
dropId: document.getElementById('hirelyTestDrop')?.id || null,
```

### `importClickBtn` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/tests/qa-hard-reset-import.mjs` | 53 | main | unknown | no | no | lookup |

```
importButtonId: document.getElementById('importClickBtn')?.id || null,
```

### `importFlowV2ActiveLabel` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/ui/product/import-flow-v2.js` | 142 | (module) | unknown | no | no | lookup |

```
const activeLbl = root.querySelector('#importFlowV2ActiveLabel');
```

### `importFlowV2Extract` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/ui/product/import-flow-v2.js` | 110 | (module) | unknown | no | no | lookup |

```
const panel = root.querySelector('#importFlowV2Extract');
```

### `importFlowV2MacroHint` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/ui/product/import-flow-v2.js` | 111 | (module) | unknown | no | no | lookup |

```
const hintEl = root.querySelector('#importFlowV2MacroHint');
```

### `importPasteFallbackDocx` — LOW (3 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/tests/qa-import-fallback-ux-lock.mjs` | 134 | startServer | unknown | no | yes | textContent |
| `src/tests/qa-import-needs-paste-ui.mjs` | 136 | (module) | unknown | no | yes | textContent |
| `src/tests/qa-pdf-timeout-fallback.mjs` | 147 | startServer | unknown | no | yes | textContent |

```
replaceLabel: document.getElementById('importPasteFallbackDocx')?.textContent?.trim() || '',
```

### `importPasteFallbackFile` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/tests/qa-import-fallback-ux-lock.mjs` | 128 | startServer | unknown | no | yes | textContent |

```
fileName: document.getElementById('importPasteFallbackFile')?.textContent?.trim() || '',
```

### `importPasteFallbackReason` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/tests/qa-import-fallback-ux-lock.mjs` | 130 | startServer | unknown | no | yes | textContent |

```
reason: document.getElementById('importPasteFallbackReason')?.textContent?.trim() || '',
```

### `importPasteFallbackRetryOcr` — LOW (3 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/tests/qa-import-fallback-ux-lock.mjs` | 133 | startServer | unknown | no | yes | textContent |
| `src/tests/qa-import-needs-paste-ui.mjs` | 135 | startServer | unknown | no | yes | textContent |
| `src/tests/qa-pdf-timeout-fallback.mjs` | 146 | startServer | unknown | no | yes | textContent |

```
retryLabel: document.getElementById('importPasteFallbackRetryOcr')?.textContent?.trim() || '',
```

### `importPasteFallbackType` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/tests/qa-import-fallback-ux-lock.mjs` | 129 | startServer | unknown | no | yes | textContent |

```
fileType: document.getElementById('importPasteFallbackType')?.textContent?.trim() || '',
```

### `openPasteCompactBtn` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `src/tests/qa-product-recovery.mjs` | 146 | (module) | unknown | no | no | lookup |

```
const openPasteMissing = await page.evaluate(() => !document.getElementById('openPasteCompactBtn'));
```

### `resetBtn` — LOW (1 refs)

| File | Line | Function | Required? | Exists? | Guarded? | Operation |
|------|------|----------|-----------|---------|----------|-----------|
| `index.html` | 8132 | resetExtractionState | unknown | no | yes | lookup |

```
const resetBtn=$('resetBtn');
```

## Full reference map (all DOM lookups)

| DOM ID | File | Function | Required? | Optional? | Still exists? | Flag |
|--------|------|----------|-----------|-----------|---------------|------|
| `hirelyTestResult` | `src/tests/qa-hard-reset-import.mjs:83` | main |  |  | no | BROKEN_REFERENCE |
| `exportFinalPanel` | `index.html:8288` | previewName |  | yes | no | BROKEN_REFERENCE |
| `exportFinalPanel` | `scripts/product-pass-qa-yoaz.mjs:186` | (module) |  | yes | no | BROKEN_REFERENCE |
| `extractionAlert` | `src/tests/qa-import-silent.mjs:72` | waitForOutcome |  | yes | no | BROKEN_REFERENCE |
| `extractionAlert` | `src/tests/qa-import-silent.mjs:151` | onConsole |  | yes | no | BROKEN_REFERENCE |
| `extractionAlert` | `src/tests/qa-verify-ui.mjs:92` | browserChecks |  | yes | no | BROKEN_REFERENCE |
| `extractionGate` | `src/tests/qa-final-ui-sync-yoaz.mjs:105` | waitImportDone |  | yes | no | BROKEN_REFERENCE |
| `extractionGate` | `src/tests/qa-flow-lock-browser.mjs:141` | waitImportDone |  | yes | no | BROKEN_REFERENCE |
| `extractionGate` | `src/tests/qa-p7-final-lock.mjs:260` | waitImportDone |  | yes | no | BROKEN_REFERENCE |
| `extractionGate` | `src/tests/qa-pdf-acceptance.mjs:273` | uploadAndCapture |  | yes | no | BROKEN_REFERENCE |
| `extractionGate` | `src/tests/qa-product-lock.mjs:92` | waitImportDone |  | yes | no | BROKEN_REFERENCE |
| `extractionGate` | `src/tests/qa-real-user-cv.mjs:174` | waitImportDone |  | yes | no | BROKEN_REFERENCE |
| `extractionGate` | `src/tests/qa-real-visual-browser.mjs:123` | waitImportDone |  | yes | no | BROKEN_REFERENCE |
| `extractionGate` | `src/tests/qa-visual-quality-lock.mjs:126` | waitImportDone |  | yes | no | BROKEN_REFERENCE |
| `extractionGate` | `scripts/final-browser-qa.mjs:120` | waitImportDone |  | yes | no | BROKEN_REFERENCE |
| `extractionGate` | `scripts/real-browser-qa-lock.mjs:146` | waitForImportLive |  | yes | no | BROKEN_REFERENCE |
| `extractionGate` | `scripts/real-world-cv-qa-lock.mjs:98` | waitImportDone |  | yes | no | BROKEN_REFERENCE |
| `extractionGate` | `scripts/visible-qa-yoaz.mjs:77` | waitImportDone |  | yes | no | BROKEN_REFERENCE |
| `hirelyDebugPanel` | `index.html:3272` | renderExtractionDebug |  | yes | no | BROKEN_REFERENCE |
| `hirelyDebugPanel` | `index.html:3365` | renderParserTracePanel |  | yes | no | BROKEN_REFERENCE |
| `hirelyDebugPanel` | `index.html:3400` | renderParserObservability |  | yes | no | BROKEN_REFERENCE |
| `hirelyDebugPanel` | `index.html:8316` | previewName |  | yes | no | BROKEN_REFERENCE |
| `hirelyForensicPanel` | `index.html:1829` | unlockPageUI |  | yes | no | BROKEN_REFERENCE |
| `hirelyForensicPanel` | `index.html:3178` | renderForensicMode |  | yes | no | BROKEN_REFERENCE |
| `hirelyForensicPanel` | `index.html:8319` | previewName |  | yes | no | BROKEN_REFERENCE |
| `hirelyTestImport` | `src/tests/qa-real-product-audit.mjs:242` | (module) |  | yes | no | BROKEN_REFERENCE |
| `hirelyTestImport` | `src/tests/qa-verify-ui.mjs:82` | browserChecks |  | yes | no | BROKEN_REFERENCE |
| `hirelyTestImport` | `src/tests/qa-verify-ui.mjs:148` | browserChecks |  | yes | no | BROKEN_REFERENCE |
| `hirelyTestImport` | `src/tests/qa-verify-ui.mjs:149` | browserChecks |  | yes | no | BROKEN_REFERENCE |
| `importDebugPanel` | `src/ui/product/import-debug-panel.js:90` | (module) |  | yes | no | BROKEN_REFERENCE |
| `letterText` | `index.html:6873` | renderCoverLetterPreview |  | yes | no | BROKEN_REFERENCE |
| `letterText` | `index.html:7028` | renderOutputs |  | yes | no | BROKEN_REFERENCE |
| `letterText` | `index.html:7068` | renderOutputs |  | yes | no | BROKEN_REFERENCE |
| `letterText` | `index.html:7072` | renderOutputs |  | yes | no | BROKEN_REFERENCE |
| `letterText` | `index.html:8229` | name |  | yes | no | BROKEN_REFERENCE |
| `linkedinText` | `index.html:7027` | renderOutputs |  | yes | no | BROKEN_REFERENCE |
| `linkedinText` | `index.html:7060` | renderOutputs |  | yes | no | BROKEN_REFERENCE |
| `rawDetails` | `index.html:8122` | resetExtractionState |  | yes | no | BROKEN_REFERENCE |
| `rawDetails` | `src/tests/qa-import-silent.mjs:71` | waitForOutcome |  | yes | no | BROKEN_REFERENCE |
| `rawDetails` | `src/tests/qa-import-silent.mjs:150` | onConsole |  | yes | no | BROKEN_REFERENCE |
| `resultFlow` | `index.html:5518` | updateResultFlow |  | yes | no | BROKEN_REFERENCE |
| `templateGallery` | `index.html:1970` | resetImportWorkspaceForFallback |  | yes | no | BROKEN_REFERENCE |
| `templateGallery` | `src/tests/qa-ocr-browser-smoke.mjs:160` | (module) |  | yes | no | BROKEN_REFERENCE |
| `cvA4MeasureHost` | `src/ui/export/cv-a4-pages.js:92` | (module) |  |  | no | BROKEN_REFERENCE |
| `cvA4MeasureHost` | `src/ui/export/cv-a4-pages.js:378` | (module) |  |  | no | BROKEN_REFERENCE |
| `exportBackToTemplatesBtn` | `src/tests/qa-export-page-full-preview.mjs:128` | setStep |  |  | no | BROKEN_REFERENCE |
| `exportFinalCopyCv` | `index.html:8196` | (module) |  |  | no | BROKEN_REFERENCE |
| `exportFinalCvPdf` | `index.html:8192` | (module) |  |  | no | BROKEN_REFERENCE |
| `exportFinalCvPdf` | `scripts/real-world-cv-qa-lock.mjs:171` | normKey |  |  | no | BROKEN_REFERENCE |
| `exportFinalCvPdf` | `scripts/real-world-cv-qa-lock.mjs:413` | (module) |  |  | no | BROKEN_REFERENCE |
| `exportFinalLetterPdf` | `index.html:8194` | (module) |  |  | no | BROKEN_REFERENCE |
| `exportFinalScore` | `index.html:8289` | previewName |  |  | no | BROKEN_REFERENCE |
| `exportFinalScore` | `scripts/product-pass-qa-yoaz.mjs:187` | (module) |  |  | no | BROKEN_REFERENCE |
| `extractionAlertText` | `src/tests/qa-verify-ui.mjs:91` | browserChecks |  |  | no | BROKEN_REFERENCE |
| `generateBtn` | `index.html:5610` | updateGenerateBtnState |  |  | no | BROKEN_REFERENCE |
| `hirelyCoreError` | `src/tests/qa-h4-end-to-end-flow.mjs:172` | selectTemplateCard |  |  | no | BROKEN_REFERENCE |
| `hirelyParserObs` | `index.html:3416` | renderParserObservability |  |  | no | BROKEN_REFERENCE |
| `hirelyTestDrop` | `src/tests/qa-hard-reset-import.mjs:54` | main |  |  | no | BROKEN_REFERENCE |
| `hirelyTestDrop` | `src/tests/qa-hard-reset-import.mjs:91` | main |  |  | no | BROKEN_REFERENCE |
| `hirelyTestResult` | `index.html:7872` | showTestImportFile |  |  | no | BROKEN_REFERENCE |
| `hirelyTestResult` | `src/tests/qa-hard-reset-import.mjs:55` | main |  |  | no | BROKEN_REFERENCE |
| `hirelyTestResult` | `src/tests/qa-hard-reset-import.mjs:72` | main |  |  | no | BROKEN_REFERENCE |
| `hirelyTestResult` | `src/tests/qa-hard-reset-import.mjs:93` | main |  |  | no | BROKEN_REFERENCE |
| `importClickBtn` | `src/tests/qa-hard-reset-import.mjs:53` | main |  |  | no | BROKEN_REFERENCE |
| `importFlowV2ActiveLabel` | `src/ui/product/import-flow-v2.js:142` | (module) |  |  | no | BROKEN_REFERENCE |
| `importFlowV2Extract` | `src/ui/product/import-flow-v2.js:110` | (module) |  |  | no | BROKEN_REFERENCE |
| `importFlowV2MacroHint` | `src/ui/product/import-flow-v2.js:111` | (module) |  |  | no | BROKEN_REFERENCE |
| `importPasteFallbackDocx` | `src/tests/qa-import-fallback-ux-lock.mjs:134` | startServer |  |  | no | BROKEN_REFERENCE |
| `importPasteFallbackDocx` | `src/tests/qa-import-needs-paste-ui.mjs:136` | (module) |  |  | no | BROKEN_REFERENCE |
| `importPasteFallbackDocx` | `src/tests/qa-pdf-timeout-fallback.mjs:147` | startServer |  |  | no | BROKEN_REFERENCE |
| `importPasteFallbackFile` | `src/tests/qa-import-fallback-ux-lock.mjs:128` | startServer |  |  | no | BROKEN_REFERENCE |
| `importPasteFallbackReason` | `src/tests/qa-import-fallback-ux-lock.mjs:130` | startServer |  |  | no | BROKEN_REFERENCE |
| `importPasteFallbackRetryOcr` | `src/tests/qa-import-fallback-ux-lock.mjs:133` | startServer |  |  | no | BROKEN_REFERENCE |
| `importPasteFallbackRetryOcr` | `src/tests/qa-import-needs-paste-ui.mjs:135` | startServer |  |  | no | BROKEN_REFERENCE |
| `importPasteFallbackRetryOcr` | `src/tests/qa-pdf-timeout-fallback.mjs:146` | startServer |  |  | no | BROKEN_REFERENCE |
| `importPasteFallbackType` | `src/tests/qa-import-fallback-ux-lock.mjs:129` | startServer |  |  | no | BROKEN_REFERENCE |
| `openPasteCompactBtn` | `src/tests/qa-product-recovery.mjs:146` | (module) |  |  | no | BROKEN_REFERENCE |
| `resetBtn` | `index.html:8132` | resetExtractionState |  |  | no | BROKEN_REFERENCE |
| `a4OverflowWarn` | `src/tests/qa-a4-pagination.mjs:95` | text |  |  | yes |  |
| `a4OverflowWarn` | `src/ui/export/a4-viewport.js:175` | (module) |  |  | yes |  |
| `a4Viewport` | `src/ui/export/a4-viewport.js:170` | (module) |  |  | yes |  |
| `a4Viewport` | `src/ui/export/a4-viewport.js:357` | schedule |  |  | yes |  |
| `a4Viewport` | `scripts/cv-preview-readability-report.mjs:109` | main |  |  | yes |  |
| `a4Viewport` | `scripts/hirely-final-repair-qa.mjs:188` | add |  |  | yes |  |
| `a4Viewport` | `scripts/product-pass-qa-yoaz.mjs:116` | main |  |  | yes |  |
| `a4ZoomBar` | `index.html:4996` | renderA4ZoomBar |  |  | yes |  |
| `a4ZoomBar` | `src/tests/qa-export-page-full-preview.mjs:110` | setStep |  |  | yes |  |
| `a4ZoomBar` | `src/ui/export/a4-viewport.js:176` | (module) |  |  | yes |  |
| `app` | `index.html:1863` | ensureImportNeedsPasteVisible | yes |  | yes |  |
| `app` | `index.html:2009` | ensureImportReviewVisible | yes |  | yes |  |
| `app` | `index.html:2100` | setImportLoadingUx | yes |  | yes |  |
| `app` | `index.html:2136` | endImportLoadingUx | yes |  | yes |  |
| `app` | `index.html:4497` | setLoadingPhase | yes |  | yes |  |
| `app` | `index.html:5385` | applyCvPipeline | yes |  | yes |  |
| `app` | `index.html:5549` | setWorkspaceReady | yes |  | yes |  |
| `app` | `src/tests/qa-flow-lock-browser.mjs:140` | waitImportDone | yes |  | yes |  |
| `app` | `src/tests/qa-flow-lock-browser.mjs:196` | cvText | yes |  | yes |  |
| `app` | `src/ui/hirely-wow-factor.js:28` | (module) | yes |  | yes |  |
| `app` | `src/ui/hirely-wow-factor.js:55` | (module) | yes |  | yes |  |
| `app` | `src/ui/hirely-wow-factor.js:205` | (module) | yes |  | yes |  |
| `app` | `scripts/qa-boot-regression.mjs:198` | runOptionalDomScenario | yes |  | yes |  |
| `app` | `scripts/real-browser-qa-lock.mjs:108` | collectUiSnap | yes |  | yes |  |
| `app` | `scripts/test-boot-fix.mjs:81` | main | yes |  | yes |  |
| `copyLetterBtn` | `index.html:8200` | (module) |  |  | yes |  |
| `coverLetterPreview` | `index.html:6872` | renderCoverLetterPreview |  |  | yes |  |
| `coverLetterPreview` | `index.html:6931` | generateCoverLetterNow |  |  | yes |  |
| `coverLetterPreview` | `index.html:6999` | ready |  |  | yes |  |
| `coverLetterPreview` | `index.html:8202` | (module) |  |  | yes |  |
| `coverLetterPreview` | `index.html:8208` | (module) |  |  | yes |  |
| `coverLetterPreview` | `index.html:8215` | name |  |  | yes |  |
| `coverLetterPreview` | `index.html:8227` | name |  |  | yes |  |
| `coverLetterPreview` | `src/tests/qa-export-lock.mjs:290` | (module) |  |  | yes |  |
| `coverLetterPreview` | `src/tests/qa-h4-end-to-end-flow.mjs:357` | vis |  |  | yes |  |
| `coverLetterPreview` | `src/tests/qa-h5-cover-letter-product.mjs:216` | vis |  |  | yes |  |
| `coverLetterPreview` | `src/tests/qa-h5-cover-letter-product.mjs:237` | vis |  |  | yes |  |
| `coverLetterPreview` | `src/tests/qa-h5-cover-letter-product.mjs:286` | (module) |  |  | yes |  |
| `coverLetterPreview` | `src/tests/qa-h5-cover-letter-product.mjs:316` | (module) |  |  | yes |  |
| `coverLetterPreview` | `src/tests/qa-p7-final-lock.mjs:715` | vis |  |  | yes |  |
| `coverLetterWorkspace` | `index.html:6989` | syncCoverLetterWorkspace |  | yes | yes |  |
| `coverLetterWorkspace` | `index.html:7010` | openCoverLetterWorkspace |  | yes | yes |  |
| `coverLetterWorkspace` | `index.html:7035` | renderOutputs |  | yes | yes |  |
| `coverLetterWorkspace` | `src/tests/qa-export-page-fix.mjs:120` | main |  | yes | yes |  |
| `coverLetterWorkspace` | `src/tests/qa-final-reset.mjs:113` | rawLen |  | yes | yes |  |
| `coverLetterWorkspace` | `src/tests/qa-h4-end-to-end-flow.mjs:329` | (module) |  | yes | yes |  |
| `coverLetterWorkspace` | `src/tests/qa-h5-cover-letter-product.mjs:187` | vis |  | yes | yes |  |
| `coverLetterWorkspace` | `src/tests/qa-p7-final-lock.mjs:682` | (module) |  | yes | yes |  |
| `coverLetterWorkspace` | `scripts/product-pass-qa-yoaz.mjs:185` | (module) |  | yes | yes |  |
| `cvDoc` | `index.html:1821` | unlockPageUI |  | yes | yes |  |
| `cvDoc` | `index.html:1874` | cvPreviewIsLive |  | yes | yes |  |
| `cvDoc` | `index.html:1961` | resetImportWorkspaceForFallback |  | yes | yes |  |
| `cvDoc` | `index.html:2756` | isExportReady |  | yes | yes |  |
| `cvDoc` | `index.html:2842` | renderReviewStudioV2 |  | yes | yes |  |
| `cvDoc` | `index.html:3154` | captureForensicRenderInput |  | yes | yes |  |
| `cvDoc` | `index.html:3182` | renderForensicMode |  | yes | yes |  |
| `cvDoc` | `index.html:3379` | renderParserTracePanel |  | yes | yes |  |
| `cvDoc` | `index.html:4817` | captureProductionImportTrace |  | yes | yes |  |
| `cvDoc` | `index.html:5017` | ensureExportPreviewRendered |  | yes | yes |  |
| `cvDoc` | `index.html:5135` | applyImportResult |  | yes | yes |  |
| `cvDoc` | `index.html:5777` | applyCvReveal |  | yes | yes |  |
| `cvDoc` | `index.html:5997` | prepareLockedCvExport |  | yes | yes |  |
| `cvDoc` | `index.html:6401` | layoutCvA4WhenReady |  | yes | yes |  |
| `cvDoc` | `index.html:6588` | renderCVInner |  | yes | yes |  |
| `cvDoc` | `index.html:6699` | (module) |  | yes | yes |  |
| `cvDoc` | `index.html:6951` | applyCvPreviewFieldEdits |  | yes | yes |  |
| `cvDoc` | `index.html:7673` | downloadPDF |  | yes | yes |  |
| `cvDoc` | `index.html:7783` | emailCV |  | yes | yes |  |
| `cvDoc` | `index.html:8273` | previewName |  | yes | yes |  |
| `cvDoc` | `index.html:8284` | previewName |  | yes | yes |  |
| `cvDoc` | `index.html:8290` | previewName |  | yes | yes |  |
| `cvDoc` | `src/tests/pdf-export-qa.mjs:253` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-clear-flow-navigation.mjs:58` | waitForCv |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-detection-panel-consistency.mjs:113` | runPasteFallbackImport |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-detection-panel-consistency.mjs:123` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-detection-panel-consistency.mjs:126` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-detection-panel-consistency.mjs:217` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-end-to-end-flow-audit.mjs:94` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-export-lock.mjs:94` | waitForCv |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-export-lock.mjs:279` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-export-lock.mjs:301` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-export-page-fix.mjs:60` | waitForCv |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-export-page-fix.mjs:115` | main |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-export-page-full-preview.mjs:59` | waitForCv |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-export-page-full-preview.mjs:106` | setStep |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-extraction-quality-step.mjs:71` | waitForCv |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-final-pdf-export-lock.mjs:192` | exportBlob |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-final-pdf-export-lock.mjs:199` | exportBlob |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-final-reset.mjs:70` | waitForBoot |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-final-reset.mjs:77` | plain |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-final-ui-sync-yoaz.mjs:102` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-final-ui-sync-yoaz.mjs:159` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-final-ui-sync-yoaz.mjs:160` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-flow-lock-browser.mjs:137` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-flow-lock-browser.mjs:189` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-format-support-audit.mjs:273` | verifyPasteFallbackUi |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-full-import-pdf.mjs:114` | ok |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-full-import-pdf.mjs:131` | ok |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-h4-end-to-end-flow.mjs:94` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-h4-end-to-end-flow.mjs:200` | vis |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-h4-end-to-end-flow.mjs:244` | vis |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-h4-end-to-end-flow.mjs:266` | vis |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-h5-cover-letter-product.mjs:84` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-h6-product-polish.mjs:166` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-import-fallback-ux-lock.mjs:138` | startServer |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-import-fallback-ux-lock.mjs:140` | startServer |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-import-fallback-ux-lock.mjs:176` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-import-fallback-ux-lock.mjs:177` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-import-fallback-ux-lock.mjs:186` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-import-fallback-ux-lock.mjs:187` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-import-needs-paste-ui.mjs:206` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-import-needs-paste-ui.mjs:219` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-import-needs-paste-ui.mjs:220` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-import-reality-check.mjs:271` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-import-reality-check.mjs:345` | ext |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-import-silent.mjs:69` | waitForOutcome |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-import-silent.mjs:148` | onConsole |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-import-silent.mjs:149` | onConsole |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-mvp-recovery.mjs:64` | waitForCv |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-mvp-recovery.mjs:125` | onConsole |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-mvp-recovery.mjs:254` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-mvp-recovery.mjs:259` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-mvp-recovery.mjs:272` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-ocr-browser-smoke.mjs:157` | runSmoke |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-ocr-browser-smoke.mjs:163` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-p7-final-lock.mjs:256` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-p7-final-lock.mjs:306` | getCvPreviewText |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-p7-final-lock.mjs:311` | getA4Snapshot |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-p7-final-lock.mjs:729` | vis |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-pdf-acceptance.mjs:367` | main |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-pdf-acceptance.mjs:368` | main |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-pdf-acceptance.mjs:396` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-pdf-export-audit.mjs:167` | exportViaHtml2pdf |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-pdf-export-audit.mjs:172` | exportViaHtml2pdf |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-pdf-import-acceptance-yoaz.mjs:128` | log |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-pdf-timeout-fallback.mjs:174` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-pdf-timeout-fallback.mjs:186` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-pdf-timeout-fallback.mjs:187` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-product-lock.mjs:89` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-product-lock.mjs:165` | classifyFirstToExperience |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-product-recovery.mjs:52` | main |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-product-recovery.mjs:77` | main |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-cv-benchmark-pack.mjs:126` | runBenchmarkCase |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-cv-benchmark-pack.mjs:179` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-format-qa.mjs:283` | runBrowserStuckCheck |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-product-audit.mjs:110` | step |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-product-audit.mjs:129` | step |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-product-audit.mjs:150` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-product-audit.mjs:196` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-product-audit.mjs:216` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-product-audit.mjs:253` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-user-cv.mjs:154` | run |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-user-cv.mjs:171` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-user-cv.mjs:175` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-user-cv.mjs:297` | collectBrowserSnapshot |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-user-cv.mjs:399` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-user-cv.mjs:418` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-visual-browser.mjs:110` | runPasteFallbackImport |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-visual-browser.mjs:120` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-visual-browser.mjs:124` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-visual-browser.mjs:202` | renderExportTemplate |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-visual-browser.mjs:214` | collectVisualSnapshot |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-world-import-truth.mjs:166` | runImportOnPage |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-real-world-import-truth.mjs:257` | ext |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-review-consistency.mjs:157` | runBrowserTests |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-review-consistency.mjs:177` | runBrowserTests |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-review-consistency.mjs:196` | runBrowserTests |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-single-source-of-truth.mjs:66` | waitForCv |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-template-section-order.mjs:98` | runPasteFallbackImport |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-template-section-order.mjs:107` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-template-section-order.mjs:110` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-template-section-order.mjs:168` | auditTemplate |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-template-section-order.mjs:176` | auditTemplate |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-template-v1-selector.mjs:70` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-template-v1-selector.mjs:111` | getPickerSnapshot |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-template-v1-selector.mjs:175` | getPickerSnapshot |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-template-v1-selector.mjs:213` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-template-v1-selector.mjs:236` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-template-v1-selector.mjs:269` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-truth-test.mjs:207` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-truth-test.mjs:208` | (module) |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-truth-test.mjs:299` | hasExp |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-verify-ui.mjs:108` | browserChecks |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-verify-ui.mjs:132` | browserChecks |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-visual-quality-lock.mjs:113` | runPasteFallbackImport |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-visual-quality-lock.mjs:123` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-visual-quality-lock.mjs:127` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-visual-quality-lock.mjs:203` | renderTemplateExport |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-visual-quality-lock.mjs:214` | collectVisualDomSnapshot |  | yes | yes |  |
| `cvDoc` | `src/tests/qa-zero-raw-ocr.mjs:116` | browserCheck |  | yes | yes |  |
| `cvDoc` | `src/tests/test-ocr-quality.mjs:201` | (module) |  | yes | yes |  |
| `cvDoc` | `src/ui/export/a4-viewport.js:174` | (module) |  | yes | yes |  |
| `cvDoc` | `src/ui/runtime/dom-safe.js:27` | (module) |  | yes | yes |  |
| `cvDoc` | `scripts/collapsible-editor-panel-report.mjs:87` | main |  | yes | yes |  |
| `cvDoc` | `scripts/contact-consistency-report.mjs:134` | main |  | yes | yes |  |
| `cvDoc` | `scripts/cv-preview-readability-report.mjs:94` | main |  | yes | yes |  |
| `cvDoc` | `scripts/cv-preview-readability-report.mjs:165` | (module) |  | yes | yes |  |
| `cvDoc` | `scripts/diagnose-real-pdf-import.mjs:119` | (module) |  | yes | yes |  |
| `cvDoc` | `scripts/diagnose-real-pdf-import.mjs:120` | (module) |  | yes | yes |  |
| `cvDoc` | `scripts/final-acceptance-test.mjs:281` | addCheck |  | yes | yes |  |
| `cvDoc` | `scripts/final-acceptance-test.mjs:282` | addCheck |  | yes | yes |  |
| `cvDoc` | `scripts/final-acceptance-test.mjs:389` | (module) |  | yes | yes |  |
| `cvDoc` | `scripts/final-browser-qa.mjs:117` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `scripts/final-browser-qa.mjs:121` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `scripts/final-browser-qa.mjs:178` | collectSnap |  | yes | yes |  |
| `cvDoc` | `scripts/hirely-final-repair-qa.mjs:195` | add |  | yes | yes |  |
| `cvDoc` | `scripts/hirely-final-repair-qa.mjs:332` | checklistOk |  | yes | yes |  |
| `cvDoc` | `scripts/open-export-preview.mjs:20` | (module) |  | yes | yes |  |
| `cvDoc` | `scripts/product-pass-qa-yoaz.mjs:130` | (module) |  | yes | yes |  |
| `cvDoc` | `scripts/production-reality-audit.mjs:74` | importPdf |  | yes | yes |  |
| `cvDoc` | `scripts/production-reality-audit.mjs:90` | importPdf |  | yes | yes |  |
| `cvDoc` | `scripts/qa-boot-regression.mjs:200` | runOptionalDomScenario |  | yes | yes |  |
| `cvDoc` | `scripts/qa-final-boot-dom-contract.mjs:112` | main |  | yes | yes |  |
| `cvDoc` | `scripts/real-browser-qa-lock.mjs:92` | collectUiSnap |  | yes | yes |  |
| `cvDoc` | `scripts/real-world-cv-qa-lock.mjs:95` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `scripts/real-world-cv-qa-lock.mjs:99` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `scripts/real-world-cv-qa-lock.mjs:158` | normKey |  | yes | yes |  |
| `cvDoc` | `scripts/review-queue-quality-report.mjs:173` | (module) |  | yes | yes |  |
| `cvDoc` | `scripts/test-boot-fix.mjs:83` | main |  | yes | yes |  |
| `cvDoc` | `scripts/test-template-gallery-position.mjs:78` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `scripts/test-template-gallery-position.mjs:130` | isVisible |  | yes | yes |  |
| `cvDoc` | `scripts/test-template-gallery-position.mjs:182` | follows |  | yes | yes |  |
| `cvDoc` | `scripts/test-template-gallery-position.mjs:199` | follows |  | yes | yes |  |
| `cvDoc` | `scripts/test-template-gallery-position.mjs:200` | follows |  | yes | yes |  |
| `cvDoc` | `scripts/ui-scale-screenshots.mjs:47` | waitForCv |  | yes | yes |  |
| `cvDoc` | `scripts/visible-qa-yoaz.mjs:74` | waitImportDone |  | yes | yes |  |
| `cvDoc` | `scripts/visible-qa-yoaz.mjs:200` | (module) |  | yes | yes |  |
| `cvDocWrap` | `index.html:5769` | pulseCvDoc |  |  | yes |  |
| `cvDocWrap` | `index.html:6685` | (module) |  |  | yes |  |
| `cvDocWrap` | `index.html:6740` | apply |  |  | yes |  |
| `cvExportBar` | `index.html:2929` | setDocStep |  |  | yes |  |
| `cvExportBar` | `index.html:5502` | showExtractionGate |  |  | yes |  |
| `cvExportBar` | `index.html:5565` | setWorkspaceReady |  |  | yes |  |
| `cvExportBar` | `index.html:8123` | resetExtractionState |  |  | yes |  |
| `cvExportBar` | `src/tests/qa-clear-flow-navigation.mjs:143` | main |  |  | yes |  |
| `cvExportBar` | `src/tests/qa-export-page-fix.mjs:117` | main |  |  | yes |  |
| `cvExportBar` | `src/tests/qa-export-page-full-preview.mjs:108` | setStep |  |  | yes |  |
| `cvExportBar` | `scripts/qa-no-regression-repair.mjs:184` | vis |  |  | yes |  |
| `cvExportBar` | `scripts/qa-no-regression-repair.mjs:236` | vis |  |  | yes |  |
| `cvExportBar` | `scripts/qa-p0-subtraction.mjs:78` | forceDocStep |  |  | yes |  |
| `cvExportBar` | `scripts/qa-ui-scale-fix.mjs:55` | forceDocStep |  |  | yes |  |
| `cvExportBar` | `scripts/real-world-cv-qa-lock.mjs:414` | (module) |  |  | yes |  |
| `cvHeaderBar` | `index.html:6058` | renderCvHeaderBar |  |  | yes |  |
| `cvHeaderBar` | `scripts/product-pass-qa-yoaz.mjs:129` | (module) |  |  | yes |  |
| `cvHeaderBarMeta` | `index.html:6065` | renderCvHeaderBar |  |  | yes |  |
| `cvHeaderBarName` | `index.html:6064` | renderCvHeaderBar |  |  | yes |  |
| `cvHeaderBarName` | `index.html:8179` | (module) |  |  | yes |  |
| `cvHeaderEditBtn` | `index.html:8173` | (module) |  |  | yes |  |
| `cvHeaderEditDialog` | `index.html:6082` | openCvHeaderEditDialog |  |  | yes |  |
| `cvHeaderEditDialog` | `index.html:6111` | applyCvHeaderEdit |  |  | yes |  |
| `cvHeaderEditDialog` | `index.html:8178` | (module) |  |  | yes |  |
| `cvIncompleteBanner` | `index.html:4027` | renderCvIncompleteBanner |  |  | yes |  |
| `cvLang` | `index.html:6467` | sectionLabel |  |  | yes |  |
| `cvLang` | `index.html:6825` | letterLang |  |  | yes |  |
| `cvLang` | `index.html:8153` | resetExtractionState |  |  | yes |  |
| `cvLoadingLabel` | `index.html:2086` | setImportLoadingUx |  |  | yes |  |
| `cvLoadingLabel` | `index.html:4501` | setLoadingPhase |  |  | yes |  |
| `cvLoadingLabel` | `index.html:5765` | setCvLoading |  |  | yes |  |
| `cvLoadingLabel` | `index.html:7692` | downloadPDF |  |  | yes |  |
| `cvLoadingLabel` | `index.html:7789` | suggested |  |  | yes |  |
| `cvPreview` | `src/ui/runtime/dom-safe.js:27` | (module) | yes |  | yes |  |
| `cvReviewMissing` | `index.html:6177` | renderCvReviewPanel |  |  | yes |  |
| `cvReviewMissing` | `index.html:6190` | renderCvReviewPanel |  |  | yes |  |
| `cvReviewStrengths` | `index.html:6175` | renderCvReviewPanel |  |  | yes |  |
| `cvReviewStrengths` | `index.html:6188` | renderCvReviewPanel |  |  | yes |  |
| `cvReviewWeaknesses` | `index.html:6176` | renderCvReviewPanel |  |  | yes |  |
| `cvReviewWeaknesses` | `index.html:6189` | renderCvReviewPanel |  |  | yes |  |
| `cvReviewWeaknesses` | `scripts/contact-consistency-report.mjs:150` | (module) |  |  | yes |  |
| `cvSkeleton` | `index.html:1930` | renderOcrFailureCleanPreview |  |  | yes |  |
| `cvSkeleton` | `index.html:1963` | resetImportWorkspaceForFallback |  |  | yes |  |
| `cvSkeleton` | `index.html:5761` | setCvLoading |  |  | yes |  |
| `cvSkeleton` | `index.html:7693` | downloadPDF |  |  | yes |  |
| `cvSkeleton` | `index.html:7790` | suggested |  |  | yes |  |
| `cvStage` | `index.html:5029` | ensureExportPreviewRendered |  |  | yes |  |
| `cvStage` | `src/tests/qa-clear-flow-navigation.mjs:153` | (module) |  |  | yes |  |
| `cvStage` | `src/tests/qa-export-page-fix.mjs:116` | main |  |  | yes |  |
| `cvStage` | `src/tests/qa-export-page-full-preview.mjs:107` | setStep |  |  | yes |  |
| `cvStage` | `src/tests/qa-import-fallback-ux-lock.mjs:139` | startServer |  |  | yes |  |
| `cvStage` | `src/tests/qa-p7-final-lock.mjs:312` | getA4Snapshot |  |  | yes |  |
| `cvStage` | `src/ui/export/a4-viewport.js:173` | (module) |  |  | yes |  |
| `cvStage` | `src/ui/export/a4-viewport.js:348` | (module) |  |  | yes |  |
| `cvStage` | `scripts/collapsible-editor-panel-report.mjs:100` | main |  |  | yes |  |
| `cvStage` | `scripts/cv-preview-readability-report.mjs:108` | main |  |  | yes |  |
| `cvStage` | `scripts/hirely-final-repair-qa.mjs:190` | add |  |  | yes |  |
| `cvStageWrap` | `index.html:1888` | hideImportPasteFallback |  |  | yes |  |
| `cvStageWrap` | `index.html:2247` | showImportPasteFallback |  |  | yes |  |
| `cvStageWrap` | `index.html:5760` | setCvLoading |  |  | yes |  |
| `cvStageWrap` | `src/tests/qa-h4-end-to-end-flow.mjs:96` | waitImportDone |  |  | yes |  |
| `cvStageWrap` | `src/tests/qa-import-fallback-ux-lock.mjs:135` | startServer |  |  | yes |  |
| `cvStageWrap` | `src/tests/qa-import-needs-paste-ui.mjs:112` | startServer |  |  | yes |  |
| `cvStageWrap` | `src/tests/qa-import-needs-paste-ui.mjs:128` | startServer |  |  | yes |  |
| `cvStageWrap` | `src/tests/qa-p7-final-lock.mjs:259` | waitImportDone |  |  | yes |  |
| `cvStageWrap` | `src/tests/qa-p7-final-lock.mjs:299` | getDegradedSnapshot |  |  | yes |  |
| `cvStageWrap` | `src/tests/qa-pdf-ocr-ux-progress.mjs:130` | startServer |  |  | yes |  |
| `cvStageWrap` | `src/tests/qa-pdf-timeout-fallback.mjs:123` | startServer |  |  | yes |  |
| `cvStageWrap` | `src/tests/qa-pdf-timeout-fallback.mjs:141` | startServer |  |  | yes |  |
| `cvText` | `index.html:1946` | renderOcrFailureCleanPreview |  |  | yes |  |
| `cvText` | `index.html:2272` | showImportPasteFallback |  |  | yes |  |
| `cvText` | `index.html:2293` | showImportRenderFallback |  |  | yes |  |
| `cvText` | `index.html:4675` | hasValidInput |  |  | yes |  |
| `cvText` | `index.html:4742` | expCount |  |  | yes |  |
| `cvText` | `index.html:5319` | (module) |  |  | yes |  |
| `cvText` | `index.html:5414` | extractionGateChoosePaste |  |  | yes |  |
| `cvText` | `index.html:5453` | canScoreCV |  |  | yes |  |
| `cvText` | `index.html:5612` | text |  |  | yes |  |
| `cvText` | `index.html:5648` | computeRecruiterScores |  |  | yes |  |
| `cvText` | `index.html:6546` | ensureStateCvData |  |  | yes |  |
| `cvText` | `index.html:6556` | showPdfPasteFallback |  |  | yes |  |
| `cvText` | `index.html:6608` | renderCVInner |  |  | yes |  |
| `cvText` | `index.html:7138` | run |  |  | yes |  |
| `cvText` | `index.html:7171` | showPdfScannedFallback |  |  | yes |  |
| `cvText` | `index.html:7855` | openPaste |  |  | yes |  |
| `cvText` | `index.html:7908` | heroUpload |  |  | yes |  |
| `cvText` | `index.html:8091` | resetExtractionState |  |  | yes |  |
| `cvText` | `index.html:8135` | resetExtractionState |  |  | yes |  |
| `cvText` | `src/core/parsing/rich-parser.js:817` | base |  |  | yes |  |
| `cvText` | `src/tests/qa-mvp-recovery.mjs:104` | onConsole |  |  | yes |  |
| `cvText` | `src/tests/qa-real-product-audit.mjs:102` | step |  |  | yes |  |
| `detectedChecklist` | `index.html:4112` | renderDetectedChecklist |  |  | yes |  |
| `detectedDetails` | `index.html:2919` | setDocStep |  |  | yes |  |
| `detectedDetails` | `index.html:5817` | updateDetected |  |  | yes |  |
| `detectedDetails` | `index.html:8121` | resetExtractionState |  |  | yes |  |
| `detectedSummary` | `index.html:5820` | updateDetected |  |  | yes |  |
| `detectedSummary` | `index.html:5833` | clientN |  |  | yes |  |
| `docNav` | `index.html:3019` | renderProgressNav | yes |  | yes |  |
| `docNav` | `index.html:5569` | setWorkspaceReady | yes |  | yes |  |
| `docNav` | `src/tests/qa-pdf-acceptance.mjs:339` | main | yes |  | yes |  |
| `docNav` | `scripts/qa-boot-regression.mjs:201` | runOptionalDomScenario | yes |  | yes |  |
| `docNav` | `scripts/qa-no-regression-repair.mjs:158` | run | yes |  | yes |  |
| `docNav` | `scripts/test-boot-fix.mjs:84` | main | yes |  | yes |  |
| `downloadBtn` | `index.html:2843` | renderReviewStudioV2 |  |  | yes |  |
| `downloadBtn` | `src/tests/qa-clear-flow-navigation.mjs:151` | main |  |  | yes |  |
| `downloadBtn` | `src/tests/qa-export-page-fix.mjs:134` | main |  |  | yes |  |
| `downloadBtn` | `src/tests/qa-export-page-full-preview.mjs:127` | setStep |  |  | yes |  |
| `downloadBtn` | `scripts/qa-no-regression-repair.mjs:249` | vis |  |  | yes |  |
| `downloadBtn` | `scripts/real-browser-qa-lock.mjs:95` | collectUiSnap |  |  | yes |  |
| `downloadBtn` | `scripts/real-world-cv-qa-lock.mjs:170` | normKey |  |  | yes |  |
| `downloadBtn` | `scripts/real-world-cv-qa-lock.mjs:412` | (module) |  |  | yes |  |
| `downloadLetterBtn` | `index.html:8206` | (module) |  |  | yes |  |
| `downloadLetterPdfBtn` | `index.html:8195` | (module) |  |  | yes |  |
| `downloadLetterPdfBtn` | `index.html:8213` | name |  |  | yes |  |
| `downloadLetterPdfBtn` | `src/tests/qa-h4-end-to-end-flow.mjs:370` | vis |  |  | yes |  |
| `drop` | `index.html:1847` | ensureImportNeedsPasteVisible | yes |  | yes |  |
| `drop` | `index.html:2354` | setImportPipelineBusy | yes |  | yes |  |
| `drop` | `index.html:7573` | bindVerifiedImportHandlers | yes |  | yes |  |
| `drop` | `index.html:7575` | bindVerifiedImportHandlers | yes |  | yes |  |
| `drop` | `src/tests/qa-import-silent.mjs:121` | onConsole | yes |  | yes |  |
| `drop` | `src/ui/hirely-wow-factor.js:35` | (module) | yes |  | yes |  |
| `drop` | `src/ui/hirely-wow-factor.js:44` | (module) | yes |  | yes |  |
| `drop` | `scripts/final-browser-qa.mjs:221` | checkUploadClickable | yes |  | yes |  |
| `drop` | `scripts/local-ocr-csp-fix-report.mjs:210` | (module) | yes |  | yes |  |
| `drop` | `scripts/qa-final-boot-dom-contract.mjs:111` | main | yes |  | yes |  |
| `drop` | `scripts/qa-no-regression-repair.mjs:128` | run | yes |  | yes |  |
| `emptyPasteBtn` | `index.html:6619` | renderCVInner |  |  | yes |  |
| `emptyPasteBtn` | `index.html:6646` | renderCVInner |  |  | yes |  |
| `emptyRecoveryFixBtn` | `index.html:6629` | renderCVInner |  |  | yes |  |
| `emptySampleBtn` | `index.html:6645` | renderCVInner |  |  | yes |  |
| `exportMoreBtn` | `src/ui/product/p0-subtraction.js:6` | (module) |  |  | yes |  |
| `exportMoreMenu` | `src/ui/product/p0-subtraction.js:7` | (module) |  |  | yes |  |
| `exportStepHead` | `index.html:5044` | syncResumeStudioChrome |  |  | yes |  |
| `exportStepHead` | `src/tests/qa-clear-flow-navigation.mjs:149` | main |  |  | yes |  |
| `exportStepHead` | `src/tests/qa-export-page-fix.mjs:118` | main |  |  | yes |  |
| `exportStepHead` | `src/tests/qa-export-page-full-preview.mjs:109` | setStep |  |  | yes |  |
| `exportStepTemplateName` | `index.html:5003` | syncExportStepHead |  |  | yes |  |
| `exportStepTemplateName` | `src/tests/qa-export-page-fix.mjs:119` | main |  |  | yes |  |
| `exportStepTemplateName` | `src/tests/qa-export-page-full-preview.mjs:120` | setStep |  |  | yes |  |
| `extractionQualityList` | `index.html:2962` | renderExtractionQualityStep |  |  | yes |  |
| `extractionQualityList` | `src/tests/qa-detection-panel-consistency.mjs:216` | importCv |  |  | yes |  |
| `extractionQualityList` | `src/tests/qa-extraction-quality-step.mjs:141` | waitForCv |  |  | yes |  |
| `extractionQualityList` | `scripts/contact-consistency-report.mjs:148` | (module) |  |  | yes |  |
| `extractionQualityStep` | `index.html:2950` | renderExtractionQualityStep |  |  | yes |  |
| `extractionQualityStep` | `index.html:5588` | revealResults |  |  | yes |  |
| `extractionQualityStep` | `src/tests/qa-extraction-quality-step.mjs:135` | waitForCv |  |  | yes |  |
| `extractionQualityStep` | `src/tests/qa-extraction-quality-step.mjs:160` | (module) |  |  | yes |  |
| `extractionQualityStep` | `src/tests/qa-extraction-quality-step.mjs:167` | (module) |  |  | yes |  |
| `extractionQualityStep` | `src/ui/hirely-wow-factor.js:159` | (module) |  |  | yes |  |
| `extractionQualityStep` | `scripts/test-template-gallery-position.mjs:127` | isVisible |  |  | yes |  |
| `extractionQualityWarn` | `index.html:2963` | renderExtractionQualityStep |  |  | yes |  |
| `extractionRecoveryPanel` | `index.html:2788` | renderExtractionRecoveryPanel |  |  | yes |  |
| `extractionRecoveryPanel` | `src/ui/product/extraction-recovery-panel.js:76` | (module) |  |  | yes |  |
| `fileInput` | `index.html:1725` | resetFileInput | yes |  | yes |  |
| `fileInput` | `index.html:7493` | openVerifiedFilePicker | yes |  | yes |  |
| `fileInput` | `index.html:7511` | bindVerifiedImportHandlers | yes |  | yes |  |
| `fileInput` | `index.html:8118` | resetExtractionState | yes |  | yes |  |
| `fileInput` | `src/tests/qa-hard-reset-import.mjs:52` | main | yes |  | yes |  |
| `fileInput` | `src/tests/qa-product-lock.mjs:266` | vis | yes |  | yes |  |
| `fileInput` | `scripts/generate-stability-report.mjs:101` | browserBootAudit | yes |  | yes |  |
| `fileInput` | `scripts/import-boot-independence-report.mjs:102` | runScenario | yes |  | yes |  |
| `fileInput` | `scripts/local-ocr-csp-fix-report.mjs:209` | (module) | yes |  | yes |  |
| `fileInput` | `scripts/qa-final-boot-dom-contract.mjs:110` | main | yes |  | yes |  |
| `fileInput` | `scripts/real-browser-qa-lock.mjs:250` | ok | yes |  | yes |  |
| `fileInput` | `scripts/test-browser-boot-upload.mjs:98` | pass | yes |  | yes |  |
| `fileInput` | `scripts/ui-boot-audit.mjs:97` | main | yes |  | yes |  |
| `fileName` | `index.html:5537` | syncImportCompact |  |  | yes |  |
| `fileName` | `index.html:7128` | loadSample |  |  | yes |  |
| `fileName` | `index.html:7257` | handleLinkedInMultiImport |  |  | yes |  |
| `fileName` | `index.html:7288` | endImport |  |  | yes |  |
| `fileName` | `index.html:8117` | resetExtractionState |  |  | yes |  |
| `fileName` | `src/tests/qa-import-fallback-ux-lock.mjs:131` | startServer |  |  | yes |  |
| `fileName` | `src/tests/qa-import-needs-paste-ui.mjs:107` | startServer |  |  | yes |  |
| `fileName` | `src/tests/qa-import-needs-paste-ui.mjs:133` | startServer |  |  | yes |  |
| `fileName` | `src/tests/qa-pdf-timeout-fallback.mjs:126` | startServer |  |  | yes |  |
| `fileName` | `src/tests/qa-pdf-timeout-fallback.mjs:144` | startServer |  |  | yes |  |
| `fileName` | `scripts/real-browser-qa-lock.mjs:120` | collectUiSnap |  |  | yes |  |
| `flowPrimaryCta` | `index.html:2990` | syncFlowPrimaryCta |  |  | yes |  |
| `flowPrimaryCta` | `src/tests/qa-clear-flow-navigation.mjs:112` | main |  |  | yes |  |
| `flowPrimaryCtaBtn` | `index.html:2991` | syncFlowPrimaryCta |  |  | yes |  |
| `flowPrimaryCtaBtn` | `src/tests/qa-clear-flow-navigation.mjs:113` | main |  |  | yes |  |
| `flowPrimaryCtaBtn` | `src/tests/qa-clear-flow-navigation.mjs:132` | main |  |  | yes |  |
| `flowPrimaryCtaBtn` | `src/tests/qa-extraction-quality-step.mjs:175` | (module) |  |  | yes |  |
| `flowPrimaryCtaHint` | `index.html:2992` | syncFlowPrimaryCta |  |  | yes |  |
| `flowPrimaryCtaNext` | `index.html:2993` | syncFlowPrimaryCta |  |  | yes |  |
| `generateLetterBtn` | `index.html:8167` | resetExtractionState |  |  | yes |  |
| `generateLetterBtn` | `src/tests/qa-h4-end-to-end-flow.mjs:330` | (module) |  |  | yes |  |
| `generateLetterBtn` | `src/tests/qa-h4-end-to-end-flow.mjs:350` | vis |  |  | yes |  |
| `generateLetterBtn` | `src/tests/qa-h5-cover-letter-product.mjs:188` | vis |  |  | yes |  |
| `generateLetterBtn` | `src/tests/qa-p7-final-lock.mjs:683` | (module) |  |  | yes |  |
| `headerEditCancel` | `index.html:8177` | (module) |  |  | yes |  |
| `headerEditEmail` | `index.html:6087` | openCvHeaderEditDialog |  |  | yes |  |
| `headerEditEmail` | `index.html:6104` | applyCvHeaderEdit |  |  | yes |  |
| `headerEditName` | `index.html:6085` | openCvHeaderEditDialog |  |  | yes |  |
| `headerEditName` | `index.html:6100` | applyCvHeaderEdit |  |  | yes |  |
| `headerEditPhone` | `index.html:6088` | openCvHeaderEditDialog |  |  | yes |  |
| `headerEditPhone` | `index.html:6105` | applyCvHeaderEdit |  |  | yes |  |
| `headerEditPortfolio` | `index.html:6089` | openCvHeaderEditDialog |  |  | yes |  |
| `headerEditPortfolio` | `index.html:6106` | applyCvHeaderEdit |  |  | yes |  |
| `headerEditSave` | `index.html:8175` | (module) |  |  | yes |  |
| `headerEditTitle` | `index.html:6086` | openCvHeaderEditDialog |  |  | yes |  |
| `headerEditTitle` | `index.html:6101` | applyCvHeaderEdit |  |  | yes |  |
| `hero` | `src/tests/qa-h6-product-polish.mjs:84` | vis |  |  | yes |  |
| `heroTitle` | `src/tests/qa-h6-product-polish.mjs:87` | vis |  |  | yes |  |
| `heroUploadBtn` | `src/tests/qa-h6-product-polish.mjs:89` | vis |  |  | yes |  |
| `heroUploadBtn` | `src/tests/qa-h6-product-polish.mjs:90` | vis |  |  | yes |  |
| `heroUploadBtn` | `scripts/qa-no-regression-repair.mjs:166` | run |  |  | yes |  |
| `hirelyBootHealth` | `index.html:1597` | renderBootHealthOverlay |  |  | yes |  |
| `hirelyCoreLoadError` | `index.html:4222` | showHirelyFeatureWarnings |  |  | yes |  |
| `hirelyCoreLoadError` | `index.html:4252` | hideHirelyCoreLoadError |  |  | yes |  |
| `hirelyCoreLoadError` | `src/ui/runtime/engine-health.js:190` | (module) |  |  | yes |  |
| `hirelyCoreLoadError` | `scripts/final-browser-qa.mjs:312` | record |  |  | yes |  |
| `hirelyCoreLoadError` | `scripts/final-browser-qa.mjs:313` | record |  |  | yes |  |
| `hirelyCoreLoadError` | `scripts/qa-boot-regression.mjs:255` | (module) |  |  | yes |  |
| `hirelyCoreLoadError` | `scripts/qa-engine-health.mjs:54` | runScenario |  |  | yes |  |
| `hirelyCoreLoadError` | `scripts/qa-final-boot-dom-contract.mjs:86` | main |  |  | yes |  |
| `hirelyCoreLoadError` | `scripts/qa-no-regression-repair.mjs:115` | run |  |  | yes |  |
| `hirelyCoreLoadError` | `scripts/qa-no-regression-repair.mjs:120` | run |  |  | yes |  |
| `hirelyCoreLoadError` | `scripts/real-world-cv-qa-lock.mjs:175` | normKey |  |  | yes |  |
| `hirelyCoreLoadError` | `scripts/real-world-cv-qa-lock.mjs:176` | normKey |  |  | yes |  |
| `hirelyCoreLoadError` | `scripts/visible-qa-yoaz.mjs:159` | record |  |  | yes |  |
| `hirelyParserTrace` | `index.html:3384` | renderParserTracePanel |  |  | yes |  |
| `importAnalysisStages` | `index.html:1860` | ensureImportNeedsPasteVisible |  |  | yes |  |
| `importAnalysisStages` | `src/ui/hirely-wow-factor.js:58` | (module) |  |  | yes |  |
| `importAnalysisStages` | `src/ui/product/import-analysis-stages.js:32` | (module) |  |  | yes |  |
| `importCompact` | `index.html:1844` | ensureImportNeedsPasteVisible |  |  | yes |  |
| `importCompact` | `index.html:2090` | setImportLoadingUx |  |  | yes |  |
| `importCompact` | `index.html:4508` | setLoadingPhase |  |  | yes |  |
| `importCompact` | `index.html:4528` | setImportStatus |  |  | yes |  |
| `importCompact` | `index.html:4543` | setImportStatus |  |  | yes |  |
| `importCompact` | `index.html:5536` | syncImportCompact |  |  | yes |  |
| `importCompactFile` | `index.html:5538` | syncImportCompact |  |  | yes |  |
| `importCompactStatus` | `index.html:2085` | setImportLoadingUx |  |  | yes |  |
| `importCompactStatus` | `index.html:4500` | setLoadingPhase |  |  | yes |  |
| `importCompactStatus` | `index.html:4527` | setImportStatus |  |  | yes |  |
| `importCompactStatus` | `index.html:4542` | setImportStatus |  |  | yes |  |
| `importCompactStatus` | `index.html:4606` | applyI18n |  |  | yes |  |
| `importCompactStatus` | `index.html:5545` | syncImportCompact |  |  | yes |  |
| `importExpanded` | `index.html:1843` | ensureImportNeedsPasteVisible |  |  | yes |  |
| `importExpanded` | `index.html:5535` | syncImportCompact |  |  | yes |  |
| `importExpanded` | `src/tests/qa-import-needs-paste-ui.mjs:125` | startServer |  |  | yes |  |
| `importExpanded` | `src/tests/qa-import-needs-paste-ui.mjs:137` | (module) |  |  | yes |  |
| `importFlowV2` | `index.html:4599` | applyI18n |  |  | yes |  |
| `importFlowV2` | `src/ui/product/import-flow-v2.js:47` | (module) |  |  | yes |  |
| `importLiveStatus` | `index.html:2347` | setImportLiveStatus |  |  | yes |  |
| `importLiveStatus` | `src/tests/qa-import-silent.mjs:135` | onConsole |  |  | yes |  |
| `importLiveStatus` | `src/tests/qa-mvp-recovery.mjs:95` | onConsole |  |  | yes |  |
| `importLiveStatus` | `src/tests/qa-mvp-recovery.mjs:144` | tc |  |  | yes |  |
| `importLiveStatus` | `src/tests/qa-pdf-ocr-ux-progress.mjs:108` | startServer |  |  | yes |  |
| `importLiveStatus` | `src/tests/qa-verify-ui.mjs:89` | browserChecks |  |  | yes |  |
| `importLoadingDetail` | `index.html:2087` | setImportLoadingUx |  |  | yes |  |
| `importLoadingDetail` | `index.html:2128` | endImportLoadingUx |  |  | yes |  |
| `importLoadingPasteHint` | `index.html:2061` | hideImportLoadingPasteHint |  |  | yes |  |
| `importLoadingPasteHint` | `index.html:2066` | showImportLoadingPasteHint |  |  | yes |  |
| `importLoadingWait` | `index.html:2088` | setImportLoadingUx |  |  | yes |  |
| `importLoadingWait` | `index.html:2129` | endImportLoadingUx |  |  | yes |  |
| `importPasteFallback` | `index.html:1797` | needsImportPasteUi |  | yes | yes |  |
| `importPasteFallback` | `index.html:1887` | hideImportPasteFallback |  | yes | yes |  |
| `importPasteFallback` | `index.html:2179` | showOcrEarlyPasteOffer |  | yes | yes |  |
| `importPasteFallback` | `index.html:2204` | triggerPdfOcrFullFallback |  | yes | yes |  |
| `importPasteFallback` | `index.html:2246` | showImportPasteFallback |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-detection-panel-consistency.mjs:125` | waitImportDone |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-end-to-end-flow-audit.mjs:96` | waitImportDone |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-final-ui-sync-yoaz.mjs:104` | waitImportDone |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-flow-lock-browser.mjs:139` | waitImportDone |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-flow-lock-browser.mjs:197` | cvText |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-format-support-audit.mjs:268` | verifyPasteFallbackUi |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-import-fallback-ux-lock.mjs:99` | startServer |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-import-fallback-ux-lock.mjs:115` | startServer |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-import-fallback-ux-lock.mjs:124` | startServer |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-import-fallback-ux-lock.mjs:188` | (module) |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-import-needs-paste-ui.mjs:83` | startServer |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-import-needs-paste-ui.mjs:101` | startServer |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-import-needs-paste-ui.mjs:123` | startServer |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-import-needs-paste-ui.mjs:138` | (module) |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-import-needs-paste-ui.mjs:179` | (module) |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-import-needs-paste-ui.mjs:221` | (module) |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-import-needs-paste-ui.mjs:222` | (module) |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-import-reality-check.mjs:269` | (module) |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-ocr-browser-smoke.mjs:155` | runSmoke |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-p7-final-lock.mjs:258` | waitImportDone |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-p7-final-lock.mjs:298` | getDegradedSnapshot |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-pdf-import-acceptance-yoaz.mjs:129` | log |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-pdf-ocr-ux-progress.mjs:75` | startServer |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-pdf-ocr-ux-progress.mjs:116` | startServer |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-pdf-ocr-ux-progress.mjs:128` | startServer |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-pdf-ocr-ux-progress.mjs:131` | (module) |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-pdf-ocr-ux-progress.mjs:138` | (module) |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-pdf-timeout-fallback.mjs:103` | startServer |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-pdf-timeout-fallback.mjs:121` | startServer |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-pdf-timeout-fallback.mjs:139` | startServer |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-pdf-timeout-fallback.mjs:188` | (module) |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-product-lock.mjs:91` | waitImportDone |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-real-cv-benchmark-pack.mjs:124` | runBenchmarkCase |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-real-format-qa.mjs:281` | runBrowserStuckCheck |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-real-user-cv.mjs:173` | waitImportDone |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-real-visual-browser.mjs:122` | waitImportDone |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-real-world-import-truth.mjs:164` | runImportOnPage |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-template-section-order.mjs:109` | waitImportDone |  | yes | yes |  |
| `importPasteFallback` | `src/tests/qa-visual-quality-lock.mjs:125` | waitImportDone |  | yes | yes |  |
| `importPasteFallback` | `src/tests/test-ocr-quality.mjs:200` | (module) |  | yes | yes |  |
| `importPasteFallback` | `scripts/diagnose-real-pdf-import.mjs:98` | startServer |  | yes | yes |  |
| `importPasteFallback` | `scripts/final-browser-qa.mjs:119` | waitImportDone |  | yes | yes |  |
| `importPasteFallback` | `scripts/production-reality-audit.mjs:77` | importPdf |  | yes | yes |  |
| `importPasteFallback` | `scripts/production-reality-audit.mjs:92` | importPdf |  | yes | yes |  |
| `importPasteFallback` | `scripts/real-browser-qa-lock.mjs:96` | collectUiSnap |  | yes | yes |  |
| `importPasteFallback` | `scripts/real-browser-qa-lock.mjs:130` | waitForPasteFallback |  | yes | yes |  |
| `importPasteFallback` | `scripts/real-world-cv-qa-lock.mjs:97` | waitImportDone |  | yes | yes |  |
| `importPasteFallback` | `scripts/visible-qa-yoaz.mjs:76` | waitImportDone |  | yes | yes |  |
| `importPasteFallbackApply` | `src/tests/qa-import-needs-paste-ui.mjs:134` | startServer |  |  | yes |  |
| `importPasteFallbackApply` | `src/tests/qa-pdf-timeout-fallback.mjs:145` | startServer |  |  | yes |  |
| `importPasteFallbackLead` | `index.html:2181` | showOcrEarlyPasteOffer |  |  | yes |  |
| `importPasteFallbackLead` | `index.html:2249` | showImportPasteFallback |  |  | yes |  |
| `importPasteFallbackLead` | `src/tests/qa-format-support-audit.mjs:270` | verifyPasteFallbackUi |  |  | yes |  |
| `importPasteFallbackLead` | `src/tests/qa-import-fallback-ux-lock.mjs:116` | startServer |  |  | yes |  |
| `importPasteFallbackLead` | `src/tests/qa-import-fallback-ux-lock.mjs:127` | startServer |  |  | yes |  |
| `importPasteFallbackLead` | `src/tests/qa-import-needs-paste-ui.mjs:106` | startServer |  |  | yes |  |
| `importPasteFallbackLead` | `src/tests/qa-import-needs-paste-ui.mjs:132` | startServer |  |  | yes |  |
| `importPasteFallbackLead` | `src/tests/qa-pdf-ocr-ux-progress.mjs:129` | startServer |  |  | yes |  |
| `importPasteFallbackLead` | `src/tests/qa-pdf-ocr-ux-progress.mjs:139` | (module) |  |  | yes |  |
| `importPasteFallbackLead` | `src/tests/qa-pdf-timeout-fallback.mjs:125` | startServer |  |  | yes |  |
| `importPasteFallbackLead` | `src/tests/qa-pdf-timeout-fallback.mjs:143` | startServer |  |  | yes |  |
| `importPasteFallbackLead` | `scripts/real-browser-qa-lock.mjs:119` | collectUiSnap |  |  | yes |  |
| `importPasteFallbackLead` | `scripts/real-browser-qa-lock.mjs:131` | waitForPasteFallback |  |  | yes |  |
| `importPasteFallbackText` | `index.html:2182` | showOcrEarlyPasteOffer |  |  | yes |  |
| `importPasteFallbackText` | `index.html:2250` | showImportPasteFallback |  |  | yes |  |
| `importPasteFallbackText` | `index.html:5413` | extractionGateChoosePaste |  |  | yes |  |
| `importPasteFallbackText` | `index.html:5510` | showExtractionGate |  |  | yes |  |
| `importPasteFallbackText` | `index.html:7854` | openPaste |  |  | yes |  |
| `importPasteFallbackText` | `index.html:7941` | heroUpload |  |  | yes |  |
| `importPasteFallbackText` | `src/tests/qa-format-support-audit.mjs:269` | verifyPasteFallbackUi |  |  | yes |  |
| `importPasteFallbackText` | `src/tests/qa-import-fallback-ux-lock.mjs:132` | startServer |  |  | yes |  |
| `importPasteFallbackText` | `src/tests/qa-import-fallback-ux-lock.mjs:167` | (module) |  |  | yes |  |
| `importPasteFallbackText` | `src/tests/qa-import-needs-paste-ui.mjs:102` | startServer |  |  | yes |  |
| `importPasteFallbackText` | `src/tests/qa-import-needs-paste-ui.mjs:126` | startServer |  |  | yes |  |
| `importPasteFallbackText` | `src/tests/qa-import-needs-paste-ui.mjs:189` | (module) |  |  | yes |  |
| `importPasteFallbackText` | `src/tests/qa-pdf-timeout-fallback.mjs:122` | startServer |  |  | yes |  |
| `importPasteFallbackText` | `src/tests/qa-pdf-timeout-fallback.mjs:140` | startServer |  |  | yes |  |
| `importPasteFallbackText` | `src/tests/qa-pdf-timeout-fallback.mjs:166` | (module) |  |  | yes |  |
| `importPasteFallbackTitle` | `index.html:2180` | showOcrEarlyPasteOffer |  |  | yes |  |
| `importPasteFallbackTitle` | `index.html:2248` | showImportPasteFallback |  |  | yes |  |
| `importPasteFallbackTitle` | `src/tests/qa-import-fallback-ux-lock.mjs:126` | startServer |  |  | yes |  |
| `importPasteFallbackTitle` | `src/tests/qa-import-needs-paste-ui.mjs:105` | startServer |  |  | yes |  |
| `importPasteFallbackTitle` | `src/tests/qa-import-needs-paste-ui.mjs:131` | startServer |  |  | yes |  |
| `importStatusWarn` | `index.html:1889` | hideImportPasteFallback |  |  | yes |  |
| `importStatusWarn` | `index.html:2191` | showOcrEarlyPasteOffer |  |  | yes |  |
| `importStatusWarn` | `index.html:2251` | showImportPasteFallback |  |  | yes |  |
| `importStatusWarn` | `index.html:3456` | showReviewGuaranteeWarningsUi |  |  | yes |  |
| `importStatusWarn` | `index.html:8024` | (module) |  |  | yes |  |
| `importStatusWarnText` | `index.html:3457` | showReviewGuaranteeWarningsUi |  |  | yes |  |
| `includePhoto` | `index.html:8078` | finish |  |  | yes |  |
| `includePhoto` | `index.html:8088` | finish |  |  | yes |  |
| `includePhoto` | `index.html:8104` | resetExtractionState |  |  | yes |  |
| `includePhoto` | `src/ui/pro/pro-cv-features.js:311` | finish |  |  | yes |  |
| `insightLead` | `index.html:4180` | renderReviewPanel |  |  | yes |  |
| `insightLead` | `index.html:5460` | syncScoreCopy |  |  | yes |  |
| `insightLead` | `index.html:6212` | renderScorePanel |  |  | yes |  |
| `issuesList` | `index.html:4080` | renderSimpleIssues |  |  | yes |  |
| `issuesPanel` | `index.html:4079` | renderSimpleIssues |  |  | yes |  |
| `jobDescInput` | `index.html:5659` | assessment |  |  | yes |  |
| `jobDescInput` | `index.html:6202` | renderRecruiterCommandCenter |  |  | yes |  |
| `letterLangSelect` | `index.html:6823` | letterLang |  |  | yes |  |
| `letterLangSelect` | `index.html:6831` | syncLetterLangSelect |  |  | yes |  |
| `letterLangSelect` | `index.html:8158` | resetExtractionState |  |  | yes |  |
| `letterMissingFields` | `index.html:6860` | renderLetterMissingFields |  |  | yes |  |
| `letterTargetCompany` | `index.html:6896` | exp |  |  | yes |  |
| `letterTargetCompany` | `index.html:6936` | generateCoverLetterNow |  |  | yes |  |
| `letterTargetCompany` | `index.html:7042` | renderOutputs |  |  | yes |  |
| `letterTargetCompany` | `index.html:8198` | (module) |  |  | yes |  |
| `letterTargetCompany` | `src/tests/qa-h5-cover-letter-product.mjs:190` | vis |  |  | yes |  |
| `letterTargetRole` | `index.html:6869` | letterTargetRole |  |  | yes |  |
| `letterTargetRole` | `index.html:8156` | resetExtractionState |  |  | yes |  |
| `letterTargetRole` | `src/tests/qa-h5-cover-letter-product.mjs:189` | vis |  |  | yes |  |
| `linkedinImportBtn` | `index.html:7577` | bindVerifiedImportHandlers |  |  | yes |  |
| `linkedinImportInput` | `index.html:7578` | bindVerifiedImportHandlers |  |  | yes |  |
| `linkedinImportPanel` | `index.html:7191` | renderLinkedInImportPanel |  |  | yes |  |
| `metrics` | `index.html:6212` | renderScorePanel |  |  | yes |  |
| `metrics` | `scripts/real-world-cv-qa-lock.mjs:169` | normKey |  |  | yes |  |
| `mvpClassifyWarn` | `index.html:4022` | renderMvpImportBanner |  |  | yes |  |
| `mvpImportBanner` | `index.html:1965` | resetImportWorkspaceForFallback |  |  | yes |  |
| `mvpImportBanner` | `index.html:4000` | renderMvpImportBanner |  |  | yes |  |
| `mvpImportBanner` | `src/tests/qa-mvp-recovery.mjs:126` | onConsole |  |  | yes |  |
| `openLetterBtn` | `index.html:8169` | resetExtractionState |  |  | yes |  |
| `openLetterBtn` | `src/tests/qa-export-page-fix.mjs:135` | main |  |  | yes |  |
| `openLetterBtn` | `scripts/product-pass-qa-yoaz.mjs:181` | (module) |  |  | yes |  |
| `openLetterReviewBtn` | `index.html:6995` | ready |  |  | yes |  |
| `openLetterReviewBtn` | `index.html:8171` | (module) |  |  | yes |  |
| `openLetterReviewBtn` | `src/tests/qa-h5-cover-letter-product.mjs:163` | vis |  |  | yes |  |
| `photoBtn` | `index.html:8057` | updatePhotoPreview |  |  | yes |  |
| `photoEditorCancel` | `src/ui/pro/pro-cv-features.js:129` | (module) |  |  | yes |  |
| `photoEditorDialog` | `src/ui/pro/pro-cv-features.js:124` | (module) |  |  | yes |  |
| `photoEditorImg` | `src/ui/pro/pro-cv-features.js:125` | (module) |  |  | yes |  |
| `photoEditorPosX` | `src/ui/pro/pro-cv-features.js:127` | (module) |  |  | yes |  |
| `photoEditorPosY` | `src/ui/pro/pro-cv-features.js:128` | (module) |  |  | yes |  |
| `photoEditorRemove` | `src/ui/pro/pro-cv-features.js:131` | (module) |  |  | yes |  |
| `photoEditorSave` | `src/ui/pro/pro-cv-features.js:130` | (module) |  |  | yes |  |
| `photoEditorZoom` | `src/ui/pro/pro-cv-features.js:126` | (module) |  |  | yes |  |
| `photoInput` | `index.html:8058` | updatePhotoPreview |  |  | yes |  |
| `photoInput` | `index.html:8059` | updatePhotoPreview |  |  | yes |  |
| `photoInput` | `index.html:8119` | resetExtractionState |  |  | yes |  |
| `photoPreview` | `index.html:8052` | updatePhotoPreview |  |  | yes |  |
| `pipelineReportBody` | `index.html:3226` | renderProductionPipelineReport |  |  | yes |  |
| `pipelineReportPanel` | `index.html:3225` | renderProductionPipelineReport |  | yes | yes |  |
| `pipelineReportPanel` | `src/tests/qa-product-recovery.mjs:98` | main |  | yes | yes |  |
| `pipelineReportPanel` | `src/tests/qa-product-recovery.mjs:99` | main |  | yes | yes |  |
| `pipelineReportPanel` | `src/tests/qa-product-recovery.mjs:100` | main |  | yes | yes |  |
| `pipelineReportPanel` | `src/tests/qa-real-product-audit.mjs:241` | (module) |  | yes | yes |  |
| `premiumGalleryFilters` | `index.html:6719` | renderPremiumGalleryFilters |  |  | yes |  |
| `premiumTemplateGallery` | `index.html:6519` | bootTemplateRegistryDeferred |  |  | yes |  |
| `premiumTemplateGallery` | `index.html:6774` | renderTemplates |  |  | yes |  |
| `pricing` | `index.html:4432` | requirePro |  |  | yes |  |
| `proCvAtsOrderWarn` | `src/ui/pro/pro-cv-features.js:116` | (module) |  |  | yes |  |
| `proCvEditBar` | `src/ui/pro/pro-cv-features.js:113` | (module) |  |  | yes |  |
| `proCvEditBar` | `scripts/collapsible-editor-panel-report.mjs:143` | (module) |  |  | yes |  |
| `proCvEditDrawer` | `src/ui/pro/pro-cv-features.js:112` | (module) |  |  | yes |  |
| `proCvEditDrawer` | `scripts/collapsible-editor-panel-report.mjs:95` | main |  |  | yes |  |
| `proCvEditDrawer` | `scripts/collapsible-editor-panel-report.mjs:141` | (module) |  |  | yes |  |
| `proCvEditDrawer` | `scripts/collapsible-editor-panel-report.mjs:176` | (module) |  |  | yes |  |
| `proCvLayoutToggle` | `src/ui/pro/pro-cv-features.js:111` | (module) |  |  | yes |  |
| `proCvLayoutToggle` | `scripts/collapsible-editor-panel-report.mjs:94` | main |  |  | yes |  |
| `proCvLayoutToggle` | `scripts/collapsible-editor-panel-report.mjs:142` | (module) |  |  | yes |  |
| `proCvLayoutTools` | `src/ui/pro/pro-cv-features.js:110` | (module) |  |  | yes |  |
| `proCvLayoutTools` | `scripts/collapsible-editor-panel-report.mjs:93` | main |  |  | yes |  |
| `proCvPhotoBtn` | `src/ui/pro/pro-cv-features.js:117` | (module) |  |  | yes |  |
| `proCvPhotoBtn` | `scripts/collapsible-editor-panel-report.mjs:96` | main |  |  | yes |  |
| `proCvPhotoCropBtn` | `src/ui/pro/pro-cv-features.js:118` | (module) |  |  | yes |  |
| `proCvPhotoHideBtn` | `src/ui/pro/pro-cv-features.js:119` | (module) |  |  | yes |  |
| `proCvPhotoInput` | `src/ui/pro/pro-cv-features.js:123` | (module) |  |  | yes |  |
| `proCvPhotoRemoveBtn` | `src/ui/pro/pro-cv-features.js:120` | (module) |  |  | yes |  |
| `proCvPhotoTemplateToggle` | `src/ui/pro/pro-cv-features.js:121` | (module) |  |  | yes |  |
| `proCvPhotoTemplateToggle` | `scripts/collapsible-editor-panel-report.mjs:97` | main |  |  | yes |  |
| `proCvPhotoThumb` | `src/ui/pro/pro-cv-features.js:122` | (module) |  |  | yes |  |
| `proCvSectionOrder` | `src/ui/pro/pro-cv-features.js:114` | (module) |  |  | yes |  |
| `proCvSectionOrder` | `scripts/collapsible-editor-panel-report.mjs:98` | main |  |  | yes |  |
| `proCvSectionOrder` | `scripts/collapsible-editor-panel-report.mjs:157` | (module) |  |  | yes |  |
| `proCvSectionOrderReset` | `src/ui/pro/pro-cv-features.js:115` | (module) |  |  | yes |  |
| `proCvSectionOrderReset` | `scripts/collapsible-editor-panel-report.mjs:99` | main |  |  | yes |  |
| `progress` | `index.html:2194` | showOcrEarlyPasteOffer |  | yes | yes |  |
| `progress` | `index.html:2217` | schedule |  | yes | yes |  |
| `progress` | `index.html:7156` | setProgress |  | yes | yes |  |
| `progress` | `index.html:7163` | hideProgress |  | yes | yes |  |
| `progress` | `index.html:7989` | (module) |  | yes | yes |  |
| `progress` | `src/tests/qa-import-fallback-ux-lock.mjs:137` | startServer |  | yes | yes |  |
| `progress` | `src/tests/qa-import-needs-paste-ui.mjs:104` | startServer |  | yes | yes |  |
| `progress` | `src/tests/qa-import-needs-paste-ui.mjs:130` | startServer |  | yes | yes |  |
| `progress` | `src/tests/qa-import-needs-paste-ui.mjs:181` | (module) |  | yes | yes |  |
| `progress` | `src/tests/qa-import-reality-check.mjs:273` | (module) |  | yes | yes |  |
| `progress` | `src/tests/qa-real-format-qa.mjs:285` | runBrowserStuckCheck |  | yes | yes |  |
| `progressBar` | `index.html:2193` | showOcrEarlyPasteOffer |  | yes | yes |  |
| `progressBar` | `index.html:2221` | schedule |  | yes | yes |  |
| `progressBar` | `index.html:7155` | setProgress |  | yes | yes |  |
| `progressBar` | `index.html:7163` | hideProgress |  | yes | yes |  |
| `progressBar` | `index.html:8120` | resetExtractionState |  | yes | yes |  |
| `progressBar` | `src/tests/qa-pdf-ocr-ux-progress.mjs:96` | startServer |  | yes | yes |  |
| `progressNavFill` | `index.html:3024` | renderProgressNav |  |  | yes |  |
| `progressNavFill` | `src/ui/hirely-wow-factor.js:54` | (module) |  |  | yes |  |
| `rccConfidenceBadge` | `index.html:6206` | renderRecruiterCommandCenter |  |  | yes |  |
| `recruiterAtsScore` | `index.html:3079` | audit |  |  | yes |  |
| `recruiterAuditChecks` | `index.html:3082` | audit |  |  | yes |  |
| `recruiterBandDesc` | `index.html:3081` | audit |  |  | yes |  |
| `recruiterBandLabel` | `index.html:3080` | audit |  |  | yes |  |
| `recruiterCommandCenter` | `index.html:6195` | renderRecruiterCommandCenter |  |  | yes |  |
| `recruiterFixList` | `index.html:3083` | audit |  |  | yes |  |
| `recruiterReviewPanel` | `index.html:3071` | renderRecruiterReview |  | yes | yes |  |
| `recruiterReviewPanel` | `index.html:3122` | setStudioMode |  | yes | yes |  |
| `recruiterScoreRing` | `index.html:3078` | audit |  |  | yes |  |
| `recsList` | `index.html:4162` | renderReviewPanel |  |  | yes |  |
| `recsList` | `index.html:5850` | renderRecruiterInsightList |  |  | yes |  |
| `resumeEditorPanel` | `index.html:2913` | setDocStep |  |  | yes |  |
| `resumeEditorPanel` | `index.html:3121` | setStudioMode |  |  | yes |  |
| `resumeEditorPanel` | `index.html:4956` | refreshResumeEditor |  |  | yes |  |
| `resumeEditorPanel` | `index.html:5082` | refreshResumeStudio |  |  | yes |  |
| `resumeEditorPanel` | `src/tests/qa-real-product-audit.mjs:184` | (module) |  |  | yes |  |
| `resumeEditorRoot` | `index.html:4955` | refreshResumeEditor |  |  | yes |  |
| `resumeEditorRoot` | `index.html:5081` | refreshResumeStudio |  |  | yes |  |
| `resumeEditorRoot` | `src/tests/qa-real-product-audit.mjs:185` | (module) |  |  | yes |  |
| `resumeEditorRoot` | `src/tests/qa-real-product-audit.mjs:254` | (module) |  |  | yes |  |
| `resumeStudioHead` | `index.html:5040` | syncResumeStudioChrome |  |  | yes |  |
| `resumeStudioHead` | `src/tests/qa-clear-flow-navigation.mjs:118` | main |  |  | yes |  |
| `reviewPanel` | `index.html:4141` | renderReviewPanel |  |  | yes |  |
| `reviewPanel` | `index.html:4149` | renderReviewPanel |  |  | yes |  |
| `reviewPanel` | `index.html:4161` | renderReviewPanel |  |  | yes |  |
| `reviewStudioAnalysis` | `index.html:2722` | syncReviewStudioV2Chrome |  |  | yes |  |
| `reviewStudioAnalysis` | `index.html:2820` | renderReviewStudioV2 |  |  | yes |  |
| `reviewStudioAnalysis` | `src/tests/qa-h4-end-to-end-flow.mjs:190` | selectTemplateCard |  |  | yes |  |
| `reviewStudioAnalysis` | `src/tests/qa-h5-cover-letter-product.mjs:164` | vis |  |  | yes |  |
| `reviewStudioAnalysis` | `src/tests/qa-h6-product-polish.mjs:184` | (module) |  |  | yes |  |
| `reviewStudioAnalysis` | `src/tests/qa-p7-final-lock.mjs:447` | getAtsSnapshot |  |  | yes |  |
| `reviewStudioAnalysis` | `src/ui/hirely-wow-factor.js:63` | (module) |  |  | yes |  |
| `reviewStudioAnalysis` | `src/ui/hirely-wow-factor.js:83` | (module) |  |  | yes |  |
| `reviewStudioAnalysis` | `scripts/test-template-gallery-position.mjs:132` | isVisible |  |  | yes |  |
| `reviewStudioCenter` | `index.html:2457` | placeToClassifyPanel |  |  | yes |  |
| `reviewStudioCenter` | `index.html:2655` | renderSuggestionsPanel |  |  | yes |  |
| `reviewStudioCenter` | `index.html:2721` | syncReviewStudioV2Chrome |  |  | yes |  |
| `reviewStudioCenter` | `index.html:6011` | handleChecklistAction |  |  | yes |  |
| `reviewStudioCenter` | `src/ui/hirely-wow-factor.js:92` | (module) |  |  | yes |  |
| `reviewStudioCenter` | `scripts/test-template-gallery-position.mjs:131` | isVisible |  |  | yes |  |
| `reviewV2BlockedBadge` | `index.html:2829` | renderReviewStudioV2 |  |  | yes |  |
| `reviewV2Checklist` | `index.html:6214` | renderScorePanel |  |  | yes |  |
| `reviewV2Metrics` | `index.html:6214` | renderScorePanel |  |  | yes |  |
| `reviewV2Metrics` | `src/tests/qa-p7-final-lock.mjs:449` | getAtsSnapshot |  |  | yes |  |
| `reviewV2Metrics` | `src/ui/hirely-wow-factor.js:139` | (module) |  |  | yes |  |
| `reviewV2ReadyBadge` | `index.html:2828` | renderReviewStudioV2 |  |  | yes |  |
| `reviewV2ReviewRequiredBadge` | `index.html:2830` | renderReviewStudioV2 |  |  | yes |  |
| `reviewV2ReviewRequiredWhy` | `index.html:2831` | renderReviewStudioV2 |  |  | yes |  |
| `reviewV2ScoreDesc` | `index.html:3454` | showReviewGuaranteeWarningsUi |  |  | yes |  |
| `reviewV2ScoreDesc` | `index.html:6171` | renderCvReviewPanel |  |  | yes |  |
| `reviewV2ScoreDesc` | `index.html:6214` | renderScorePanel |  |  | yes |  |
| `reviewV2ScoreLead` | `index.html:6170` | renderCvReviewPanel |  |  | yes |  |
| `reviewV2ScoreLead` | `index.html:6214` | renderScorePanel |  |  | yes |  |
| `reviewV2ScoreLead` | `scripts/product-pass-qa-yoaz.mjs:128` | (module) |  |  | yes |  |
| `reviewV2ScoreRing` | `index.html:6214` | renderScorePanel |  |  | yes |  |
| `reviewV2ScoreRing` | `src/ui/hirely-wow-factor.js:136` | (module) |  |  | yes |  |
| `reviewV2ScoreRing` | `scripts/real-browser-qa-lock.mjs:94` | collectUiSnap |  |  | yes |  |
| `reviewV2ScoreTotal` | `index.html:6214` | renderScorePanel |  |  | yes |  |
| `reviewV2ScoreTotal` | `src/tests/qa-final-reset.mjs:98` | rawLen |  |  | yes |  |
| `reviewV2ScoreTotal` | `src/tests/qa-h4-end-to-end-flow.mjs:212` | vis |  |  | yes |  |
| `reviewV2ScoreTotal` | `src/tests/qa-p7-final-lock.mjs:448` | getAtsSnapshot |  |  | yes |  |
| `reviewV2ScoreTotal` | `src/ui/hirely-wow-factor.js:136` | (module) |  |  | yes |  |
| `roleInput` | `index.html:5659` | assessment |  |  | yes |  |
| `roleInput` | `index.html:6203` | renderRecruiterCommandCenter |  |  | yes |  |
| `roleInput` | `index.html:7073` | renderOutputs |  |  | yes |  |
| `roleInput` | `index.html:8155` | resetExtractionState |  |  | yes |  |
| `roleInput` | `src/tests/qa-p7-final-lock.mjs:424` | editCvIdentity |  |  | yes |  |
| `score` | `index.html:6212` | renderScorePanel |  |  | yes |  |
| `score` | `src/ui/hirely-wow-factor.js:137` | (module) |  |  | yes |  |
| `score` | `scripts/final-browser-qa.mjs:184` | collectSnap |  |  | yes |  |
| `scoreDesc` | `index.html:4181` | renderReviewPanel |  |  | yes |  |
| `scoreDesc` | `index.html:5461` | syncScoreCopy |  |  | yes |  |
| `scoreDesc` | `index.html:6212` | renderScorePanel |  |  | yes |  |
| `scoreRing` | `index.html:6212` | renderScorePanel |  |  | yes |  |
| `scoreRing` | `src/ui/hirely-wow-factor.js:137` | (module) |  |  | yes |  |
| `statusIcon` | `index.html:4486` | setStatusIcon |  |  | yes |  |
| `statusText` | `index.html:2084` | setImportLoadingUx |  | yes | yes |  |
| `statusText` | `index.html:4499` | setLoadingPhase |  | yes | yes |  |
| `statusText` | `index.html:4515` | setImportStatus |  | yes | yes |  |
| `statusText` | `index.html:4608` | applyI18n |  | yes | yes |  |
| `statusText` | `index.html:7123` | show |  | yes | yes |  |
| `statusText` | `src/tests/qa-import-fallback-ux-lock.mjs:141` | startServer |  | yes | yes |  |
| `statusText` | `src/tests/qa-import-fallback-ux-lock.mjs:143` | startServer |  | yes | yes |  |
| `statusText` | `src/tests/qa-import-needs-paste-ui.mjs:224` | (module) |  | yes | yes |  |
| `statusText` | `src/tests/qa-pdf-ocr-ux-progress.mjs:107` | startServer |  | yes | yes |  |
| `statusText` | `src/tests/qa-pdf-timeout-fallback.mjs:148` | startServer |  | yes | yes |  |
| `statusText` | `src/tests/qa-verify-ui.mjs:90` | browserChecks |  | yes | yes |  |
| `studioAtsChecklist` | `index.html:6213` | renderScorePanel |  |  | yes |  |
| `studioAtsChecklist` | `scripts/contact-consistency-report.mjs:149` | (module) |  |  | yes |  |
| `studioCreativeBadge` | `index.html:5066` | syncResumeStudioChrome |  |  | yes |  |
| `studioInsightLead` | `index.html:6213` | renderScorePanel |  |  | yes |  |
| `studioMetrics` | `index.html:6213` | renderScorePanel |  |  | yes |  |
| `studioMetrics` | `scripts/real-world-cv-qa-lock.mjs:169` | normKey |  |  | yes |  |
| `studioModeToggle` | `index.html:5058` | syncResumeStudioChrome |  |  | yes |  |
| `studioPreview` | `index.html:5026` | ensureExportPreviewRendered |  |  | yes |  |
| `studioPreview` | `index.html:5048` | syncResumeStudioChrome |  |  | yes |  |
| `studioPreview` | `src/tests/qa-clear-flow-navigation.mjs:145` | main |  |  | yes |  |
| `studioPreview` | `src/tests/qa-export-page-fix.mjs:105` | main |  |  | yes |  |
| `studioPreview` | `src/tests/qa-export-page-fix.mjs:114` | main |  |  | yes |  |
| `studioPreview` | `src/tests/qa-export-page-full-preview.mjs:105` | setStep |  |  | yes |  |
| `studioPreview` | `src/tests/qa-real-visual-browser.mjs:215` | collectVisualSnapshot |  |  | yes |  |
| `studioPreview` | `src/tests/qa-single-source-of-truth.mjs:143` | eduInFinal |  |  | yes |  |
| `studioRail` | `index.html:3115` | setStudioMode |  |  | yes |  |
| `studioRail` | `index.html:5055` | syncResumeStudioChrome |  |  | yes |  |
| `studioScore` | `index.html:6213` | renderScorePanel |  |  | yes |  |
| `studioScore` | `src/tests/qa-product-recovery.mjs:63` | main |  |  | yes |  |
| `studioScore` | `src/tests/qa-product-recovery.mjs:91` | main |  |  | yes |  |
| `studioScore` | `src/ui/hirely-wow-factor.js:138` | (module) |  |  | yes |  |
| `studioScore` | `scripts/final-browser-qa.mjs:184` | collectSnap |  |  | yes |  |
| `studioScoreDesc` | `index.html:6213` | renderScorePanel |  |  | yes |  |
| `studioScorePanel` | `index.html:3123` | setStudioMode |  | yes | yes |  |
| `studioScorePanel` | `index.html:5060` | syncResumeStudioChrome |  | yes | yes |  |
| `studioScoreRing` | `index.html:6213` | renderScorePanel |  |  | yes |  |
| `studioScoreRing` | `src/ui/hirely-wow-factor.js:138` | (module) |  |  | yes |  |
| `studioSectionNav` | `index.html:3124` | setStudioMode |  |  | yes |  |
| `studioSectionNav` | `index.html:5080` | refreshResumeStudio |  |  | yes |  |
| `studioSuggestionsPanel` | `index.html:5068` | syncResumeStudioChrome |  |  | yes |  |
| `studioSuggestionsPanel` | `index.html:5083` | refreshResumeStudio |  |  | yes |  |
| `studioSuggestionsPanel` | `src/tests/qa-product-lock.mjs:376` | (module) |  |  | yes |  |
| `styleStepHead` | `index.html:5042` | syncResumeStudioChrome |  |  | yes |  |
| `styleStepHead` | `src/tests/qa-clear-flow-navigation.mjs:130` | main |  |  | yes |  |
| `suggestionsList` | `index.html:2653` | renderSuggestionsPanel |  |  | yes |  |
| `suggestionsMore` | `index.html:2654` | renderSuggestionsPanel |  |  | yes |  |
| `suggestionsMore` | `scripts/product-pass-qa-yoaz.mjs:118` | main |  |  | yes |  |
| `suggestionsMore` | `scripts/review-queue-quality-report.mjs:193` | (module) |  |  | yes |  |
| `suggestionsPanel` | `index.html:2652` | renderSuggestionsPanel |  |  | yes |  |
| `suggestionsPanel` | `src/tests/qa-p7-final-lock.mjs:614` | (module) |  |  | yes |  |
| `suggestionsPanel` | `scripts/review-queue-quality-report.mjs:194` | (module) |  |  | yes |  |
| `templateGrid` | `index.html:6518` | bootTemplateRegistryDeferred |  |  | yes |  |
| `templateGrid` | `index.html:6773` | renderTemplates |  |  | yes |  |
| `templatePickerBar` | `index.html:2935` | setDocStep |  |  | yes |  |
| `templatePickerBar` | `index.html:5046` | syncResumeStudioChrome |  |  | yes |  |
| `templatePickerBar` | `index.html:5500` | showExtractionGate |  |  | yes |  |
| `templatePickerBar` | `index.html:5554` | setWorkspaceReady |  |  | yes |  |
| `templatePickerBar` | `index.html:5588` | revealResults |  |  | yes |  |
| `templatePickerBar` | `index.html:6517` | bootTemplateRegistryDeferred |  |  | yes |  |
| `templatePickerBar` | `index.html:7905` | heroUpload |  |  | yes |  |
| `templatePickerBar` | `index.html:7936` | heroUpload |  |  | yes |  |
| `templatePickerBar` | `src/tests/qa-clear-flow-navigation.mjs:131` | main |  |  | yes |  |
| `templatePickerBar` | `src/tests/qa-export-page-full-preview.mjs:154` | (module) |  |  | yes |  |
| `templatePickerBar` | `src/tests/qa-extraction-quality-step.mjs:149` | (module) |  |  | yes |  |
| `templatePickerBar` | `src/tests/qa-extraction-quality-step.mjs:161` | (module) |  |  | yes |  |
| `templatePickerBar` | `src/tests/qa-extraction-quality-step.mjs:168` | (module) |  |  | yes |  |
| `templatePickerBar` | `scripts/qa-no-regression-repair.mjs:219` | vis |  |  | yes |  |
| `templatePickerBar` | `scripts/test-template-gallery-position.mjs:128` | isVisible |  |  | yes |  |
| `templatePickerMeta` | `index.html:6760` | renderTemplates |  |  | yes |  |
| `templatePickerTitle` | `index.html:6761` | renderTemplates |  |  | yes |  |
| `toClassifyDock` | `index.html:2456` | placeToClassifyPanel |  |  | yes |  |
| `toClassifyDock` | `src/tests/qa-truth-test.mjs:232` | hasExp |  |  | yes |  |
| `toClassifyDock` | `src/tests/qa-truth-test.mjs:240` | hasExp |  |  | yes |  |
| `toClassifyDock` | `src/tests/qa-verify-ui.mjs:144` | browserChecks |  |  | yes |  |
| `toClassifyList` | `index.html:3839` | renderToClassifyPanel |  |  | yes |  |
| `toClassifyList` | `index.html:3860` | renderToClassifyPanel |  |  | yes |  |
| `toClassifyPanel` | `index.html:2455` | placeToClassifyPanel |  |  | yes |  |
| `toClassifyPanel` | `index.html:3838` | renderToClassifyPanel |  |  | yes |  |
| `toClassifyPanel` | `src/tests/qa-product-lock.mjs:375` | (module) |  |  | yes |  |
| `toClassifyPanel` | `src/tests/qa-truth-test.mjs:233` | hasExp |  |  | yes |  |
| `toClassifyPanel` | `src/tests/qa-truth-test.mjs:239` | hasExp |  |  | yes |  |
| `tools` | `index.html:7897` | heroUpload |  |  | yes |  |
| `tools` | `index.html:7902` | heroUpload |  |  | yes |  |
| `trustStrip` | `index.html:3739` | renderTrustStrip |  |  | yes |  |
| `uiLang` | `index.html:2470` | suggestionCategoryLabel |  |  | yes |  |
| `uiLang` | `index.html:2736` | getReviewBeforeTemplateLockReport |  |  | yes |  |
| `uiLang` | `index.html:3046` | stepLocked |  |  | yes |  |
| `uiLang` | `index.html:4570` | l |  |  | yes |  |
| `uiLang` | `index.html:4598` | applyI18n |  |  | yes |  |
| `uiLang` | `index.html:4615` | applyI18n |  |  | yes |  |
| `uiLang` | `index.html:6708` | lang |  |  | yes |  |
| `uiLang` | `index.html:6826` | letterLang |  |  | yes |  |
| `unlockBtn` | `index.html:8239` | name |  |  | yes |  |
| `verifyPanel` | `index.html:2458` | placeToClassifyPanel |  |  | yes |  |
| `verifyReviewBlock` | `index.html:3972` | renderVerifyReviewPanel |  |  | yes |  |
| `verifyReviewPanel` | `index.html:3973` | renderVerifyReviewPanel |  |  | yes |  |
| `verifyStatusAside` | `index.html:3914` | renderVerifyStatusAside |  |  | yes |  |
| `verifyStatusAside` | `src/tests/qa-verify-ui.mjs:142` | browserChecks |  |  | yes |  |
| `workspace` | `index.html:2862` | setDocStep |  | yes | yes |  |
| `workspace` | `index.html:6990` | syncCoverLetterWorkspace |  | yes | yes |  |
| `workspace` | `src/tests/qa-clear-flow-navigation.mjs:129` | main |  | yes | yes |  |
| `workspace` | `src/tests/qa-clear-flow-navigation.mjs:148` | main |  | yes | yes |  |
| `workspace` | `src/tests/qa-export-page-fix.mjs:124` | main |  | yes | yes |  |
| `workspace` | `src/tests/qa-export-page-full-preview.mjs:115` | setStep |  | yes | yes |  |
| `workspace` | `src/tests/qa-export-page-full-preview.mjs:153` | (module) |  | yes | yes |  |
| `workspace` | `src/tests/qa-h5-cover-letter-product.mjs:168` | vis |  | yes | yes |  |
| `workspace` | `src/tests/qa-h5-cover-letter-product.mjs:198` | vis |  | yes | yes |  |
| `workspace` | `src/tests/qa-real-visual-browser.mjs:308` | hasExp |  | yes | yes |  |
| `workspace` | `src/tests/qa-verify-ui.mjs:110` | browserChecks |  | yes | yes |  |
| `workspace` | `src/ui/hirely-wow-factor.js:18` | (module) |  | yes | yes |  |
| `workspace` | `scripts/final-acceptance-test.mjs:265` | addCheck |  | yes | yes |  |
| `workspace` | `scripts/hirely-final-repair-qa.mjs:178` | add |  | yes | yes |  |
| `workspace` | `scripts/product-pass-qa-yoaz.mjs:106` | main |  | yes | yes |  |
| `workspace` | `scripts/product-pass-qa-yoaz.mjs:115` | main |  | yes | yes |  |
| `workspace` | `scripts/qa-no-regression-repair.mjs:179` | vis |  | yes | yes |  |
| `workspace` | `scripts/qa-no-regression-repair.mjs:211` | vis |  | yes | yes |  |
| `workspace` | `scripts/qa-no-regression-repair.mjs:235` | vis |  | yes | yes |  |
| `workspace` | `scripts/qa-p0-subtraction.mjs:68` | forceDocStep |  | yes | yes |  |
| `workspace` | `scripts/qa-ui-scale-fix.mjs:46` | forceDocStep |  | yes | yes |  |
| `workspace` | `scripts/real-browser-qa-lock.mjs:93` | collectUiSnap |  | yes | yes |  |
| `workspaceGrid` | `index.html:1846` | ensureImportNeedsPasteVisible |  | yes | yes |  |
| `workspaceGrid` | `index.html:1966` | resetImportWorkspaceForFallback |  | yes | yes |  |
| `workspaceGrid` | `index.html:2008` | ensureImportReviewVisible |  | yes | yes |  |
| `workspaceGrid` | `index.html:2353` | setImportPipelineBusy |  | yes | yes |  |
| `workspaceGrid` | `index.html:2863` | setDocStep |  | yes | yes |  |
| `workspaceGrid` | `index.html:5070` | syncResumeStudioChrome |  | yes | yes |  |
| `workspaceGrid` | `index.html:5384` | applyCvPipeline |  | yes | yes |  |
| `workspaceGrid` | `index.html:5551` | setWorkspaceReady |  | yes | yes |  |
| `workspaceGrid` | `src/tests/prelaunch-browser.mjs:61` | resetApp |  | yes | yes |  |
| `workspaceGrid` | `src/tests/qa-detection-panel-consistency.mjs:112` | runPasteFallbackImport |  | yes | yes |  |
| `workspaceGrid` | `src/tests/qa-detection-panel-consistency.mjs:127` | waitImportDone |  | yes | yes |  |
| `workspaceGrid` | `src/tests/qa-end-to-end-flow-audit.mjs:97` | waitImportDone |  | yes | yes |  |
| `workspaceGrid` | `src/tests/qa-quality-gate.mjs:192` | browserGate |  | yes | yes |  |
| `workspaceGrid` | `src/tests/qa-real-user-cv.mjs:153` | run |  | yes | yes |  |
| `workspaceGrid` | `src/tests/qa-real-user-cv.mjs:176` | waitImportDone |  | yes | yes |  |
| `workspaceGrid` | `src/tests/qa-real-user-cv.mjs:400` | (module) |  | yes | yes |  |
| `workspaceGrid` | `src/tests/qa-real-visual-browser.mjs:109` | runPasteFallbackImport |  | yes | yes |  |
| `workspaceGrid` | `src/tests/qa-real-visual-browser.mjs:125` | waitImportDone |  | yes | yes |  |
| `workspaceGrid` | `src/tests/qa-template-section-order.mjs:97` | runPasteFallbackImport |  | yes | yes |  |
| `workspaceGrid` | `src/tests/qa-template-section-order.mjs:111` | waitImportDone |  | yes | yes |  |
| `workspaceGrid` | `src/tests/qa-truth-test.mjs:235` | hasExp |  | yes | yes |  |
| `workspaceGrid` | `src/tests/qa-visual-quality-lock.mjs:112` | runPasteFallbackImport |  | yes | yes |  |
| `workspaceGrid` | `src/tests/qa-visual-quality-lock.mjs:128` | waitImportDone |  | yes | yes |  |
| `workspaceGrid` | `src/ui/hirely-wow-factor.js:17` | (module) |  | yes | yes |  |
| `workspaceGrid` | `scripts/final-acceptance-test.mjs:252` | addCheck |  | yes | yes |  |
| `workspaceGrid` | `scripts/hirely-final-repair-qa.mjs:169` | add |  | yes | yes |  |
| `workspaceGrid` | `scripts/product-pass-qa-yoaz.mjs:92` | main |  | yes | yes |  |
| `workspaceGrid` | `scripts/qa-no-regression-repair.mjs:180` | vis |  | yes | yes |  |
| `workspaceGrid` | `scripts/qa-no-regression-repair.mjs:210` | vis |  | yes | yes |  |
| `workspaceGrid` | `scripts/qa-no-regression-repair.mjs:234` | vis |  | yes | yes |  |
| `workspaceGrid` | `scripts/qa-p0-subtraction.mjs:61` | waitReady |  | yes | yes |  |
| `workspaceGrid` | `scripts/qa-p0-subtraction.mjs:69` | forceDocStep |  | yes | yes |  |
| `workspaceGrid` | `scripts/qa-ui-scale-fix.mjs:47` | forceDocStep |  | yes | yes |  |
| `workspaceGrid` | `scripts/qa-ui-scale-fix.mjs:98` | main |  | yes | yes |  |
| `workspaceGrid` | `scripts/test-template-gallery-position.mjs:154` | follows |  | yes | yes |  |
| `wsImport` | `index.html:1799` | needsImportPasteUi | yes |  | yes |  |
| `wsImport` | `index.html:1845` | ensureImportNeedsPasteVisible | yes |  | yes |  |
| `wsImport` | `index.html:1885` | hideImportPasteFallback | yes |  | yes |  |
| `wsImport` | `index.html:1972` | resetImportWorkspaceForFallback | yes |  | yes |  |
| `wsImport` | `index.html:2010` | ensureImportReviewVisible | yes |  | yes |  |
| `wsImport` | `index.html:2274` | showImportPasteFallback | yes |  | yes |  |
| `wsImport` | `index.html:2352` | setImportPipelineBusy | yes |  | yes |  |
| `wsImport` | `index.html:4328` | blockImportWhenCoreFailed | yes |  | yes |  |
| `wsImport` | `index.html:4337` | unblockImportWhenCoreReady | yes |  | yes |  |
| `wsImport` | `index.html:5552` | setWorkspaceReady | yes |  | yes |  |
| `wsImport` | `src/tests/qa-detection-panel-consistency.mjs:124` | waitImportDone | yes |  | yes |  |
| `wsImport` | `src/tests/qa-end-to-end-flow-audit.mjs:95` | waitImportDone | yes |  | yes |  |
| `wsImport` | `src/tests/qa-final-ui-sync-yoaz.mjs:103` | waitImportDone | yes |  | yes |  |
| `wsImport` | `src/tests/qa-flow-lock-browser.mjs:138` | waitImportDone | yes |  | yes |  |
| `wsImport` | `src/tests/qa-flow-lock-browser.mjs:198` | cvText | yes |  | yes |  |
| `wsImport` | `src/tests/qa-format-support-audit.mjs:271` | verifyPasteFallbackUi | yes |  | yes |  |
| `wsImport` | `src/tests/qa-format-support-audit.mjs:272` | verifyPasteFallbackUi | yes |  | yes |  |
| `wsImport` | `src/tests/qa-h4-end-to-end-flow.mjs:95` | waitImportDone | yes |  | yes |  |
| `wsImport` | `src/tests/qa-h5-cover-letter-product.mjs:85` | waitImportDone | yes |  | yes |  |
| `wsImport` | `src/tests/qa-import-fallback-ux-lock.mjs:125` | startServer | yes |  | yes |  |
| `wsImport` | `src/tests/qa-import-fallback-ux-lock.mjs:136` | startServer | yes |  | yes |  |
| `wsImport` | `src/tests/qa-import-needs-paste-ui.mjs:103` | startServer | yes |  | yes |  |
| `wsImport` | `src/tests/qa-import-needs-paste-ui.mjs:124` | startServer | yes |  | yes |  |
| `wsImport` | `src/tests/qa-import-needs-paste-ui.mjs:129` | startServer | yes |  | yes |  |
| `wsImport` | `src/tests/qa-import-needs-paste-ui.mjs:180` | (module) | yes |  | yes |  |
| `wsImport` | `src/tests/qa-import-needs-paste-ui.mjs:223` | (module) | yes |  | yes |  |
| `wsImport` | `src/tests/qa-import-reality-check.mjs:268` | (module) | yes |  | yes |  |
| `wsImport` | `src/tests/qa-import-reality-check.mjs:270` | (module) | yes |  | yes |  |
| `wsImport` | `src/tests/qa-import-silent.mjs:73` | waitForOutcome | yes |  | yes |  |
| `wsImport` | `src/tests/qa-import-silent.mjs:136` | onConsole | yes |  | yes |  |
| `wsImport` | `src/tests/qa-import-silent.mjs:147` | onConsole | yes |  | yes |  |
| `wsImport` | `src/tests/qa-mvp-recovery.mjs:96` | onConsole | yes |  | yes |  |
| `wsImport` | `src/tests/qa-mvp-recovery.mjs:145` | tc | yes |  | yes |  |
| `wsImport` | `src/tests/qa-ocr-browser-smoke.mjs:154` | runSmoke | yes |  | yes |  |
| `wsImport` | `src/tests/qa-ocr-browser-smoke.mjs:156` | runSmoke | yes |  | yes |  |
| `wsImport` | `src/tests/qa-p7-final-lock.mjs:257` | waitImportDone | yes |  | yes |  |
| `wsImport` | `src/tests/qa-pdf-timeout-fallback.mjs:142` | startServer | yes |  | yes |  |
| `wsImport` | `src/tests/qa-product-lock.mjs:90` | waitImportDone | yes |  | yes |  |
| `wsImport` | `src/tests/qa-real-cv-benchmark-pack.mjs:123` | runBenchmarkCase | yes |  | yes |  |
| `wsImport` | `src/tests/qa-real-cv-benchmark-pack.mjs:125` | runBenchmarkCase | yes |  | yes |  |
| `wsImport` | `src/tests/qa-real-format-qa.mjs:280` | runBrowserStuckCheck | yes |  | yes |  |
| `wsImport` | `src/tests/qa-real-format-qa.mjs:282` | runBrowserStuckCheck | yes |  | yes |  |
| `wsImport` | `src/tests/qa-real-user-cv.mjs:172` | waitImportDone | yes |  | yes |  |
| `wsImport` | `src/tests/qa-real-visual-browser.mjs:121` | waitImportDone | yes |  | yes |  |
| `wsImport` | `src/tests/qa-real-world-import-truth.mjs:163` | runImportOnPage | yes |  | yes |  |
| `wsImport` | `src/tests/qa-real-world-import-truth.mjs:165` | runImportOnPage | yes |  | yes |  |
| `wsImport` | `src/tests/qa-template-section-order.mjs:108` | waitImportDone | yes |  | yes |  |
| `wsImport` | `src/tests/qa-template-v1-selector.mjs:71` | waitImportDone | yes |  | yes |  |
| `wsImport` | `src/tests/qa-verify-ui.mjs:109` | browserChecks | yes |  | yes |  |
| `wsImport` | `src/tests/qa-visual-quality-lock.mjs:124` | waitImportDone | yes |  | yes |  |
| `wsImport` | `src/ui/hirely-wow-factor.js:36` | (module) | yes |  | yes |  |
| `wsImport` | `src/ui/product/import-flow-v2.js:119` | (module) | yes |  | yes |  |
| `wsImport` | `scripts/final-browser-qa.mjs:118` | waitImportDone | yes |  | yes |  |
| `wsImport` | `scripts/qa-boot-regression.mjs:199` | runOptionalDomScenario | yes |  | yes |  |
| `wsImport` | `scripts/real-browser-qa-lock.mjs:103` | collectUiSnap | yes |  | yes |  |
| `wsImport` | `scripts/real-world-cv-qa-lock.mjs:96` | waitImportDone | yes |  | yes |  |
| `wsImport` | `scripts/test-boot-fix.mjs:82` | main | yes |  | yes |  |
| `wsImport` | `scripts/test-template-gallery-position.mjs:79` | waitImportDone | yes |  | yes |  |
| `wsImport` | `scripts/visible-qa-yoaz.mjs:75` | waitImportDone | yes |  | yes |  |
| `wsInsights` | `index.html:5553` | setWorkspaceReady |  | yes | yes |  |
| `wsProduct` | `index.html:1968` | resetImportWorkspaceForFallback |  | yes | yes |  |
| `wsProduct` | `index.html:2007` | ensureImportReviewVisible |  | yes | yes |  |
| `wsProduct` | `index.html:5382` | applyCvPipeline |  | yes | yes |  |
| `wsProduct` | `index.html:5550` | setWorkspaceReady |  | yes | yes |  |
| `wsProduct` | `index.html:5588` | revealResults |  | yes | yes |  |
| `wsProduct` | `index.html:5749` | wsProductVisible |  | yes | yes |  |
| `wsProduct` | `index.html:8125` | resetExtractionState |  | yes | yes |  |
| `wsProduct` | `src/tests/qa-import-fallback-ux-lock.mjs:175` | (module) |  | yes | yes |  |
| `wsProduct` | `src/tests/qa-import-fallback-ux-lock.mjs:185` | (module) |  | yes | yes |  |
| `wsProduct` | `src/tests/qa-import-needs-paste-ui.mjs:204` | (module) |  | yes | yes |  |
| `wsProduct` | `src/tests/qa-import-needs-paste-ui.mjs:218` | (module) |  | yes | yes |  |
| `wsProduct` | `src/tests/qa-pdf-timeout-fallback.mjs:175` | (module) |  | yes | yes |  |
| `wsProduct` | `src/tests/qa-pdf-timeout-fallback.mjs:185` | (module) |  | yes | yes |  |
| `wsProduct` | `scripts/qa-no-regression-repair.mjs:217` | vis |  | yes | yes |  |

## Production runtime (`index.html` only)

| Severity | DOM ID | Line | Function | Operation | Guarded? |
|----------|--------|------|----------|-----------|----------|
| MEDIUM | `exportFinalPanel` | 8288 | previewName | classList | yes |
| MEDIUM | `hirelyDebugPanel` | 3272 | renderExtractionDebug | lookup | **no** |
| MEDIUM | `hirelyDebugPanel` | 3365 | renderParserTracePanel | lookup | yes |
| MEDIUM | `hirelyDebugPanel` | 3400 | renderParserObservability | lookup | yes |
| MEDIUM | `hirelyDebugPanel` | 8316 | previewName | lookup | yes |
| MEDIUM | `hirelyForensicPanel` | 1829 | unlockPageUI | lookup | yes |
| MEDIUM | `hirelyForensicPanel` | 3178 | renderForensicMode | lookup | yes |
| MEDIUM | `hirelyForensicPanel` | 8319 | previewName | innerHTML | yes |
| MEDIUM | `letterText` | 6873 | renderCoverLetterPreview | lookup | **no** |
| MEDIUM | `letterText` | 7028 | renderOutputs | value | yes |
| MEDIUM | `letterText` | 7068 | renderOutputs | lookup | yes |
| MEDIUM | `letterText` | 7072 | renderOutputs | lookup | yes |
| MEDIUM | `letterText` | 8229 | name | addEventListener | yes |
| MEDIUM | `linkedinText` | 7027 | renderOutputs | value | yes |
| MEDIUM | `linkedinText` | 7060 | renderOutputs | lookup | yes |
| MEDIUM | `rawDetails` | 8122 | resetExtractionState | lookup | yes |
| MEDIUM | `resultFlow` | 5518 | updateResultFlow | lookup | yes |
| MEDIUM | `templateGallery` | 1970 | resetImportWorkspaceForFallback | lookup | yes |
| LOW | `exportFinalCopyCv` | 8196 | (module) | lookup | yes |
| LOW | `exportFinalCvPdf` | 8192 | (module) | lookup | yes |
| LOW | `exportFinalLetterPdf` | 8194 | (module) | lookup | yes |
| LOW | `exportFinalScore` | 8289 | previewName | textContent | yes |
| LOW | `generateBtn` | 5610 | updateGenerateBtnState | lookup | yes |
| LOW | `hirelyParserObs` | 3416 | renderParserObservability | lookup | yes |
| LOW | `hirelyTestResult` | 7872 | showTestImportFile | lookup | yes |
| LOW | `resetBtn` | 8132 | resetExtractionState | lookup | yes |

## Notes

- `cvPreview` contract id resolves to live `#cvDoc` in `dom-safe.js`.
- Guarded = nearby `if (el)`, optional chaining, `setHTML`/`setText`/`trackRenderHtml`, or try/catch within 8 lines.
- QA-only files under `scripts/` may reference probes; production boot path is `index.html` + `src/ui/runtime/*`.
- **No CRITICAL** = no required missing DOM with unguarded crash writes on boot path.