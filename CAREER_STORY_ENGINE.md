# Hirely Career Story Engine — Spec

**Version:** `CAREER_STORY_ENGINE_V1`  
**Status:** Spec (builds on `RESUME_GRAPH_ENGINE`, `TRUSTED_CV_REVIEW_V1`, `RECRUITER_BRAIN_V1`, `ACHIEVEMENT_ENGINE_V1`)  
**Goal:** Transform **fragmented experience** into a **coherent career story** — answering who the candidate is, what they do, where they are headed, and why they matter — using only facts already in the CV.

---

## 1. Problem

Imported CVs often arrive as **fragments**, not stories:

| Fragment type | Example | Recruiter experience |
|---------------|---------|----------------------|
| Bullet shards | `Posters. Packaging. Email flows.` | No through-line |
| Role list only | `Designer — Agency A`, `Designer — Agency B` | Same title, no arc |
| Skills disconnected | `Figma, Photoshop` with no link to work | Expertise unclear |
| Missing summary | Empty `summary` field | 6-second screen fails |
| Thin market line | `Positioned as a Designer in the creative segment` | Generic, not memorable |

Hirely already scores completeness (`TRUSTED_CV_REVIEW_V1`) and positions candidates (`RECRUITER_COMMAND_CENTER_V2`). Those outputs are **checklist-grade**. The **Career Story Engine** synthesizes a **human narrative** recruiters can read, forward, and trust.

---

## 2. Four questions the engine must answer

Every generated artifact must explicitly resolve these four questions. Each maps to a **story block** assembled from CV facts.

| Question | Story block | Primary sources |
|----------|-------------|-----------------|
| **Who is this candidate?** | `identity` | `name`, `title`, `location`, seniority, archetype |
| **What is their expertise?** | `expertise` | `skills`, `tools`, role keywords, repeated domain nouns across experience |
| **What is their trajectory?** | `trajectory` | Ordered `experiences[]`, title seniority trend, tenure, industry/clients |
| **What is their value?** | `value` | Metrics, clients, projects, scope phrases, achievement rewrites |

**Principle:** Strategic narrative = **interpreted facts**, not fiction. Same constraint as `ACHIEVEMENT_ENGINE_V1` and `RECRUITER_BRAIN_V1`.

---

## 3. Three outputs

The engine produces **three distinct narrative products** from one shared `CareerStoryModel`.

### 3.1 Professional Narrative

**Purpose:** Replace or enrich the CV **summary section** — the candidate’s own career story in prose.

| Attribute | Spec |
|-----------|------|
| Length | 80–180 words (4–6 sentences) |
| Voice | First person (`I`) default; third person optional for executive templates |
| Structure | Expertise → trajectory → proof → positioning |
| Use | `resumeData.summary`, template `cvSection--summary`, studio editor |
| Tone | Confident, specific, grounded — not marketing fluff |

**Example (facts-only):**

> I am a senior graphic designer with 8+ years across agency and in-house environments, specializing in brand identity, packaging, and integrated campaigns. After starting at Studio Nova, I progressed to Art Director at Maison Luxe, where I led visual systems for beauty and lifestyle clients including Sephora and L'Oréal. My work spans Figma, Illustrator, and campaign delivery from concept through production. I bring a portfolio-forward approach with measurable audience reach across social and retail channels.

Every entity (`Studio Nova`, `Sephora`, `8+ years`, `Art Director`) must trace to `factsUsed[]`.

---

### 3.2 Executive Summary

**Purpose:** Board-room brevity for **executive templates** and **Recruiter Command Center** headline block.

| Attribute | Spec |
|-----------|------|
| Length | 40–80 words (2–3 sentences) |
| Voice | Third person |
| Structure | Who + expertise + value proof |
| Use | `executiveSummarySection()`, RCC `executiveSummary.summary`, PDF summary page |
| Tone | Crisp, senior, outcome-oriented |

**Example:**

> Yohann Azancot is a senior graphic designer and illustrator with eight years of brand and campaign experience across Paris-based agencies and luxury clients. He has progressed from designer to art director roles, delivering identity systems, packaging, and integrated campaigns for Sephora, L'Oréal, and Nike. He combines Figma-led production with strong visual craft and client-facing delivery.

---

### 3.3 Recruiter Introduction

**Purpose:** The **30-second forward** — what a recruiter writes when introducing the candidate to a hiring manager.

| Attribute | Spec |
|-----------|------|
| Length | 25–50 words (2–3 sentences) |
| Voice | Third person; may open with “I’d like to introduce…” |
| Structure | Hook (title + years) → differentiator → proof or client signal |
| Use | Cover letter opener, email forward, LinkedIn InMail draft, export packet |
| Tone | Direct, referral-ready, scannable |

**Example:**

> I’d like to introduce Yohann Azancot, a senior graphic designer with 8+ years in brand and campaign work. He has art director experience with luxury and lifestyle clients (Sephora, L'Oréal, Nike) and a strong portfolio in identity, packaging, and integrated campaigns.

---

## 4. Golden rules

| # | Rule | Enforcement |
|---|------|-------------|
| 1 | **Never invent information** | `detectRewriteViolations()` — same gates as `safe-rewrite-validation.js` |
| 2 | **Use only available context** | `buildCareerFactPool()` — structured resume + graph nodes only |
| 3 | **Preserve user summary when strong** | If existing `summary` ≥ 80 chars and passes quality gate → `preserve` strategy |
| 4 | **Trace every claim** | `factsUsed[]` on every sentence |
| 5 | **No employer/title fabrication** | `INVENT_COMPANY`, `INVENT_TITLE` block auto-apply |
| 6 | **No metric fabrication** | `INVENT_METRIC` — metrics only from experience/summary/projects |
| 7 | **Graceful degradation** | Thin CV → shorter outputs + `needsUserInput` flags, not padded prose |
| 8 | **Graph-first input** | Prefer `structuredResume` / `resumeGraph` — never raw OCR field invention |

---

## 5. Fragment → story pipeline

```
structuredResume / resumeData
        │
        ▼
buildCareerFactPool()              ◄── identity, roles, skills, metrics, clients
        │
        ▼
consolidateFragments()             ◄── merge shards, dedupe themes
        │
        ▼
analyzeTrajectory()                ◄── progression, tenure, velocity (RECRUITER_BRAIN)
        │
        ▼
clusterExpertise()                 ◄── skills + tools + domain nouns
        │
        ▼
extractValueProof()                ◄── metrics, clients, achievements
        │
        ▼
assembleCareerStoryModel()         ◄── four story blocks
        │
        ├─► generateProfessionalNarrative()
        ├─► generateExecutiveSummary()
        └─► generateRecruiterIntroduction()
        │
        ▼
applySafeRewriteGate()             ◄── per output
        │
        ▼
resumeData.meta.careerStoryEngine
```

---

## 6. Career fact pool

All narrative content must originate from the **career fact pool**.

### 6.1 Pool sources (priority)

| Priority | Source | Feeds |
|----------|--------|-------|
| 1 | `structured.identity` | Who |
| 2 | `structured.experiences[]` | Trajectory, value |
| 3 | `resumeGraph` nodes (`EXPERIENCE`, `SKILL`, `CLIENT`) | Coherence |
| 4 | `skills`, `tools`, `languages` | Expertise |
| 5 | `clients`, `projects` | Value, creative proof |
| 6 | `education` | Trajectory (early career) |
| 7 | Existing `summary` | Preserve or refine |
| 8 | `achievementEngine` rewrites | Value (post-achievement pass) |
| 9 | `detectCvArchetype()` | Market framing (`creative`, `developer`, `executive`) |

**Forbidden:** job description text, salary bands, industry benchmarks, LLM hallucination, guessed employers.

### 6.2 Fragment consolidation

| Input fragment | Consolidation strategy |
|----------------|------------------------|
| Noun shards (`Posters. Packaging.`) | `domainThemes[]` — e.g. `brand identity`, `packaging` |
| Duplicate role titles | `tenureDepth` — “8 years in design roles across 3 employers” |
| Client names in skills | Move to `clients[]`; cite in value block |
| Undated roles | Use role order; flag `dates_unclear` in trajectory |
| `unknownExperience` lines | Harvest themes only — do not name employers unless parsed |

```js
export function consolidateFragments(pool) {
  return {
    domainThemes: extractRepeatedNouns(pool.experienceBlob),
    roleSequence: orderExperiencesByDate(pool.experiences),
    clientSet: uniqueClients(pool.clients, pool.experienceBlob),
    metricHighlights: topMetrics(pool.metrics, 3),
    skillClusters: clusterSkills(pool.skills, pool.tools),
  };
}
```

---

## 7. Story block assembly

### 7.1 Identity block — *Who is this candidate?*

```js
{
  name: 'Yohann Azancot',
  title: 'Senior Graphic Designer',
  location: 'Paris, France',
  seniority: 'senior',           // detectSeniority() — recruiter-command-center
  archetype: 'creative',         // detectCvArchetype()
  yearsVisible: 8,               // estimateCareerYears() — trusted-cv-review
  factsUsed: ['Yohann Azancot', 'Senior Graphic Designer', 'Paris, France'],
}
```

**Template fragment:**  
`{name} is a {seniority} {title} based in {location}.`

---

### 7.2 Expertise block — *What is their expertise?*

Built from **skill clusters** + **domain themes** + **tools**:

| Cluster type | Detection |
|--------------|-----------|
| Core craft | Top 3 skills by frequency in experience blob |
| Tools | `tools[]` intersecting experience text |
| Domain | `creative`, `digital`, `brand`, `product` — keyword density |
| Languages | Only if `languages[]` present |

**Template fragment:**  
`…specializing in {theme1}, {theme2}, and {theme3}, with hands-on work in {tool1} and {tool2}.`

**Rule:** Max 5 expertise terms; all must appear in pool.

---

### 7.3 Trajectory block — *What is their trajectory?*

Uses **RECRUITER_BRAIN_V1** progression logic (spec-level until implemented):

| Trajectory signal | Narrative phrase (deterministic) |
|-------------------|----------------------------------|
| `upward_titles` | `progressed from {roleA} to {roleB} over {n} years` |
| `steady_ic` | `{n}+ years deepening expertise in {domain}` |
| `agency_to_inhouse` | `background across agency and in-house environments` |
| `freelance_mix` | `mix of freelance and permanent roles` |
| `early_career` | `early-career {title} building foundation in {domain}` |
| `unclear_dates` | Omit tenure claims; use role count only |

**Source roles:** chronologically sorted `experiences[]` — first role, latest role, promotion count.

**Template fragment:**  
`After starting at {companyA}, they advanced to {titleB} at {companyB}, where they {scopePhrase}.`

Companies and titles must match parsed experience exactly.

---

### 7.4 Value block — *What is their value?*

| Proof type | Source | Narrative use |
|------------|--------|---------------|
| Metrics | `METRIC_RE` in bullets | One headline metric in narrative |
| Named clients | `clients[]`, experience text | Parenthetical or “including X, Y” |
| Projects | `projects[]` | Creative mode — “selected projects for…” |
| Scope | Multi-market, team size phrases from bullets | Only if verbatim in CV |
| Achievements | `achievementEngine` output | Prefer rewritten bullets |

**Template fragment:**  
`…delivering {domainWork} for clients including {client1} and {client2}, with {metricHighlight}.`

**Rule:** Max 1 metric in Executive Summary; max 2 in Professional Narrative; max 1 in Recruiter Introduction.

---

## 8. Output generators

### 8.1 Professional Narrative template

```
[IDENTITY] I am a {seniority} {title} with {years}+ years in {trajectoryContext}, 
specializing in {expertiseThemes}.

[TRAJECTORY] {trajectorySentence}.

[VALUE] {valueSentence with clients and/or metric}.

[TOOLS/CRAFT] {optional tools sentence if pool.tools.length >= 2}.
```

**Length guard:** Truncate lowest-priority sentences first (tools → value → trajectory detail).

---

### 8.2 Executive Summary template

```
{identity.name} is a {seniority} {title} with {years}+ years of {expertisePrimary} experience. 
{trajectorySentence}. {valueSentence}.
```

Third person throughout. No “I’d like to introduce.”

---

### 8.3 Recruiter Introduction template

```
I'd like to introduce {identity.name}, a {seniority} {title} with {years}+ years in {expertisePrimary}. 
{differentiatorSentence with clients or progression}.
```

**Differentiator priority:** named clients > promotion arc > metric > tools.

---

## 9. Preserve vs generate

| Condition | Strategy |
|-----------|----------|
| `summary` ≥ 80 chars, has action verb, no corruption | `preserve` — use as Professional Narrative base |
| `summary` 40–79 chars | `enhance` — append trajectory or value from pool |
| `summary` missing or < 40 chars | `generate` — full synthesis |
| Executive Summary | Always generate from model (may differ from user summary) |
| Recruiter Introduction | Always generate |

**Enhance rule:** Appended sentences must pass `applySafeRewriteGate()` independently.

---

## 10. Architecture

### 10.1 Module map

| Module | Path | Role |
|--------|------|------|
| **Career story engine** | `src/core/parsing/career-story-engine.js` | Orchestrator |
| Fact pool | `src/core/parsing/career-story-fact-pool.js` | CV fact gathering |
| Fragment consolidate | `src/core/parsing/career-story-fragments.js` | Shard → themes |
| Trajectory | `src/core/parsing/career-story-trajectory.js` | Progression analysis |
| Expertise cluster | `src/core/parsing/career-story-expertise.js` | Skills/tools grouping |
| Value proof | `src/core/parsing/career-story-value.js` | Metrics, clients |
| Generators | `src/core/parsing/career-story-generators.js` | Three output builders |
| Validation | `src/core/parsing/safe-rewrite-validation.js` | No-invention gate |
| Graph input | `src/core/parsing/build-resume-graph.js` | Structured nodes |

### 10.2 Pipeline placement

```
import → parse → structuredResume
        │
        ▼
runResumeGraphEngine()
        │
        ▼
rewriteResumeExperiences()           ◄── existing
        │
        ▼
runAchievementEngine()               ◄── ACHIEVEMENT_ENGINE_V1
        │
        ▼
runCareerStoryEngine()               ◄── NEW
        │
        ├─► resumeData.summary (if generate/enhance)
        ├─► resumeData.meta.careerStoryEngine
        └─► feeds RECRUITER_COMMAND_CENTER executiveSummary
        │
        ▼
buildRecruiterCommandCenterAudit()   ◄── prefers careerStory outputs
        │
        ▼
template / export / cover letter
```

**Opt-in flag:** `resumeData.meta.careerStoryEngine.enabled` — default `true` when `summary` is thin or missing.

---

## 11. Data model

```ts
type CareerStoryBlock = {
  kind: 'identity' | 'expertise' | 'trajectory' | 'value';
  sentences: string[];
  factsUsed: string[];
};

type CareerStoryModel = {
  version: 'CAREER_STORY_ENGINE_V1';
  blocks: CareerStoryBlock[];
  archetype: string;
  seniority: string;
  yearsVisible: number;
  trajectorySignal: 'upward' | 'steady' | 'mixed' | 'early' | 'unclear';
  domainThemes: string[];
  clientHighlights: string[];
  metricHighlights: string[];
  confidence: number;                // 0–100
};

type CareerStoryOutput = {
  kind: 'professional_narrative' | 'executive_summary' | 'recruiter_introduction';
  text: string;
  wordCount: number;
  factsUsed: string[];
  strategy: 'preserve' | 'enhance' | 'generate';
  rewriteConfidence: number;
  autoApplied: boolean;
  violations: string[];
};

type CareerStoryEngineReport = {
  version: 'CAREER_STORY_ENGINE_V1';
  model: CareerStoryModel;
  outputs: CareerStoryOutput[];
  needsUserInput: string[];          // e.g. 'add_summary_metric', 'confirm_dates'
  ready: boolean;
};
```

Stored at `resumeData.meta.careerStoryEngine`.

---

## 12. Examples

### 12.1 Creative designer — full synthesis

**Input fragments:**

```
Title: Graphic Designer & Illustrator
Experience:
  - Junior Designer — Studio Nova (2016–2018)
  - Senior Designer — Atelier Bleu (2018–2021)
  - Art Director — Maison Luxe (2021–Present)
  - Posters. Packaging. Campaign visuals.
Clients: Sephora, L'Oréal, Nike
Tools: Figma, Illustrator, Photoshop
Summary: (empty)
```

**Professional Narrative (generate):**

> I am a senior graphic designer and illustrator with 8+ years across agency environments, specializing in brand identity, packaging, and campaign visuals. I progressed from Junior Designer at Studio Nova to Art Director at Maison Luxe, building depth in beauty and lifestyle work. I have delivered creative for clients including Sephora, L'Oréal, and Nike, using Figma, Illustrator, and Photoshop from concept through production.

**Executive Summary:**

> Yohann Azancot is a senior graphic designer and illustrator with eight years of brand, packaging, and campaign experience. He has advanced from junior designer to art director roles across Studio Nova, Atelier Bleu, and Maison Luxe, with client work for Sephora, L'Oréal, and Nike.

**Recruiter Introduction:**

> I'd like to introduce Yohann Azancot, a senior graphic designer with 8+ years in brand and campaign work. He has progressed to art director level with luxury clients including Sephora, L'Oréal, and Nike.

---

### 12.2 Developer — metric-grounded

**Input:**

```
Title: Software Engineer
Summary: (empty)
Experience:
  - Built payment APIs at Stripe (2019–Present)
  - Led migration to Kubernetes, improving deployment frequency by 4x
Skills: TypeScript, React, Node.js
```

**Recruiter Introduction:**

> I'd like to introduce Alex Chen, a software engineer with 6+ years in backend and platform work. At Stripe, they built payment APIs and led a Kubernetes migration improving deployment frequency by 4x.

`4x` allowed — verbatim in experience bullet.

---

### 12.3 Thin CV — graceful degradation

**Input:**

```
Title: (missing)
Experience: One line — "Freelance designer, various clients"
Skills: Photoshop
```

**Output:**

- `confidence: 35`
- Professional Narrative: 1–2 sentences max — no invented employers
- `needsUserInput: ['confirm_title', 'add_experience_detail', 'add_summary_metric']`
- Recruiter Introduction: omitted or minimal template with disclaimer

---

### 12.4 Blocked — invented client

**Candidate output:** `…clients including Apple and Google…`  
**Pool:** no Apple, no Google  
**violations:** `INVENT_COMPANY:Apple`, `INVENT_COMPANY:Google`  
**Result:** Regenerate without client clause; flag `needsUserInput: ['confirm_clients']`

---

## 13. UI surfacing

| Surface | Content |
|---------|---------|
| Studio summary field | Professional Narrative — editable, `contenteditable` |
| “Generate story” CTA | Runs engine when summary empty |
| Story preview panel | Three tabs: Narrative · Executive · Recruiter intro |
| Facts tooltip | `factsUsed` per sentence on hover |
| RCC executive block | Executive Summary replaces generic `market.narrative` when available |
| Export packet | Recruiter Introduction in PDF summary page / forward email draft |
| Cover letter | Recruiter intro seeds `cover-letter-renderer` opener |

**i18n keys:**

| Key | EN |
|-----|-----|
| `careerStoryTitle` | Your career story |
| `careerStoryLead` | Built from your CV — we never invent facts |
| `careerStoryNarrative` | Professional narrative |
| `careerStoryExecutive` | Executive summary |
| `careerStoryRecruiter` | Recruiter introduction |
| `careerStoryGenerate` | Generate from my experience |
| `careerStoryFacts` | Based on |
| `careerStoryThin` | Add more experience detail to strengthen your story |

---

## 14. Integration map

| Engine | Relationship |
|--------|--------------|
| `RESUME_GRAPH_ENGINE` | Primary structured input — experience/skill nodes |
| `ACHIEVEMENT_ENGINE_V1` | Value block uses achievement rewrites |
| `TRUSTED_CV_REVIEW_V1` | `summary_missing` / `summary_thin` triggers generate |
| `RECRUITER_BRAIN_V1` | Trajectory signals (`upward_titles`, `velocityIndex`) |
| `RECRUITER_COMMAND_CENTER_V2` | `executiveSummary` fed by Career Story output |
| `CREATIVE_MODE_V1` | Portfolio-first value block — clients, projects, Behance |
| `SAFE_REWRITE_VALIDATION_V1` | Hard gate on all three outputs |
| `cover-letter-renderer` | Recruiter intro as optional opener seed |

---

## 15. Scoring impact

| Dimension | Effect |
|-----------|--------|
| `SCORING_SYSTEM_V2` — Narrative Coherence | +15–25 pts when story generated and grounded |
| `TRUSTED_CV_REVIEW` — `summary_present` | Strength unlocked when narrative applied |
| `RECRUITER_BRAIN` — `question` quadrant | `summary_missing` insight reduced |
| `RED_FLAG_DETECTION` — `weak_descriptions` | Does not fix bullets — only summary layer |
| ATS summary field | Improved keyword density from real skills/tools |

---

## 16. Implementation phases

### Phase 1 — Deterministic core (MVP)

- [ ] `career-story-fact-pool.js`
- [ ] `career-story-trajectory.js` — title progression + years
- [ ] `career-story-generators.js` — three templates
- [ ] `runCareerStoryEngine(structuredResume | resumeData)`
- [ ] Safe rewrite gate per output
- [ ] Write `summary` when missing (user approve in studio)

### Phase 2 — Fragment intelligence

- [ ] `career-story-fragments.js` — theme extraction
- [ ] `career-story-expertise.js` — skill clustering
- [ ] `career-story-value.js` — client/metric selection
- [ ] Preserve/enhance strategies for existing summaries

### Phase 3 — UI + downstream

- [ ] Studio story preview panel (3 tabs)
- [ ] Wire RCC `executiveSummary` to career story output
- [ ] PDF export summary page + cover letter opener
- [ ] `qa-career-story-engine.mjs` + `scripts/career-story-report.mjs`

### Phase 4 — Recruiter Brain sync

- [ ] Share trajectory analyzers with `RECRUITER_BRAIN_V1`
- [ ] Quadrant-aware phrasing (emphasize `love` signals in value block)

---

## 17. Acceptance criteria

| # | Criterion |
|---|-----------|
| 1 | All three outputs answer Who, Expertise, Trajectory, Value |
| 2 | No output contains company/metric/title not in fact pool |
| 3 | `INVENT_*` violations block auto-apply |
| 4 | Strong existing summary → `preserve` strategy (no overwrite) |
| 5 | Empty summary on rich CV → Professional Narrative ≥ 80 words |
| 6 | Executive Summary ≤ 80 words; Recruiter Introduction ≤ 50 words |
| 7 | Every sentence has ≥ 1 entry in `factsUsed` |
| 8 | Thin CV → `needsUserInput` flags, no padded fiction |
| 9 | Creative fixture cites `clients` / `projects` when present |
| 10 | `npm run qa:career-story-engine` passes; `qa:safe-rewrite-validation` no regression |

---

## 18. QA commands

```bash
npm run qa:safe-rewrite-validation
npm run qa:trusted-cv-review
npm run qa:recruiter-command-center
# Future
npm run qa:career-story-engine
npm run career-story-report
```

**Golden fixtures:**

| Fixture | Tests |
|---------|-------|
| `creative-designer-arc` | Upward trajectory, client names, 3 outputs |
| `developer-metrics` | Metric in recruiter intro only from bullet |
| `thin-freelance` | Degraded output + needsUserInput |
| `strong-summary-preserve` | No overwrite |
| `invent-blocked` | Client invention rejected |

---

## 19. Before / after

### Before (fragmented)

```
Graphic Designer
Studio Nova — 2016–2018
Atelier Bleu — 2018–2021
Maison Luxe — 2021–now
Posters. Packaging.
Sephora, L'Oréal
Figma, Illustrator
(summary empty)
```

**Recruiter read:** “Designer, some clients, no story.”

### After (Career Story Engine)

| Output | Text |
|--------|------|
| **Professional Narrative** | I am a senior graphic designer with 8+ years… [full arc] |
| **Executive Summary** | …progressed from Studio Nova to Art Director at Maison Luxe… |
| **Recruiter Introduction** | I'd like to introduce… luxury clients including Sephora, L'Oréal |

**Recruiter read:** “Clear arc, credible clients, forwardable in 30 seconds.”

---

## 20. Summary

| Question | Answered by | Output touchpoint |
|----------|-------------|-------------------|
| Who is this candidate? | Identity block | All three |
| What is their expertise? | Expertise block | Narrative + Executive |
| What is their trajectory? | Trajectory block | Narrative + Executive |
| What is their value? | Value block | All three |

The Career Story Engine turns **parsed fragments** into **coherent, fact-grounded prose** — a Professional Narrative for the CV, an Executive Summary for senior templates, and a Recruiter Introduction for forwarding — without inventing a single employer, metric, or skill.

---

*Spec `CAREER_STORY_ENGINE_V1` — extends `RESUME_GRAPH_ENGINE`, `TRUSTED_CV_REVIEW_V1`, and `ACHIEVEMENT_ENGINE_V1`.*
