# P0 Subtraction Sprint Report

**Source of truth:** `DESIGN_CRITIQUE_REPORT.md`  
**Date:** 2026-06-14  
**Goal:** Simpler, calmer, less zoomed, more Apple-like — subtract duplicate UI, no new features.

---

## Summary

| P0 item | Status | Evidence |
|---------|--------|----------|
| 1. Template gallery gated to Style only | ✅ | `syncResumeStudioChrome`, `p0-subtraction.css`, QA `02-review` / `03-style` |
| 2. Single recovery path | ✅ | `#importPasteFallback` canonical; duplicates removed from DOM |
| 3. Export footer: PDF + More | ✅ | `#cvExportBar` + `#exportMoreMenu`; `p0-subtraction.js` |
| 4. Smaller stepper, no hint duplication | ✅ | `#progressNextHint` removed; `p0-subtraction.css` stepper shrink |
| 5. Review document-first (68/32), max 3 issues, “Review” | ✅ | `p0-subtraction.css`, `recruiter-command-center.js` `renderSlim()` |
| 6. No production debug leakage | ✅ | Test/debug panels removed; CSS hard-hide fallbacks |
| Build | ✅ | `npm run check:core` passed |
| Browser QA | ✅ | `scripts/qa-p0-subtraction.mjs` — 17/17 |

---

## Deleted components (DOM removed)

| ID / region | Was |
|-------------|-----|
| `#hirelyTestClickBtn` | Debug click probe |
| `#hirelyTestImport` | Yellow test import strip |
| `#importDebugPanel` | Import debug panel |
| `#hirelyDebugPanel` | Pipeline debug (prod DOM; `?debug=true` may inject stub) |
| `#hirelyForensicPanel` | OCR forensic overlay |
| `#progressNextHint` | Oversized stepper hint box |
| `#extractionAlert` | Duplicate paste/retry banner |
| `#extractionGate` | Full-screen extraction gate overlay |
| `#importActions` | Sample / paste / replace / retry row |
| `#cvProductHead` | Audit / LinkedIn / letter tab strip |
| `#auditPanel`, `#linkedinPanel`, `#letterPanel` | Debug product tabs |
| `#exportFinalPanel` | Duplicate export success panel |
| `#exportBackToTemplatesHeadBtn` | Duplicate back-to-templates in header |
| `#rawDetails` | Visible raw-text editor (replaced by hidden `#cvText`) |

---

## Merged / canonical components

| Canonical | Replaces |
|-----------|----------|
| `#importPasteFallback` — “We need a little more text”, textarea, **Continue**, **Try another file** | `#extractionAlert`, `#extractionGate`, `#importActions` paste/retry/sample buttons, scattered `openPaste()` entry points |
| `#cvExportBar` — **Download PDF** + **More** menu | Inline email/TXT/letter/back buttons, `#exportFinalPanel` downloads |
| `#exportMoreMenu` | `#exportBackToTemplatesBtn`, `#emailCvBtn`, `#downloadTxt`, `#openLetterBtn` (overflow) |
| `#docNav` only (sticky stepper) | `#importFlowV2` macro steps hidden in prod via CSS |
| `#reviewStudioAnalysis` slim “Review” sidebar | “Recruiter Command Center” full audit in production (`renderSlim`, max 3 items) |

### JS routing (no duplicate UX)

- `showExtractionGate()` → `showImportPasteFallback()`
- `setExtractionAlert()` → noop
- `syncExportFinalPanel()` → noop
- `openPaste()` → canonical fallback panel
- `showPdfScannedFallback()` / `showPdfPasteFallback()` → paste panel (no `#rawDetails`)

---

## Files touched

| File | Change |
|------|--------|
| `index.html` | DOM subtraction, export More menu, recovery copy, chrome sync, event bindings cleanup |
| `src/ui/product/p0-subtraction.css` | **New** — style-only templates, review grid, export bar, stepper, debug hide |
| `src/ui/product/p0-subtraction.js` | **New** — More menu toggle |
| `src/ui/studio/recruiter-command-center.js` | `renderSlim()` / `collectSlimActions()` (max 3) |
| `scripts/qa-p0-subtraction.mjs` | **New** — P0 browser QA + screenshots |

---

## Screenshots

### After (P0)

| Step | File |
|------|------|
| Import → Review | `.qa-screenshots/p0-subtraction/01-after-import-review.png` |
| Review (no templates) | `.qa-screenshots/p0-subtraction/02-review-step.png` |
| Style (templates) | `.qa-screenshots/p0-subtraction/03-style-step.png` |
| Export (PDF + More) | `.qa-screenshots/p0-subtraction/04-export-step.png` |

### Before (reference)

Pre-subtraction baseline referenced in `DESIGN_CRITIQUE_REPORT.md` and `.qa-screenshots/ui-scale-rebalance/after-0*.png`.

---

## QA checklist

Run:

```bash
npm run dev   # http://localhost:3001
npm run check:core
HIRELY_URL='http://127.0.0.1:3001/?pro=true' node scripts/qa-p0-subtraction.mjs
```

| Check | Result |
|-------|--------|
| Import works (sample / file) | ✅ |
| Paste fallback panel present + canonical copy | ✅ |
| Review: no `#templatePickerBar` | ✅ |
| Style: template gallery visible | ✅ |
| Export: one primary PDF + More overflow | ✅ |
| No debug controls in production DOM | ✅ |
| Build (`check:core`) passes | ✅ |

### Manual smoke (recommended)

1. Import a thin PDF → only `#importPasteFallback` appears (not alert/gate row).
2. **Continue** with pasted text → pipeline completes.
3. **Try another file** → file picker opens.
4. Review step: CV ~70% width, sidebar “Relecture” / “Review”, ≤3 checklist items.
5. Style step: template strip appears; Review strip gone.
6. Export: **Download PDF** + **More** (back, letter, email, TXT).
7. `?debug=true` still available for engineers; prod page has no test buttons.

---

## Intentionally unchanged

- Import / review / style / export **pipelines** (`applyCvPipeline`, `setDocStep` locks, export validation).
- Brand, templates, PDF engine, letter workspace (letter opened from More menu).
- `?debug=true` / forensic mode hooks (guarded; panels not in default DOM).

---

## Follow-ups (out of P0 scope)

- `qa:smoke` / `prelaunch-browser.mjs` still reference removed `#sampleBtn` — update to `loadSample()` API.
- `package.json` `dev` port is `3001`; some legacy scripts expect `3000`.
- Optional: hide `#importFlowV2` micro beats in JS (currently CSS-only in prod).
