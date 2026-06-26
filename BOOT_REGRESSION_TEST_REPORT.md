# BOOT Regression Test Report

**Status:** PASS
**Engine:** HIRELY_BOOT_REGRESSION_V1
**Generated:** 2026-06-18T10:39:31.733Z

## Summary

Automated regression for boot trace corruption seeds and P0-removed optional DOM panels.

| Metric | Value |
|--------|-------|
| Total checks | 31 |
| Passed | 31 |
| Failed | 0 |

## Test cases

| # | Case | Group |
|---|------|-------|
| 1 | `__HIRELY_CORE_BOOT_TRACE__` undefined | trace_undefined |
| 2 | `__HIRELY_CORE_BOOT_TRACE__` is `{}` | trace_empty_object |
| 3 | `__HIRELY_CORE_BOOT_TRACE__` is string | trace_string |
| 4 | Optional DOM panels missing | optional_dom |
| 5 | Debug panels removed | optional_dom |
| 6 | `renderOutputs()` with missing optional target | optional_dom |
| 7 | `renderAll()` before optional panels exist | optional_dom |

## Expected behaviour

- App boots (`CORE_BOOT_OK` or degraded, never failed from trace/DOM)
- No `TypeError` (`push is not a function`, null `innerHTML`)
- No `CORE_BOOT_FAILED` from regression paths
- Missing optional nodes logged via `MISSING_DOM_TARGET` / `__HIRELY_MISSING_DOM__` only

## Results

### trace_undefined

- [x] **trace_undefined_app_boots** — ok
- [x] **trace_undefined_trace_is_array** — 85
- [x] **trace_undefined_trace_push_safe**
- [x] **trace_undefined_no_type_error** — clean
- [x] **trace_undefined_no_core_boot_failed** — ok
- [x] **trace_undefined_core_boot_ok_marker** — trace CORE_IMPORT_OK or bootOrder CORE_BOOT_OK

### trace_empty_object

- [x] **trace_empty_object_app_boots** — ok
- [x] **trace_empty_object_trace_is_array** — 85
- [x] **trace_empty_object_trace_push_safe**
- [x] **trace_empty_object_no_type_error** — clean
- [x] **trace_empty_object_no_core_boot_failed** — ok
- [x] **trace_empty_object_core_boot_ok_marker** — trace CORE_IMPORT_OK or bootOrder CORE_BOOT_OK

### trace_string

- [x] **trace_string_app_boots** — ok
- [x] **trace_string_trace_is_array** — 85
- [x] **trace_string_trace_push_safe**
- [x] **trace_string_no_type_error** — clean
- [x] **trace_string_no_core_boot_failed** — ok
- [x] **trace_string_core_boot_ok_marker** — trace CORE_IMPORT_OK or bootOrder CORE_BOOT_OK

### optional_dom

- [x] **optional_panels_missing** — auditPanelInner, linkedinText, letterText, auditPanel, linkedinPanel, letterPanel
- [x] **debug_panels_removed** — auditPanelInner, linkedinText, letterText
- [x] **required_dom_present** — {"app":true,"wsImport":true,"cvDoc":true,"docNav":true}
- [x] **render_outputs_returns_status** — skipped=auditPanelInner,linkedinText,letterText
- [x] **render_outputs_missing_target** — ok
- [x] **render_all_before_optional_panels** — ok
- [x] **dom_contract_loaded** — HirelyDomContract
- [x] **missing_optional_logged_not_fatal** — missingDom=auditPanelInner,auditPanel,linkedinPanel,letterPanel,linkedinText,letterText,hirelyDebugPanel,hirelyForensicPanel,extractionGate,extractionAlert,exportFinalPanel,hirelyTestClickBtn,hirelyTestImport,resultFlow,templateGallery,rawDetails,auditPanelInner,auditPanel,linkedinPanel,letterPanel,linkedinText,letterText,hirelyDebugPanel,hirelyForensicPanel,extractionGate,extractionAlert,exportFinalPanel,hirelyTestClickBtn,hirelyTestImport,resultFlow,templateGallery,rawDetails,auditPanelInner,auditPanel,linkedinPanel,letterPanel,linkedinText,letterText,hirelyDebugPanel,hirelyForensicPanel,extractionGate,extractionAlert,exportFinalPanel,hirelyTestClickBtn,hirelyTestImport,resultFlow,templateGallery,rawDetails,auditPanelInner,auditPanelInner,auditPanel,linkedinPanel,letterPanel,linkedinText,letterText,hirelyDebugPanel,hirelyForensicPanel,extractionGate,extractionAlert,exportFinalPanel,hirelyTestClickBtn,hirelyTestImport,resultFlow,templateGallery,rawDetails,auditPanelInner,auditPanel,linkedinPanel,letterPanel,linkedinText,letterText,hirelyDebugPanel,hirelyForensicPanel,extractionGate,extractionAlert,exportFinalPanel,hirelyTestClickBtn,hirelyTestImport,resultFlow,templateGallery,rawDetails,auditPanelInner,auditPanel,linkedinPanel,letterPanel,linkedinText,letterText,hirelyDebugPanel,hirelyForensicPanel,extractionGate,extractionAlert,exportFinalPanel,hirelyTestClickBtn,hirelyTestImport,resultFlow,templateGallery,rawDetails,auditPanelInner,auditPanelInner,auditPanelInner,auditPanel,linkedinPanel,letterPanel,linkedinText,letterText,hirelyDebugPanel,hirelyForensicPanel,extractionGate,extractionAlert,exportFinalPanel,hirelyTestClickBtn,hirelyTestImport,resultFlow,templateGallery,rawDetails; trace=auditPanelInner,auditPanel,linkedinPanel,letterPanel,linkedinText,letterText,hirelyDebugPanel,hirelyForensicPanel,extractionGate,extractionAlert,exportFinalPanel,hirelyTestClickBtn,hirelyTestImport,resultFlow,templateGallery,rawDetails,auditPanelInner,auditPanel,linkedinPanel,letterPanel,linkedinText,letterText,hirelyDebugPanel,hirelyForensicPanel,extractionGate,extractionAlert,exportFinalPanel,hirelyTestClickBtn,hirelyTestImport,resultFlow,templateGallery,rawDetails,auditPanelInner,auditPanel,linkedinPanel,letterPanel,linkedinText,letterText,hirelyDebugPanel,hirelyForensicPanel,extractionGate,extractionAlert,exportFinalPanel,hirelyTestClickBtn,hirelyTestImport,resultFlow,templateGallery,rawDetails,auditPanelInner,auditPanelInner,auditPanel,linkedinPanel,letterPanel,linkedinText,letterText,hirelyDebugPanel,hirelyForensicPanel,extractionGate,extractionAlert,exportFinalPanel,hirelyTestClickBtn,hirelyTestImport,resultFlow,templateGallery,rawDetails,auditPanelInner,auditPanel,linkedinPanel,letterPanel,linkedinText,letterText,hirelyDebugPanel,hirelyForensicPanel,extractionGate,extractionAlert,exportFinalPanel,hirelyTestClickBtn,hirelyTestImport,resultFlow,templateGallery,rawDetails,auditPanelInner,auditPanel,linkedinPanel,letterPanel,linkedinText,letterText,hirelyDebugPanel,hirelyForensicPanel,extractionGate,extractionAlert,exportFinalPanel,hirelyTestClickBtn,hirelyTestImport,resultFlow,templateGallery,rawDetails,auditPanelInner,auditPanelInner,auditPanelInner,auditPanel,linkedinPanel,letterPanel,linkedinText,letterText,hirelyDebugPanel,hirelyForensicPanel,extractionGate,extractionAlert,exportFinalPanel,hirelyTestClickBtn,hirelyTestImport,resultFlow,templateGallery,rawDetails
- [x] **missing_dom_warnings_only** — ok
- [x] **optional_dom_no_type_error** — clean
- [x] **optional_dom_no_core_boot_failed** — ok
- [x] **optional_dom_failure_banner_hidden** — engineHealth=IMPORT_READY; redHidden=true; degradedOnly=false
- [x] **optional_dom_engine_not_failed** — IMPORT_READY

## Run

```bash
npm run qa:boot
```
