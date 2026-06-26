# Hirely Recruiter Brain — Strategic Analysis Report

**Version:** `RECRUITER_BRAIN_V1`  
**Status:** Spec + design report (not yet implemented)  
**Goal:** Transform recruiter output from **descriptive checklists** to **strategic hiring intelligence**.

---

## 1. Problem

Current recruiter output (`TRUSTED_CV_REVIEW_V1`, `RECRUITER_COMMAND_CENTER_V2`) is accurate but **descriptive**:

| Today | Example |
|-------|---------|
| Strengths list | “Experience section present” |
| Weaknesses list | “Summary missing” |
| Market line | “Positioned as a Software Engineer in the developer segment” |
| ATS block | Score + dimension percentages |

Recruiters don’t hire from checklists. They form a **6-second narrative**:

- Is this person **moving up** or **plateauing**?
- Would I **trust the timeline**?
- Are they **positioned** for the role and market?
- What would make me **advance** vs **reject** vs **champion** them?

**Recruiter Brain** adds a strategic layer: interpret signals, not just list them.

---

## 2. Vision

```
Descriptive (today)          Strategic (Recruiter Brain)
────────────────────         ────────────────────────────
"11 years experience"   →    "Steady IC progression; no management pivot yet"
"Skills listed"         →    "Stack evolved React → TypeScript → platform leadership"
"ATS score 73"          →    "Competitive for mid-market; weak vs FAANG bar"
"Summary missing"       →    "Recruiters will question positioning in first screen"
```

**Principle:** Every statement must be **grounded in CV facts** — no invented employers, promotions, or skills. Strategic = interpreted facts, not fiction.

---

## 3. Output model — four recruiter reactions

Replace flat strengths/weaknesses with **four strategic quadrants**:

| Quadrant | ID | Meaning | Recruiter mental model |
|----------|-----|---------|------------------------|
| **Will like** | `like` | Credible positives — advances screening | “This checks out” |
| **Will question** | `question` | Ambiguity — needs interview probe | “I’d ask about this” |
| **May reject** | `reject` | Hard stops or high-risk signals | “I’d pass at this stage” |
| **May love** | `love` | Differentiators — champion triggers | “I’d fight to get them in” |

Each item is a **strategic insight** with:

```ts
type RecruiterBrainInsight = {
  id: string;
  quadrant: 'like' | 'question' | 'reject' | 'love';
  dimension: BrainDimensionId;
  headline: string;           // ≤ 12 words
  rationale: string;          // 1–2 sentences, fact-grounded
  evidence: string[];         // CV facts cited (max 3)
  severity?: 'low' | 'medium' | 'high';
  actionable?: string;        // Optional fix (user-facing)
};
```

**Display rules:**

- Show **top 3 per quadrant** by default; expand to full list
- Lead with **love** + **reject** (highest decision leverage)
- Never show empty quadrants — omit if zero insights

---

## 4. Seven analysis dimensions

Recruiter Brain runs seven analyzers. Each produces signals mapped to quadrants.

### 4.1 Career progression

**Question:** Is the trajectory upward, lateral, or unclear?

| Signal | Detection | Quadrant |
|--------|-----------|----------|
| Clear upward titles | Designer → Senior → Lead over time | `love` |
| Steady IC depth | Same seniority band, deepening scope | `like` |
| Title regression | Senior → Junior without explanation | `question` |
| Flat titles 8+ years | Same role label, no scope growth | `question` |
| No experience block | Empty or single line | `reject` |
| Freelance → in-house arc | Contract then FTE pattern | `like` |

**Source modules:**

- `collectExperienceRows()` — `recruiter-quality-audit.js`
- Title tokens: `SENIORITY_RE` — `recruiter-command-center.js`
- Role keywords: `roleKeywords.js`, `creative_roles.json`

**Output example:**

> **Will love:** Clear progression from Graphic Designer to Art Director over 6 years — role titles escalate at each step.  
> Evidence: `Junior Designer 2016–2018`, `Senior Designer 2018–2021`, `Art Director 2021–Present`

---

### 4.2 Promotion velocity

**Question:** How fast did they level up relative to tenure?

| Metric | Calculation |
|--------|-------------|
| `avgTenureMonths` | Mean role duration from date ranges |
| `promotionEvents` | Title seniority score increases between consecutive roles |
| `velocityIndex` | `promotionEvents / (totalYears / 2)` — normalized 0–100 |

| Velocity | Interpretation | Quadrant |
|----------|----------------|----------|
| Fast (≥70) | Promotion every ~2 years | `love` |
| Healthy (45–69) | Normal cadence | `like` |
| Slow (25–44) | Long tenures, few title changes | `question` |
| Stalled (<25) | 5+ years, no seniority movement | `question` |
| Job hopping (<12mo × 3) | Three sub-year stints | `reject` |

**Edge cases:**

- Freelance / consulting: use **client breadth** instead of promotions
- Creative mode: project volume substitutes for title velocity

---

### 4.3 Experience consistency

**Question:** Does the timeline hold up under recruiter scrutiny?

| Signal | Detection | Quadrant |
|--------|-----------|----------|
| All roles dated | `experienceHasDates()` + `DATE_RANGE_RE` | `like` |
| Timeline gaps >12mo | `timeline_gaps` — `recruiter-quality-audit` | `question` |
| Overlapping full-time roles | Conflicting date ranges | `reject` |
| Duplicate roles | `duplicate_roles` check | `question` |
| Thin descriptions | `weak_descriptions` + no metrics | `question` |
| Measurable impact | `METRIC_RE` in bullets | `love` |

**Consistency score (0–100):**

```
consistency = 100
  - (gaps × 15)
  - (overlaps × 25)
  - (duplicates × 10)
  - (undated roles × 8)
```

---

### 4.4 Industry positioning

**Question:** Where does this candidate sit in the market narrative?

| Input | Source |
|-------|--------|
| Archetype | `detectCvArchetype()` — `ats-quality-h8.js` |
| Segment | developer, creative, consultant, executive, marketing, general |
| Client brands | `clients[]`, entity dictionary |
| Title framing | `identity.title` vs experience roles |

| Positioning tier | Rule | Quadrant |
|------------------|------|----------|
| Niche authority | Archetype + 5+ years + brand clients | `love` |
| Segment fit | Title matches archetype | `like` |
| Pivot candidate | Title ≠ experience majority | `question` |
| Unpositioned | No title + generic summary | `reject` |
| Premium brands | ≥2 Fortune/recognizable clients | `love` |

**Extends** `marketPositioning()` in RCC V2 with **strategic narrative**, not template sentence.

**Before (descriptive):**

> Positioned as a Software Engineer candidate in the developer segment with 4 years of visible experience.

**After (strategic):**

> **Will like:** Positioned as a backend engineer in fintech — title, stack, and Stripe/Dropbox lineage align.  
> **Will question:** Current title says “Software Engineer” but last two roles were contract — clarify employment type.

---

### 4.5 Skill evolution

**Question:** Does the skill story show growth or stagnation?

| Signal | Detection | Quadrant |
|--------|-----------|----------|
| Tool → platform shift | e.g. Photoshop → Figma → Design systems | `love` |
| Stack modernization | Legacy → current frameworks in tools/skills | `like` |
| Skills match title | Keyword overlap title ↔ skills | `like` |
| Stale stack only | No tools from last 5 years (heuristic) | `question` |
| Skills without proof | Skills listed, no experience mention | `question` |
| Missing core tools | Archetype expects tools, none listed | `reject` |

**Algorithm:**

1. Bucket skills/tools by era (inferred from experience date ranges where mentioned)
2. Compare earliest vs latest role skill footprint
3. Cross-check `keywordCoverage()` from RCC

**Creative mode:** Software section + project types weigh heavier than generic skills.

---

### 4.6 Seniority level

**Question:** What level would a recruiter bucket this person?

| Level | Detection |
|-------|-----------|
| Intern / Junior | `detectSeniority()` + <2 years |
| Mid | Default band, 2–5 years |
| Senior IC | senior/lead/principal + 5+ years |
| Manager | manager/head of + people verbs |
| Director+ | director/VP/chief |
| Executive | C-suite, founder, board |

**Output:**

```json
{
  "inferredLevel": "senior",
  "confidence": 78,
  "titleSignal": "Senior Software Engineer",
  "yearsSignal": 11,
  "scopeSignal": "led, shipped, scaled in bullets",
  "mismatch": null
}
```

| Mismatch | Quadrant |
|----------|----------|
| Title says Director, 3 years experience | `question` |
| 15 years, still Junior title | `question` |
| Senior title + strong scope proof | `love` |

**Reuses** `detectSeniority()`, `estimateCareerYears()`, `salaryBand()`.

---

### 4.7 Market competitiveness

**Question:** How hard would it be to place this candidate right now?

**Composite index (0–100):**

| Factor | Weight |
|--------|--------|
| Recruiter score / ATS Pro | 25% |
| Career progression score | 15% |
| Consistency score | 15% |
| Skill evolution score | 15% |
| Impact density (metrics in bullets) | 10% |
| Keyword / job fit (if JD provided) | 20% |

| Band | Range | Strategic label |
|------|-------|-----------------|
| Top tier | 82–100 | “Strong hire — likely multiple processes” |
| Competitive | 65–81 | “Solid — passes most screens” |
| Selective | 50–64 | “Needs target role + narrative sharpening” |
| Uphill | 35–49 | “Limited market — fix gaps first” |
| Blocked | <35 | “High rejection risk at current state” |

**Extends** RCC `marketPositioning.tier` with **placement probability narrative**.

---

## 5. Architecture

```
resumeData / cvData + scoreReport + jobDescription (optional)
        │
        ▼
buildRecruiterCommandCenterAudit()     ◄── existing RCC V2
        │
        ▼
buildRecruiterBrainReport()            ◄── NEW orchestrator
        │
        ├── analyzeCareerProgression()
        ├── analyzePromotionVelocity()
        ├── analyzeExperienceConsistency()
        ├── analyzeIndustryPositioning()
        ├── analyzeSkillEvolution()
        ├── analyzeSeniorityLevel()
        ├── analyzeMarketCompetitiveness()
        │
        ▼
mapSignalsToQuadrants()                ◄── rank + dedupe
        │
        ▼
RecruiterBrainReport → UI (replace descriptive lists)
```

### 5.1 Module map

| Module | Path | Role |
|--------|------|------|
| **Brain orchestrator** | `src/core/validation/recruiter-brain.js` | `buildRecruiterBrainReport()` |
| Career progression | `src/core/validation/brain/career-progression.js` | Title trajectory |
| Promotion velocity | `src/core/validation/brain/promotion-velocity.js` | Tenure + level-ups |
| Experience consistency | `src/core/validation/brain/experience-consistency.js` | Gaps, dupes, dates |
| Industry positioning | `src/core/validation/brain/industry-positioning.js` | Archetype narrative |
| Skill evolution | `src/core/validation/brain/skill-evolution.js` | Stack story |
| Seniority level | `src/core/validation/brain/seniority-level.js` | Level inference |
| Market competitiveness | `src/core/validation/brain/market-competitiveness.js` | Composite index |
| Quadrant mapper | `src/core/validation/brain/quadrant-mapper.js` | Signal → like/question/reject/love |
| UI renderer | `src/ui/studio/recruiter-brain-panel.js` | Strategic cards |
| Styles | `src/ui/studio/recruiter-brain-panel.css` | Quadrant layout |

### 5.2 `RecruiterBrainReport` shape

```ts
type RecruiterBrainReport = {
  version: 'RECRUITER_BRAIN_V1';
  ready: boolean;
  competitiveness: {
    score: number;
    band: 'top_tier' | 'competitive' | 'selective' | 'uphill' | 'blocked';
    headline: string;
  };
  seniority: {
    level: string;
    confidence: number;
    narrative: string;
  };
  dimensions: {
    careerProgression: DimensionResult;
    promotionVelocity: DimensionResult;
    experienceConsistency: DimensionResult;
    industryPositioning: DimensionResult;
    skillEvolution: DimensionResult;
    seniorityLevel: DimensionResult;
    marketCompetitiveness: DimensionResult;
  };
  quadrants: {
    like: RecruiterBrainInsight[];
    question: RecruiterBrainInsight[];
    reject: RecruiterBrainInsight[];
    love: RecruiterBrainInsight[];
  };
  executiveBrief: string;   // 2-sentence recruiter POV
  meta: {
    archetype: string;
    years: number;
    jobFit?: { pct: number; matched: string[] };
  };
};
```

---

## 6. UI — Recruiter Brain panel

**Location:** Replace or augment `#reviewStudioAnalysis` descriptive blocks in Review step.

```
┌─ Recruiter Brain ─────────────────────────────────────────────┐
│ COMPETITIVE · Senior IC · 11y · Developer segment              │
│                                                                │
│ "Backend engineer with credible tenure — recruiters will       │
│  advance if impact numbers are added to the top third."       │
├────────────────────────────────────────────────────────────────┤
│ ♥ MAY LOVE          │ ✓ WILL LIKE                              │
│ · Stripe + Dropbox  │ · 11-year dated timeline                 │
│ · Fintech segment   │ · Complete contact block                 │
├─────────────────────┼──────────────────────────────────────────┤
│ ? WILL QUESTION     │ ✕ MAY REJECT                           │
│ · No metrics in     │ · (none at current threshold)            │
│   bullets           │                                          │
│ · Missing summary   │                                          │
└────────────────────────────────────────────────────────────────┘
│ [Career] [Velocity] [Consistency] [Position] [Skills] [Level] │
└────────────────────────────────────────────────────────────────┘
```

**Visual tokens:**

| Quadrant | Color | Icon |
|----------|-------|------|
| Love | Rose / accent | ♥ |
| Like | Green | ✓ |
| Question | Amber | ? |
| Reject | Red (muted) | ✕ |

Uses `visual-density-pass.css` compact cards — 4-quadrant grid on desktop, accordion on mobile.

---

## 7. Mapping: descriptive → strategic

| Current (`trusted-cv-review`) | Recruiter Brain quadrant |
|------------------------------|--------------------------|
| `experience_years` strength | **Like** — tenure credibility |
| `skills_rich` strength | **Like** — keyword footprint |
| `clients_projects` strength | **Love** — differentiation |
| `impact_thin` weakness | **Question** — proof gap |
| `summary_missing` weakness | **Question** — positioning gap |
| `dates_unclear` weakness | **Question** — consistency |
| `missing experience` | **Reject** — hard stop |
| `missing name/email` | **Reject** — hard stop |
| High score + brand clients | **Love** — champion signal |
| Job hop pattern | **Reject** — stability risk |

---

## 8. Sample outputs (corpus)

### 8.1 Developer CV

| Quadrant | Insight |
|----------|---------|
| **Love** | FAANG-tier employers (Stripe, Dropbox) — instant credibility in tech screens |
| **Like** | 11-year timeline with dates — recruiters trust the arc |
| **Like** | Backend/engineer positioning aligns with experience majority |
| **Question** | No quantified impact in bullets — recruiters will ask “what did you ship?” |
| **Question** | No summary — 6-second positioning relies on title alone |
| **Reject** | — |

**Executive brief:**  
*Strong mid–senior backend profile with brand-name lineage. Recruiters advance to phone screen; they'll probe impact and current scope in the first call.*

**Competitiveness:** 73 — Competitive

---

### 8.2 Consultant CV

| Quadrant | Insight |
|----------|---------|
| **Love** | Clear consulting arc — client-facing roles with recognizable firms |
| **Like** | Keyword coverage 100% — ATS and recruiter search align |
| **Like** | Seniority matches 8+ year span |
| **Question** | Project-based wording — clarify which engagements were lead vs support |
| **Reject** | — |

**Executive brief:**  
*Consultant positioning is coherent and market-ready. Champion candidates will highlight lead engagements and outcome metrics.*

**Competitiveness:** 84 — Top tier

---

### 8.3 Creative CV

| Quadrant | Insight |
|----------|---------|
| **Love** | Portfolio-forward structure — clients and projects before job history |
| **Like** | Behance/Instagram links present — recruiters can validate craft quickly |
| **Question** | Low ATS score — creative layout may not parse in corporate ATS |
| **Question** | Thin experience dates — freelance history needs clearer ranges |
| **Reject** | Missing email/contact — hard stop for agency recruiters |

**Executive brief:**  
*Creative portfolio signals are strong for agency and studio roles. Corporate ATS pipelines will filter this CV unless a text-first export is used.*

**Competitiveness:** 45 — Uphill (corporate) / 72 — Competitive (creative)

---

## 9. Job description overlay

When `#jobDescInput` is provided:

| Addition | Behavior |
|----------|----------|
| Fit score | Boost `marketCompetitiveness` with keyword match |
| **Love** | Matched seniority + must-have skills |
| **Reject** | Missing must-have requirements (≥2) |
| **Question** | Partial fit — “role asks for X, CV emphasizes Y” |

Reuses `analyzeAtsPro()` job-description mode from `ats-engine-pro.js`.

---

## 10. i18n keys (new)

| Key | EN |
|-----|-----|
| `brainTitle` | Recruiter Brain |
| `brainBrief` | What recruiters think in the first 6 seconds |
| `brainLove` | May love |
| `brainLike` | Will like |
| `brainQuestion` | Will question |
| `brainReject` | May reject |
| `brainCompetitive` | Market competitiveness |
| `brainSeniority` | Inferred level |
| `brainProgression` | Career progression |
| `brainVelocity` | Promotion velocity |
| `brainConsistency` | Experience consistency |
| `brainPositioning` | Industry positioning |
| `brainSkills` | Skill evolution |

---

## 11. Guardrails

| Rule | Enforcement |
|------|-------------|
| No invention | Insights cite `evidence[]` from CV only |
| No fake promotions | Title changes require date-backed roles |
| No salary promises | Salary stays indicative (RCC disclaimer) |
| Confidence floor | Omit insight if confidence < 40% |
| Max items | 8 per quadrant, 3 shown by default |
| Creative dual score | Corporate vs creative competitiveness when `creativeMode.active` |

---

## 12. Implementation phases

### Phase 1 — Brain core (MVP)

- [ ] `recruiter-brain.js` + 7 dimension analyzers
- [ ] Quadrant mapper from RCC + quality audit signals
- [ ] `executiveBrief` generator (template-based, fact-grounded)
- [ ] Wire into `buildRecruiterCommandCenterAudit()` as `brain` field

### Phase 2 — UI

- [ ] Replace descriptive strength/weakness lists with 4-quadrant panel
- [ ] Dimension detail tabs
- [ ] i18n EN/FR

### Phase 3 — QA + tuning

- [ ] `qa-recruiter-brain.mjs` on test lab corpus
- [ ] Tune thresholds on developer / consultant / creative / executive fixtures
- [ ] A/B: descriptive vs strategic (export completion rate)

---

## 13. Acceptance criteria

| # | Criterion |
|---|-----------|
| 1 | Every insight includes ≥1 evidence string from CV |
| 2 | All 7 dimensions produce a score or narrative when CV has experience |
| 3 | Four quadrants populated on developer + consultant golden fixtures |
| 4 | `reject` quadrant surfaces missing contact/experience when absent |
| 5 | `love` quadrant surfaces brand clients or progression on strong CVs |
| 6 | Executive brief ≤ 2 sentences, strategic tone |
| 7 | Competitiveness band aligns ±10 with RCC total score |
| 8 | Job description changes at least one quadrant item when provided |
| 9 | No insight contradicts `trusted-cv-review` facts |
| 10 | `npm run qa:recruiter-brain` passes |

---

## 14. QA commands

```bash
# Existing baseline
npm run qa:recruiter-command-center
npm run qa:recruiter-score-v2
npm run test:recruiter-quality

# Future
npm run qa:recruiter-brain
npm run recruiter-brain-report
```

**Fixtures:** developer-cv, consultant-cv, creative-cv, marketing-cv, executive-cv from `tests/lib/hirely-test-lab-catalog.mjs`.

---

## 15. Relation to existing systems

| System | Role |
|--------|------|
| `TRUSTED_CV_REVIEW_V1` | Fact detection input — not replaced, fed into Brain |
| `RECRUITER_COMMAND_CENTER_V2` | Host audit — Brain becomes `audit.brain` |
| `RECRUITER_QUALITY_V1` | Timeline gaps, duplicates, weak descriptions |
| `ATS_ENGINE_PRO` | Job fit + competitiveness factor |
| `RECRUITER_SCORE_V2` | Score backbone |
| `COMPARISON_MODE_SPEC` | User-facing “what changed” — Brain is “how you’re read” |
| `CREATIVE_MODE_SPEC` | Dual competitiveness paths for creatives |

---

## 16. Success metrics

| Metric | Target |
|--------|--------|
| User rates insights “useful” | ≥ 70% |
| Time on Review step | +20% (engagement) |
| Export after viewing Brain | ≥ baseline |
| Support tickets “what does score mean?” | −40% vs descriptive |

---

## 17. Summary

| From | To |
|------|-----|
| Checklist strengths | **Will like** — credible signals |
| Checklist weaknesses | **Will question** — probe areas |
| Missing fields | **May reject** — hard stops |
| Brand/progression wins | **May love** — champion triggers |
| “11 years experience” | Career progression + velocity narrative |
| “ATS 73” | Market competitiveness band + placement odds |
| “Developer segment” | Industry positioning with pivot/risk flags |

**Recruiter Brain** does not add new data — it **thinks strategically about data Hirely already extracts**.

---

*Report version `RECRUITER_BRAIN_V1` — ready for Phase 1 implementation.*
