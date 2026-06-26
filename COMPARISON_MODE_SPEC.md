# Hirely Comparison Mode — Product & Engineering Spec

**Version:** `COMPARISON_MODE_V1`  
**Status:** Spec (not yet implemented)  
**Target:** Let users see **Original CV** vs **Generated CV** side by side, with clear highlights for what Hirely improved — without increasing cognitive load.

---

## 1. Problem

After import, users see only the **generated** CV in the A4 preview. They cannot easily answer:

- *What changed?*
- *Did Hirely lose anything?*
- *Why is the recruiter score higher?*
- *Is the new layout actually better for ATS?*

The product already computes before/after signals (`cv-enhancement-engine`, `cv-rebuild-engine`, ATS scoring, review gates) but does not surface them in a unified visual comparison.

---

## 2. Goal

| Requirement | Detail |
|-------------|--------|
| Side-by-side view | Original left, Generated right (RTL-aware flip) |
| Highlight improvements | Four highlight families + summary ribbon |
| Trust | Show retention % and “nothing invented” badge |
| Low cognitive load | Default to **summary + top 5 wins**; expand on demand |
| Fit existing flow | Available from **Review** and **Style** steps; optional in **Export** |

**Non-goals (V1):** pixel-perfect PDF overlay diff, line-by-line merge editor, multi-template A/B grid.

---

## 3. User stories

1. **As a candidate**, after import I want to see my original CV next to the Hirely version so I trust the transformation.
2. **As a candidate**, I want highlighted sections that explain *why* the new CV is better (ATS, readability, structure).
3. **As a recruiter-minded user**, I want a score delta (before → after) per dimension without reading two full documents.
4. **As a creative CV user**, I want to understand that layout was rebuilt intentionally (columns/graphics stripped) while content was preserved.
5. **As a power user**, I want to filter highlights by category (sections / ATS / layout / readability).

---

## 4. Entry points

| Location | Trigger | When visible |
|----------|---------|--------------|
| Review step toolbar | Tab: **Compare** (`data-tab="compare"`) | After successful import + preview render |
| Recruiter Command Center | Link: “View comparison” | When `state.cvData` is valid |
| Style step | Toggle: “Compare with original” | Same gate as review |
| Hero pipeline cards | Optional CTA post-import | Deep-link `?compare=1` |

**Gate:** Comparison mode requires `state.rawText.length >= 80` and `isFinalResumeRenderable(state.finalResumeData)`.

---

## 5. Layout

### 5.1 Desktop (≥1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Compare · Score +12 · 94% text retained · 7 improvements                │
│  [All] [Sections] [ATS] [Layout] [Readability]     Sync scroll ☑        │
├─────────────────────────────┬────────────────────────────────────────────┤
│  ORIGINAL                   │  GENERATED                                 │
│  ─────────                  │  ─────────                                 │
│  PDF page 1 / plain text    │  A4 live preview (active template)         │
│  monospace, muted chrome    │  full product chrome                       │
│                             │                                            │
│  ░░ weak section            │  ██ improved section (highlight)           │
│  ░░ OCR noise               │  ██ clean bullets                          │
└─────────────────────────────┴────────────────────────────────────────────┘
│  Improvement cards (collapsible): top wins + “Show all N changes”          │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Split ratio:** 50/50 default; resizable drag handle (persisted in `sessionStorage`).
- **Sync scroll:** Optional linked scroll for text mode; disabled for PDF thumbnail vs A4 (different aspect).
- **Density:** Uses `visual-density-pass.css` tokens — compact summary ribbon, no extra hero padding.

### 5.2 Tablet / mobile

- Stacked tabs: **Original | Generated | Improvements**
- Summary ribbon stays pinned
- Highlights appear as cards under Generated tab

---

## 6. Pane content

### 6.1 Original (left)

| Import type | Render strategy |
|-------------|-----------------|
| PDF | First-page raster via `pdf-first-page.js` / `pdf-ocr-render.js`; fallback plain text |
| DOCX / TXT / paste | `state.rawText` in scrollable `<pre class="comparisonOriginalText">` |
| LinkedIn paste | Formatted text + “LinkedIn import” badge |
| OCR / scan | Same as PDF; warn badge if `extractionQuality !== 'good'` |

**Data sources:**

- `state.rawText` — canonical original text
- `state.cleanText` — cleaned extraction (toggle: “Show cleaned source”)
- `state.lastImportFile` — blob for PDF thumbnail
- `buildExtractionArchiveStage()` output — per-line archive (debug/advanced toggle)

**Label:** i18n `compareOriginal` — “Original CV”

### 6.2 Generated (right)

| Mode | Render strategy |
|------|-----------------|
| Default | Existing `#a4Viewport` clone or shared viewport instance |
| Text fallback | `formatCvAsStructuredText(state.cvData)` with section anchors |

**Data sources:**

- `state.finalResumeData` / `state.cvData`
- `state.activeTemplate`, `state.spacing`
- Live template CSS from `cv-templates-v3-families.css`

**Label:** i18n `compareGenerated` — “Generated CV”

---

## 7. Highlight taxonomy

Each highlight is a `ComparisonHighlight` with `category`, `sectionId`, `severity`, `beforeSnippet`, `afterSnippet`, `messageKey`, `scoreImpact`.

### 7.1 Improved sections (`section`)

**What:** Structure and completeness improvements.

| Signal | Detection | Example message |
|--------|-----------|-----------------|
| Section detected | `fuzzySectionKey` on raw vs structured sections | “Experience section structured from mixed layout” |
| Gate passed | `buildReviewReadinessReport().gates` | “Education block added and validated” |
| Field recovered | `reviewQueue` resolved items | “Phone number moved from unclassified lines” |
| New section | `resumeData` has section absent in raw heuristic | “Skills block separated from experience” |
| Content retention | `measureTextRetention()` ≥ 80% | “94% of original text preserved in structure” |

**Visual:** Green left border on generated section; amber on original if content was noisy/unclassified.

### 7.2 ATS improvements (`ats`)

**What:** Parser-safe structure and ATS dimension gains.

| Signal | Detection | Example message |
|--------|-----------|-----------------|
| Score delta | `computeAtsQualityH8(beforeCv)` vs `computeAtsQualityH8(afterCv)` | “ATS score 62 → 84 (+22)” |
| Keyword coverage | ATS H8 `matched` / `gaps` diff | “Role keywords now in experience bullets” |
| Formatting penalty removed | `PENALTY_WEIGHTS.badFormatting` cleared | “Removed multi-column artifacts hurting ATS parse” |
| Date ranges | `DATE_RANGE_RE` on experience lines | “Consistent date ranges for ATS parsers” |
| Duplicate content | `DUPLICATE_SLASH_RE` fixed | “Duplicate role lines merged” |

**Visual:** Blue highlight + ATS icon chip in summary ribbon.

### 7.3 Layout improvements (`layout`)

**What:** Intentional layout rebuild (never preserve source layout per `CV_REBUILD_ENGINE_V1`).

| Signal | Detection | Example message |
|--------|-----------|-----------------|
| Rebuild flag | `meta.neverPreservesSourceLayout === true` | “Rebuilt from data — source columns/tabs removed” |
| Single-column flow | template applied vs multi-column raw | “Single-column reading order for recruiters” |
| Template spacing | `state.spacing` + template family | “Consistent section rhythm (Normal spacing)” |
| Whitespace normalized | `stripFormattingArtifacts` / tab alignment stripped | “Aligned whitespace and bullet hierarchy” |
| Creative → structured | `creative-cv-mode` metadata | “Creative layout converted to recruiter-scannable structure” |

**Visual:** Purple outline on generated page; informational callout on original (“Source layout not preserved by design”).

### 7.4 Recruiter readability improvements (`readability`)

**What:** Copy and presentation improvements a recruiter would notice in 6 seconds.

| Signal | Detection | Example message |
|--------|-----------|-----------------|
| Enhancement rewrites | `resumeData.meta.cvEnhancement.changes[]` | “Experience bullet starts with action verb” |
| Weak → strong description | `ISSUE_TYPES.WEAK_DESCRIPTION` fixed | “Expanded thin role description” |
| Action verbs | `hasActionVerb` before/after | “Summary now leads with impact verb” |
| Bullet structure | experience bullets count / length | “Achievements broken into scannable bullets” |
| Recruiter panel delta | `buildRecruiterPanelMetrics` before/after | “Readability 58 → 76 (+18)” |
| Trusted review | `computeProductScore` strengths | “Recruiter strengths: clear title, quantified impact” |

**Visual:** Teal inline highlight on changed sentences; tooltip with before/after snippet.

### 7.5 Severity

| Level | Use |
|-------|-----|
| `win` | Clear improvement; show in top 5 |
| `neutral` | Informational (e.g. layout rebuild policy) |
| `watch` | Possible loss or needs user review (`reviewQueue` items) |

---

## 8. Comparison engine (backend)

### 8.1 Module

**Path:** `src/core/comparison/comparison-mode-engine.js`

```js
export const COMPARISON_MODE_V1 = 'COMPARISON_MODE_V1';

/**
 * @param {{
 *   rawText: string,
 *   cleanText?: string,
 *   beforeCvData: object,
 *   afterCvData: object,
 *   resumeData?: object,
 *   enhancementMeta?: object,
 *   rebuildMeta?: object,
 *   reviewQueue?: object[],
 *   importMeta?: object,
 * }} input
 * @returns {ComparisonReport}
 */
export function buildComparisonReport(input) { ... }
```

### 8.2 `ComparisonReport` shape

```ts
type ComparisonReport = {
  version: 'COMPARISON_MODE_V1';
  available: boolean;
  reason?: string;
  retention: { pct: number; rawChars: number; structuredChars: number };
  scores: {
    before: RecruiterPanelMetrics;
    after: RecruiterPanelMetrics;
    delta: { overall: number; ats: number; readability: number; content: number };
  };
  highlights: ComparisonHighlight[];
  topWins: ComparisonHighlight[];      // max 5, severity === 'win'
  watchItems: ComparisonHighlight[];   // review required
  sections: {
    id: string;
    label: string;
    beforePresent: boolean;
    afterPresent: boolean;
    improved: boolean;
  }[];
  meta: {
    importType: 'pdf' | 'docx' | 'txt' | 'linkedin' | 'paste';
    rebuildEngine: string;
    enhancementEngine: string;
    neverPreservesSourceLayout: boolean;
  };
};
```

### 8.3 Building `beforeCvData`

Snapshot taken **at import confirmation** (before rebuild/enhancement):

1. Parse `rawText` through lightweight `simple-cv-mapper` or first-pass `structuredResume` pre-rebuild.
2. Store in `state.comparisonSnapshot.beforeCvData` (session only; not exported).
3. Re-score with `computeAtsQualityH8` + `computeRecruiterScoreV2` for apples-to-apples delta.

> **Important:** Before snapshot must use the same scoring normalizers as after (`normalizeCvForAtsScoring`).

### 8.4 Highlight generation pipeline

```
rawText + beforeCvData + afterCvData
        │
        ├─► section diff (section-mapper, review-readiness gates)
        ├─► ATS diff (ats-quality-h8, recruiter-score-v2)
        ├─► layout signals (cv-rebuild-engine meta)
        ├─► readability diff (cv-enhancement-engine changes)
        └─► retention (extraction-archive measureTextRetention)
                │
                ▼
        merge + dedupe + rank by scoreImpact
                │
                ▼
        topWins (5) + full highlights[]
```

---

## 9. UI components

| Component | Path | Role |
|-----------|------|------|
| Comparison shell | `src/ui/comparison/comparison-mode.css` | Split layout, highlights |
| Comparison panel | `#comparisonPanel` in `index.html` | Tab panel in workspace |
| Summary ribbon | `#comparisonSummary` | Score delta, retention, filter chips |
| Original pane | `#comparisonOriginal` | PDF img or pre text |
| Generated pane | `#comparisonGenerated` | A4 viewport host |
| Improvement list | `#comparisonImprovements` | Collapsible cards |
| Engine | `src/core/comparison/comparison-mode-engine.js` | Report builder |
| Renderer | `src/ui/comparison/comparison-mode.js` | DOM bind (or inline in index.html phase 1) |

### 9.1 Highlight rendering

- Section-level: `data-comparison-section="experience"` on generated blocks
- Text-level: wrap changed spans with `.comparisonHighlight--{category}`
- Click highlight → scroll other pane to related anchor (if exists)
- Keyboard: `1-4` switches filter chips; `Esc` exits compare tab

### 9.2 Integration with existing tabs

Unhide compare tab in production (currently audit/linkedin/letter tabs are hidden in non-debug):

```html
<button type="button" class="tab" role="tab" data-tab="compare">
  <span data-i="tabCompare">Compare</span>
</button>
```

Place after **Preview** tab, before hidden pro tabs.

---

## 10. State & wiring

### 10.1 New `state` fields

```js
comparisonSnapshot: {
  beforeCvData: null,
  capturedAt: null,
  importType: null,
},
comparisonReport: null,
comparisonFilter: 'all', // 'all' | 'section' | 'ats' | 'layout' | 'readability'
comparisonSyncScroll: true,
```

### 10.2 Lifecycle

| Event | Action |
|-------|--------|
| Import confirmed | Capture `beforeCvData`; clear stale report |
| Rebuild complete | `buildComparisonReport()` → `state.comparisonReport` |
| Enhancement applied | Re-run report (readability highlights refresh) |
| Template / spacing change | Update generated pane only; layout highlights refresh |
| Replace CV | Clear comparison state |

### 10.3 Call sites

| Existing function | Hook |
|-------------------|------|
| `applyCvRebuildEngine` / `hirely-import.js` | After rebuild, capture snapshot if missing |
| `runCvEnhancement` | Merge `cvEnhancement` into report |
| `renderReviewStudioV2()` | Pass comparison summary link |
| `renderRecruiterReview()` | Score delta badge |
| Tab switch handler | `renderComparisonMode()` |

---

## 11. Copy & i18n keys

| Key | EN | FR |
|-----|----|----|
| `tabCompare` | Compare | Comparer |
| `compareOriginal` | Original CV | CV d'origine |
| `compareGenerated` | Generated CV | CV généré |
| `compareScoreDelta` | Score {before} → {after} (+{delta}) | Score {before} → {after} (+{delta}) |
| `compareRetention` | {pct}% text retained | {pct}% du texte conservé |
| `compareLayoutNote` | Layout rebuilt for clarity — content preserved | Mise en page reconstruite — contenu préservé |
| `compareNoInvention` | No invented information | Aucune information inventée |
| `compareFilterAll` | All improvements | Toutes les améliorations |
| `compareFilterSection` | Sections | Sections |
| `compareFilterAts` | ATS | ATS |
| `compareFilterLayout` | Layout | Mise en page |
| `compareFilterReadability` | Readability | Lisibilité |
| `compareShowAll` | Show all {n} changes | Voir les {n} changements |
| `compareWatch` | Needs your review | À vérifier |

---

## 12. Edge cases

| Case | Behavior |
|------|----------|
| Paste-only, no file | Original pane = text only; no PDF thumbnail |
| OCR poor quality | Show `compareWatch` highlights; retention badge amber if < 80% |
| LinkedIn import | Original = normalized paste; badge + fewer layout highlights |
| User edits header | Regenerate report; readability highlights update |
| Enhancement disabled | Readability highlights from structure/ATS only |
| Identical scores | Show “Structure clarified” neutral highlights; hide delta badge |
| Long CV (4+ pages) | Original PDF: page 1 + page selector; Generated: A4 scroll |

---

## 13. Privacy & security

- `beforeCvData` snapshot stays **in-memory** (session); never sent to third parties.
- Comparison report excluded from PDF export and email attachments.
- Optional analytics event: `comparison_viewed` with counts only (no CV text).

---

## 14. Implementation phases

### Phase 1 — MVP (ship first)

- [ ] `comparison-mode-engine.js` with section + ATS + retention highlights
- [ ] Compare tab with 50/50 text vs A4 split
- [ ] Summary ribbon (score delta + top 5 wins)
- [ ] i18n EN/FR

### Phase 2 — Full highlights

- [ ] Layout + readability highlights from rebuild/enhancement meta
- [ ] PDF thumbnail original pane
- [ ] Filter chips + improvement cards
- [ ] Link from Recruiter Command Center

### Phase 3 — Polish

- [ ] Resizable split + sync scroll
- [ ] Mobile stacked tabs
- [ ] `qa-comparison-mode.mjs` + `COMPARISON_MODE_REPORT.md` generator
- [ ] Playwright visual regression (compare tab smoke)

---

## 15. Acceptance criteria

| # | Criterion |
|---|-----------|
| 1 | User can open Compare tab within 1 click from Review step after import |
| 2 | Original and Generated render side by side on ≥1024px viewport |
| 3 | Summary shows ATS/recruiter score delta when both snapshots exist |
| 4 | At least one highlight appears per category on golden CV fixtures |
| 5 | `watch` highlights surface unresolved `reviewQueue` items |
| 6 | Retention % matches `measureTextRetention` within ±2% |
| 7 | No highlight claims “invention” — enhancement engine guard respected |
| 8 | Compare tab meets WCAG AA contrast for highlight colors |
| 9 | FR/EN strings present for all UI chrome |
| 10 | QA script passes on CI (`npm run qa:comparison-mode`) |

---

## 16. QA fixtures

Use existing test lab catalog (`tests/lib/hirely-test-lab-catalog.mjs`):

| Fixture | Expected highlights |
|---------|---------------------|
| Developer CV (ATS) | ATS + readability (action verbs) |
| Creative multi-column | Layout + section |
| Scanned PDF | Watch + retention |
| Executive CV | Section completeness + recruiter readability |
| LinkedIn paste | Section; minimal layout |

---

## 17. Related systems

| System | Relationship |
|--------|--------------|
| `CV_REBUILD_ENGINE_V1` | Layout rebuild policy + metadata |
| `CV_ENHANCEMENT_ENGINE_V2` | Before/after copy changes |
| `ATS_QUALITY_H8` / `RECRUITER_SCORE_V2` | Score deltas |
| `buildReviewReadinessReport` | Section gates |
| `extraction-archive` | Retention measurement |
| `REVIEW_STUDIO_V2` | Host layout (Review step) |
| `VISUAL_DENSITY_PASS_V1` | Compact compare chrome |

---

## 18. Proposed file map

```
src/core/comparison/
  comparison-mode-engine.js    # Report builder
  comparison-section-diff.js   # Section-level diff helpers
  comparison-highlight-rank.js   # Sorting / top wins
  index.js

src/ui/comparison/
  comparison-mode.css          # Split layout + highlight tokens
  comparison-mode.js             # UI controller (optional phase 1: inline index.html)

src/tests/
  qa-comparison-mode.mjs

scripts/
  comparison-mode-report.mjs   # Optional CI artifact

COMPARISON_MODE_SPEC.md        # This document
```

---

## 19. Visual tokens (highlights)

```css
:root {
  --compare-highlight-section: #22c55e33;
  --compare-highlight-ats: #3b82f633;
  --compare-highlight-layout: #a855f733;
  --compare-highlight-readability: #14b8a633;
  --compare-highlight-watch: #f59e0b33;
  --compare-split-min: 280px;
}
```

Use border-left 3px + subtle background — never rely on color alone (include icon + label).

---

## 20. Success metrics

| Metric | Target |
|--------|--------|
| Compare tab open rate (post-import) | ≥ 40% of completed imports |
| Time to first compare render | < 400ms after tab click |
| User-reported “trust” survey | +15% vs no comparison |
| Export rate after viewing compare | ≥ baseline (no drop) |

---

*Spec aligns with Hirely pipeline contracts: rebuilt output never preserves source layout; enhancement never invents facts; ATS scoring uses H8 + Recruiter Score V2.*
