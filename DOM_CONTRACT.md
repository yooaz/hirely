# Hirely DOM Contract (post P0 subtraction)

Runtime contract between simplified HTML shell and `index.html` boot/render code.

**Source of truth:** `src/ui/runtime/dom-contract.js` → `window.HirelyDomContract`

## Rules

| Situation | Behaviour |
|-----------|-----------|
| Required DOM missing | `console.error`, `MISSING_REQUIRED_DOM` trace, blocks meaningful boot |
| Optional DOM missing | `MISSING_DOM_TARGET` trace, `__HIRELY_MISSING_DOM__` entry, app continues |
| `setHTML(id)` on missing optional id | returns `{ ok: false, required: false }` |
| `setHTML(id)` on missing required id | returns `{ ok: false, required: true }` |

## Required DOM IDs

Must exist in `index.html` for product boot.

| ID | Role |
|----|------|
| `app` | Application root |
| `workspace` | Workspace container |
| `workspaceGrid` | Main grid layout |
| `wsImport` | Import panel / drop zone host |
| `drop` | Upload drop zone (`data-upload-zone`) |
| `fileInput` | Hidden file input |
| `docNav` | Review / Style / Export navigation |
| `wsProduct` | CV product column |
| `cvPanel` | CV output panel |
| `cvDoc` | CV preview mount |
| `importPasteFallback` | Paste recovery UI |
| `statusText` | Import status line |
| `progress` | Progress bar container |
| `progressBar` | Progress bar fill |

## Optional DOM IDs

Removed, merged, or debug-only. Missing nodes must not crash boot.

| ID | Former role | Current handling |
|----|-------------|------------------|
| `auditPanelInner` | Dev audit tab body | `renderOutputs` → `skipped` |
| `auditPanel` | Audit tab shell | CSS hidden in prod |
| `linkedinPanel` | LinkedIn export tab | Removed |
| `letterPanel` | Cover letter tab | Removed |
| `linkedinText` | LinkedIn textarea | Guarded `.value` writes |
| `letterText` | Letter textarea | Guarded `.value` writes |
| `hirelyDebugPanel` | Pipeline debug | Debug mode only |
| `hirelyForensicPanel` | OCR forensic | Forensic mode only |
| `pipelineReportPanel` | Pipeline report | Debug only |
| `importDebugPanel` | Import debug host | Debug only |
| `extractionGate` | Legacy gate overlay | State flag only (no DOM) |
| `extractionAlert` | Merged into paste fallback | `setExtractionAlert` no-op |
| `exportFinalPanel` | Old export summary | Removed; `cvExportBar` used |
| `hirelyTestClickBtn` | QA click probe | Debug only |
| `hirelyTestImport` | QA import strip | Debug only |
| `recruiterReviewPanel` | Duplicate recruiter UI | Hidden in prod |
| `studioScorePanel` | Duplicate score UI | Studio debug path |
| `wsInsights` | Legacy insights column | Still in DOM; optional visibility |
| `coverLetterWorkspace` | Letter editor block | Hidden unless opened |
| `resultFlow` | Dev flow steps | `updateResultFlow` guards |
| `templateGallery` | Legacy gallery id | Replaced by `templateGrid` |
| `rawDetails` | Raw text editor | Debug only |

## Boot trace

All boot events go through `hirelyTrace(event)` — never `window.__HIRELY_CORE_BOOT_TRACE__.push` directly.

If trace is corrupted (object/string), legacy value is stored as `__HIRELY_LEGACY_BOOT_TRACE__` and trace is reinitialized as an array (preserving `.steps` when present).

## Render contracts

### `renderOutputs()`

Returns:

```javascript
{
  rendered: string[],      // ids successfully updated
  skipped: string[],       // optional ids not present
  missingRequired: string[] // required ids missing (should be empty in prod)
}
```

Stored on `window.__HIRELY_LAST_RENDER_OUTPUTS__`.

### `renderAll()`

Returns phase report; never throws. Stored on `window.__HIRELY_LAST_RENDER_ALL__`.

Debug only: `#hirelyBootHealth` overlay (`renderBootHealthOverlay`).

## QA

```bash
npm run qa:boot
```
