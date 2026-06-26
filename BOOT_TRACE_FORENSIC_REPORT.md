# BOOT_TRACE_FORENSIC_REPORT

**Status:** PASS
**Generated:** 2026-06-15T10:14:20.443Z

## Canonical boot chain

- `BOOT_START`
- `DOM_CONTRACT_READY`
- `CORE_IMPORT_STARTED`
- `CORE_IMPORT_OK`
- `TEMPLATE_REGISTRY_READY`
- `RENDER_OUTPUTS_START`
- `RENDER_OUTPUTS_OK`
- `RENDER_ALL_START`
- `RENDER_ALL_OK`
- `UI_READY`
- `IMPORT_READY`

## First failure

_No failure recorded — boot chain completed or still in progress._

## Chain completion (debug run)

| Step | Status |
|------|--------|
| BOOT_START | PASS |
| DOM_CONTRACT_READY | PASS |
| CORE_IMPORT_STARTED | PASS |
| CORE_IMPORT_OK | PASS |
| TEMPLATE_REGISTRY_READY | PASS |
| RENDER_OUTPUTS_START | PASS |
| RENDER_OUTPUTS_OK | PASS |
| RENDER_ALL_START | PASS |
| RENDER_ALL_OK | PASS |
| UI_READY | PASS |
| IMPORT_READY | PASS |

**Missing steps:** none

## Production console policy

- Boot marker strings in production console: none (expected)
- Boot marker strings with `?debug=true`: BOOT_START, CORE_IMPORT_STARTED, CORE_IMPORT_OK, TEMPLATE_REGISTRY_READY, UI_READY
- Production page errors: none

## Debug run summary

```json
{
  "coreBoot": "ok",
  "engineHealth": "DEGRADED",
  "completed": [
    "BOOT_START",
    "DOM_CONTRACT_READY",
    "CORE_IMPORT_STARTED",
    "CORE_IMPORT_OK",
    "TEMPLATE_REGISTRY_READY",
    "RENDER_OUTPUTS_START",
    "RENDER_OUTPUTS_OK",
    "RENDER_ALL_START",
    "RENDER_ALL_OK",
    "UI_READY",
    "IMPORT_READY"
  ],
  "missing": [],
  "bootOrder": [
    "UPLOAD_BIND_OK",
    "IMPORT_UI_READY",
    "CORE_BOOT_OK",
    "TEMPLATE_REGISTRY_READY"
  ],
  "traceLength": 20
}
```

## Trace tail (debug, last 24 entries)

```json
[
  {
    "tag": "BOOT_START",
    "status": "ok",
    "source": "src/ui/runtime/boot-trace.js",
    "timestamp": "2026-06-15T10:14:18.143Z"
  },
  {
    "tag": "DOM_CONTRACT_READY",
    "status": "ok",
    "source": "src/ui/runtime/dom-contract.js",
    "requiredCount": 14,
    "missingRequired": [],
    "timestamp": "2026-06-15T10:14:18.155Z"
  },
  {
    "tag": "DOM_VALIDATED",
    "timestamp": "2026-06-15T10:14:18.204Z"
  },
  {
    "tag": "CORE_IMPORT_STARTED",
    "status": "ok",
    "source": "index.html:getHirelyCore",
    "timestamp": "2026-06-15T10:14:18.204Z"
  },
  {
    "tag": "CORE_BOOT_FETCH_START",
    "timestamp": "2026-06-15T10:14:18.204Z"
  },
  {
    "phase": "BOOT_START",
    "status": "ok",
    "at": "2026-06-15T10:14:18.290Z",
    "timestamp": "2026-06-15T10:14:18.290Z"
  },
  {
    "phase": "CORE_BOOT",
    "module": "src/core/index.js",
    "status": "loading",
    "at": "2026-06-15T10:14:18.290Z",
    "timestamp": "2026-06-15T10:14:18.290Z"
  },
  {
    "phase": "CORE_BOOT",
    "module": "src/core/index.js",
    "status": "loaded",
    "tier": "full",
    "missingRequired": [],
    "missingOptional": [],
    "at": "2026-06-15T10:14:19.007Z",
    "timestamp": "2026-06-15T10:14:19.007Z"
  },
  {
    "phase": "BOOT_START",
    "status": "ok",
    "at": "2026-06-15T10:14:18.290Z",
    "timestamp": "2026-06-15T10:14:18.290Z"
  },
  {
    "phase": "CORE_BOOT",
    "module": "src/core/index.js",
    "status": "loading",
    "at": "2026-06-15T10:14:18.290Z",
    "timestamp": "2026-06-15T10:14:18.290Z"
  },
  {
    "phase": "CORE_BOOT",
    "module": "src/core/index.js",
    "status": "loaded",
    "tier": "full",
    "missingRequired": [],
    "missingOptional": [],
    "at": "2026-06-15T10:14:19.007Z",
    "timestamp": "2026-06-15T10:14:19.007Z"
  },
  {
    "tag": "CORE_IMPORT_OK",
    "status": "ok",
    "source": "index.html:reportHirelyCoreStatus",
    "timestamp": "2026-06-15T10:14:19.008Z"
  },
  {
    "tag": "IMPORT_READY",
    "status": "ok",
    "source": "index.html:unblockImportWhenCoreReady",
    "timestamp": "2026-06-15T10:14:19.008Z"
  },
  {
    "tag": "TEMPLATE_REGISTRY_READY",
    "status": "ok",
    "source": "index.html:bootTemplateRegistryDeferred",
    "timestamp": "2026-06-15T10:14:19.009Z"
  },
  {
    "tag": "RENDER_ALL_START",
    "status": "ok",
    "source": "index.html:renderAll",
    "timestamp": "2026-06-15T10:14:19.010Z"
  },
  {
    "tag": "RENDER_OUTPUTS_START",
    "status": "ok",
    "source": "index.html:renderOutputs",
    "timestamp": "2026-06-15T10:14:19.010Z"
  },
  {
    "tag": "MISSING_DOM_TARGET",
    "id": "auditPanelInner",
    "source": "renderOutputs",
    "timestamp": "2026-06-15T10:14:19.011Z"
  },
  {
    "tag": "RENDER_OUTPUTS_OK",
    "status": "ok",
    "source": "index.html:renderOutputs",
    "rendered": 0,
    "skipped": 3,
    "missingRequired": [],
    "timestamp": "2026-06-15T10:14:19.011Z"
  },
  {
    "tag": "RENDER_ALL_OK",
    "status": "ok",
    "source": "index.html:renderAll",
    "phases": 10,
    "missingRequired": [],
    "timestamp": "2026-06-15T10:14:19.012Z"
  },
  {
    "tag": "UI_READY",
    "status": "ok",
    "source": "index.html:getHirelyCore.then",
    "timestamp": "2026-06-15T10:14:19.018Z"
  }
]
```

## Implementation

- `src/ui/runtime/boot-trace.js` — canonical milestones; console only when `?debug=true`
- `src/ui/runtime/dom-contract.js` — `DOM_CONTRACT_READY` + missing required DOM capture
- `src/core/boot/core-boot-loader.mjs` — loader logs gated to debug URL
- `index.html` — `bootTraceStep` / `bootTraceFail` at render + core import boundaries

## Verify

```bash
npm run qa:boot-trace-forensic
```
