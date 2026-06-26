# Export Rebuild Spec

**Version:** `EXPORT_REBUILD_V1`  
**Generated:** 2026-06-15  
**Status:** SPEC — implementation not started

## Mission

**Export = see your A4, download your PDF, done.**

One full-page preview. One primary download. One overflow menu for secondary actions. No zoom toolbar, no letter composer, no duplicate success panels, no competing footers.

---

## Product intent

| Principle | Rule |
|-----------|------|
| WYSIWYG | A4 preview is the product — matches PDF output |
| One download | **Download PDF** is the only primary CTA |
| Secondary hidden | Email, TXT, back to templates, letter → **More** menu only |
| No chrome stacking | One action bar — not header + footer + zoom + flow CTA |
| Done | After download, brief inline confirmation — no second success screen |

---

## Target layout

### Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│  Progress nav — Import · Review · Style · Export                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    A4 PREVIEW (full width)                       │
│                    #cvStage / #a4Viewport                        │
│                    fit-to-width, 100% logical scale              │
│                    (no zoom toolbar)                             │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│         [ Download PDF ]              [ More ▾ ]                 │
│         exportStepBar (sticky bottom or below preview)           │
└──────────────────────────────────────────────────────────────────┘
```

### Mobile

Stack: **Preview (scroll)** → **Download PDF** (full width) → **More** (ghost).

### What “Done” means

- User downloads PDF → browser save dialog → optional one-line toast: *"PDF downloaded"* (`show()` → `#statusText` or ephemeral `#exportDoneHint`).
- No `exportFinalPanel`, no score recap, no letter workspace expansion, no second Download button.

---

## Target DOM

Replace Export chrome scattered across `docFooter`, `studioPreview`, and `reviewStudioAnalysis` with:

```html
<!-- Inside #wsProduct on docStep-export -->
<div class="exportStep" id="exportStep" data-step="export">
  <!-- Preview column — existing studioPreview subtree, trimmed -->
  <div class="exportStep__preview studioPreview studioPreview--export" id="studioPreview">
    <div class="workspaceCanvas cvFocus">
      <div id="cvStageWrap" class="cvStageWrap">
        <div id="cvStage" class="cvStage cv-preview-shell">
          <div id="a4Viewport" class="a4Viewport" data-a4-tier="desktop" data-a4-mode="fit">
            <!-- cvDoc — unchanged -->
          </div>
        </div>
      </div>
    </div>
  </div>

  <footer class="exportStep__bar" id="exportStepBar" aria-label="Export actions">
    <p class="exportStep__doneHint hidden" id="exportDoneHint" aria-live="polite"></p>
    <div class="exportStep__actions">
      <button type="button" class="btn primary" id="downloadBtn" data-i="downloadPdf">
        Download PDF
      </button>
      <div class="exportStep__moreWrap">
        <button type="button" class="btn ghost" id="exportMoreBtn"
          aria-expanded="false" aria-haspopup="menu" data-i="exportMore">
          More
        </button>
        <div id="exportMoreMenu" class="exportStep__moreMenu hidden" role="menu">
          <button type="button" role="menuitem" id="exportMoreBackBtn" data-i="exportBackToTemplates">
            Back to templates
          </button>
          <button type="button" role="menuitem" id="emailCvBtn" class="tab--pro" data-i="emailCvPdf">
            Email PDF
          </button>
          <button type="button" role="menuitem" id="downloadTxt" class="tab--pro" data-i="exportTxt">
            Export TXT
          </button>
          <button type="button" role="menuitem" id="openLetterBtn" class="tab--pro" data-i="letterOpenBtn">
            Cover letter
          </button>
        </div>
      </div>
    </div>
  </footer>
</div>
```

### ID preservation

| ID | Fate |
|----|------|
| `downloadBtn` | **Keep** — sole primary download |
| `exportMoreBtn` / `exportMoreMenu` | **Keep** — rename wrapper optional |
| `cvDoc`, `cvStage`, `a4Viewport` | **Keep** — DOM contract |
| `cvExportBar` | **Replace** → `exportStepBar` (move out of `docFooter`) |
| `exportStepHead` | **Remove** prod — template name in nav label only |
| `a4ZoomBar` | **Remove** prod |
| `coverLetterWorkspace` | **Remove** from Export — More menu only |
| `flowPrimaryCta` | **Style only** — hidden on Export (already) |
| `exportFinalPanel` | **Delete** (dead refs remain in QA) |
| `exportFinalCvPdf` | **Delete** — duplicate download |
| `openLetterReviewBtn` | **Remove** — not on Export |

---

## A4 preview rules

| Rule | Implementation |
|------|----------------|
| Default zoom | `HirelyA4Viewport.setZoomMode('fit')` on enter Export |
| No zoom UI | Remove `#a4ZoomBar` from production DOM or always `hidden` |
| Pinch / scroll | Native scroll on `#a4Viewport` — sufficient on mobile |
| PDF parity | `ensureExportPreviewRendered()` unchanged — layout at 794×1123 logical |
| No edit chrome | Hide `#cvHeaderBar`, `#proCvLayoutTools`, `#templatePickerBar` on Export |

```css
html:not(.debug-mode) .workspaceGrid--ready.docStep-export .exportStep {
  display: grid;
  grid-template-rows: 1fr auto;
  grid-template-areas: "preview" "bar";
  min-height: min(80vh, 900px);
}

html:not(.debug-mode) .workspaceGrid--ready.docStep-export .exportStep__preview {
  grid-area: preview;
  min-height: 0;
}

html:not(.debug-mode) .workspaceGrid--ready.docStep-export .exportStep__bar {
  grid-area: bar;
  position: sticky;
  bottom: 0;
  z-index: 2;
}
```

---

## Action bar (only bar)

### Primary

| Control | Handler | Gate |
|---------|---------|------|
| **Download PDF** `#downloadBtn` | `downloadPDF()` | `requirePro()`, `isExportReady()`, `validateCvData` not INVALID |

### More menu (secondary — all here)

| Item | Handler | Notes |
|------|---------|-------|
| Back to templates | `setDocStep('style')` | Only escape hatch to Style |
| Email PDF | `emailCV()` | Pro |
| Export TXT | `downloadTXT()` | Pro |
| Cover letter | `openCoverLetterModal()` | **Not** inline workspace — see below |

**Remove from visible Export UI:**

- `#a4ZoomBar` (Fit / 75% / 100% / 125%)
- `#exportStepHead` (kicker + template name + lead duplicate)
- `#coverLetterWorkspace` inline panel
- `#flowPrimaryCta` on Export (already hidden L324)
- `#cvExportBar` inside `docFooter` — relocate to `exportStepBar`
- `#reviewV2ReadyBadge` / export score recap (Review job)
- Dead `#exportFinalPanel` + `#exportFinalCvPdf` bindings

### Letter handling

Cover letter is **not** part of Export layout. Options:

1. **Recommended:** More → opens modal/sheet (`#letterModal`) — reuse `cover-letter-renderer.js`, no `#coverLetterWorkspace` on page.
2. **Defer:** More → navigates to dedicated letter route (future).

Remove 40+ lines of letter controls from `docFooter` on Export.

---

## Current state — overload inventory

### Multiple bars / toolbars on Export

| Bar | Location | Fate |
|-----|----------|------|
| `#exportStepHead` | `#wsProduct` header | **Remove** |
| `#a4ZoomBar` | inside `#cvPanel` | **Remove** |
| `#cvExportBar` | `footer.docFooter` | **Move** → `exportStepBar` |
| `#flowPrimaryCta` | `docFooter` (Style step) | Keep on Style only |
| `#coverLetterWorkspace` | `docFooter` | **Remove** from Export view |
| Progress nav | top | **Keep** |

### Duplicate downloads

| Trigger | Element | Fate |
|---------|---------|------|
| Primary bar | `#downloadBtn` | **Keep** |
| Dead panel | `#exportFinalCvPdf` | **Delete** binding + DOM |
| Progress nav click `export` | `handleChecklistAction('export')` → `downloadPDF()` | **Change** → `setDocStep('export')` only |
| Style `flowPrimaryCtaBtn` | "Exporter ce CV" | **Keep** — navigates to Export, not download |
| Review ATS checklist | export action | **Remove** direct download |

### Duplicate success states

| Surface | Trigger | Fate |
|---------|---------|------|
| `show(t('statusReady'),'ok')` | after `downloadPDF()` | **Keep** — single toast |
| `#exportFinalPanel` | `syncExportFinalPanel()` (noop) | **Delete** dead CSS/JS refs |
| `#reviewV2ReadyBadge` | export ready on Review | Not on Export |
| `#exportDoneHint` | new | Optional one-line under bar — auto-hide 3s |
| Letter workspace “generated” UI | cover letter flow | Move to modal |

### Zoom controls

| Asset | Shown on Export today | Fate |
|-------|----------------------|------|
| `#a4ZoomBar` | `renderA4ZoomBar()` when `docStep==='export'` | **Never show** on Export |
| `HirelyA4Viewport` zoom modes | fit/75/100/125 | Default **fit** only; API kept for PDF export suspend |

---

## Remove from Export (production)

### DOM

- `#a4ZoomBar` and all `.a4ZoomBtn`
- `#exportStepHead` (or keep `hidden` permanently)
- `#coverLetterWorkspace` when `docStep==='export'`
- `#cvExportBar` from `docFooter` — single `exportStepBar` under preview
- `#openLetterReviewBtn` in review analysis (letter not on Review per REVIEW_REBUILD_SPEC)
- `#extractionQualityStep`, `#trustStrip`, `#mvpImportBanner` inside preview on Export

### JS — stop / change on `docStep==='export'`

| Call | Action |
|------|--------|
| `renderA4ZoomBar()` showing on export | `hidden` always, or skip when `export` |
| `syncCoverLetterWorkspace()` expanding footer | Only when letter modal open |
| `syncExportStepHead()` | Remove or nav-only |
| `openCoverLetterWorkspace()` scroll to footer | Open modal instead |
| `handleChecklistAction('export')` | Navigate only, no `downloadPDF()` |
| `exportFinalCvPdf.onclick` | Delete |
| `syncExportFinalPanel()` | Already noop — delete dead code |

### CSS

| File | Action |
|------|--------|
| `a4-viewport.css` | `.a4ZoomBar` debug-only |
| `index.html` inline | Remove export head/zoom rules |
| `review-studio-v2.css` | Delete `.exportFinalPanel` block |
| `p0-subtraction.css` | Update selectors `cvExportBar` → `exportStepBar` |

---

## Keep (unchanged behavior)

| Asset | Why |
|-------|-----|
| `downloadPDF()` | Core export pipeline |
| `prepareLockedCvExport()` / export lock | PDF parity gate |
| `HirelyPdfExportV2` / `exportPacketV2` | PDF generation |
| `ensureExportPreviewRendered()` | Preview before download |
| `isExportReady()` / `guardCvDataStep('export')` | Step gate |
| `requirePro()` | Paywall |
| `exportMoreMenu` + `p0-subtraction.js` toggle | More menu behavior |
| `importLog('EXPORT_*')` | Forensics |

---

## Enter / leave Export

### Enter (`setDocStep('export')`)

1. `guardCvDataStep('export')` + `isExportReady()`
2. `syncActiveTemplate()` → `renderCV(null)` → `layoutCvA4WhenReady()`
3. `HirelyA4Viewport.setZoomMode('fit')` — no zoom bar
4. Show `#exportStep` + `#exportStepBar`
5. Hide Style-only chrome (gallery, spacing, flow CTA)

### Leave

- **Back to templates:** More → `setDocStep('style')`
- **Progress nav:** any prior step via `setDocStep`

---

## Done state UX

After successful `downloadPDF()`:

```js
function showExportDone() {
  const hint = document.getElementById('exportDoneHint');
  if (hint) {
    hint.textContent = t('exportDone') || 'PDF downloaded.';
    hint.classList.remove('hidden');
    setTimeout(() => hint.classList.add('hidden'), 3000);
  }
  // Optional: keep existing show(t('statusReady'),'ok') — pick ONE, not both
}
```

**Pick one feedback channel:** prefer `#exportDoneHint` under the bar; demote global `#statusText` toast on Export to errors only.

---

## Debug mode

Behind `html.debug-mode` or `?debug=1`:

- `#a4ZoomBar` for QA viewport testing
- `#exportStepHead` with template metadata
- `#exportFinalPanel` stub if needed for legacy QA scripts — update scripts to use `#downloadBtn` only

---

## File plan

| Action | Path |
|--------|------|
| **Add** | `src/ui/export/export-step.js` — enter/leave, done hint, bar sync |
| **Add** | `src/ui/export/export-step.css` — grid + sticky bar |
| **Add** | `src/ui/components/ExportStep.html` |
| **Modify** | `index.html` — move bar out of `docFooter`, trim preview |
| **Modify** | `a4-viewport.js` — `renderA4ZoomBar` export guard |
| **Modify** | `p0-subtraction.js` — menu targets |
| **Clean** | Dead refs: `exportFinalCvPdf`, `exportFinalPanel`, `exportFinalScore` |

---

## Migration phases

### Phase 1 — Subtract chrome

1. Hide `#a4ZoomBar`, `#exportStepHead`, `#coverLetterWorkspace` on `docStep-export`.
2. Force `setZoomMode('fit')` in `ensureExportPreviewRendered()`.
3. Screenshot PDF parity baseline.

### Phase 2 — Single bar

1. Create `#exportStepBar` below preview (move from `docFooter`).
2. Remove duplicate `#cvExportBar` from footer on Export.
3. Wire `downloadBtn` + More menu only.

### Phase 3 — Done + dedupe

1. Add `#exportDoneHint`; remove duplicate success toasts.
2. Delete `exportFinalCvPdf` handlers and dead panel CSS.
3. Fix progress nav / checklist — Export step navigates, does not download.

### Phase 4 — Letter modal (optional)

1. Extract `#coverLetterWorkspace` to modal invoked from More.
2. Remove letter block from `docFooter` entirely.

---

## Acceptance criteria

| # | Criterion |
|---|-----------|
| 1 | Export shows **A4 preview only** + **one action bar** |
| 2 | **No** zoom toolbar visible in production |
| 3 | Exactly **one** Download PDF button on screen |
| 4 | More menu contains all secondary actions (back, email, TXT, letter) |
| 5 | **No** inline cover letter workspace on Export |
| 6 | **No** `exportFinalPanel` or second download button |
| 7 | PDF bytes match preview (`npm run qa:pdf-export` or equivalent) |
| 8 | `isExportReady()` still blocks download when Review incomplete |
| 9 | `npm run qa:p0-subtraction` updated and PASS |

---

## Verification

```bash
npm run qa:p0-subtraction
npm run qa:dom-contract
# PDF parity (if available):
npm run qa:pdf-export-v2-report
# After implementation:
npm run qa:export-rebuild
```

Manual:

1. Complete flow → Export → preview fills viewport, no zoom row.
2. Download PDF → one save dialog, one success message.
3. More → Back to templates works; letter does not expand footer panel.
4. No duplicate Download buttons in DOM (`querySelectorAll` for download handlers === 1).

---

## Related docs

- `IMPORT_REBUILD_SPEC.md` — Import step simplification
- `REVIEW_REBUILD_SPEC.md` — Review owns score/gates before Export unlock
- `P0_SUBTRACTION_REPORT.md` — prior export footer work (partial)
- `DEAD_REFERENCE_REPORT.md` — `exportFinalPanel` / `exportFinalCvPdf` cleanup
- `PDF_EXPORT_V2_REPORT.md` — PDF pipeline must not regress

---

## Appendix — element inventory (current → fate)

| Element | Current role | Fate |
|---------|--------------|------|
| `exportStepHead` | Title + template name + lead | **Remove** |
| `a4ZoomBar` | Fit/75/100/125 | **Remove** prod |
| `studioPreview--export` | Preview wrapper | **Keep** |
| `cvExportBar` | Footer download row | **Move** → `exportStepBar` |
| `downloadBtn` | Primary PDF | **Keep** |
| `exportMoreBtn` | Overflow | **Keep** |
| `coverLetterWorkspace` | Full letter editor in footer | **Remove** from Export |
| `flowPrimaryCta` | Style → Export CTA | Style only |
| `exportFinalPanel` | Dead success panel | **Delete** |
| `exportFinalCvPdf` | Dead duplicate download | **Delete** |
| `openLetterReviewBtn` | Letter from Review | **Remove** (Review rebuild) |
| `reviewV2ReadyBadge` | "Ready to export" | Review only |
| `statusText` toast on success | Global status | **Errors only** on Export |

---

## Appendix — download path collapse

| Path today | After rebuild |
|------------|---------------|
| `#downloadBtn` → `downloadPDF()` | **Primary** |
| `#exportFinalCvPdf` → `downloadPDF()` | **Deleted** |
| ATS checklist `export` action → `downloadPDF()` | **Navigate to Export step** |
| Progress nav Export step | View only — user clicks Download |
| `flowPrimaryCta` on Style | `setDocStep('export')` only |

**One download action. One success signal. Done.**
