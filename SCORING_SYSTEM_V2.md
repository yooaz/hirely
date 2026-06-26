# Hirely Visual Scoring System V2

**Version:** `SCORING_SYSTEM_V2`  
**Status:** Spec (partial UI exists — this document defines the unified visual layer)  
**Goal:** Replace flat percentages with a **visual score language** — rings, bars, heatmaps, and confidence indicators across six recruiter-facing dimensions.

---

## 1. Problem

Today Hirely surfaces scores as:

| Surface | Current UX |
|---------|------------|
| Review panel | `72` in a conic ring + `72%` text bars |
| RCC audit | Score ring + confidence badge |
| Metrics grid | Label + number + 3px bar (`scoreMetricsGrid`) |
| Bands | `bandGood` / `bandAverage` text only |

Recruiters and candidates don't think in **percentages** — they think in **bands**, **signals**, and **scan patterns**. A ring showing `73` without context feels arbitrary. Six separate backend scores (`readability`, `ats`, `content`, `experience`, `panel`) don't map to one coherent story.

**Scoring System V2** unifies six product dimensions with distinct visual treatments and qualitative labels.

---

## 2. Six dimensions

| # | Dimension | ID | What it measures | Primary source |
|---|-----------|-----|------------------|----------------|
| 1 | **Recruiter Readability** | `readability` | 6-second scan — can a recruiter grasp profile fast? | `buildCompositeScores().readability` |
| 2 | **ATS Compatibility** | `ats` | Parser-safe structure for Greenhouse/Lever/Workday | `analyzeAtsPro()` / `panel.ats` |
| 3 | **Professional Positioning** | `positioning` | Title, summary, narrative coherence | Archetype + title + summary gates |
| 4 | **Experience Strength** | `experience` | Depth, dates, metrics, role proof | `scoreExperience()` + `METRIC_RE` |
| 5 | **Market Competitiveness** | `market` | Placement odds vs segment | Trust score + RCC market tier |
| 6 | **Visual Design** | `design` | Template + layout + export polish | Formatting + template family + A4 render |

Each dimension scores **0–100** internally but **never shows raw % as primary label** in consumer UI.

---

## 3. Visual language (replace boring percentages)

### 3.1 Principle: show band first, number second

| Internal score | Band label | Color token | Ring fill |
|----------------|------------|-------------|-----------|
| 82–100 | **Excellent** | `--score-excellent` #22c55e | Full arc |
| 65–81 | **Strong** | `--score-strong` #4ade80 | High arc |
| 50–64 | **Fair** | `--score-fair` #fbbf24 | Mid arc |
| 35–49 | **Needs work** | `--score-weak` #fb923c | Low arc |
| 0–34 | **At risk** | `--score-risk` #fb7185 | Minimal arc |

**Display:** `Strong` as headline · `72` as secondary micro-text inside ring (optional toggle in settings).

### 3.2 Visual components

| Component | Use | Dimensions |
|-----------|-----|------------|
| **Rings** | Hero overall + per-dimension summary | All 6 + composite |
| **Bars** | Sub-factor breakdown within a dimension | ATS (7 dims), Experience (dates/metrics/depth) |
| **Heatmaps** | Section health grid | Readability + Positioning |
| **Confidence indicators** | Data trust, not quality | Global + per-dimension |

---

## 4. Component specifications

### 4.1 Rings (`hirely-score-ring`)

**Existing base:** `.scoreRing` conic-gradient in `index.html` (72px).

**V2 enhancements:**

```html
<div class="hirelyScoreRing hirelyScoreRing--strong" 
     style="--score:72" 
     role="img" 
     aria-label="Recruiter Readability: Strong">
  <span class="hirelyScoreRing__band">Strong</span>
  <span class="hirelyScoreRing__value" aria-hidden="true">72</span>
</div>
```

| Variant | Size | Context |
|---------|------|---------|
| `--hero` | 88px | Review panel top — composite score |
| `--dimension` | 48px | Six-dimension grid |
| `--inline` | 32px | Template picker, export step |

**CSS:**

```css
.hirelyScoreRing {
  --track: #eef1f5;
  --fill: var(--score-accent, var(--ink));
  background: conic-gradient(var(--fill) calc(var(--score) * 1%), var(--track) 0);
}
.hirelyScoreRing__band {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.hirelyScoreRing__value {
  font-size: 11px;
  opacity: 0.55;
}
```

**Animation:** 400ms ease-out arc fill on score change (respect `prefers-reduced-motion`).

---

### 4.2 Bars (`hirely-score-bar`)

**Existing base:** `.scoreMetricsGrid .bar` (3px height).

**V2 enhancements:**

```html
<div class="hirelyScoreBar" data-band="strong">
  <div class="hirelyScoreBar__head">
    <span class="hirelyScoreBar__label">Keywords</span>
    <span class="hirelyScoreBar__band">Strong</span>
  </div>
  <div class="hirelyScoreBar__track">
    <span class="hirelyScoreBar__fill" style="width:78%"></span>
  </div>
</div>
```

| Property | Value |
|----------|-------|
| Track height | 6px (dimension) · 4px (nested) |
| Radius | 999px |
| Fill | Band color gradient (not flat ink) |
| Label | **No trailing `%`** — band word only |

**Use inside dimensions:**

- **ATS:** 7 `ATS_PRO_DIMENSIONS` bars
- **Experience:** Dates · Metrics · Depth · Action verbs
- **Design:** Typography · Spacing · Template fit · PDF render

---

### 4.3 Heatmaps (`hirely-score-heatmap`)

Section × health grid — replaces bullet lists of weaknesses.

```html
<div class="hirelyHeatmap" role="grid" aria-label="Section health">
  <!-- rows: sections, cols: signal type -->
</div>
```

**Grid axes (Readability heatmap):**

| Row (section) | Cols (signal) |
|---------------|---------------|
| Identity | Clear · Complete · Prominent |
| Summary | Present · Length · Impact |
| Experience | Dated · Proof · Scannable |
| Skills | Listed · Relevant · Dense |
| Contact | Email · Phone · Links |

**Cell states:**

| State | Color | Meaning |
|-------|-------|---------|
| `hot` | Green 500 | Strong |
| `warm` | Green 200 | OK |
| `cool` | Amber 200 | Weak |
| `cold` | Red 200 | Missing / risk |
| `empty` | Gray 100 | N/A |

**Rendering:** 5×3 grid max (15 cells) — compact, no legend required (tooltip on hover/focus).

**Positioning heatmap:** Title ↔ Experience ↔ Skills alignment (3×3 coherence matrix).

---

### 4.4 Confidence indicators (`hirely-score-confidence`)

Separate **data trust** from **quality score**.

```html
<div class="hirelyConfidence" data-tier="high" title="High confidence — extracted data verified">
  <span class="hirelyConfidence__dot"></span>
  <span class="hirelyConfidence__label">High confidence</span>
</div>
```

| Tier | Rule | Visual |
|------|------|--------|
| **High** | Extraction ≥80, no critical review items | Solid green dot |
| **Medium** | Extraction 55–79 or minor review queue | Half-fill amber dot |
| **Low** | OCR poor, critical review, incomplete import | Pulsing red ring (subtle) |

**Per-dimension confidence:** Small dot on dimension ring corner — dims when section inferred not extracted.

**Sources:**

- `importQualityScore` — `import-quality-score.js`
- `recruiterConfidence()` — `recruiter-command-center.js`
- `countUnresolvedCriticalReview()` — `trust-score.js`

---

## 5. Dimension → visual mapping

### 5.1 Recruiter Readability

**Question:** *Can a recruiter understand this CV in 6 seconds?*

| Sub-signal | Weight | Visual |
|------------|--------|--------|
| Identity clarity | 25% | Heatmap row |
| Summary scanability | 25% | Heatmap row |
| Section order | 20% | Bar |
| Bullet density | 15% | Bar |
| Formatting noise | 15% | Bar |

**Primary visual:** **Heatmap** (section scan) + **Ring** (composite)  
**Source:** `scores.readability` — identity + summary + formatting (`recruiter-score-v2.js`)

**Band copy:**

| Band | Label shown |
|------|-------------|
| Excellent | "Instantly scannable" |
| Strong | "Easy to read" |
| Fair | "Readable with effort" |
| Needs work | "Dense or unclear" |
| At risk | "Hard to scan" |

---

### 5.2 ATS Compatibility

**Question:** *Will ATS parsers extract this correctly?*

| Sub-signal | Weight | Visual |
|------------|--------|--------|
| Keywords | 14% | Bar |
| Format | 14% | Bar |
| Sections | 16% | Bar |
| Readability (ATS) | 12% | Bar |
| Contact | 14% | Bar |
| Experience structure | 20% | Bar |
| Skills relevance | 20% | Bar |

**Primary visual:** **Bars** (7 dimensions) + **Ring**  
**Source:** `analyzeAtsPro()` — `ats-engine-pro.js`

**Platform benchmark strip (optional):**

```
Greenhouse ●●●○  Lever ●●○○  Workday ●●●●  SmartRecruiters ●●○○
```
Dot bars — not percentages.

---

### 5.3 Professional Positioning

**Question:** *Is the career story coherent and targeted?*

| Sub-signal | Weight | Visual |
|------------|--------|--------|
| Title clarity | 30% | Heatmap |
| Summary positioning | 25% | Heatmap |
| Title ↔ experience match | 25% | Heatmap |
| Archetype fit | 20% | Ring |

**Primary visual:** **Heatmap** (coherence 3×3) + **Ring**  
**Source:** `detectCvArchetype()`, `marketPositioning()`, title/experience cross-check

**Band copy:**

| Band | Label |
|------|-------|
| Excellent | "Crystal-clear positioning" |
| Strong | "Well positioned" |
| Fair | "Positioning unclear" |
| Needs work | "Mixed signals" |
| At risk | "Unpositioned profile" |

---

### 5.4 Experience Strength

**Question:** *Is work history credible and proof-rich?*

| Sub-signal | Weight | Visual |
|------------|--------|--------|
| Role depth (count) | 20% | Bar |
| Date completeness | 25% | Bar |
| Measurable impact | 30% | Bar |
| Action verb density | 15% | Bar |
| Tenure credibility | 10% | Bar |

**Primary visual:** **Bars** + **Ring**  
**Source:** `scoreExperience()`, `METRIC_RE`, `collectExperienceRows()`

**Band copy:**

| Band | Label |
|------|-------|
| Excellent | "Proof-rich experience" |
| Strong | "Solid work history" |
| Fair | "Experience needs proof" |
| Needs work | "Thin descriptions" |
| At risk | "Experience unclear" |

---

### 5.5 Market Competitiveness

**Question:** *How competitive is this profile in the market right now?*

| Sub-signal | Weight | Visual |
|------------|--------|--------|
| Trust score composite | 35% | Ring |
| Archetype segment strength | 25% | Bar |
| Keyword coverage | 20% | Bar |
| Seniority ↔ years match | 20% | Bar |

**Primary visual:** **Ring** (hero secondary) + **Confidence** badge  
**Source:** `computeTrustScore()`, RCC `marketPositioning`, `keywordCoverage()`

**Band copy:**

| Band | Label |
|------|-------|
| Excellent | "Top-tier candidate" |
| Strong | "Competitive profile" |
| Fair | "Selective market" |
| Needs work | "Uphill search" |
| At risk | "Limited market fit" |

---

### 5.6 Visual Design

**Question:** *Does the CV look professional in preview and PDF?*

| Sub-signal | Weight | Visual |
|------------|--------|--------|
| Template appropriateness | 30% | Bar |
| Typography hierarchy | 25% | Bar |
| Spacing / density | 20% | Bar |
| A4 render validity | 15% | Confidence |
| ATS-safe layout | 10% | Bar |

**Primary visual:** **Bars** + **Confidence** (PDF render)  
**Source:** `scoreFormatting()`, template metadata (`creative-template-pack.mjs`), `auditPdfRender()`

**Band copy:**

| Band | Label |
|------|-------|
| Excellent | "Publication-ready" |
| Strong | "Professional layout" |
| Fair | "Acceptable design" |
| Needs work | "Layout uneven" |
| At risk | "Export issues" |

---

## 6. Layout — Score Dashboard V2

**Location:** Review step → `#reviewStudioAnalysis` (replaces hidden `#reviewV2Metrics` in production).

```
┌─ Score Dashboard ──────────────────────────────────────────────┐
│  [HERO RING 88px]  Strong · Market Competitive               │
│  ● High confidence                                             │
│  "Clear backend profile — add metrics to reach Excellent."     │
├────────────────────────────────────────────────────────────────┤
│  DIMENSION RINGS (6 × 48px)                                    │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────┐│
│  │Readab. │ │  ATS   │ │Position│ │ Exper. │ │ Market │ │Design│
│  │ Strong │ │  Fair  │ │ Strong │ │  Fair  │ │ Strong │ │Strong│
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────┘│
├────────────────────────────────────────────────────────────────┤
│  [Active tab: ATS Compatibility]                               │
│  ████████░░ Keywords      Strong                               │
│  ██████░░░░ Format        Fair                                 │
│  █████████░ Sections      Strong                               │
│  ...                                                           │
│  ── OR ──                                                      │
│  [Active tab: Readability]                                     │
│  HEATMAP 5×3 section grid                                      │
└────────────────────────────────────────────────────────────────┘
```

**Interaction:**

- Tap dimension ring → expand bars or heatmap for that dimension
- Default tab: weakest dimension (coaching-first)
- Hero ring = weighted composite (see §7)

---

## 7. Composite score formula

**Hero ring** (internal only — display band, not weighted formula to user):

| Dimension | Weight |
|-----------|--------|
| Recruiter Readability | 20% |
| ATS Compatibility | 18% |
| Professional Positioning | 18% |
| Experience Strength | 22% |
| Market Competitiveness | 12% |
| Visual Design | 10% |

```js
composite = round(
  readability * 0.20 +
  ats * 0.18 +
  positioning * 0.18 +
  experience * 0.22 +
  market * 0.12 +
  design * 0.10
);
```

**Creative mode:** Swap weights — Design 18%, ATS 12%.

**Caps:** Inherit `TRUST_SCORE_CAPS` — composite cannot exceed cap when identity/email/experience missing.

---

## 8. Data model

```ts
type ScoreBand = 'excellent' | 'strong' | 'fair' | 'needs_work' | 'at_risk';

type DimensionScore = {
  id: string;
  score: number;              // 0–100 internal
  band: ScoreBand;
  label: string;              // "Strong", not "72%"
  headline: string;           // "Easy to read"
  confidence: 'high' | 'medium' | 'low';
  factors: Array<{
    id: string;
    label: string;
    score: number;
    band: ScoreBand;
    visual: 'bar' | 'heatmap-cell';
  }>;
};

type VisualScoreReportV2 = {
  version: 'SCORING_SYSTEM_V2';
  ready: boolean;
  composite: DimensionScore;
  dimensions: {
    readability: DimensionScore;
    ats: DimensionScore;
    positioning: DimensionScore;
    experience: DimensionScore;
    market: DimensionScore;
    design: DimensionScore;
  };
  confidence: {
    tier: 'high' | 'medium' | 'low';
    factors: Array<{ label: string; pct: number }>;
  };
  heatmaps: {
    readability?: HeatmapGrid;
    positioning?: HeatmapGrid;
  };
  weakest: string;              // dimension id — default expanded tab
  capped: boolean;
  capReason?: string;
};
```

---

## 9. Architecture

```
cvData + resumeData + scoreReport + templateId
        │
        ▼
buildVisualScoreReportV2()          ◄── NEW orchestrator
        │
        ├── scoreReadability()      ← panel.readability / composite
        ├── scoreAts()              ← analyzeAtsPro()
        ├── scorePositioning()      ← archetype + title match
        ├── scoreExperience()       ← experience dimension + metrics
        ├── scoreMarket()           ← trust score + keyword coverage
        └── scoreDesign()           ← formatting + template + PDF audit
        │
        ▼
bandLabel(score) → never raw % in primary UI
        │
        ▼
renderScoreDashboardV2()            ◄── UI
```

### 9.1 Module map

| Module | Path |
|--------|------|
| Orchestrator | `src/core/validation/visual-score-v2.js` |
| Band utils | `src/core/validation/score-bands.js` |
| Dimension scorers | `src/core/validation/score-dimensions/*.js` |
| Heatmap builder | `src/core/validation/score-heatmap.js` |
| UI renderer | `src/ui/studio/score-dashboard-v2.js` |
| Styles | `src/ui/studio/score-dashboard-v2.css` |

### 9.2 Integration

| Consumer | Change |
|----------|--------|
| `renderReviewStudioV2()` | Use dashboard V2 instead of `reviewV2ScoreLead` + hidden metrics |
| `renderRecruiterCommandCenter()` | Hero ring shares band language |
| `renderMetrics()` | Deprecate `%` labels in `metricsMinimal` |
| Export step | Design dimension ring on template confirm |
| i18n | Band labels + dimension headlines |

---

## 10. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Screen readers | `aria-label="ATS Compatibility: Fair"` on rings |
| Color blind | Band text always visible — color is reinforcement only |
| Motion | `prefers-reduced-motion` disables arc animation |
| Focus | Heatmap cells keyboard-focusable with tooltips |
| Contrast | WCAG AA on all band labels (4.5:1) |

---

## 11. i18n keys

| Key | EN |
|-----|-----|
| `scoreV2Title` | Score overview |
| `scoreBandExcellent` | Excellent |
| `scoreBandStrong` | Strong |
| `scoreBandFair` | Fair |
| `scoreBandNeedsWork` | Needs work |
| `scoreBandAtRisk` | At risk |
| `scoreDimReadability` | Recruiter Readability |
| `scoreDimAts` | ATS Compatibility |
| `scoreDimPositioning` | Professional Positioning |
| `scoreDimExperience` | Experience Strength |
| `scoreDimMarket` | Market Competitiveness |
| `scoreDimDesign` | Visual Design |
| `scoreConfidenceHigh` | High confidence |
| `scoreConfidenceMedium` | Medium confidence |
| `scoreConfidenceLow` | Low confidence |
| `scoreWeakestHint` | Focus here first |

---

## 12. Before → After

| Element | Before (V1) | After (V2) |
|---------|-------------|------------|
| Hero | `73` in ring | **Strong** + small 73 |
| Metrics row | `Lisibilité · 68` | Bar + **Fair** label |
| ATS panel | `73/100` | 7 bars with band words |
| Weakness list | Text bullets | Heatmap cold cells |
| Trust | Hidden in debug | Confidence dot + tier |
| Template step | No design score | Design ring on picker |

---

## 13. Implementation phases

### Phase 1 — Band language + rings

- [ ] `score-bands.js` — score → band + headline
- [ ] `visual-score-v2.js` — six dimension scores
- [ ] Upgrade `.scoreRing` → `.hirelyScoreRing` with band label
- [ ] Wire hero + 6 mini-rings in Review panel

### Phase 2 — Bars + heatmaps

- [ ] ATS 7-bar panel
- [ ] Experience 4-bar panel
- [ ] Readability heatmap builder
- [ ] Positioning coherence heatmap
- [ ] Tab interaction (weakest first)

### Phase 3 — Confidence + polish

- [ ] Global + per-dimension confidence dots
- [ ] Composite formula + creative mode weights
- [ ] Design dimension (template + PDF)
- [ ] `qa-visual-score-v2.mjs`
- [ ] Deprecate raw `%` in consumer metrics

---

## 14. Acceptance criteria

| # | Criterion |
|---|-----------|
| 1 | No primary UI label shows bare `NN%` — band word first |
| 2 | All 6 dimensions render with ring + band |
| 3 | ATS dimension shows 7 sub-bars |
| 4 | Readability shows section heatmap |
| 5 | Confidence indicator visible when import complete |
| 6 | Hero composite respects trust score caps |
| 7 | Weakest dimension auto-selected on load |
| 8 | Rings animate on score update (with reduced-motion fallback) |
| 9 | WCAG AA on band text |
| 10 | `npm run qa:visual-score-v2` passes |

---

## 15. QA commands

```bash
npm run qa:recruiter-score-v2
npm run qa:ats-score-panel
npm run qa:trust-score
# Future
npm run qa:visual-score-v2
```

---

## 16. Relation to other systems

| System | Relationship |
|--------|--------------|
| `TRUST_SCORE_V1` | Caps composite · feeds Market dimension |
| `ATS_ENGINE_PRO` | ATS dimension sub-bars |
| `RECRUITER_COMMAND_CENTER_V2` | Shares ring + confidence patterns |
| `RECRUITER_BRAIN_V1` | Strategic narrative under dashboard |
| `RED_FLAG_DETECTION_V1` | Cold heatmap cells ↔ red flags |
| `VISUAL_DENSITY_PASS_V1` | Compact dashboard chrome |

---

## 17. Design tokens

```css
:root {
  --score-excellent: #16a34a;
  --score-strong: #22c55e;
  --score-fair: #eab308;
  --score-weak: #f97316;
  --score-risk: #ef4444;
  --score-track: #eef1f5;
  --heatmap-hot: #bbf7d0;
  --heatmap-warm: #dcfce7;
  --heatmap-cool: #fef3c7;
  --heatmap-cold: #fee2e2;
  --confidence-high: #22c55e;
  --confidence-medium: #f59e0b;
  --confidence-low: #ef4444;
}
```

---

## 18. Summary

**Scoring System V2** keeps deterministic backend scores but changes what users see:

- **Rings** — band-first dimension summaries  
- **Bars** — sub-factor strength without percentage obsession  
- **Heatmaps** — section health at a glance  
- **Confidence** — extraction trust separate from quality  

Six dimensions tell a complete recruiter story: readable, parseable, positioned, proven, competitive, and polished.

---

*Spec version `SCORING_SYSTEM_V2` — extends `scoreRing` / `scoreMetricsGrid` in `index.html` and panel metrics in `recruiter-score-v2.js`.*
