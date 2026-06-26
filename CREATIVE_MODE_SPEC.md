# Hirely Creative Mode — Product & Engineering Spec

**Version:** `CREATIVE_MODE_V1`  
**Status:** Spec (partial implementation exists — this document unifies and extends)  
**Audience:** Designers, illustrators, architects, art directors, photographers, and portfolio-forward creatives.

---

## 1. Problem

Corporate ATS CV flows optimize for **experience → education → skills**. Creative professionals need:

- **Portfolio proof** before job history
- **Platform links** (Behance, Dribbble, Instagram, personal site) surfaced prominently
- **Selected projects** as first-class content, not buried in experience bullets
- **Visual hierarchy** that signals craft without breaking PDF export or text selectability

Hirely already detects creative CVs (`CREATIVE_CV_MODE`, `creative-resume-mode.js`) and ships creative templates — but the product experience is **implicit** (parser flag + badge) rather than a **dedicated mode** with structured portfolio editing and hierarchy rules.

---

## 2. Goal

| Requirement | Detail |
|-------------|--------|
| Dedicated mode | Explicit **Creative Mode** — auto-detected or user-selected |
| Portfolio links | Structured fields: **Website**, **Behance**, **Dribbble**, **Instagram** (+ optional ArtStation, Vimeo) |
| Selected projects | Curated project list with title, client, year, role, optional URL |
| Visual hierarchy | Portfolio-first section order + creative template defaults |
| No invention | Extract and structure only — never fabricate clients or projects |
| Export-ready | Plain-text URLs in PDF; ATS-medium templates available |

**Non-goals (V1):** embedded portfolio iframes, image upload per project, animated CV, full architect RIBA credential schema.

---

## 3. Target personas

| Persona | Primary proof | Typical links | Section priority |
|---------|---------------|---------------|------------------|
| **Graphic / brand designer** | Client list + campaigns | Behance, Dribbble, website | Clients → Projects → Experience |
| **Illustrator** | Selected work + publications | Behance, Instagram, website | Projects → Publications → Exhibitions |
| **Art / creative director** | Brands + case studies | Website, LinkedIn, Behance | Clients → Projects → Experience |
| **Architect** | Built projects + awards | Website, Instagram, LinkedIn | Projects → Awards → Experience |
| **Motion / 3D artist** | Reels + client work | Vimeo, ArtStation, Behance | Projects → Tools → Clients |
| **Photographer** | Series + exhibitions | Instagram, website | Projects → Exhibitions → Publications |

---

## 4. Creative Mode vs corporate mode

| Dimension | Corporate (default) | Creative Mode |
|-----------|---------------------|---------------|
| Section order | Experience-first | Portfolio-first (`CREATIVE_SECTION_RENDER_ORDER`) |
| Clients / projects | Often folded into experience | First-class sections |
| Portfolio links | Single `portfolio` URL field | Multi-platform link row |
| Smart Repair targets | Experience, education, skills | Clients, projects, portfolio, exhibitions, awards |
| Default templates | ATS Clean, Consulting, Swiss | Creative Director, Behance Showcase, Art Director Portfolio |
| Score emphasis | ATS completeness | Portfolio completeness + recruiter readability |
| Badge | — | `#studioCreativeBadge` — “Creative CV” |

---

## 5. Activation

### 5.1 Auto-detect (default)

Mode activates when **any** signal fires:

| Signal | Source |
|--------|--------|
| Trigger role | `CREATIVE_CV_TRIGGER_ROLES` in title/summary (`creative-cv-roles.js`) |
| Creative layout | Multi-column / portfolio layout from `layout-detection` |
| Portfolio hosts | `behance.net`, `dribbble.com`, `instagram.com` in raw text (`PORTFOLIO_HOST_RE`) |
| Client entities | Nike, Adobe, etc. without job dates (`creative-client-project-recovery`) |
| Industry select | `#industry` value = `Creative` |
| Project density | ≥2 project lines from `PROJECTS_ENGINE` |

```js
// Existing entry point
detectCreativeCvMode(rawText, { lines, force: industry === 'Creative' })
resolveCreativeResumeMode(resumeData)
```

### 5.2 Manual override

| Control | Location | Behavior |
|---------|----------|----------|
| Industry dropdown | Import panel `#industry` | `Creative` forces mode on next import |
| Mode toggle | Review step header (new) | “Creative CV” on/off — reorders sections + shows portfolio editor |
| Template pick | Style step | Creative templates auto-filtered when mode active |

**Persist:** `resumeData.meta.creativeMode`:

```ts
{
  active: boolean;
  source: 'auto' | 'industry' | 'user';
  targetRolesDetected: string[];
  signals: string[];
  portfolioFirst: true;
  sectionRenderOrder: string[];
}
```

---

## 6. Portfolio links (structured)

### 6.1 Canonical platforms (V1)

| Field ID | Label | URL pattern | Required |
|----------|-------|-------------|----------|
| `website` | Website | `https?://` or `www.` | Recommended |
| `behance` | Behance | `behance.net/` | Optional |
| `dribbble` | Dribbble | `dribbble.com/` | Optional |
| `instagram` | Instagram | `instagram.com/` | Optional |

### 6.2 Extended platforms (V1.1)

| Field ID | Label |
|----------|-------|
| `artstation` | ArtStation |
| `vimeo` | Vimeo |
| `linkedin` | LinkedIn (shared with identity) |
| `other` | Additional URL |

### 6.3 Data model

**Extend `resumeData.identity`:**

```ts
type CreativePortfolioLinks = {
  website?: string;
  behance?: string;
  dribbble?: string;
  instagram?: string;
  artstation?: string;
  vimeo?: string;
  other?: string[];
};

type ResumeIdentity = {
  // existing
  name, title, email, phone, location, linkedin,
  website?: string;           // primary site (backward compat)
  portfolio?: string;         // alias → website (legacy cvData.portfolio)
  creativeLinks?: CreativePortfolioLinks;
};
```

**Flat extraction array** `portfolioLinks[]` remains for import recovery; normalized into `creativeLinks` on reconcile.

### 6.4 Extraction pipeline

| Stage | Module | Action |
|-------|--------|--------|
| Line detect | `isPortfolioLinkLine()` | Route URL lines to portfolio bucket |
| Host classify | `socials.json` + `PORTFOLIO_HOST_RE` | Map to platform field |
| Identity merge | `identity-extraction.js` | Prefer labeled lines (“Behance: …”) |
| Reconcile | `reconcileCreativeSections()` | Dedupe; fill `creativeLinks` |

**Example input** (`tests/fixtures/portfolio-links-rich.txt`):

```
behance.net/janecreative · dribbble.com/janecreative · instagram.com/janecreative
Portfolio: https://janecreative.com
```

**Output:**

```json
{
  "creativeLinks": {
    "behance": "https://behance.net/janecreative",
    "dribbble": "https://dribbble.com/janecreative",
    "instagram": "https://instagram.com/janecreative",
    "website": "https://janecreative.com"
  }
}
```

### 6.5 UI — Portfolio link editor (new)

**Location:** Review step → Creative panel (below header edit)

```
┌─ Portfolio & links ─────────────────────────────┐
│ Website    [ https://yoursite.com          ]    │
│ Behance    [ https://behance.net/you       ]    │
│ Dribbble   [ https://dribbble.com/you      ]    │
│ Instagram  [ https://instagram.com/you     ]    │
│ + Add link (ArtStation, Vimeo…)                 │
└─────────────────────────────────────────────────┘
```

- Validate URL shape; normalize to `https://`
- Live-update A4 preview contact row
- Show platform icons (text labels in PDF — icons UI-only)

---

## 7. Selected projects

### 7.1 Project entry schema

Build on `PROJECTS_ENGINE` parsed objects:

```ts
type CreativeProject = {
  id: string;
  title: string;          // "Nike Air Max Campaign"
  client?: string;        // "Nike"
  year?: string;          // "2023"
  role?: string;          // "Art Director"
  url?: string;           // Case study link
  summary?: string;       // One-line description (optional V1.1)
  featured?: boolean;     // Pin to top (max 6 featured)
  source: 'extracted' | 'user';
};
```

**Storage:** `resumeData.projects[]` as display strings (current) + `resumeData.meta.projectsStructured[]` (new, editor SSOT).

`formatProjectEntry()` remains the render formatter:

```
Nike Air Max Campaign — Nike · 2023 · Art Director
```

### 7.2 Extraction

| Module | Role |
|--------|------|
| `projects-engine.js` | Parse title, client, year, role from lines |
| `creative-client-project-recovery.js` | Recover projects from misclassified experience |
| `creative-experience-recovery-engine.js` | Split portfolio bullets from jobs |

**Section headers recognized:** `Projects`, `Selected Work`, `Key Projects`, `Portfolio Pieces`.

### 7.3 UI — Selected projects editor (new)

```
┌─ Selected projects (drag to reorder) ───────────┐
│ ★ Nike Air Max Campaign — Nike · 2023      [✎] │
│   Brand Film — Adidas · 2022               [✎] │
│   Editorial Series — Vogue · 2021          [✎] │
│ [ + Add project ]                               │
└─────────────────────────────────────────────────┘
```

- Max **12** projects in data; template shows **6** featured (configurable per template)
- Reorder updates `sectionRenderOrder` within projects block
- Empty state: “Import detected 0 projects — add your best 3–6 pieces”

### 7.4 Clients block (companion)

`resumeData.clients[]` — comma-separated brand names or one per line.

Creative Mode shows **Selected Clients** above projects when ≥3 clients detected (per `CREATIVE_SECTION_RENDER_ORDER`).

---

## 8. Visual hierarchy

Creative Mode applies a **hierarchy profile** — independent of template skin.

### 8.1 Hierarchy profile: `portfolio-forward`

| Rank | Section | Visual treatment |
|------|---------|------------------|
| 1 | Identity + links | Large name, compact contact row with platform labels |
| 2 | Summary | Short lead (2–3 lines max in creative templates) |
| 3 | Selected clients | Single line or 2-column name grid |
| 4 | Selected projects | Left-border or card stack — **largest body section** |
| 5 | Exhibitions / awards / publications | Optional creative blocks |
| 6 | Portfolio links block | Full URL list if not in header |
| 7 | Software / tools | Label “Software” not “Skills” when tools present |
| 8 | Experience | Timeline — secondary to portfolio |
| 9 | Education | Compact |
| 10 | Skills · languages | Footer meta row |

**Source:** `CREATIVE_SECTION_RENDER_ORDER` in `creative-cv-mode.js`.

### 8.2 Typography hierarchy (creative templates)

| Level | Token | Example |
|-------|-------|---------|
| Display | `--cv-name-size` | 24–28pt name |
| Role | `--cv-title-size` | 9–10pt uppercase tracking |
| Section | `--cv-section-title` | 7.5pt uppercase + rule |
| Project title | `--cv-project-title` | 11pt semibold |
| Body | `--cv-body-size` | 10–10.5pt / 1.56 leading |
| Meta | `--cv-meta-size` | 9pt muted URLs |

Templates implementing hierarchy: `creative-director`, `art-director-portfolio`, `behance-showcase`, `illustrator-portfolio`, `creative-portfolio`, `editorial-magazine`.

### 8.3 Spacing rules

| Rule | Value |
|------|-------|
| Section gap | +20% vs ATS templates |
| Project entry gap | 12–16px between items |
| Client line | Tight inline (no bullets) |
| Max pages | 2 pages (creative); 1 page preferred for juniors |

Uses `cv-template-density.css` spacing presets: default **Normal**; user can pick Compact / Spacious.

### 8.4 Template routing (Style step)

When `creativeMode.active`:

| Auto-suggest order | Template ID |
|--------------------|-------------|
| 1 | `behance-showcase` (heavy Behance link) |
| 2 | `creative-director` (director / lead roles) |
| 3 | `illustrator-portfolio` (illustrator / artist) |
| 4 | `art-director-portfolio` (split portfolio layout) |
| 5 | `creative-portfolio` (general creative) |
| 6 | `editorial-magazine` (editorial / luxury) |

Filter chip: **Creative** in `premiumGalleryFilters` (exists — wire to mode).

---

## 9. Section inventory (creative-first)

| Section | `resumeData` field | Parser bucket | Template class |
|---------|-------------------|---------------|----------------|
| Identity | `identity` | header | `cvHeader` |
| Summary | `summary` | summary | `cvSummary` |
| Clients | `clients[]` | clients | `cvSection--clients` |
| Projects | `projects[]` | projects | `cvSection--projects` |
| Exhibitions | `exhibitions[]` | exhibitions | `cvSection--exhibitions` |
| Awards | `awards[]` | awards | `cvSection--awards` |
| Publications | `publications[]` | publications | `cvSection--publications` |
| Portfolio links | `portfolioLinks[]` + `creativeLinks` | portfolio | `cvSection--portfolio` |
| Software | `tools[]` | tools | `cvSection--software` |
| Experience | `experiences[]` | experience | `cvSection--experience` |
| Education | `education[]` | education | `cvSection--education` |
| Skills | `skills[]` | skills | `cvMetaFooter` |

---

## 10. Architecture

```
Import (PDF/DOCX/paste)
        │
        ▼
detectCreativeCvMode() ──► meta.creativeMode
        │
        ▼
section-engine-v2 + applyCreativeCvModeToSectionBlocks()
        │
        ▼
PROJECTS_ENGINE + creative-client-project-recovery
        │
        ▼
resumeDataFromStructured() + reconcileCreativeSections()
        │
        ▼
normalizeCreativePortfolioLinks()  ◄── NEW
        │
        ▼
Editor (portfolio + projects panels) ◄── NEW UI
        │
        ▼
resumeDataToTemplateView() → creative template render
        │
        ▼
PDF export (plain-text URLs preserved)
```

### 10.1 Existing modules (reuse)

| Module | Path | Role |
|--------|------|------|
| Creative CV mode | `src/core/parsing/creative-cv-mode.js` | Detection + section order |
| Creative parsing | `src/core/parsing/creative-parsing-mode.js` | Line classification |
| Creative resume product | `src/core/creative-resume-mode.js` | Reconcile sections, studio blocks |
| Projects engine | `src/core/parsing/projects-engine.js` | Project parse/format |
| Client recovery | `src/core/parsing/creative-client-project-recovery.js` | Brand list recovery |
| Social dictionary | `src/data/dictionaries/socials.json` | Platform entity match |
| Creative roles | `src/data/dictionaries/creative_roles.json` | Role detection |
| Template pack | `src/ui/templates/creative-template-pack.mjs` | Hierarchy briefs |
| Template render | `src/ui/templates/cv-templates.js` | `stackCreativeFirst`, portfolio sections |

### 10.2 New modules (proposed)

| Module | Path | Role |
|--------|------|------|
| Portfolio link normalizer | `src/core/creative/portfolio-links.js` | URL → platform fields |
| Creative mode facade | `src/core/creative/creative-mode.js` | Single export for product UI |
| Project structured store | `src/core/creative/selected-projects.js` | Structured ↔ display sync |
| Hierarchy resolver | `src/core/creative/visual-hierarchy.js` | Section weights per persona |
| Creative panel CSS | `src/ui/studio/creative-mode-panel.css` | Editor chrome |
| Creative panel UI | `src/ui/studio/creative-mode-panel.js` | Link + project editors |

---

## 11. Persona extensions

### 11.1 Architect (new in V1)

Add to `CREATIVE_CV_TRIGGER_ROLES` and `creative_roles.json`:

- `Architect`
- `Interior Architect`
- `Landscape Architect`

**Project keywords:** `competition`, `built work`, `renovation`, `masterplan`, `RIBA`, `AA School`.

**Hierarchy tweak:** Projects → Awards → Publications → Experience (clients less common).

### 11.2 Illustrator signals

- Publications + exhibitions buckets prioritized
- Instagram + Behance link prominence
- Default template: `illustrator-portfolio`

---

## 12. Review & export gates (creative)

Extend `buildReviewReadinessReport()` with creative gates (soft — warn, don’t block export):

| Gate | Rule | Severity |
|------|------|----------|
| Portfolio link | ≥1 of website / Behance / Dribbble / Instagram | Warn |
| Selected projects | ≥2 projects OR ≥3 clients | Warn |
| Project quality | No generic-only titles (“Campaign”, “Poster”) | Info |
| Experience | Still ≥1 job OR freelance line | Warn |

**Export:** Allowed when base gates pass (identity + content). Creative gates are recommendations.

---

## 13. i18n keys (new)

| Key | EN | FR |
|-----|----|----|
| `creativeModeTitle` | Creative Mode | Mode créatif |
| `creativeModeLead` | Portfolio-first CV for designers and creatives | CV orienté portfolio pour créatifs |
| `creativeLinksTitle` | Portfolio & links | Portfolio & liens |
| `creativeLinkWebsite` | Website | Site web |
| `creativeLinkBehance` | Behance | Behance |
| `creativeLinkDribbble` | Dribbble | Dribbble |
| `creativeLinkInstagram` | Instagram | Instagram |
| `creativeProjectsTitle` | Selected projects | Projets sélectionnés |
| `creativeClientsTitle` | Selected clients | Clients sélectionnés |
| `creativeAddProject` | Add project | Ajouter un projet |
| `creativeAddLink` | Add link | Ajouter un lien |
| `creativeModeBadge` | Creative CV | CV créatif |
| `creativeTemplateFilter` | Creative | Créatif |
| `creativeGatePortfolio` | Add a portfolio link | Ajoutez un lien portfolio |
| `creativeGateProjects` | Add 2+ selected projects | Ajoutez 2+ projets |

---

## 14. Edge cases

| Case | Behavior |
|------|----------|
| User switches off Creative Mode | Revert to corporate section order; keep data in `projects`/`clients` |
| Only LinkedIn, no portfolio | Show website field empty; warn gate |
| OCR garbled URLs | Route to review queue; don’t auto-truncate |
| `@handle` without URL | Prompt user to complete (Instagram/Behance) |
| 20+ projects imported | Keep all in data; template shows top 6 featured |
| Architect with corporate layout | Mode on via role; projects engine parses built work |
| Adobe Illustrator in tools | Must not classify as Adobe client (`creative-entity-guard`) |

---

## 15. Privacy & export

- Portfolio URLs exported as plain text in PDF (ATS-readable)
- No hotlinking or embedding external portfolio content
- `creativeLinks` included in `resumeData` JSON export (user-owned)

---

## 16. Implementation phases

### Phase 1 — Unify mode (ship first)

- [ ] `src/core/creative/creative-mode.js` facade
- [ ] `normalizeCreativePortfolioLinks()` from `portfolioLinks[]` + raw text
- [ ] Extend `identity.creativeLinks` in `resume-data.js`
- [ ] Show `#studioCreativeBadge` whenever mode active
- [ ] Auto-filter creative templates on Style step
- [ ] Architect roles in trigger list + dictionary

### Phase 2 — Portfolio & projects editor

- [ ] Creative panel UI in Review step
- [ ] Structured projects `meta.projectsStructured`
- [ ] Drag reorder + featured flag
- [ ] Platform link inputs with validation
- [ ] i18n EN/FR/NL/DE/ES/IT

### Phase 3 — Hierarchy & quality

- [ ] `visual-hierarchy.js` persona profiles
- [ ] Creative export readiness warnings
- [ ] `qa-creative-mode-v1.mjs` + `CREATIVE_MODE_REPORT.md`
- [ ] Test lab fixtures: designer, illustrator, architect

---

## 17. Acceptance criteria

| # | Criterion |
|---|-----------|
| 1 | Importing `portfolio-links-rich.txt` fills all four platform fields |
| 2 | Creative Mode auto-activates for Illustrator / Art Director / Architect titles |
| 3 | `clients` and `projects` never appear as standalone experience rows |
| 4 | Review step shows portfolio link editor when mode active |
| 5 | ≥6 projects supported in editor; template renders ≥3 |
| 6 | Behance Showcase template shows portfolio links in header |
| 7 | Section order matches `CREATIVE_SECTION_RENDER_ORDER` in preview |
| 8 | Toggling industry to Creative forces mode on re-import |
| 9 | PDF export contains full URLs as selectable text |
| 10 | `npm run qa:creative-mode-v1` passes on golden fixtures |

---

## 18. QA fixtures

| Fixture | Path | Validates |
|---------|------|-----------|
| Portfolio links | `tests/fixtures/portfolio-links-rich.txt` | Behance, Dribbble, Instagram, website |
| Creative director | `tests/cv-corpus/creative-director.txt` | Clients + projects split |
| Yoaz creative | `tests/fixtures/yoaz-cv/fixture.txt` | Mode trigger + client recovery |
| Client/project recovery | `tests/fixtures/creative-client-project-recovery.txt` | Recovery engine |
| Projects rich | `tests/fixtures/projects-creative-rich.txt` | PROJECTS_ENGINE |
| Illustrator sample | `src/data/samples/creative-cv.txt` | End-to-end render |

```bash
npm run qa:creative-cv-mode
npm run qa:creative-resume
npm run test:portfolio-extraction
npm run test:projects-engine
# Future:
npm run qa:creative-mode-v1
```

---

## 19. Related documents

| Document | Relationship |
|----------|--------------|
| `CREATIVE_TEMPLATE_SPEC.md` | Template-level typography + section stack |
| `CREATIVE_DIRECTOR_TEMPLATE.md` | Flagship creative template |
| `CREATIVE_CLIENT_PROJECT_RECOVERY_REPORT.md` | Client/project extraction QA |
| `COMPARISON_MODE_SPEC.md` | Layout rebuild explanation for creatives |
| `REVIEW_STUDIO_V2.md` | Host layout for creative panel |

---

## 20. Proposed file map

```
src/core/creative/
  creative-mode.js              # Product facade (mode resolve, gates)
  portfolio-links.js            # Platform URL normalize
  selected-projects.js          # Structured project sync
  visual-hierarchy.js           # Persona hierarchy profiles
  index.js

src/ui/studio/
  creative-mode-panel.css
  creative-mode-panel.js

src/tests/
  qa-creative-mode-v1.mjs

scripts/
  creative-mode-report.mjs

CREATIVE_MODE_SPEC.md           # This document
```

---

## 21. Success metrics

| Metric | Target |
|--------|--------|
| Creative import → mode detection rate | ≥ 85% on creative test lab corpus |
| Users completing portfolio link fields | ≥ 60% when mode active |
| Creative template selection rate | ≥ 70% on creative imports |
| Project section populated | ≥ 2 projects on 75% of creative CVs |
| Export satisfaction (creative cohort) | ≥ baseline corporate NPS |

---

*Creative Mode respects Hirely data contracts: `resumeData` is SSOT; templates never parse; enhancement never invents clients or projects.*
