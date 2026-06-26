# Hirely Design Critique Report

**Version:** `DESIGN_CRITIQUE_V1`  
**Date:** 2026-06-06  
**Target:** Apple-level simplicity — one primary action per screen, no duplicate journeys, content over chrome  
**Scope:** Every user-facing screen in `index.html` + dev labs (`parser-lab`, `test-lab`, `pdf-lab`)  
**Evidence:** Live markup (`index.html` ~8.3k lines), 35 linked stylesheets, QA screenshots in `.qa-screenshots/ui-scale-rebalance/`

---

## 1. Executive summary

Hirely has a **clear 4-step mental model** (Import → Review → Style → Export) and production CSS already hides much debug UI. But the product still feels **engineered, not designed**: multiple progress systems, parallel recruiter surfaces, and recovery flows compete for attention. A recent **Visual Density Pass** tightened spacing to show ~35% more UI per screen — useful for power users, **opposite** of Apple restraint.

| Dimension | Grade | One-line verdict |
|-----------|-------|------------------|
| Visual clutter | **C+** | Too many status lines, badges, and nested panels per step |
| Unnecessary controls | **C** | Secondary import actions, spacing toggles, debug remnants in DOM |
| Duplicate actions | **D+** | Paste/export/letter/template-back appear 2–4× per journey |
| Oversized components | **C−** | Progress stepper pills, template cards, warning banners dominate viewport |
| Layout efficiency | **C** | Landing wastes 60% width; edit step stacks gallery + quality + preview |
| **Overall vs Apple bar** | **C** | Strong bones; needs subtraction, not addition |

**Highest-impact fix:** One navigation layer, one recovery path, one export bar — delete or merge everything else.

---

## 2. Method

1. **Screen inventory** — all `docStep` states, modals, labs  
2. **Markup audit** — control counts, `hidden` / `debug-mode` gates (hidden ≠ removed)  
3. **Visual review** — `.qa-screenshots/ui-scale-rebalance/after-0{1–5}-*.png`  
4. **North star** — `LANDING_PAGE_V4.md` + Apple HIG principles: progressive disclosure, single primary CTA, content-first hero

---

## 3. Cross-cutting issues (all screens)

### 3.1 Triple progress navigation

The same 4-step journey is rendered **three times**:

| Layer | Location | Problem |
|-------|----------|---------|
| Hero pipeline | `#hero .heroPipeline--four` | 4 cards + arrows on landing |
| Doc stepper | `#docNav .hirelyProgressSteps` | 4 oversized pill buttons + fill track |
| Import macro | `#importFlowV2` (4 macro + 5 micro beats) | Duplicates stepper during import |

**Apple fix:** Keep **one** sticky stepper (`docNav` only). Landing shows **product demo**, not a second pipeline. Import shows **one** animated line (“Reading your CV…”), not 4+5 steps.

---

### 3.2 Duplicate recovery & paste paths

At least **four** surfaces solve “extraction failed / thin text”:

| Surface | IDs | Actions |
|---------|-----|---------|
| Paste fallback panel | `#importPasteFallback` | Paste, Retry OCR, Replace file |
| Extraction alert | `#extractionAlert` | Paste text, Other file |
| Extraction gate overlay | `#extractionGate` | Continue, Paste, Retry (hidden prod) |
| Import actions row | `#openPasteBtn`, `#replaceCvBtn`, `#sampleBtn` | Paste, Replace, Sample |

Users cannot tell which is canonical. **Apple fix:** Single sheet — title, one textarea, primary “Continue”, secondary “Try another file”.

---

### 3.3 Duplicate recruiter / score UI

Recruiter intelligence appears in **five** implementations (several hidden in prod but still in DOM/CSS):

| Surface | Location | Visible prod |
|---------|----------|--------------|
| Recruiter Command Center | `#reviewStudioAnalysis` / `#recruiterCommandCenter` | Yes (edit) |
| Studio score panel | `#studioScorePanel` | Hidden |
| Recruiter review panel | `#recruiterReviewPanel` | Hidden |
| wsInsights score card | `.scoreCardPremium` in `#wsInsights` | Hidden |
| Extraction quality step | `#extractionQualityStep` | Partial |

Screenshot `after-03-analysis-edit.png` shows **detection checklist + orange export warning** above templates — audit UI bleeding into wrong step.

**Apple fix:** One **Review** column: score ring + max 3 actionable items. No separate “quality step”, “command center”, and “recovery panel” headers.

---

### 3.4 Duplicate export & letter actions

| Action | Occurrences |
|--------|-------------|
| Download PDF | `#downloadBtn`, `#exportFinalCvPdf`, RCC implicit CTA |
| Back to templates | `#exportBackToTemplatesBtn`, `#exportBackToTemplatesHeadBtn` |
| Cover letter | `#coverLetterWorkspace`, `#openLetterBtn`, `#openLetterReviewBtn`, letter tab (debug) |
| Copy / TXT export | `#downloadTxt`, `#exportFinalCopyCv`, letter TXT buttons |

**Apple fix:** Export step = **preview + 2 buttons** (PDF primary, More ▾ for letter/email/txt). Letter is a modal, not a footer workspace competing with CV.

---

### 3.5 Stylesheet & markup debt

- **35+ CSS files** in `index.html` (many legacy template packs: h16, h20, showcase-v8, v2-families alongside v3)  
- **~8,300 lines** inline CSS + JS in one HTML file  
- `visual-density-pass.css` overrides DS3 to **shrink** chrome but **increase** visible widgets — fights simplicity goal  

**Apple fix:** One design-system bundle, one template CSS lazy-loaded per selected template.

---

### 3.6 Production hides; does not remove

`html:not(.debug-mode)` rules hide 40+ selectors but leave:

- Dead tabs (`audit`, `linkedin`, `letter`)  
- Duplicate panels in accessibility tree  
- Larger bundle + cognitive load for maintainers  

Simplicity requires **deletion**, not `display: none`.

---

## 4. Screen-by-screen critique

### 4.1 App shell (header)

**Files:** `index.html` `.top`, `hirely-ui-scale.css`, `design-system-v3.css`  
**Screenshot:** All `after-0*.png`

| Issue | Severity | Detail |
|-------|----------|--------|
| Nav redundancy | Medium | Landing: Accueil / Mon CV / Prix. In workspace, nav hidden but stepper repeats journey |
| Debug leakage | Low | `#hirelyTestClickBtn` “TEST CLICK” in header markup |
| Lang selector | OK | Single compact control — keep |

**Apple target:** Logo + 2 nav links max. Language in menu sheet. No test controls in production bundle.

---

### 4.2 Landing / hero (`#hero`)

**Screenshot:** `after-01-dashboard.png`

| Issue | Severity | Detail |
|-------|----------|--------|
| Layout inefficiency | **High** | ~65% viewport empty on right — no product preview (`LANDING_PAGE_V4` calls for A4 hero) |
| Visual clutter (copy) | Medium | Badge + headline + lead + `heroHow` 4-step line = **triple** explanation of same flow |
| Oversized CTA | Low | Primary button appropriate; secondary “Voir modèles Pro” orphaned below fold of hero |
| Missing proof | High | No before/after, no live demo — generic SaaS pattern V4 bans |

**Unnecessary controls:** `heroTemplates` skips to style without import — edge case button on landing.

**Apple target:** Headline + one line + one button + **large CV preview** (morph animation). Remove badge pill and `heroHow`. Right column = product, not whitespace.

---

### 4.3 Pricing (`#pricing`)

| Issue | Severity | Detail |
|-------|----------|--------|
| Competing CTAs | Medium | Two cards × 2 buttons = 4 paths to same import/unlock |
| Layout placement | Medium | Full section below workspace — scroll collision when user is mid-flow |
| Feature lists | Low | 2× bullet lists duplicate hero/pricing copy |

**Apple target:** One plan comparison row or single Pro upsell inline at export — not a separate marketing section during studio use.

---

### 4.4 Import (`docStep-import`)

**Screenshot:** `after-02-import.png`  
**Files:** `wsImport`, `import-flow-v2.css`, `linkedin-import.css`

| Issue | Severity | Detail |
|-------|----------|--------|
| Oversized stepper | **High** | Progress pills + `#progressNextHint` box consume ~25% vertical before content |
| Layout inefficiency | **High** | Full-width import panel; drop zone ~40% of card; “CV importé” empty dead zone |
| Visual clutter | **High** | 10+ status elements: `importFlowV2`, `importLiveStatus`, `importAnalysisStages`, `importLoadingDetail`, `importLoadingWait`, `importLoadingPasteHint`, `statusRow`, `progress`, `fileName` |
| Unnecessary controls | **High** | `sampleBtn`, `resetBtn`, `openPasteBtn`, `replaceCvBtn`, `pasteManualBtn`, `retryFileBtn` — 6 secondary actions |
| Duplicate upload | Medium | Main `#drop` + `#linkedinImportBlock` + drop hints for LinkedIn — same action, three UIs |
| Hidden options still in DOM | Medium | `roleInput`, `cvLang`, industry, job desc, photo — gated off but clutter markup |

**Duplicate actions:** Paste appears in fallback panel, alert links, and import actions.

**Apple target:** Centered drop card (icon + one line). While loading: single progress sentence. LinkedIn = “Add files” chip on drop zone, not second section. No command bar title “Importez votre CV” under global stepper.

---

### 4.5 Review / Edit (`docStep-edit`)

**Screenshot:** `after-03-analysis-edit.png`  
**Files:** `review-studio-v2.css`, `recruiter-command-center.css`, `resume-studio.css`

| Issue | Severity | Detail |
|-------|----------|--------|
| Wrong content on step | **Critical** | Template gallery + filters visible on **Relire** step — should be style-only |
| Layout inefficiency | **High** | Stacked bands: quality checklist → warning banner → full template rail → CV preview |
| Visual clutter | **High** | `extractionQualityStep` + `templatePickerBar` + `cvHeaderBar` + `reviewStudioAnalysis` + `toClassifyPanel` |
| Oversized warning | Medium | Full-width orange bar for one sentence |
| Unnecessary controls | Medium | `cvHeaderEditBtn` + 5-field dialog — identity already in studio editor |
| Duplicate classification | Medium | `toClassifyPanel` + `extractionRecoveryPanel` + RCC issues — same “fix imports” job |
| Hidden rail | Low | `#studioRail` with 13 sections hidden in prod layout (`review-studio-v2` uses center/analysis only) — dead architecture |

**Recruiter Command Center** name + score ring + 3 badge states + letter CTA = **dense product vocabulary** on a step that should feel like “your document”.

**Apple target:** **Document-first** — CV preview ≥60% width. Right: slim “3 things to check” list. No templates. No “Recruiter Command Center” label — use “Review”.

---

### 4.6 Style / Templates (`docStep-style`)

**Screenshot:** `after-04-templates.png`  
**Files:** `premium-template-gallery.css`, `template-gallery-position.css`

| Issue | Severity | Detail |
|-------|----------|--------|
| Control overload | **High** | 7 filter pills + 3 spacing buttons + 10 template cards × 4 text lines each |
| Oversized cards | Medium | Thumbnail small, metadata large — card height driven by copy, not preview |
| Visual clutter | Medium | Teal tagline + gray description + footer line per card — **3 subtitles** |
| Duplicate template | **High** | “Art Director Portfolio” appears twice in grid (data/render bug) |
| Redundant filters | Medium | “Tous” + category filters when 10 templates fit one row without filters |
| Layout | Medium | `styleStepHead` + `templatePickerHead` + `premiumGalleryFilters` — triple headers |

**Apple target:** Keynote-style picker: **large thumbnails**, name only, horizontal scroll or 2-row grid. Spacing in inspector after select. Filters → segmented control max 3 segments (Work / Creative / Executive).

---

### 4.7 Export (`docStep-export`)

**Screenshot:** `after-05-export.png`  
**Files:** `pdf-export-v2.css`, `a4-viewport.css`, `cv-a4-pages.css`

| Issue | Severity | Detail |
|-------|----------|--------|
| Layout inefficiency | **High** | Preview shows sparse CV (skills/tools only) with huge empty A4 — user sees failure not success |
| Clipped header | **High** | Contact line cut at top of viewport — zoom/viewport bug |
| Duplicate back | Medium | Back in header (`exportStepHead`) and footer (`cvExportBar`) |
| Footer action sprawl | **High** | 5 buttons in `cvExportBar` equal visual weight |
| exportFinalPanel | Medium | Third export success UI — rarely shown, duplicates downloads |
| Zoom bar | Low | 4 zoom buttons — pinch/scroll or single “Fit” sufficient |

**Apple target:** Full-bleed A4, floating **Download PDF** (black). Secondary actions in `···` menu. Template name subtle top-left.

---

### 4.8 Modals & overlays

| Modal | Issue |
|-------|-------|
| `#cvHeaderEditDialog` | Duplicates identity section editor |
| `#photoEditorDialog` | 3 sliders — OK for Pro; should not surface on free path |
| `#extractionGate` | Duplicate of paste fallback |
| `#proCvEditDrawer` | 6 photo buttons + reorder list — powerful but heavy; belongs in Style step only |

**Apple target:** Max one modal stack. Photo = system file picker + crop, not inline drawer with 6 buttons.

---

### 4.9 Cover letter workspace (`#coverLetterWorkspace`)

| Issue | Severity |
|-------|----------|
| Competing with export footer | **High** |
| 4 inputs + 3 tone toggles + generate + 3 export actions | **High** |
| Duplicates letter tab (debug) and RCC letter CTA | Medium |

**Apple target:** Separate “Letter” mode via step or sheet — not embedded in `docFooter` with CV export bar.

---

### 4.10 Debug / verify (`?debug=true`)

Not user-facing, but **pollutes** simplicity work:

- `#hirelyTestImport`, `#hirelyDebugPanel`, `#hirelyForensicPanel`  
- `docStep-verify`, `#pipelineReportPanel`, audit/LinkedIn/letter tabs  
- `#importDebugPanel`, `#toClassifyDock`, forensic fullscreen  

**Apple target:** Dev tools in separate route (`/lab`), not conditional CSS on production HTML.

---

### 4.11 Parser Lab (`parser-lab/index.html`)

| Issue | Detail |
|-------|--------|
| 3-column dense grid | Appropriate for dev |
| Mode toggle | OK |
| Shares template CSS with prod | Load weight |

**Verdict:** Fine for internal; never linked from prod nav.

---

### 4.12 Test Lab (`test-lab/index.html`)

| Issue | Detail |
|-------|--------|
| Metric cards + filters + table | Standard dashboard — cluttered for Apple bar but OK for QA |

---

### 4.13 PDF Accuracy Lab (`debug/pdf-lab/index.html`)

| Issue | Detail |
|-------|--------|
| Sidebar + 8 metric tiles + stage diff | High density intentional |

---

## 5. Duplicate actions matrix

| User intent | Current controls (count) | Apple target (count) |
|-------------|--------------------------|----------------------|
| Upload CV | Drop zone, hero CTA, pricing CTA, LinkedIn pick, test import | **1** drop + 1 hero CTA |
| Paste text | Fallback panel, alert links, open paste, gate paste, raw details | **1** sheet |
| Replace file | Fallback, retry, replace CV, reset | **1** “Replace” |
| Choose template | Gallery on style **and** edit step, hero templates link | **1** gallery on style only |
| Download PDF | Export bar, final panel, potential RCC | **1** primary |
| Cover letter | Workspace, export bar, RCC button, tab | **1** entry → sheet |
| Back to templates | Header + footer buttons | **1** back chevron |
| See score / issues | RCC, quality step, recovery, suggestions, issues | **1** review list |
| Fix header | cvHeaderBar dialog + studio identity section | **1** inline edit |

---

## 6. Oversized components

| Component | Current | Apple-style |
|-----------|---------|-------------|
| `.hirelyProgressBtn` | Full-width pill, icon + label | Text-only step labels or dots |
| `#progressNextHint` | Large hint box beside stepper | Single line under stepper |
| `.premiumTplCard` | ~220px tall with 4 text blocks | ~160px, image-forward |
| `.extractionQualityWarn` | Full-width banner | Inline icon + text in list |
| `#drop` | Full panel width dashed box | Max 480px centered |
| `.heroPipeline` | 4 cards on landing | Remove — use video/preview |
| `#coverLetterWorkspace` | Full footer section | Modal / separate view |
| `.reviewStudioAnalysis` | Named panel + badges + metrics | Slim sidebar |

---

## 7. Layout inefficiencies

```
CURRENT (edit step — from screenshot)
┌─────────────────────────────────────────────┐
│ [==== Stepper + hint box =================] │  ← 25% height
├─────────────────────────────────────────────┤
│ Extraction quality checklist                │
│ ████████ WARNING BANNER ████████            │
├─────────────────────────────────────────────┤
│ Template gallery (7 filters + 10 cards)     │  ← wrong step
├─────────────────────────────────────────────┤
│ CV preview (partially visible)              │
└─────────────────────────────────────────────┘

APPLE TARGET (edit step)
┌──────────────────┬──────────┐
│                  │ 3 fixes  │
│   CV preview     │ · name   │
│   (60–70%)       │ · exp    │
│                  │ · skills │
├──────────────────┴──────────┤
│      [ Choisir un modèle ]  │  ← single CTA
└─────────────────────────────┘
```

| Screen | Wasted space | Fix |
|--------|--------------|-----|
| Landing | 65% right column empty | A4 live preview |
| Import | Empty “CV importé” | Collapse after success; auto-advance |
| Edit | Gallery on wrong step | `display` gate per `docStep` |
| Export | Empty A4 body | Fix data pipeline; min content gate before export |
| Style | Filter row + title stack | Merge into one toolbar |

---

## 8. Unnecessary controls (remove list)

### Production — remove or merge

| Control | Reason |
|---------|--------|
| `#sampleBtn` | Dev/demo — not user journey |
| `#resetBtn` | Destructive; bury in settings |
| `#heroTemplates` | Skip-ahead breaks flow |
| `#importAnalysisStages` | Superseded by Import Flow V2 |
| `spacingGroup` (3 buttons) | Default + override in export |
| 7 gallery filters | Over-segmentation for 10 items |
| `#exportFinalPanel` | Duplicate export success |
| `#cvHeaderEditBtn` + dialog | Duplicate editor |
| `studioModeToggle` / recruiter mode | Duplicate RCC |
| `#trustStrip` | Hidden; delete |
| LinkedIn duplicate block | Merge into drop zone |
| `importSecondary` 3-button row | Keep paste only in failure state |

### Debug-only — move to `/lab`

| Control |
|---------|
| `#hirelyTestClickBtn`, `#hirelyTestImport` |
| Audit / LinkedIn / Letter tabs |
| `#importDebugPanel`, forensic panel |
| `docStep-verify` |

---

## 9. Priority remediation

| P | Action | Screens | Effort |
|---|--------|---------|--------|
| **P0** | Gate `#templatePickerBar` to `docStep-style` only | Edit | S |
| **P0** | Merge paste/recovery into one component | Import | M |
| **P0** | Export footer → 1 primary + overflow menu | Export | S |
| **P1** | Remove hero pipeline; add A4 preview (`LANDING_PAGE_V4`) | Landing | L |
| **P1** | Shrink stepper; remove `#importFlowV2` macro duplicate | Import | M |
| **P1** | RCC → slim “Review” sidebar (max 3 items) | Edit | M |
| **P1** | Template card → thumbnail + title only | Style | M |
| **P2** | Delete hidden DOM (debug panels, duplicate score UIs) | All | M |
| **P2** | Consolidate 35 CSS → 3 bundles | All | L |
| **P2** | Letter as modal, not footer workspace | Export | M |
| **P3** | Split `index.html` into route modules | All | L |
| **P3** | Revert density pass chrome overrides where they add widgets | All | S |

---

## 10. Apple simplicity scorecard (target state)

| Principle | Today | Target |
|-----------|-------|--------|
| One primary CTA per screen | 2–5 | 1 |
| Progressive disclosure | Many always-visible options | Defaults + “More” |
| Content over chrome | Chrome ~40% on edit/import | Chrome ~15% |
| Consistent navigation | 3 progress systems | 1 stepper |
| Calm typography | Many kickers, badges, uppercase labels | Sentence case, fewer labels |
| Motion with purpose | Import orb + micro beats + wow-factor | One rebuild animation on landing |
| Honest empty states | Empty import list, sparse export CV | Block export until CV complete |

---

## 11. Per-screen control budget (recommended)

| Screen | Max interactive controls | Max text blocks |
|--------|--------------------------|-----------------|
| Landing | 2 (import, pricing link) | 3 (headline, sub, note) |
| Import | 1 (+ hidden file input) | 2 (status, hint) |
| Review | 4 (section jumps) + preview | 4 (score + 3 fixes) |
| Style | 10 (template cards) + 1 filter | 2 (title, subtitle) |
| Export | 2 (download, more menu) | 2 (template name, hint) |

**Current import alone:** ~25 interactive elements.

---

## 12. Files to touch (implementation map)

| Area | Primary files |
|------|---------------|
| Step gating | `index.html` `setDocStep()`, inline `html:not(.debug-mode)` rules |
| Import simplify | `import-flow-v2.js`, `import-flow-v2.css`, `wsImport` markup |
| Review layout | `review-studio-v2.css`, `recruiter-command-center.js` |
| Template gallery | `premium-template-gallery.mjs`, `premium-template-gallery.css` |
| Export bar | `index.html` `#cvExportBar`, `pdf-export-v2.js` |
| Landing | `index.html` `#hero`, `document-experience-v1.css`, `LANDING_PAGE_V4.md` |
| Density rollback | `visual-density-pass.css` (selective) |
| Deletion pass | `index.html` debug panels, `studioRail` prod-unused markup |

---

## 13. Summary

Hirely’s **flow is right**; the **UI stack is too tall**. The product accumulated parallel systems (import progress, recruiter analysis, export paths) while production CSS hid symptoms instead of removing causes. Screenshots confirm the worst offender: **edit step shows style controls and audit banners above the CV**, and **export shows an empty page**.

**Apple-level simplicity** here means:

1. **Subtract** duplicate navigators, recovery panels, and export buttons  
2. **Show the document** — preview is the hero on every step after import  
3. **One list of fixes** — not Command Center + quality step + recovery + classify  
4. **Templates when styling** — not while reviewing  
5. **Landing proves the product** — not a third explanation of 4 steps  

The codebase is ready for a **subtraction sprint** (P0–P1), not a feature sprint.

---

*Report `DESIGN_CRITIQUE_V1` — pairs with `LANDING_PAGE_V4.md`, `IMPORT_FLOW_V2.md`, `VISUAL_DENSITY_PASS` (repo: `visual-density-pass.css`).*
