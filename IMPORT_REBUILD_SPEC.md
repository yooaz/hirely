# Import Rebuild Spec

**Version:** `IMPORT_REBUILD_V1`  
**Generated:** 2026-06-15  
**Status:** SPEC — implementation not started

## Mission

**Import = one action, one message, one escape hatch, one exit.**

The user drops a file (or pastes when needed), sees a single status line while we work, gets one recovery sheet if something fails, and follows one path to Review. No parallel import UIs, no competing status feeds, no secondary actions visible by default.

---

## Product intent

| Principle | Rule |
|-----------|------|
| One input | **Single dropzone** — all file types, including LinkedIn bundles, through `#drop` |
| One voice | **Single status line** — one element updates for idle → loading → success → error |
| One recovery | **Single recovery sheet** — paste, OCR fail, empty CV, partial extract → same surface |
| One exit | **Single continue path** — success auto-advances to Review; recovery uses sheet **Continue** only |
| Quiet by default | LinkedIn block, options, detected profile, photo, debug — **hidden** until `?debug=1` or advanced |

---

## Target layout

### Default (idle)

```
┌─────────────────────────────────────────────────────────────┐
│  Progress nav — Import · Review · Style · Export            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              ┌─────────────────────────┐                    │
│              │                         │                    │
│              │    DROP ZONE (only)     │                    │
│              │    PDF · Word · text    │                    │
│              │                         │                    │
│              └─────────────────────────┘                    │
│                                                             │
│              Reading your CV…                    ← 1 line   │
│              ▓▓▓▓▓▓▓░░░░░░░░  48%                ← optional thin bar │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Loading

- Dropzone disabled (visual only — still shows file name).
- **Only** `#importStatusLine` updates (no duplicate labels).
- Optional: slim progress bar bound to same state machine (not a second stepper).

### Recovery sheet (overlay / bottom sheet)

Triggered by: `IMPORT_NEEDS_PASTE`, OCR timeout, `INVALID` CV, unrecoverable extract.

```
┌─────────────────────────────────────────────────────────────┐
│  ░░░░░░░░░░░ dimmed dropzone ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Recovery title (context-specific)                     │ │
│  │  One-line explanation                                  │ │
│  │  [ textarea — paste CV text ]          (when needed)    │ │
│  │                                                        │ │
│  │  [ Continue ]              [ Try another file ]          │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

`Try another file` is secondary but **inside** the sheet only — not a separate visible import action on the idle screen.

### Success

- Status line: *"CV ready"* (or i18n equivalent).
- **Auto-continue** to Review via existing `ensureImportReviewVisible()` → `setDocStep('edit')`.
- No compact import panel, no second success banner, no manual "Analyze" CTA on Import.

---

## Target DOM

Replace `#wsImport` interior with:

```html
<aside class="importStep" id="wsImport" aria-label="Import">
  <div class="importStep__dropzone" id="drop" data-upload-zone tabindex="0" role="button">
    <input type="file" id="fileInput" hidden
      accept=".pdf,.doc,.docx,.txt,.json,.csv,.zip,.png,.jpg,.jpeg,.webp,*/*" />
    <div class="importStep__dropIcon" aria-hidden="true">…</div>
    <p class="importStep__dropTitle" data-i="dropTitle">Drop your CV</p>
    <p class="importStep__dropHint" data-i="dropHint">PDF, Word, or text</p>
    <p class="importStep__fileName" id="importFileName" aria-live="polite"></p>
  </div>

  <p class="importStep__status" id="importStatusLine" aria-live="polite" data-i="importStatusIdle">
    No file imported yet.
  </p>

  <div class="importStep__progress" id="importProgress" hidden aria-hidden="true">
    <span class="importStep__progressBar" id="importProgressBar"></span>
  </div>

  <!-- Single recovery sheet — hidden until recovery mode -->
  <dialog class="importRecoverySheet" id="importRecoverySheet" aria-labelledby="importRecoveryTitle">
    <h2 id="importRecoveryTitle" class="importRecoverySheet__title"></h2>
    <p id="importRecoveryLead" class="importRecoverySheet__lead"></p>
    <textarea id="importRecoveryText" class="importRecoverySheet__textarea hidden"
      rows="12" aria-label="CV text"></textarea>
    <div class="importRecoverySheet__actions">
      <button type="button" class="btn primary" id="importRecoveryContinue" data-i="importRecoveryContinue">
        Continue
      </button>
      <button type="button" class="btn ghost" id="importRecoveryRetry" data-i="importRecoveryRetry">
        Try another file
      </button>
    </div>
  </dialog>
</aside>
```

### ID migration map

| Current | Fate | New |
|---------|------|-----|
| `#drop` | **Keep** (restyled) | `#drop` inside `importStep__dropzone` |
| `#fileInput` | **Keep** | same |
| `#importLiveStatus` | **Merge** | `#importStatusLine` |
| `#statusText` | **Merge** | `#importStatusLine` |
| `#statusIcon` + `#statusRow` | **Remove** from Import UI | status conveyed by line + optional bar |
| `#importLoadingDetail` | **Merge** | append to status line as subtitle OR drop |
| `#importLoadingWait` | **Remove** | folded into status copy |
| `#importLoadingPasteHint` | **Remove** | recovery sheet only |
| `#importAnalysisStages` | **Remove** prod | debug only |
| `#importFlowV2` | **Remove** prod | debug only |
| `#progress` / `#progressBar` | **Rename** | `#importProgress` / `#importProgressBar` |
| `#importPasteFallback` | **Replace** | `#importRecoverySheet` |
| `#importPasteFallbackApply` | **Replace** | `#importRecoveryContinue` |
| `#importPasteFallbackReplace` | **Replace** | `#importRecoveryRetry` |
| `#extractionRecoveryPanel` on Import | **Remove** | merged into recovery sheet |
| `#linkedinImportBlock` | **Hide** default | same `#fileInput` multi-file |
| `#detectedDetails`, `#toolsMore`, `#roleInput`, etc. | **Hide** default | Review / debug |

**DOM contract:** keep `drop`, `fileInput`, `wsImport`, `statusText` — either alias `statusText` → `importStatusLine` or update `dom-contract.js`.

---

## Single status line

### State machine → copy

| Phase | `importStatusLine` example (EN) | Progress bar |
|-------|----------------------------------|--------------|
| `idle` | No file imported yet. | hidden |
| `reading` | Reading your document… | 10% |
| `extracting` | Extracting content… | 35% |
| `structuring` | Organizing sections… | 62% |
| `building` | Preparing your CV… | 85% |
| `success` | CV ready. | 100% → hide |
| `error` | We couldn't read this file. | hidden |
| `recovery` | (hidden — sheet owns copy) | hidden |

### Implementation

New module: `src/ui/import/import-status.js`

```js
export function setImportStatus(phase, { detail, fileName, progress } = {}) {}
```

**Rules:**

1. Only `setImportStatus()` may write `#importStatusLine` during Import.
2. Delete parallel writers: `setImportLiveStatus`, `show()` → `#statusText` on Import step, `importCompactStatus`, `cvLoadingLabel` updates during import.
3. Long OCR waits: update the **same line** (e.g. append "This may take a moment.") — no second hint element.
4. Forensics / `importLog()` unchanged — telemetry stays, UI does not multiply.

---

## Single recovery sheet

Unify these into `#importRecoverySheet`:

| Current surface | Trigger | Merged behavior |
|-----------------|---------|-----------------|
| `#importPasteFallback` | `IMPORT_NEEDS_PASTE`, OCR fail | Show textarea + Continue |
| `#extractionRecoveryPanel` on `docStep-import` | `validateCvData` INVALID | Show issue list (max 3 bullets) + Continue disabled until fixed OR paste |
| `#importStatusWarn` in cv stage | render fail | Sheet on Import, not preview |
| Early paste offer (`importPasteFallback--early`) | slow OCR timer | **Remove** — wait, then sheet at timeout |
| `renderEmptyCvProtectionRecovery` on Import | empty CV | Sheet body |

### Sheet modes

| Mode | `id` | Textarea | Continue enabled when |
|------|------|----------|------------------------|
| `paste` | `IMPORT_NEEDS_PASTE` | visible | `text.length >= RAW_TEXT_THRESHOLD` |
| `invalid` | `CV_INVALID` | optional | validation `status !== 'INVALID'` |
| `retry` | `IMPORT_FAILED` | hidden | never — only Retry file |

### Single continue handler

```js
// import-recovery.js
async function onImportRecoveryContinue() {
  if (sheetMode === 'paste') return applyPasteAndPipeline();
  if (sheetMode === 'invalid') return retryValidationOrPaste();
  // no other modes call Continue
}
```

Replace all direct calls to `showImportPasteFallback()` with `openImportRecoverySheet(mode, payload)`.

**Remove:** `#extractionRecoveryPanel` visibility on `docStep-import` (CSS L263–264 in `index.html`).

---

## Single continue path

### Happy path (no sheet)

```
drop / file pick → pipeline → CV_READY → ensureImportReviewVisible() → setDocStep('edit')
```

- User does **not** click Continue on success.
- Remove post-import compact panel (`#importCompact`) from default UX.
- Remove auto-scroll to `#wsProduct` competing with status — one scroll target.

### Recovery path (sheet open)

```
failure → openImportRecoverySheet → user fixes → importRecoveryContinue → pipeline → close sheet → happy path
```

### Entry points (converge to one)

| Entry | Today | After |
|-------|-------|-------|
| Hero `#heroUploadBtn` | Opens file picker | Same — calls `triggerFilePicker()` → `#fileInput` |
| Dropzone click/drop | `handleFileImport` | Same |
| LinkedIn button | Separate input + UI | **Removed** — multi-file on `#fileInput` only |
| Paste from hidden `#cvText` | Legacy | **Removed** from Import — sheet textarea only |
| `#importPasteFallbackApply` | Paste continue | `#importRecoveryContinue` only |

**No** `ctaAnalyze`, **no** second import CTA in workspace command bar.

---

## Remove from Import (production)

### UI elements — hide or delete

| Element | Lines (approx) | Reason |
|---------|----------------|--------|
| `#importFlowV2` | 1092 + module | 4-macro + 5-micro journey — duplicate of status |
| `#importAnalysisStages` | 1110 + module | Second progress stepper |
| `#importLiveStatus` | 1109 | Merged into status line |
| `#statusRow` / `#statusIcon` | 1114–1118 | Redundant with status line |
| `#importLoadingDetail` | 1111 | Second status line |
| `#importLoadingWait` | 1112 | Third status line |
| `#importLoadingPasteHint` | 1113 | Fourth status line |
| `#linkedinImportBlock` | 1102–1108 | Secondary action |
| `#wsCommandBar` | 1084–1086 | Noise — nav already says Import |
| `#importLead` | 1093 | Duplicate of drop hint |
| `#importCompact` | 1087–1090 | Second post-success UI |
| `#detectedDetails` | 1130–1133 | Quality panel — Review job |
| `#roleInput`, `#cvLang` | 1134–1135 | Options — Style/Review |
| `#toolsMore` (industry, job, photo) | 1136–1151 | Secondary actions |
| `#extractionRecoveryPanel` on Import | wsInsights L1384 | Duplicate recovery |
| `#wsInsights` on `docStep-import` invalid | CSS L264 | Use sheet instead |
| `dropActionHint` (third hint line) | 1099 | One hint enough |
| `extractionAlert` inline | CSS 594+ | Sheet instead |

### JS — consolidate

| Function / call | Action |
|-----------------|--------|
| `setImportLiveStatus()` | **Delete** → `setImportStatus()` |
| `setImportLoadingUx()` | **Simplify** → drives only status + progress % |
| `startImportLoadingUx()` timers | **Reduce** — map to 4 phases, not 5+ parallel UX systems |
| `showImportLoadingPasteHint()` | **Delete** — sheet at timeout |
| `HirelyImportFlowV2.onImportStart/End` | **Debug only** or remove |
| `HirelyImportStages` | **Debug only** |
| `HirelyWow.syncImportProgress` | **Optional** — must not add visible UI |
| `syncImportCompact()` | **Remove** from prod path |
| `renderExtractionRecoveryPanel()` when `docStep==='import'` | **Replace** with sheet |
| `showReviewGuaranteeWarningsUi()` on import transition | **Move** to Review |

### CSS files

| File | Action |
|------|--------|
| `import-flow-v2.css` | Debug-only load |
| `import-analysis-stages.css` | Debug-only load |
| `linkedin-import.css` | Debug-only or delete |
| `import-flow-v2.css` + `import-analysis-stages.css` | Replace with `import-step.css` (~150 lines) |
| `index.html` inline Import rules | Delete ~80 selectors for hidden panels |

---

## Keep (unchanged behavior)

| Asset | Why |
|-------|-----|
| `handleFileImport()` | Core pipeline |
| `importLog()` / import forensics | Gate QA, telemetry |
| `ensureImportReviewVisible()` | Auto-advance to Review |
| `getCvDataValidation()` | Blocks bad continue |
| `RAW_TEXT_THRESHOLD` / `IMPORT_NEEDS_PASTE` | Gate policy |
| `guardCvDataStep()` | Step locks |
| Multi-file merge (LinkedIn) | Behind single dropzone — `handleFileImportFromEvent` multi |
| `#fileInput` `multiple` | Supports LinkedIn + CV in one drop |

---

## Default hidden / debug only

Load or show only when `html.debug-mode` or `?debug=1`:

- `#importFlowV2`, `#importAnalysisStages`
- `#importDebugPanel`
- `#detectedDetails`, `#toolsMore`, `#linkedinImportBlock`
- Forensic / pipeline report panels
- `import-analysis-stages.js`, `import-flow-v2.js` visual mode

---

## File plan

| Action | Path |
|--------|------|
| **Add** | `src/ui/import/import-step.js` — status, sheet, drop handlers |
| **Add** | `src/ui/import/import-recovery.js` — sheet modes + continue |
| **Add** | `src/ui/import/import-step.css` |
| **Add** | `src/ui/components/ImportStep.html` |
| **Modify** | `index.html` — replace `#wsImport` subtree |
| **Modify** | `dom-contract.js` — `importStatusLine`, `importRecoverySheet` |
| **Deprecate** | Visible use of `import-flow-v2.js` macro UI in prod |

---

## Migration phases

### Phase 1 — Status consolidation

1. Add `#importStatusLine`; route `setImportLoadingUx` to it only.
2. Hide `#importLiveStatus`, `#importLoadingDetail`, `#importLoadingWait`, `#importAnalysisStages`, `#importFlowV2` via CSS.
3. Verify forensics + import gate reports still PASS.

### Phase 2 — Recovery sheet

1. Build `#importRecoverySheet` dialog.
2. Port `showImportPasteFallback()` → `openImportRecoverySheet('paste')`.
3. Port empty CV / extraction recovery → same sheet.
4. Remove `#extractionRecoveryPanel` on Import.

### Phase 3 — Dropzone + trim

1. Remove LinkedIn block from DOM (prod).
2. Remove command bar, compact panel, options fields from prod DOM.
3. Collapse drop hints to title + one subtitle.
4. Wire hero upload → same `#fileInput`.

### Phase 4 — Cleanup

1. Delete dead CSS/JS paths.
2. Update QA scripts (`qa-import-loading-ux`, `qa-import-needs-paste-ui`).
3. Add `npm run qa:import-rebuild`.

---

## Acceptance criteria

| # | Criterion |
|---|-----------|
| 1 | Idle Import shows **one** dropzone and **one** status line |
| 2 | During load, at most **one** text line + **one** progress bar update |
| 3 | Paste/OCR/invalid CV uses **one** recovery sheet — not paste panel + recovery panel + insights |
| 4 | Success → auto Review with **no** extra Import CTA |
| 5 | Recovery → **one** Continue button in sheet completes import |
| 6 | No visible LinkedIn button, options, detected profile, or photo on default Import |
| 7 | `npm run import-reality-check-report` PASS |
| 8 | `npm run qa:import-forensics` PASS |
| 9 | `npm run qa:empty-cv-protection` PASS — INVALID blocks Continue on sheet |

---

## Verification

```bash
npm run qa:import-forensics
npm run import-reality-check-report
npm run qa:empty-cv-protection
# After implementation:
npm run qa:import-rebuild
```

Manual:

1. Drop `designer-cv-rich.txt` → single status progression → lands on Review without clicking Continue.
2. Drop unreadable scan → one sheet → paste text → Continue → Review.
3. No LinkedIn block, no 4-step macro strip, no duplicate status lines.
4. Hero "Importer mon CV" opens same file picker as dropzone.

---

## Related docs

- `REVIEW_REBUILD_SPEC.md` — Review owns options/profile editing removed from Import
- `IMPORT_FORENSICS_REPORT.md` — pipeline milestones unchanged
- `EMPTY_CV_PROTECTION_REPORT.md` — INVALID handling via recovery sheet
- `COMPONENT_SPLIT_PLAN.md` — `ImportStep.html` extraction
- `NO_FAKE_PASS_IMPORT_POLICY.md` — paste gate must still FAIL correctly

---

## Appendix — status writers today (merge target)

| Writer | Target element | Remove |
|--------|----------------|--------|
| `setImportLiveStatus()` | `#importLiveStatus` | ✓ |
| `setImportLoadingUx()` | live + status + detail + wait + compact | ✓ → status only |
| `setImportStatus()` | `#statusText` | ✓ → merge |
| `show()` | `#statusText` | ✓ on Import step |
| `finishImportUi()` | various | audit |
| `HirelyImportFlowV2.setMicroStep` | macro/micro DOM | debug only |
| `HirelyImportStages.setStep` | `#importAnalysisStages` | debug only |
| `syncImportCompact()` | `#importCompactStatus` | ✓ |

**Today: up to 7 visible status/progress surfaces.** **Target: 1 line (+ optional 1 bar).**

---

## Appendix — continue paths today (collapse target)

| Path | Trigger | After |
|------|---------|-------|
| Auto | `ensureImportReviewVisible()` | `setDocStep('edit')` — **keep** |
| `#importPasteFallbackApply` | paste | pipeline → Review — **→ sheet Continue** |
| `#heroUploadBtn` | click | file picker — **keep** (same input) |
| `#linkedinImportBtn` | click | separate picker — **remove** |
| Invalid CV insights panel | manual fix buttons | **→ sheet** |
| `showImportRenderFallback` | auto `setDocStep('edit')` | **audit** — may bypass sheet; align with validation |

**Target: 2 paths only** — auto-advance on success, sheet Continue on recovery.
