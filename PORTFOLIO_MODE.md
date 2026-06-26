# Hirely Portfolio Mode — Engine Spec

**Version:** `PORTFOLIO_MODE_V1`  
**Status:** Spec (partial implementation — this document unifies and extends)  
**Goal:** **Detect** creative portfolio signals from fragmented CVs, then **build** a portfolio-first **Creative Resume** with **Project Highlights** and **Client Highlights** — using only facts present in the source document.

---

## 1. Problem

Creative CVs arrive as **scattered proof**, not structured portfolio data:

| Fragment | Typical location | Today’s risk |
|----------|------------------|--------------|
| `behance.net/jane` | Contact row, unsorted | Lost in `unsorted[]` |
| `Nike, Adidas, Sephora` | Skills or summary | Misclassified as skills |
| `Poster campaign — Nike · 2023` | Experience bullets | Buried under job history |
| `Ogilvy` | Experience company | Correct — but not surfaced as agency signal |
| `instagram.com/studio` | Header | Not linked to platform field |

Hirely ships **three separate engines** (`PORTFOLIO_EXTRACTION_ENGINE`, `CREATIVE_CLIENT_PROJECT_RECOVERY`, `PROJECTS_ENGINE`) and a **product wrapper** (`CREATIVE_MODE_V1`). **Portfolio Mode** is the **orchestrator** that runs detection, assembles highlights, and emits a portfolio-first creative resume.

---

## 2. Vision

```
Fragmented import          Portfolio Mode              Built outputs
──────────────────         ──────────────              ─────────────
URLs in contact row    →   detectPortfolioLinks()  →   identity.creativeLinks
Brand name list        →   detectCreativeClients() →   clientHighlights[]
Project lines          →   detectProjects()        →   projectHighlights[]
Agency in experience   →   detectAgencies()        →   agencySignals[]
Role + creative layout →   activatePortfolioMode() →   creativeResume (ordered)
```

**Portfolio Mode answers:** “What proof does this designer have, and how do we surface it first?”

**Relationship to Creative Mode:**

| Layer | ID | Role |
|-------|-----|------|
| **Portfolio Mode** | `PORTFOLIO_MODE_V1` | Detection + build engine (this spec) |
| **Creative Mode** | `CREATIVE_MODE_V1` | Product UX — toggle, badge, editors, templates |
| **Designer CV Mode** | `DESIGNER_CV_MODE` | Parser weighting + ATS adjustment |
| **Creative CV Mode** | `CREATIVE_CV_MODE` | Section routing + render order |

Portfolio Mode **activates** Creative Mode when portfolio signals exceed threshold. User can also force Portfolio Mode on/off.

---

## 3. Detection targets

Portfolio Mode runs **seven detectors** in parallel. Each returns `{ detected: boolean, items: [], confidence: number, source: string }`.

### 3.1 Behance

| Attribute | Spec |
|-----------|------|
| Host | `behance.net` |
| Patterns | `https://behance.net/…`, `www.behance.net/…`, bare `behance.net/user`, labeled `Behance:` |
| Module | `portfolio-extraction-engine.js` → `PORTFOLIO_PLATFORMS[id=behance]` |
| Output field | `identity.creativeLinks.behance` |
| Flat array | `portfolioLinks[]` entry `Behance — {url}` |

**QA fixture:** `tests/fixtures/portfolio-links-rich.txt`

---

### 3.2 Dribbble

| Attribute | Spec |
|-----------|------|
| Host | `dribbble.com` |
| Patterns | Same as Behance |
| Module | `PORTFOLIO_PLATFORMS[id=dribbble]` |
| Output field | `identity.creativeLinks.dribbble` |

---

### 3.3 Instagram

| Attribute | Spec |
|-----------|------|
| Host | `instagram.com` |
| Patterns | URL + `insta` label alias |
| Module | `PORTFOLIO_PLATFORMS[id=instagram]` |
| Output field | `identity.creativeLinks.instagram` |
| Note | Distinguish from `@handle` without URL — store as hint only, not validated link |

---

### 3.4 Portfolio URLs

| Attribute | Spec |
|-----------|------|
| Types | Personal site, `portfolio` label, `cargo.site`, `format.com`, `adobe.com/portfolio` |
| Host regex | `PORTFOLIO_HOST_RE` — `creative-parsing-mode.js` |
| Module | `portfolio-extraction-engine.js`, `isPortfolioLinkLine()` |
| Output fields | `identity.creativeLinks.website`, legacy `identity.portfolio` |
| Validation | `validatePortfolio()` — `rich-parser.js` |

**Labeled lines:**

```
Portfolio: https://janecreative.com
Website: www.janecreative.design
```

---

### 3.5 Agency names

Agencies are **employers**, not clients. Detection routes them to **experience** and **agency signals** — never to `clients[]`.

| Source | Module |
|--------|--------|
| Dictionary | `CREATIVE_AGENCIES` — `creative/creativeAgencies.js` (McCann, Ogilvy, TBWA, Droga5, BETC, Sid Lee…) |
| Studios | `CREATIVE_STUDIOS` — `creative/studios.js` (Pentagram, Landor, Buck, The Mill…) |
| Disambiguation | `person-company-disambiguation.js` — `agency|studio|agence` suffix |
| Experience parse | `exp.company` when `role + date + company` line matches |

```js
export function detectAgencies(experiences, textBlob) {
  const hits = [];
  for (const exp of experiences) {
    const company = normSpace(exp.company);
    if (matchCreativeAgency(company) || matchCreativeStudio(company)) {
      hits.push({ name: company, role: exp.role, dates: exp.dates, source: 'experience' });
    }
  }
  // Also scan lines with agency suffix but no client-intro phrasing
  return hits;
}
```

**Rule:** Agency names in a **client list line** (`clients including Nike`) are **not** agencies — use client detector instead.

---

### 3.6 Creative clients

Brand names cited as **work proof**, not employers.

| Source | Module |
|--------|--------|
| Anchor list | `CREATIVE_RECOVERY_CLIENT_ANCHORS` (= `CLIENT_TERMS`) |
| Entity catalog | `CLIENT_RECOGNIZER` — `entity-catalog.js` |
| JSON dictionary | `creative_clients.json` |
| Recovery | `creative-client-project-recovery.js` → `recoverClientsFromLine()` |
| Intro phrases | `CLIENT_INTRO_RE` — “worked for”, “clients including”, “collaborated with” |

**Guardrails:**

| Rule | Enforcement |
|------|-------------|
| No fake jobs | `lineHasRoleDateCompany()` → skip client harvest |
| No tools as clients | `isToolNotClient()` — Adobe Photoshop ≠ Adobe client |
| No schools as clients | `isSchoolEntity()`, MIT context check |
| Max items | 24 clients in data; 12 in highlights |

**QA fixture:** `tests/fixtures/creative-client-project-recovery.txt`

---

### 3.7 Projects

Creative work entries — title, client, year, role.

| Source | Module |
|--------|--------|
| Section headers | `Projects`, `Selected Work`, `Key Projects` |
| Line classifier | `isLikelyCreativeProjectLine()` — `creative-parsing-mode.js` |
| Parser | `projects-engine.js` → `parseProjectLine()`, `formatProjectEntry()` |
| Recovery | `creative-client-project-recovery.js` → `detectProjectsFromHarvest()` |
| Type keywords | `CREATIVE_RECOVERY_PROJECT_TYPES` — poster, campaign, packaging… |

**Display format:**

```
Nike Air Max Campaign — Nike · 2023 · Art Director
```

**Weak title filter:** Generic fragments (`campaign`, `poster` alone) demoted unless client present — `isSpecificProjectTitle()`.

**QA fixtures:** `tests/fixtures/projects-creative-rich.txt`, `tests/fixtures/creative-experience-rich.txt`

---

## 4. Activation

Portfolio Mode activates when **any** signal fires:

| Signal | Threshold |
|--------|-----------|
| Portfolio URL | ≥ 1 validated link (Behance, Dribbble, Instagram, website) |
| Creative client | ≥ 2 recovered clients |
| Project | ≥ 1 specific project line |
| Creative role | `CREATIVE_CV_TRIGGER_ROLES` in title/summary |
| Agency experience | ≥ 1 agency/studio in `experiences[]` |
| Layout | Multi-column / portfolio layout from `layout-detection` |
| Industry | `#industry` = `Creative` |

```js
export function evaluatePortfolioModeSignals(pool) {
  const score =
    (pool.links.length >= 1 ? 25 : 0) +
    (pool.clients.length >= 2 ? 20 : 0) +
    (pool.projects.length >= 1 ? 25 : 0) +
    (pool.creativeRole ? 15 : 0) +
    (pool.agencies.length >= 1 ? 10 : 0) +
    (pool.creativeLayout ? 5 : 0);
  return { active: score >= 40, score, signals: pool.signalIds };
}
```

**Persist:**

```ts
resumeData.meta.portfolioMode = {
  version: 'PORTFOLIO_MODE_V1',
  active: boolean;
  score: number;
  signals: string[];          // e.g. ['behance', 'clients:5', 'projects:3']
  detectedAt: string;           // ISO timestamp
};
```

When `active`, set `resumeData.meta.creativeMode.active = true` and apply `CREATIVE_SECTION_RENDER_ORDER`.

---

## 5. Golden rules

| # | Rule |
|---|------|
| 1 | **Never invent URLs** — only extract validated links from source text |
| 2 | **Never invent clients** — dictionary + entity match only; no guessed brands |
| 3 | **Never invent projects** — parse existing lines; user adds missing work in editor |
| 4 | **Never promote clients to jobs** — `lineHasRoleDateCompany()` gate |
| 5 | **Agencies ≠ clients** — Ogilvy in experience stays `company`; Nike in list stays `client` |
| 6 | **Preserve source** — `source: 'extracted' | 'user'` on every highlight item |
| 7 | **Dedupe** — URL key, client lowercase, project `client|title|year` key |

---

## 6. Build outputs

Portfolio Mode produces **three build artifacts** plus the assembled **Creative Resume**.

### 6.1 Creative Resume

The full `resumeData` object reordered and enriched for portfolio-first presentation.

| Step | Action |
|------|--------|
| 1 | Run all seven detectors |
| 2 | `reconcileCreativeSections()` — move lines from `unsorted` → first-class buckets |
| 3 | Normalize `identity.creativeLinks` from `portfolioLinks[]` |
| 4 | Apply `CREATIVE_SECTION_RENDER_ORDER` |
| 5 | Set default template family (`creative-director`, `art-director-portfolio`, `behance-showcase`) |
| 6 | Attach `meta.portfolioMode` report |

**Section order** (`creative-cv-mode.js`):

```
identity → summary → clients → projects → publications → exhibitions → awards
→ portfolioLinks → tools → skills → experiences → education → languages
```

**Creative Resume ≠ corporate resume:**

| Dimension | Corporate | Creative Resume |
|-----------|-----------|-----------------|
| Primary proof | Experience timeline | Clients + projects |
| Contact row | Email · phone · LinkedIn | + Behance · Dribbble · Instagram · website |
| Skills label | Skills | Software (when `tools[]` present) |
| Experience rank | #2 section | #8 — supporting context |
| Default templates | ATS Clean, Swiss | Creative Director, Art Director Portfolio |

**Module:** `creative-resume-mode.js` → `reconcileCreativeSections()`, `resolveCreativeResumeMode()`

---

### 6.2 Project Highlights

Curated **top projects** for template hero section and studio preview — not the raw `projects[]` dump.

| Attribute | Spec |
|-----------|------|
| Max featured | 6 (template default); 12 in data |
| Selection | Recency (year desc) → client anchor match → specificity score |
| Structure | `PortfolioProjectHighlight[]` |
| Render | `cvSection--projects` with `cv-project-title` hierarchy |

```ts
type PortfolioProjectHighlight = {
  id: string;
  title: string;
  client?: string;
  year?: string;
  role?: string;
  url?: string;
  display: string;              // formatProjectEntry()
  featured: boolean;
  rank: number;                 // 1 = top
  source: 'extracted' | 'user';
  factsUsed: string[];
};
```

**Selection algorithm:**

```js
export function buildProjectHighlights(projects, opts = {}) {
  const parsed = projects
    .map((p) => parseProjectLine(p))
    .filter((p) => p && isSpecificProjectTitle(p.title, p.client))
    .sort((a, b) => {
      const yearDiff = (Number(b.year) || 0) - (Number(a.year) || 0);
      if (yearDiff) return yearDiff;
      return scoreProjectSpecificity(b) - scoreProjectSpecificity(a);
    });
  return parsed.slice(0, opts.maxFeatured ?? 6).map((p, i) => ({
    ...p,
    display: formatProjectEntry(p),
    featured: true,
    rank: i + 1,
    source: 'extracted',
    factsUsed: [p.title, p.client, p.year].filter(Boolean),
  }));
}
```

**Empty state:** `needsUserInput: ['add_projects']` — prompt “Add your best 3–6 pieces”.

---

### 6.3 Client Highlights

Curated **brand proof** for the clients section — luxury/lifestyle/tech anchors prioritized for recruiter scan.

| Attribute | Spec |
|-----------|------|
| Max featured | 12 display; 24 in data |
| Selection | Dictionary anchor tier → alphabetical tie-break |
| Layout | Single line “Sephora · L'Oréal · Nike · …” or 2-column grid (template) |
| Structure | `PortfolioClientHighlight[]` |

```ts
type PortfolioClientHighlight = {
  id: string;
  name: string;
  tier: 'anchor' | 'entity' | 'inferred';
  display: string;
  rank: number;
  source: 'extracted' | 'user';
};
```

**Tier rules:**

| Tier | Source |
|------|--------|
| `anchor` | `CREATIVE_RECOVERY_CLIENT_ANCHORS` exact match |
| `entity` | `CLIENT_RECOGNIZER` canonical hit |
| `inferred` | Parsed from list line without dictionary match — **user must confirm** before featured |

**Selection:**

```js
export function buildClientHighlights(clients) {
  return clients
    .map((name) => ({
      name,
      tier: resolveClientTier(name),
      display: name,
      source: 'extracted',
    }))
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name))
    .slice(0, 12)
    .map((c, i) => ({ ...c, id: `client-${i}`, rank: i + 1 }));
}
```

**Rule:** `inferred` clients appear in review queue — not auto-featured until confirmed.

---

## 7. Architecture

```
rawText / file import
        │
        ▼
parse → structuredResume
        │
        ▼
runPortfolioModeDetectors()        ◄── 7 parallel detectors
        │
        ├─► detectPortfolioLinks()       PORTFOLIO_EXTRACTION_ENGINE
        ├─► detectCreativeClients()      CREATIVE_CLIENT_PROJECT_RECOVERY
        ├─► detectProjects()             PROJECTS_ENGINE
        ├─► detectAgencies()             CREATIVE_AGENCIES + experiences
        ├─► detectCreativeRole()         CREATIVE_CV_TRIGGER_ROLES
        └─► detectCreativeLayout()       layout-detection
        │
        ▼
evaluatePortfolioModeSignals()
        │
        ▼ (active)
buildPortfolioArtifacts()
        │
        ├─► buildCreativeResume()          reconcile + section order
        ├─► buildProjectHighlights()
        └─► buildClientHighlights()
        │
        ▼
resumeData.meta.portfolioMode
resumeData.meta.projectHighlights
resumeData.meta.clientHighlights
        │
        ▼
template render / studio editors
```

### 7.1 Module map

| Module | Path | Status |
|--------|------|--------|
| **Portfolio mode orchestrator** | `src/core/parsing/portfolio-mode.js` | **New** |
| Portfolio links | `src/core/parsing/portfolio-extraction-engine.js` | Implemented |
| Client/project recovery | `src/core/parsing/creative-client-project-recovery.js` | Implemented |
| Projects | `src/core/parsing/projects-engine.js` | Implemented |
| Creative parsing | `src/core/parsing/creative-parsing-mode.js` | Implemented |
| Creative CV mode | `src/core/parsing/creative-cv-mode.js` | Implemented |
| Creative resume | `src/core/creative-resume-mode.js` | Implemented |
| Designer mode | `src/core/parsing/designer-cv-mode.js` | Implemented |
| Agencies dictionary | `src/data/dictionaries/creative/creativeAgencies.js` | Implemented |
| Studios dictionary | `src/data/dictionaries/creative/studios.js` | Implemented |
| Highlights builders | `src/core/parsing/portfolio-highlights.js` | **New** |
| Agency detector | `src/core/parsing/portfolio-agency-detect.js` | **New** |

### 7.2 Pipeline placement

```
import → parse → structuredResume
        │
        ▼
section-engine-v2 (creative buckets)
        │
        ▼
runPortfolioExtraction()             ◄── existing (portfolio links)
runCreativeClientProjectRecovery()   ◄── existing
runProjectsEngine()                  ◄── existing
        │
        ▼
runPortfolioMode()                   ◄── NEW orchestrator
        │
        ▼
runCareerStoryEngine()               ◄── optional narrative layer
        │
        ▼
template / export
```

---

## 8. Data model

```ts
type PortfolioDetectionReport = {
  version: 'PORTFOLIO_MODE_V1';
  active: boolean;
  score: number;
  signals: string[];
  links: {
    behance?: string;
    dribbble?: string;
    instagram?: string;
    website?: string;
    artstation?: string;
    linkedin?: string;
    all: string[];                 // portfolioLinks[] flat
  };
  clients: { raw: string[]; count: number };
  projects: { raw: string[]; count: number };
  agencies: { name: string; role?: string; dates?: string }[];
  creativeRole?: string;
  needsUserInput: string[];
};

type PortfolioBuildReport = {
  version: 'PORTFOLIO_MODE_V1';
  creativeResume: {
    sectionOrder: string[];
    templateFamily: string;
    portfolioFirst: true;
  };
  projectHighlights: PortfolioProjectHighlight[];
  clientHighlights: PortfolioClientHighlight[];
  ready: boolean;
};
```

Stored at:

- `resumeData.meta.portfolioMode` — detection + build report
- `resumeData.meta.projectHighlights` — featured projects
- `resumeData.meta.clientHighlights` — featured clients
- `resumeData.identity.creativeLinks` — structured URLs

---

## 9. Examples

### 9.1 Rich portfolio import

**Input:**

```
Jane Creative — Senior Graphic Designer
yoaz@email.com · behance.net/janecreative · dribbble.com/janecreative · instagram.com/janecreative
Portfolio: https://janecreative.com

Selected Clients
Nike, Sephora, L'Oréal, Adobe

Projects
Nike Air Max Campaign — Nike · 2023 · Art Director
Brand Identity — Sephora · 2022
Packaging System — L'Oréal · 2021

Experience
Senior Designer — Ogilvy — 2019–2023
```

**Detection:**

| Target | Result |
|--------|--------|
| Behance | `https://behance.net/janecreative` |
| Dribbble | `https://dribbble.com/janecreative` |
| Instagram | `https://instagram.com/janecreative` |
| Portfolio URL | `https://janecreative.com` |
| Agency | Ogilvy (experience) |
| Clients | Nike, Sephora, L'Oréal, Adobe |
| Projects | 3 parsed entries |

**Project Highlights (top 3):**

1. Nike Air Max Campaign — Nike · 2023 · Art Director  
2. Brand Identity — Sephora · 2022  
3. Packaging System — L'Oréal · 2021  

**Client Highlights:**

Nike · Sephora · L'Oréal · Adobe

**Creative Resume:** Portfolio Mode active, section order `clients → projects → experiences`, template `creative-director`.

---

### 9.2 URLs only — thin project list

**Input:**

```
Graphic Designer
behance.net/alex · alexdesign.com
Freelance designer, various clients
```

**Detection:** 2 links, 0 projects, 0 anchor clients  
**Build:** Creative Resume active (link signal + role), empty highlights, `needsUserInput: ['add_clients', 'add_projects']`  
**Rule:** No fabricated Nike or placeholder projects.

---

### 9.3 Client list guarded from experience inflation

**Input:**

```
Art Director — Nike — 2020–2023
Clients including Adidas, Puma
```

**Detection:**

- Nike → experience company (job row) — **not** duplicated in `clients[]` from same line
- Adidas, Puma → `clients[]` from intro phrase
- Agency detector: none

**Client Highlights:** Adidas · Puma (Nike shown in experience, not client grid)

---

## 10. UI surfacing

| Surface | Content |
|---------|---------|
| Import result | “Portfolio Mode detected — 4 links, 6 clients, 3 projects” |
| Studio badge | `#studioCreativeBadge` — “Creative CV” |
| Portfolio link editor | Behance, Dribbble, Instagram, Website fields |
| Project highlights panel | Drag-reorder featured 6 |
| Client highlights panel | Confirm inferred brands |
| Template picker | Filter: Creative / Portfolio family |
| A4 preview | `cvSection--clients`, `cvSection--projects`, `cvSection--portfolio` |

**i18n keys:**

| Key | EN |
|-----|-----|
| `portfolioModeTitle` | Portfolio mode |
| `portfolioModeDetected` | Portfolio signals detected |
| `portfolioLinksTitle` | Portfolio & links |
| `projectHighlightsTitle` | Project highlights |
| `clientHighlightsTitle` | Client highlights |
| `portfolioAddProjects` | Add your best 3–6 projects |
| `portfolioConfirmClient` | Confirm client name |

---

## 11. Integration map

| Engine | Relationship |
|--------|--------------|
| `CREATIVE_MODE_V1` | Product shell — editors, toggle, templates |
| `PORTFOLIO_EXTRACTION_ENGINE` | Link detection submodule |
| `CREATIVE_CLIENT_PROJECT_RECOVERY` | Client + project recovery submodule |
| `PROJECTS_ENGINE` | Project parse submodule |
| `CAREER_STORY_ENGINE_V1` | Narrative uses client/project highlights |
| `ACHIEVEMENT_ENGINE_V1` | Experience bullets upgraded before render |
| `RECRUITER_BRAIN_V1` | `love` quadrant for portfolio-forward structure |
| `SCORING_SYSTEM_V2` | Design dimension weighted in creative mode |

---

## 12. Scoring

| Signal | Score impact |
|--------|--------------|
| ≥ 1 portfolio link | +8 portfolio completeness |
| ≥ 3 anchor clients | +10 client proof |
| ≥ 3 specific projects | +12 project proof |
| Agency experience | +5 credibility |
| No links, no projects | `portfolio_thin` weakness flag |

**Designer mode ATS:** `DESIGNER_ATS_ADJUSTMENTS.creativePortfolioBoost` — corporate ATS score dampened; portfolio layer boosted.

---

## 13. Implementation phases

### Phase 1 — Orchestrator (MVP)

- [ ] `portfolio-mode.js` — `runPortfolioMode(structuredResume)`
- [ ] Signal evaluation + `meta.portfolioMode` persist
- [ ] Wire existing three engines in sequence
- [ ] Auto-activate `creativeMode.active`

### Phase 2 — Highlights

- [ ] `portfolio-highlights.js` — project + client builders
- [ ] `portfolio-agency-detect.js`
- [ ] `meta.projectHighlights`, `meta.clientHighlights`
- [ ] Template: render featured subset

### Phase 3 — UI

- [ ] Portfolio link editor (structured `creativeLinks`)
- [ ] Project / client highlight panels with reorder
- [ ] Inferred client confirm flow
- [ ] Import detection toast

### Phase 4 — QA + reports

- [ ] `qa-portfolio-mode.mjs`
- [ ] `scripts/portfolio-mode-report.mjs`
- [ ] Golden fixtures: links-rich, client-recovery, projects-rich, thin-freelance

---

## 14. Acceptance criteria

| # | Criterion |
|---|-----------|
| 1 | Behance, Dribbble, Instagram URLs extracted from `portfolio-links-rich` fixture |
| 2 | Personal portfolio URL normalized to `identity.creativeLinks.website` |
| 3 | Anchor clients recovered without inflating `experiences[]` count |
| 4 | Projects parsed with title + client + year when present in source |
| 5 | Agencies detected in experience — not copied to `clients[]` |
| 6 | Nike as employer ≠ Nike in client list on same CV (dedupe rules) |
| 7 | Project Highlights ≤ 6, sorted by year/specificity |
| 8 | Client Highlights ≤ 12, anchor tier first |
| 9 | Thin CV → active mode with links only; no invented projects |
| 10 | `npm run qa:portfolio-mode` passes; existing `qa-portfolio-extraction` + `qa-creative-client-project-recovery` unchanged |

---

## 15. QA commands

```bash
npm run qa:portfolio-extraction
npm run qa:creative-client-project-recovery
npm run qa:creative-cv-mode
npm run qa:creative-resume-product
# Future
npm run qa:portfolio-mode
npm run portfolio-mode-report
```

**Existing reports:**

- `PORTFOLIO_EXTRACTION_REPORT.md`
- `CREATIVE_CLIENT_PROJECT_RECOVERY_REPORT.md`

---

## 16. Before / after

### Before (fragmented)

```
behance.net/jane · instagram.com/jane
Skills: Nike, Photoshop, Figma
- Poster for Nike
- Campaign visuals
Designer at Ogilvy 2019-2023
```

**Recruiter read:** “Some links buried in skills. Nike is a skill? Where’s the portfolio?”

### After (Portfolio Mode)

| Artifact | Content |
|----------|---------|
| **creativeLinks** | behance, instagram |
| **Client Highlights** | Nike |
| **Project Highlights** | Poster for Nike · Campaign visuals (parsed/enhanced) |
| **Creative Resume** | clients → projects → experience (Ogilvy) |
| **Agency signal** | Ogilvy — 2019–2023 |

**Recruiter read:** “Portfolio links up top, Nike as client proof, projects before job history.”

---

## 17. Summary

| Detect | Build |
|--------|-------|
| Behance | → `creativeLinks.behance` |
| Dribbble | → `creativeLinks.dribbble` |
| Instagram | → `creativeLinks.instagram` |
| Portfolio URLs | → `creativeLinks.website` |
| Agency names | → `agencySignals[]` + experience |
| Creative clients | → `clientHighlights[]` |
| Projects | → `projectHighlights[]` |
| **All signals** | → **Creative Resume** (portfolio-first) |

Portfolio Mode turns scattered creative proof into a **structured, recruiter-scannable portfolio CV** — without inventing a single link, client, or project.

---

*Spec `PORTFOLIO_MODE_V1` — orchestrates `PORTFOLIO_EXTRACTION_ENGINE`, `CREATIVE_CLIENT_PROJECT_RECOVERY`, `PROJECTS_ENGINE`, and `CREATIVE_MODE_V1`.*
