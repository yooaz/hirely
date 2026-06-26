# User flow cleanup report

**Date:** 2026-06-16  
**Status:** PASS  
**Scope:** Visible UI only — Import → Paste fallback → Review → Style → Export  
**Files touched:** `index.html` only (no engines, export, or templates)

## Goal

Remove user-visible confusion: unclear buttons, duplicate CTAs, debug/V1 copy, scary errors, wrong format messaging, and misleading disabled states — without changing import engines, PDF export, or template rendering.

## Issues found (before)

| Screen | Issue |
|--------|--------|
| Import | Format guide said **“Formats V1”** / **“Pris en charge (V1)”** |
| Import | **LinkedIn import** block and **importFlowV2** journey visible on main path |
| Import | Progress step 2 labeled **“Analyser”** while review UI said **“Relire”** |
| Paste | Title mentioned **unsupported format / V1**; CTA **“Créer mon CV avec ce texte”** vs nav **“Continuer”** |
| Paste | Warning **“Nous n'avons pas pu lire ce fichier”** felt like a hard failure |
| Review / Style | Sticky **`#flowPrimaryCta`** duplicated **`#docNav`** (Choisir un modèle / Télécharger) |
| Style | **`extractionQualityStep`** (“Avant le modèle”) repeated review on template step |
| Style | Lead still said **“Vérifiez ce qui a été extrait…”** after review |
| Export | Default button text **“Download PDF”** (English leak) |

## Fixes applied

### Production CSS (`html:not(.debug-mode)`)

- Hide duplicate / out-of-scope chrome: `#flowPrimaryCta` (when workspace ready), `#linkedinImportBlock`, `#importFlowV2`, `.dropActionHint`, `.extractionQualityStep`, `.reviewV2LetterCta`, `#importOcrConfidence`
- `#flowPrimaryCta` selector fixed: footer sits outside `#workspaceGrid`, so hide via `#workspace:has(.workspaceGrid--ready) #flowPrimaryCta`

### Copy & i18n (`I18N.fr` / `I18N.en`)

- Removed **V1** from user-facing import/paste/format strings
- **Formats acceptés** / **Supported formats**; softer unsupported column **“Sinon, collez le texte”**
- Paste scanned title: friendly scan/image message + **`Continuer`** CTA
- Softer **`pdfExtractFail`** / **`ocrQualityFail`** (actionable, not alarming)
- Unified step 2 label **`Relire`** / **Review** (fixed late `Object.assign` block that reset **Analyser**)
- Style step lead: design-focused, not re-extraction
- Export: **`Télécharger le PDF`** / **Download PDF** defaults

### UI shell (`index.html` inline JS)

- **`pasteFirstPanelCopy`**: wraps core copy but prefers i18n keys (`importPasteFallbackTitleScanned`, etc.)
- **`syncFlowPrimaryCta`**: hides bar when `workspaceGrid--ready` (nav uses `display:flex` while still `hidden` class — previous nav check failed)

## Manual / automated verification

Command:

```bash
node scripts/user-flow-cleanup-audit.mjs
```

**Result:** 14/14 checks PASS (`tests/output/user-flow-cleanup-audit.json`)

| Step | Verified |
|------|----------|
| Import | No V1 copy; LinkedIn + FlowV2 hidden; progress **Relire** |
| Paste (scanned PDF) | Friendly title; **Continuer**; no scary failure copy |
| Review | **Relire**; no duplicate `#flowPrimaryCta` |
| Style | No duplicate CTA; style lead not extraction-focused |
| Export | **Télécharger le PDF**; no V1 in visible copy |

Flow exercised: `scan.pdf` → paste panel → paste fixture → review → style → export (Playwright, local static server).

## Out of scope (unchanged)

- `src/core/**` import / OCR engines  
- `src/**` export pipeline and PDF generation  
- `src/ui/templates/**` and template gallery logic  
- Debug-mode panels (still available when `debug-mode` is on)

## Residual notes

- **Debug mode** still shows pipeline, LinkedIn, extraction quality, and letter CTAs — intentional for QA.
- Some hero/marketing strings outside the 4-step workspace still use recruiter/audit wording; workspace nav and step copy are aligned to **Importer → Relire → Modèle → Exporter**.
