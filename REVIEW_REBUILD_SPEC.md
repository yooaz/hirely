# Review Rebuild Spec

**Version:** `REVIEW_REBUILD_V1`  
**Generated:** 2026-06-15  
**Status:** SPEC — implementation not started

## Mission

**Review = document review only.**

The user reads their imported CV, sees a recruiter score, addresses up to **three** prioritized fixes, and continues to Style. No secondary workflows (classification queues, recruiter command centers, quality dashboards, template picking, or duplicate recovery panels) on this step.

---

## Product intent

| Principle | Rule |
|-----------|------|
| Single job | Confirm the document is good enough to style and export |
| One surface | CV preview + slim sidebar — nothing else |
| Bounded work | Sidebar shows **max 3 fixes** — never a scrollable audit |
| Clear exit | One primary **Continue** button → Style step |
| No scope creep | Template gallery, letter, recruiter audit, paste recovery → **not on Review** |

---

## Target layout

### Desktop (≥ 800px)

```
┌──────────────────────────────────────────────────────────────────┐
│  Progress nav — Import · Review · Style · Export                   │
├────────────────────────────────────────────┬─────────────────────┤
│                                            │  SCORE              │
│                                            │  ┌─────┐            │
│         CV PREVIEW (70%)                   │  │ 78  │  Strong     │
│         #cvStage / #a4Viewport             │  └─────┘            │
│         live A4 document                   │                     │
│                                            │  FIXES (≤ 3)        │
│                                            │  1. Confirm email   │
│                                            │  2. Add experience  │
│                                            │  3. Add skills      │
│                                            │                     │
│                                            │  [ Continue → ]     │
│                                            │  Choisir un modèle  │
└────────────────────────────────────────────┴─────────────────────┘
        70% minmax(0, 7fr)                      30% minmax(240px, 3fr)
```

### Mobile (< 800px)

Stack: **Preview → Score → Fixes → Continue** (preview first, sidebar below).

### CSS contract

```css
html:not(.debug-mode) .workspaceGrid--ready.docStep-edit .wsProduct {
  display: grid !important;
  grid-template-columns: minmax(0, 7fr) minmax(240px, 3fr);
  grid-template-areas: "preview sidebar";
  gap: 16px;
  align-items: start;
}

html:not(.debug-mode) .workspaceGrid--ready.docStep-edit .studioPreview {
  grid-area: preview;
}

html:not(.debug-mode) .workspaceGrid--ready.docStep-edit #reviewSidebar {
  grid-area: sidebar;
  position: sticky;
  top: 76px;
  max-height: calc(100vh - 96px);
  overflow: auto;
}
```

---

## Target DOM

Replace the current 3-column Review mashup with:

```html
<!-- Inside #wsProduct, visible only on docStep-edit -->
<div class="reviewStep" id="reviewStep" data-step="edit">
  <!-- Existing #studioPreview subtree — trimmed (see Remove list) -->
  <div class="studioPreview" id="studioPreview">…</div>

  <aside class="reviewSidebar" id="reviewSidebar" aria-label="Review">
    <section class="reviewSidebar__score" aria-labelledby="reviewScoreLabel">
      <h2 id="reviewScoreLabel" class="visually-hidden" data-i="reviewSlimTitle">Review</h2>
      <div class="scoreRing reviewSidebar__ring" id="reviewScoreRing" aria-label="Recruiter score">
        <span id="reviewScoreValue">—</span>
      </div>
      <p class="reviewSidebar__band" id="reviewScoreBand">—</p>
      <p class="reviewSidebar__summary" id="reviewScoreSummary" data-i="reviewSidebarSummary">
        Fix the items below, then continue.
      </p>
    </section>

    <ol class="reviewSidebar__fixes" id="reviewFixList" aria-label="Top fixes" data-max-fixes="3">
      <!-- ≤ 3 × <li class="reviewFixCard"> — rendered by renderReviewSidebar() -->
    </ol>

    <footer class="reviewSidebar__actions">
      <button type="button" class="btn primary reviewSidebar__continue" id="reviewContinueBtn"
        data-i="flowCtaChooseTemplate" disabled>
        Choisir un modèle
      </button>
      <p class="reviewSidebar__continueHint" id="reviewContinueHint" aria-live="polite"></p>
    </footer>
  </aside>
</div>
```

**IDs to preserve for DOM contract / QA:** `cvDoc` (inside preview), `studioPreview`, `cvStage`, `a4Viewport`.  
**New required IDs:** `reviewSidebar`, `reviewScoreRing`, `reviewScoreValue`, `reviewFixList`, `reviewContinueBtn`.

---

## Sidebar contents (only)

| Block | Element | Source | Max |
|-------|---------|--------|-----|
| Score | `#reviewScoreRing` + `#reviewScoreValue` + `#reviewScoreBand` | `computeProductScoreReport()` | 1 ring + 1 band label |
| Fixes | `#reviewFixList` | `buildReviewFixList()` (new) | **3 items** |
| Continue | `#reviewContinueBtn` | `syncReviewContinue()` (new) | 1 button |

Nothing else in the sidebar. No tabs, no accordions, no metrics grid, no letter CTA.

---

## Fix list algorithm (`buildReviewFixList`)

Merge candidates from existing validators, dedupe, sort by severity, **slice(0, 3)**.

### Priority order (highest first)

| Priority | Source module | Example fix |
|----------|---------------|-------------|
| P0 — blockers | `cv-data-protection.js` `validateCvData()` | Missing name, empty CV |
| P1 — template lock | `review-before-template-lock.js` `CRITICAL_REVIEW_KINDS` | Uncertain email, OCR paste required |
| P2 — export quality | `quality-validator.js` `criticalIssues` | Missing contact, thin experience |
| P3 — readiness gates | `review-readiness.js` failed gates | No education, no skills |
| P4 — score hints | `computeProductScoreReport()` / trusted review | Weak summary (only if < 3 higher items) |

### Fix card shape

```ts
type ReviewFix = {
  id: string;
  severity: 'blocker' | 'high' | 'medium';
  issue: string;      // one line — what is wrong
  action: string;     // one line — what to do
  target?: 'identity' | 'experience' | 'education' | 'skills' | 'paste';
  onFix?: () => void; // optional: open #cvHeaderEditDialog or setDocStep import paste
};
```

### Rendering rules

- If **0 fixes** and `templateReady`: show single line *"Nothing critical to fix."* + enable Continue.
- If **0 fixes** and `!templateReady`: still show up to 3 from lock report reasons (never empty when blocked).
- Never render fix #4+ in production (debug mode may log full list to console only).
- Each card: issue + action only — **no** accept/reject/classify controls on Review.

### Suggested implementation file

`src/ui/review/review-sidebar.js` — exports:

- `buildReviewFixList(state, deps)` → `ReviewFix[]` (max 3)
- `renderReviewSidebar(host, { score, fixes, canContinue, hint })`
- `syncReviewContinue(btn, lockReport)`

---

## Continue button

| Property | Value |
|----------|-------|
| Label | `flowCtaChooseTemplate` — "Choisir un modèle" / "Choose a template" |
| Enabled when | `getReviewBeforeTemplateLockReport().templateReady === true` **and** `getCvDataValidation().blockStyle === false` |
| Action | `setDocStep('style')` |
| Disabled hint | `#reviewContinueHint` shows `reviewBeforeTemplateLockHint` (one sentence) |

**Move from footer:** `#flowPrimaryCta` must **not** show on `docStep-edit` after rebuild. Continue lives only in `#reviewSidebar`.

---

## Current state — what Review contains today

`docStep-edit` currently mounts **five parallel systems** inside `#wsProduct`:

```
wsProduct (docStep-edit)
├── resumeStudioHead          ← hidden in prod
├── styleStepHead / exportStepHead
├── studioPreview             ← CV preview (KEEP core)
│   ├── extractionQualityStep ← REMOVE from Review
│   ├── templatePickerBar     ← REMOVE from Review (Style only)
│   └── cvStage / cvDoc       ← KEEP
├── reviewStudioCenter        ← REMOVE (suggestions + classify)
├── reviewStudioAnalysis      ← REMOVE (recruiter command center)
├── wsInsights (aside)        ← REMOVE from Review (duplicate score/recovery)
└── studioRail                ← REMOVE from Review (editor + recruiter mode)
```

Footer `#flowPrimaryCta` duplicates Continue CTA at bottom of page.

---

## Remove from Review (production)

### UI panels — delete or `display:none` + stop rendering on `docStep-edit`

| System | DOM / function | File(s) | Reason |
|--------|----------------|---------|--------|
| Quality panels | `#extractionQualityStep`, `#reviewV2Metrics`, `#cvReviewPanel`, `#reviewV2DetailBlocks` | `index.html`, `extraction-quality-step.js` | Not document review — quality dashboard |
| Warning badges | `#reviewV2ReadyBadge`, `#reviewV2BlockedBadge`, `#reviewV2ReviewRequiredBadge`, `#mvpImportBanner`, `#importStatusWarn` | `index.html` | Replaced by score + ≤3 fixes |
| Template gallery | `#templatePickerBar`, `#premiumTemplateGallery` | `index.html`, `premium-template-gallery.css` | Style step only — already hidden via CSS but still rendered |
| Recruiter Command Center | `#recruiterCommandCenter`, `#rccConfidenceBadge`, `renderRecruiterCommandCenter()` | `recruiter-command-center.js`, `review-studio-v2.css` | Full audit — out of scope |
| Recruiter review rail | `#recruiterReviewPanel`, `#studioModeToggle`, `renderRecruiterReview()`, `setStudioMode('recruiter')` | `index.html`, `studio-layout.css` | Duplicate recruiter UX |
| Suggestions / classify | `#reviewStudioCenter`, `#suggestionsPanel`, `#toClassifyPanel`, `renderSuggestionsPanel()`, `renderToClassifyPanel()` | `index.html`, `smart-repair.js` | Classification is not review — defer to import or auto-resolve |
| Duplicate recovery | `#extractionRecoveryPanel` on `docStep-edit`, `renderExtractionRecoveryPanel()` in `renderMetrics()` | `extraction-recovery-panel.js`, `index.html` L262 | Import step + INVALID gate only |
| Legacy insights column | `#wsInsights` score card, `#verifyPanel`, `#issuesPanel`, `#pipelineReportPanel`, `#recsList` | `index.html` | Duplicate of sidebar score/fixes |
| Studio editor rail | `#studioRail`, `#resumeEditorPanel`, `#studioSectionNav`, `#studioScorePanel` | `resume-studio.js`, `resume-editor.css` | Full editor — not review-only |
| Letter CTA | `#openLetterReviewBtn`, `#reviewV2LetterCta` | `index.html` | Export step feature |
| Footer duplicate CTA | `#flowPrimaryCta` on `docStep-edit` | `index.html` L3088 | Moves to sidebar |

### JS — stop calling on `docStep-edit`

| Call | Location | Replace with |
|------|----------|--------------|
| `renderRecruiterCommandCenter()` | `renderScorePanel()` | — |
| `renderCvReviewPanel()` | `renderScorePanel()` | — |
| `renderSuggestionsPanel()` | `renderReviewStudioV2()` | `renderReviewSidebar()` |
| `renderReviewQueueUi()` | `renderMetrics()` | — |
| `renderExtractionRecoveryPanel()` | `renderMetrics()` when `docStep==='edit'` | only on `import` |
| `renderRecruiterReview()` | `renderMetrics()` | — |
| `void refreshResumeStudio()` | `setDocStep('edit')` | — |
| `renderSimpleIssues()` | `setDocStep('edit')` | — |
| `syncReviewStudioV2Chrome()` | multiple | `syncReviewStepLayout()` |

### CSS files to trim (Review scope only)

| File | Action |
|------|--------|
| `review-studio-v2.css` | Replace with `review-sidebar.css` (~120 lines) |
| `recruiter-command-center.css` | Remove Review-step selectors; keep if used elsewhere |
| `studio-layout.css` | Delete 3-column `docStep-edit` rules (L17–260, L559–588); add 70/30 grid |
| `index.html` inline | Remove `docStep-edit` rules for hidden panels (~40 selectors) |

---

## Keep on Review

| Asset | Why |
|-------|-----|
| `#studioPreview` + `#cvStage` + `#cvDoc` + `#a4Viewport` | Document preview — core |
| `renderCV()` / `layoutCvA4WhenReady()` | Live preview updates |
| `#cvHeaderBar` + `#cvHeaderEditDialog` | Minimal identity fix without full editor |
| `computeProductScoreReport()` | Sidebar score |
| `getReviewBeforeTemplateLockReport()` | Continue gate |
| `getCvDataValidation()` | Block Review when INVALID |
| `setDocStep()` guards | Style/export locks unchanged |
| `#docNav` progress | Step chrome |

---

## Preview trim (inside `#studioPreview`)

On `docStep-edit`, **hide** inside preview column only:

- `#extractionQualityStep`
- `#templatePickerBar`
- `#trustStrip`
- `#toClassifyDock`
- `#proCvLayoutTools` (Pro layout → Style step)
- `#a4ZoomBar` (Export step)
- `#cvHeaderBar` — **optional keep** for quick identity fix from fix cards

Preview column = A4 CV + loading/skeleton states only.

---

## Step flow (unchanged gates)

```
Import ──(valid CV)──► Review ──(templateReady)──► Style ──(exportReady)──► Export
```

| Gate | Unchanged logic | UI change |
|------|-----------------|-----------|
| Enter Review | `guardCvDataStep('edit')` | No recovery panel on entry |
| Leave Review → Style | `isTemplateReady()` | Continue button disabled until true |
| INVALID CV | `blockReview` | Redirect to Import — no Review sidebar |

---

## Debug mode (`html.debug-mode`)

Keep full legacy panels behind debug flag only:

- `#reviewStudioCenter`, `#reviewStudioAnalysis`, `#wsInsights`, classify panel
- `renderToClassifyPanel()`, `renderRecruiterCommandCenter()`
- Do **not** ship debug layout to production

---

## File plan

| Action | Path |
|--------|------|
| **Add** | `src/ui/review/review-sidebar.js` — fix list + render |
| **Add** | `src/ui/review/review-sidebar.css` — 70/30 layout + sidebar |
| **Add** | `src/ui/components/ReviewStep.html` — partial (see COMPONENT_SPLIT_PLAN) |
| **Modify** | `index.html` — replace Review DOM subtree |
| **Modify** | `studio-layout.css` — 2-column Review grid |
| **Deprecate** | `review-studio-v2.css` Review rules (merge into review-sidebar.css) |
| **Modify** | `dom-contract.js` — add `reviewSidebar`, `reviewContinueBtn` to optionalIds |

---

## Migration phases

### Phase 1 — Layout shell (no logic change)

1. Add `#reviewSidebar` with static score + placeholder fixes + disabled Continue.
2. CSS 70/30 grid on `docStep-edit`.
3. Hide removed panels via CSS (`display:none !important`).
4. Screenshot baseline.

### Phase 2 — Sidebar logic

1. Implement `buildReviewFixList()` with max 3.
2. Implement `renderReviewSidebar()` + `syncReviewContinue()`.
3. Wire `renderMetrics()` → `renderReviewSidebar()` only on edit step.
4. Hide `#flowPrimaryCta` on edit.

### Phase 3 — Remove dead DOM

1. Delete `#reviewStudioCenter`, `#reviewStudioAnalysis` from production HTML (debug template optional).
2. Remove `#studioRail` from `docStep-edit` flow.
3. Stop loading `recruiter-command-center.js` on Review (lazy on debug only).

### Phase 4 — Cleanup

1. Delete unused Review CSS (~400 lines across files).
2. Update `REVIEW_STUDIO_V2.md` → point to this spec.
3. Add `npm run qa:review-rebuild` gate.

---

## Acceptance criteria

| # | Criterion |
|---|-----------|
| 1 | On `docStep-edit`, layout is **70% preview / 30% sidebar** at ≥1280px |
| 2 | Sidebar shows **exactly one** score ring and **≤ 3** fix cards |
| 3 | **One** Continue button in sidebar; none in footer on Review |
| 4 | No visible: template gallery, recruiter command center, suggestions, classify, recovery panel, issues panel, metrics grid |
| 5 | Continue disabled until `templateReady`; enabled triggers `setDocStep('style')` |
| 6 | `cvDoc` preview still renders and updates after import |
| 7 | `npm run qa:dom-contract` PASS |
| 8 | `npm run qa:empty-cv-protection` PASS — recovery on Import only |
| 9 | Debug mode retains legacy panels without affecting production layout |

---

## Verification

```bash
npm run qa:dom-contract
npm run qa:empty-cv-protection
npm run qa:boot
# After implementation:
npm run qa:review-rebuild
```

Manual:

1. Import `designer-cv-rich.txt` → Review shows preview + score + ≤3 fixes.
2. With incomplete identity → Continue disabled, fix list shows name/email.
3. Resolve fixes → Continue enables → Style shows template gallery.
4. No recruiter audit, no classify column, no duplicate score cards.

---

## Related docs

- `COMPONENT_SPLIT_PLAN.md` — `ReviewStep.html` extraction
- `REVIEW_STUDIO_V2.md` — **superseded** by this spec for production layout
- `EMPTY_CV_PROTECTION_REPORT.md` — recovery stays on Import
- `CSS_CONSOLIDATION_PLAN.md` — remove inline `docStep-edit` debug hides

---

## Appendix — element inventory (current → fate)

| Element ID | Current role | Fate |
|------------|--------------|------|
| `reviewStudioCenter` | Classify + suggestions | **Remove** |
| `reviewStudioAnalysis` | RCC + score + badges | **Replace** → `reviewSidebar` |
| `recruiterCommandCenter` | McKinsey-style audit | **Remove** |
| `suggestionsPanel` | Product suggestions | **Remove** |
| `toClassifyPanel` | Smart repair queue | **Remove** (debug only) |
| `extractionRecoveryPanel` | Recovery UI | **Import only** |
| `wsInsights` | Legacy score column | **Hidden** on Review |
| `studioRail` | Editor + recruiter | **Remove** from Review |
| `templatePickerBar` | Gallery | **Style only** |
| `flowPrimaryCta` | Footer continue | **Style only** (Review uses `reviewContinueBtn`) |
| `reviewV2ScoreRing` | Score | **Rename** → `reviewScoreRing` |
| `openLetterReviewBtn` | Cover letter | **Export** step |
