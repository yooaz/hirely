# Hirely Achievement Rewriter — Engine Spec

**Version:** `ACHIEVEMENT_ENGINE_V1`  
**Status:** Spec (builds on `CV_EXPERIENCE_REWRITE` + `SAFE_REWRITE_VALIDATION`)  
**Goal:** Convert **task descriptions** into **achievement statements** using only facts already present in the CV — never invent numbers, companies, or outcomes.

---

## 1. Problem

Most CVs list **duties**, not **results**:

| Type | Example | Recruiter read |
|------|---------|----------------|
| Task | "Managed social media." | So what? |
| Task | "Responsible for email marketing." | Duty, not proof |
| Task | "Posters. Packaging." | Fragment, not story |
| Achievement | "Managed social media campaigns reaching 50,000+ users." | Scope + proof |

Hirely already rewrites experience (`cv-experience-rewrite.js`) and flags weak copy (`cv-enhancement-engine.js`). The **Achievement Engine** specializes in the task → achievement transform with stricter **context pooling** and **metric attachment** rules.

---

## 2. Definitions

### 2.1 Task (input)

A line that describes **what you were assigned**, without outcome, scale, or proof.

| Signal | Pattern |
|--------|---------|
| Duty phrase | `responsible for`, `in charge of`, `handled`, `assisted with` |
| Bare verb + object | `Managed social media.` |
| Noun fragments | `Posters. Packaging.` |
| No metric | No `%`, `$`, counts, or scale words |
| No action outcome | Verb present but no result clause |

### 2.2 Achievement (output)

A line that describes **what changed** because of the work — still factual, still grounded.

| Signal | Pattern |
|--------|---------|
| Action verb | Led, Built, Scaled, Launched, Reduced… |
| Scope object | campaigns, platform, team, markets… (from source) |
| Proof (optional) | Metric **only if traceable** to context |
| Complete sentence | Subject–verb–object, ends with `.` |

### 2.3 Canonical example

**Before:**
```
Managed social media.
```

**After (when context contains the metric):**
```
Managed social media campaigns reaching 50,000+ users.
```

**Context required for this rewrite:**

```json
{
  "sameRoleBullets": ["Grew Instagram to 50,000+ followers"],
  "orSummary": "…audiences of 50,000+…",
  "orSiblingLine": "social media campaigns"
}
```

**After (when metric NOT in context — no invention):**
```
Managed social media campaigns and community channels.
```

`campaigns` and `channels` are allowed only if they appear in the same experience block, summary, skills, or tools — not fabricated.

---

## 3. Golden rules

| # | Rule | Enforcement |
|---|------|-------------|
| 1 | **Never invent information** | `detectRewriteViolations()` — `INVENT_METRIC`, `INVENT_ACHIEVEMENT` |
| 2 | **Use only available context** | `extractFactsUsed()` + `buildContextPool()` |
| 3 | **Preserve original** | `originalDescription` always kept |
| 4 | **Trace every change** | `rewriteRecords[]` with `factsUsed[]` |
| 5 | **Gate low confidence** | `< 75%` → suggestion, not auto-apply (`SAFE_REWRITE_CONFIDENCE_MIN`) |
| 6 | **No new dates, titles, companies** | Same gates as `REWRITE_VALIDATION_REPORT` |
| 7 | **Boilerplate allowed** | `ALLOWED_REWRITE_TOKENS` — glue words only (`initiatives`, `deliverables`) |

---

## 4. Context pool

All enrichment must come from the **context pool** — facts extractable from the CV at rewrite time.

### 4.1 Pool sources (priority order)

| Priority | Source | Examples |
|----------|--------|----------|
| 1 | Same bullet / line | Words in the task itself |
| 2 | Sibling bullets (same role) | Other bullets under Stripe 2019–Present |
| 3 | Same role description | `exp.description`, `exp.bullets` |
| 4 | Role metadata | `role`, `company`, `dates` |
| 5 | Same CV section | All experience lines for this import |
| 6 | Summary | `resumeData.summary` |
| 7 | Projects / clients | `projects[]`, `clients[]` (named entities only) |
| 8 | Skills / tools | Confirms domain (`Figma`, `HubSpot`) — not outcomes |

**Forbidden sources:** job description input, LLM generation, industry benchmarks, guessed scales.

### 4.2 Context pool builder

```js
/**
 * @param {object} exp — experience entry
 * @param {import('../resume-data.js').ResumeData} resumeData
 * @returns {AchievementContextPool}
 */
export function buildAchievementContextPool(exp, resumeData) {
  return {
    lineTokens: contentTokens(exp.bullet || exp.description),
    roleBullets: (exp.bullets || []).filter(Boolean),
    roleMeta: { role: exp.role, company: exp.company, dates: exp.dates },
    experienceBlob: allExperienceText(resumeData),
    summary: resumeData.summary,
    projects: resumeData.projects || [],
    clients: resumeData.clients || [],
    metrics: extractMetrics(poolBlob),      // from safe-rewrite-validation
    years: extractYears(poolBlob),
    nouns: extractDomainNouns(poolBlob),      // campaigns, dashboards, etc.
  };
}
```

### 4.3 Metric attachment rule

A metric may move from context pool → achievement line **only if**:

1. `extractMetrics(contextPool.blob)` contains the exact metric string, **or**
2. Normalized form matches (e.g. `50,000+` ≡ `50000`, `50k`)
3. Metric appears in **same role** or **same experience block** (not cross-CV unless same company+date range)

```js
// ALLOWED: metric in sibling bullet
// Bullet A: "Managed social media."
// Bullet B: "Grew audience to 50,000+ users."
// → Merge B's metric into A's achievement

// BLOCKED: metric invented
// → "reaching 50,000+ users" with no 50,000 anywhere in pool
```

---

## 5. Transformation strategies

Applied in order until achievement criteria met or gate blocks.

### 5.1 Duty → action verb

| Before | After |
|--------|-------|
| Responsible for social media | Managed social media |
| In charge of email campaigns | Managed email campaigns |
| Handled client requests | Handled client requests and support workflows |

**Source:** `rewriteSentence()` — `cv-experience-rewrite.js`

---

### 5.2 Noun fragment → created/delivered

| Before | After |
|--------|-------|
| Posters. Packaging. | Created posters and packaging and related visual deliverables. |
| Email flows. A/B tests. | Delivered work spanning email flows and A/B tests. |

**Source:** `rewriteNounFragments()` — only nouns from fragments.

---

### 5.3 Task → task + scope (from pool)

| Before | Pool contains | After |
|--------|---------------|-------|
| Managed social media. | `campaigns`, `Instagram` | Managed social media campaigns. |
| Managed integrated campaigns. | `UK and Benelux` | Managed integrated campaigns across UK and Benelux markets. |

Scope words must exist in pool tokens.

---

### 5.4 Task → task + metric (from pool)

| Before | Pool metric | After |
|--------|-------------|-------|
| Managed social media. | `50,000+ users` | Managed social media campaigns reaching 50,000+ users. |
| Shipped file-sync improvements. | `30%` (sibling bullet) | Shipped file-sync performance improvements reducing latency by 30%. |
| Scaled paid social spend. | `£2M ARR`, `3.2x ROAS` | Scaled paid social spend to £2M ARR with 3.2x ROAS. |

**Merge algorithm:**

```js
function attachMetricFromPool(taskLine, pool) {
  const metrics = pool.metrics.filter(m => metricInSameRole(m, pool));
  if (!metrics.length) return null;
  const metric = metrics[0]; // highest-signal first: %, $, counts
  return `${stripTrailingPeriod(taskLine)} ${metricClause(metric)}.`;
}
```

---

### 5.5 Sibling bullet consolidation

When one bullet is a task and another holds the metric:

```
- Managed social media.
- Grew Instagram to 50,000+ followers.
```

**Output (single achievement):**
```
Managed social media, growing Instagram to 50,000+ followers.
```

Rules:
- Consolidate only within same `exp` entry
- Never drop facts — merged line must list all `factsUsed`
- If consolidation fails gate → keep two bullets, upgrade task line only

---

### 5.6 Already strong → preserve

If line already has action verb + metric, apply punctuation/casing only:

```
Led migration of billing microservices to Kubernetes, improving deployment frequency by 4x.
```

No semantic change — `rewriteConfidence: 100`.

---

## 6. Achievement criteria

A line qualifies as **achievement-grade** when:

```js
function isAchievementGrade(text) {
  return (
    VERB_START_RE.test(text) &&
    text.length >= PROFESSIONAL_DESCRIPTION_MIN_LEN &&  // 32
    (
      METRIC_RE.test(text) ||
      hasScopeObject(text, pool) ||
      hasClientProof(text, pool)
    )
  );
}
```

| Criterion | Required |
|-----------|----------|
| Action verb | Yes |
| Min length 32 chars | Yes |
| Metric OR scope OR named client | At least one |

If criteria not met after transforms → emit **suggestion** asking user to add a number, not a fabricated one.

---

## 7. Architecture

```
resumeData.experiences[]
        │
        ▼
detectTaskLines()                    ◄── task vs achievement classifier
        │
        ▼
buildAchievementContextPool()        ◄── per experience entry
        │
        ▼
applyAchievementTransforms()         ◄── strategies 5.1–5.5
        │
        ▼
buildSafeRewriteRecord()             ◄── safe-rewrite-validation.js
        │
        ▼
applySafeRewriteGate()               ◄── confidence ≥ 75 → auto-apply
        │
        ▼
achievementRecords[] → resumeData.meta.achievementEngine
```

### 7.1 Module map

| Module | Path | Role |
|--------|------|------|
| **Achievement engine** | `src/core/parsing/achievement-engine.js` | Orchestrator |
| Task classifier | `src/core/parsing/achievement-task-detect.js` | Task vs achievement |
| Context pool | `src/core/parsing/achievement-context-pool.js` | Fact gathering |
| Transforms | `src/core/parsing/achievement-transforms.js` | Strategy application |
| Metric merge | `src/core/parsing/achievement-metric-merge.js` | Sibling consolidation |
| Validation | `src/core/parsing/safe-rewrite-validation.js` | No-invention gate |
| Experience rewrite | `src/core/parsing/cv-experience-rewrite.js` | Base rewrite (delegate) |
| Enhancement | `src/core/parsing/cv-enhancement-engine.js` | `MISSING_ACHIEVEMENT` detection |

### 7.2 Pipeline placement

```
import → parse → resumeData
        │
        ▼
rewriteResumeExperiences()           ◄── existing
        │
        ▼
runAchievementEngine()               ◄── NEW (after base rewrite)
        │
        ▼
runCvEnhancement()                   ◄── verify MISSING_ACHIEVEMENT reduced
        │
        ▼
template / export
```

**Opt-in flag:** `resumeData.meta.achievementEngine.enabled` — default `true` in production.

---

## 8. Data model

```ts
type AchievementRewriteRecord = {
  id: string;
  experienceKey: string;           // role|company|dates
  originalText: string;
  achievementText: string;
  strategy: 'duty_verb' | 'noun_expand' | 'scope_attach' | 'metric_attach' | 'sibling_merge' | 'preserve';
  factsUsed: string[];
  contextSources: string[];        // e.g. ['sibling_bullet:1', 'summary']
  rewriteConfidence: number;
  autoApplied: boolean;
  blockedReason?: string;
  violations: string[];
};

type AchievementEngineReport = {
  version: 'ACHIEVEMENT_ENGINE_V1';
  processed: number;
  upgraded: number;                // task → achievement
  preserved: number;               // already achievement-grade
  suggestions: number;             // blocked, needs user input
  records: AchievementRewriteRecord[];
};
```

Stored at `resumeData.meta.achievementEngine`.

---

## 9. Examples (corpus)

### 9.1 Allowed — metric from sibling

| | |
|---|---|
| **Before** | Managed social media. |
| **Sibling** | Grew channels to 50,000+ users. |
| **After** | Managed social media campaigns reaching 50,000+ users. |
| **factsUsed** | `Managed`, `social media`, `50,000+ users`, `campaigns` |
| **autoApplied** | true (if confidence ≥ 75) |

---

### 9.2 Allowed — scope from same line

| | |
|---|---|
| **Before** | Managed integrated campaigns. |
| **Context** | `UK and Benelux` in same bullet block |
| **After** | Managed integrated campaigns across UK and Benelux markets. |
| **Invention** | none — geography from source |

---

### 9.3 Allowed — already achievement

| | |
|---|---|
| **Before** | Scaled paid social spend to £2M ARR with 3.2x ROAS. |
| **After** | Scaled paid social spend to £2M ARR with 3.2x ROAS. |
| **Strategy** | preserve |

---

### 9.4 Blocked — invented metric

| | |
|---|---|
| **Before** | Managed social media. |
| **Context** | no metrics in pool |
| **Candidate** | Managed social media campaigns reaching 50,000+ users. |
| **violations** | `INVENT_METRIC:50,000+ users` |
| **Output** | Managed social media. (unchanged) + suggestion: "Add audience size if known" |

---

### 9.5 Blocked — invented company

| | |
|---|---|
| **Before** | Designed posters for local clients. |
| **Candidate** | Increased revenue by 40% at Acme Corp… |
| **violations** | `INVENT_METRIC:40%`, `INVENT_COMPANY:Acme Corp` |
| **Source** | `REWRITE_VALIDATION_REPORT` blocked example |

---

## 10. UI surfacing

| Surface | Behavior |
|---------|----------|
| Review suggestions | "Upgrade to achievement" cards for blocked rewrites |
| Before/after | Show `originalText` → `achievementText` with `factsUsed` tooltip |
| User approve | Accept suggestion → writes `rewrittenDescription` |
| User edit | Manual metric entry → re-run engine with expanded pool |
| Enhancement panel | `MISSING_ACHIEVEMENT` count drops after engine run |

**i18n:**

| Key | EN |
|-----|-----|
| `achievementSuggestTitle` | Turn tasks into achievements |
| `achievementSuggestLead` | We only use facts already in your CV |
| `achievementNeedsMetric` | Add a number to strengthen this bullet |
| `achievementApplied` | Achievement wording applied |
| `achievementFactsUsed` | Based on |

---

## 11. Detection integration

| Engine | Link |
|--------|------|
| `cv-enhancement-engine` | `ISSUE_TYPES.MISSING_ACHIEVEMENT` triggers rewrite |
| `recruiter-quality-audit` | `METRIC_RE` — post-rewrite metric count |
| `RED_FLAG_DETECTION` | `missing_metrics` flag cleared when metric attached from pool |
| `SCORING_SYSTEM_V2` | Experience Strength bar improves |

---

## 12. Implementation phases

### Phase 1 — Core (MVP)

- [ ] `achievement-task-detect.js` — classify task lines
- [ ] `achievement-context-pool.js` — pool builder
- [ ] `achievement-transforms.js` — duty verb + scope attach
- [ ] Wire through `safe-rewrite-validation` gate
- [ ] `runAchievementEngine(resumeData)` orchestrator

### Phase 2 — Metric merge

- [ ] `achievement-metric-merge.js` — sibling consolidation
- [ ] Cross-bullet metric attachment (same role only)
- [ ] Suggestions UI for blocked lines

### Phase 3 — QA + reports

- [ ] `qa-achievement-engine.mjs`
- [ ] `scripts/achievement-engine-report.mjs`
- [ ] Golden fixtures: social-media-task, marketing-metrics, developer-strong

---

## 13. Acceptance criteria

| # | Criterion |
|---|-----------|
| 1 | No output contains metric not in context pool (QA asserts) |
| 2 | `INVENT_*` violations always block auto-apply |
| 3 | Task line with sibling metric upgrades when merged |
| 4 | Task line without pool metrics stays unchanged (not invented) |
| 5 | `originalDescription` never overwritten — only `rewrittenDescription` |
| 6 | Every auto-applied record has `factsUsed.length >= 1` |
| 7 | `MISSING_ACHIEVEMENT` count decreases on task-heavy fixtures |
| 8 | Developer CV with existing metrics → preserve strategy only |
| 9 | `npm run qa:achievement-engine` passes |
| 10 | `npm run qa:safe-rewrite-validation` still passes (no regression) |

---

## 14. QA commands

```bash
npm run qa:safe-rewrite-validation
npm run qa:cv-rewrite-quality
npm run test:cv-enhancement
# Future
npm run qa:achievement-engine
npm run achievement-engine-report
```

---

## 15. Relation to existing engines

| Engine | Relationship |
|--------|--------------|
| `CV_EXPERIENCE_REWRITE` | Base prose rewrite — Achievement Engine runs after |
| `SAFE_REWRITE_VALIDATION_V1` | Hard gate — all achievements must pass |
| `CV_ENHANCEMENT_ENGINE_V2` | Detects `weak_description`, `missing_achievement` |
| `RECRUITER_BRAIN_V1` | Readability improves when tasks → achievements |
| `ACHIEVEMENT_ENGINE_V1` | **This spec** — task→achievement specialization |

---

## 16. Summary

| Input | Output | Constraint |
|-------|--------|------------|
| Duty / task bullet | Achievement bullet | Verbs + scope from pool |
| Fragment list | Created/delivered sentence | Nouns from fragments only |
| Task + sibling metric | Merged achievement | Metric from same role |
| Strong bullet | Preserved | No change |
| Task, no context | Unchanged + suggestion | **Never invent 50,000 users** |

The Achievement Rewriter makes CVs recruiter-ready by surfacing proof that was **already in the document** — hidden in a sibling bullet, summary, or client list — not by fabricating success.

---

*Spec `ACHIEVEMENT_ENGINE_V1` — extends `cv-experience-rewrite.js` and `safe-rewrite-validation.js`.*
