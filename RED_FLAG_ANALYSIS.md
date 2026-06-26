# Hirely Red Flag Detection — Analysis Report

**Version:** `RED_FLAG_DETECTION_V1`  
**Status:** Spec + analysis (partial implementation exists)  
**Goal:** Surface recruiter **risk signals** with a clear **Low / Medium / High** rating per flag and an overall risk level.

---

## 1. Problem

Recruiters scan for **red flags** in the first pass — not generic “weaknesses.” A gap, a hop, or an overlap triggers immediate skepticism. Hirely today detects several signals across `recruiter-quality-audit.js` and `quality-validator.js`, but they are:

- Split across modules (not unified)
- Labeled as “warn” / “fail” (not recruiter risk language)
- Missing **job hopping**, **overlapping jobs**, **unexplained transitions**, and **inflated claims** as first-class flags

**Red Flag Detection** consolidates these into one deterministic engine with **Low / Medium / High** severity and an aggregate **Risk Level**.

---

## 2. Output model

### 2.1 Per-flag structure

```ts
type RedFlag = {
  id: string;
  category: RedFlagCategory;
  risk: 'low' | 'medium' | 'high';
  headline: string;          // ≤ 10 words
  detail: string;            // 1 sentence, fact-grounded
  evidence: string[];        // CV lines / ranges cited (max 3)
  recruiterImpact: string;   // What a recruiter does with this
  fix?: string;              // User-facing remediation
};

type RedFlagReport = {
  version: 'RED_FLAG_DETECTION_V1';
  ready: boolean;
  riskLevel: 'low' | 'medium' | 'high';   // aggregate
  riskScore: number;                       // 0–100 (higher = riskier)
  flags: RedFlag[];
  summary: {
    high: number;
    medium: number;
    low: number;
  };
  checks: RedFlagCategoryResult[];         // per-category rollup
};
```

### 2.2 Aggregate risk level

| Level | Rule |
|-------|------|
| **High** | ≥1 `high` flag OR ≥3 `medium` flags OR `riskScore` ≥ 65 |
| **Medium** | ≥1 `medium` flag OR ≥2 `low` flags OR `riskScore` 35–64 |
| **Low** | Only `low` flags or none OR `riskScore` < 35 |

**Risk score formula:**

```
riskScore = min(100,
  highCount × 25 +
  mediumCount × 12 +
  lowCount × 5
)
```

Weights are tunable per QA corpus.

---

## 3. Flag categories

Eight detection categories map to recruiter skepticism patterns.

| # | Category | ID | Status in codebase |
|---|----------|-----|-------------------|
| 1 | Employment gaps | `employment_gap` | ✅ `checkTimelineGaps()` |
| 2 | Job hopping | `job_hopping` | ⚠️ Spec only (Brain) |
| 3 | Missing dates | `missing_dates` | ✅ `checkMissingDates()` |
| 4 | Overlapping jobs | `overlapping_jobs` | ✅ `findDateOverlaps()` (quality-validator) |
| 5 | Unexplained transitions | `unexplained_transition` | ⚠️ New |
| 6 | Weak descriptions | `weak_description` | ✅ `checkWeakDescriptions()` |
| 7 | Inflated claims | `inflated_claim` | ⚠️ New |
| 8 | Missing metrics | `missing_metrics` | ✅ Partial (metric count in weak descriptions) |

---

## 4. Detection rules

### 4.1 Employment gaps

**What recruiters see:** Unaccounted time between roles — sabbatical, unemployment, or omission.

| Condition | Risk | Evidence |
|-----------|------|----------|
| Gap 1–2 years between consecutive dated roles | **Low** | `Role A (2018) → Role B (2020)` |
| Gap 3–4 years | **Medium** | Same |
| Gap ≥5 years | **High** | Same |
| Gap with only 1 dated role total | **Low** | Insufficient timeline — skip escalation |

**Algorithm** (existing — `checkTimelineGaps`):

1. `collectExperienceRows(cvData)` → parse start/end years
2. Sort intervals chronologically
3. `gapYears = next.start - cur.end`
4. Flag if `gapYears > 1`

**Recruiter impact:** *“They’ll ask what you did between these roles.”*

**Fix:** Add a brief line for the gap period (study, freelance, parental leave) or correct dates.

---

### 4.2 Job hopping

**What recruiters see:** Many short tenures — retention risk, instability.

| Condition | Risk | Evidence |
|-----------|------|----------|
| 1 role <12 months (full-time pattern) | **Low** | Single short stint |
| 2 roles each <12 months in 5-year window | **Medium** | Two short stints |
| ≥3 roles each <12 months in 5-year window | **High** | Three+ hops |
| Average tenure <18 months across ≥4 roles | **High** | Pattern |

**Algorithm** (proposed):

```js
function detectJobHopping(rows) {
  const tenures = rows
    .map((r) => monthsBetween(r.startDate, r.endDate))
    .filter((m) => m > 0 && m < 120); // cap 10y single role
  const short = tenures.filter((m) => m < 12);
  const window5y = rows in last 5 calendar years with tenure < 12;
  // ...
}
```

**Exclusions:**

- Freelance / contract titles (`freelance`, `consultant`, `contract`)
- Creative mode: project-based work — use **project count** not employer count
- Overlapping contract + FTE (see overlaps)

**Recruiter impact:** *“They’ll question commitment and ask why you left each role.”*

**Fix:** Group contract work under one “Independent / Freelance” block with date range; lead with longest tenure.

---

### 4.3 Missing dates

**What recruiters see:** Incomplete timeline — can’t verify tenure or progression.

| Condition | Risk | Evidence |
|-----------|------|----------|
| 1 of N roles undated (N ≥ 2) | **Low** | Single missing range |
| Majority undated (>50%) | **Medium** | Most roles lack years |
| All roles undated | **High** | No chronology |
| Current role undated | **Medium** | Present role has no end anchor |

**Algorithm** (existing — `checkMissingDates`):

- Row lacks `startDate` and no `DATE_RANGE_RE` / `YEAR_RE` in line blob

**Recruiter impact:** *“They can’t place you on a timeline — often deprioritized in ATS.”*

**Fix:** Add `YYYY–YYYY` or `YYYY–Present` to every experience entry.

---

### 4.4 Overlapping jobs

**What recruiters see:** Two full-time roles at once — credibility or parsing error.

| Condition | Risk | Evidence |
|-----------|------|----------|
| Overlap ≤3 months | **Low** | Handover / notice period |
| Overlap 4–12 months | **Medium** | Concurrent roles |
| Overlap >12 months | **High** | Long dual employment |
| 100% overlap (same start–end) | **High** | Likely duplicate parse |

**Algorithm** (existing — `findDateOverlaps` in `quality-validator.js`):

```js
if (a.start <= b.end && b.start <= a.end) → overlap
```

**Merge into** `recruiter-quality-audit` as `checkOverlappingJobs(rows)`.

**Exclusions:**

- Explicit “part-time” / “fractional” in role line
- Freelance concurrent with FTE (downgrade to **Low** if labeled)

**Recruiter impact:** *“They’ll ask which role was primary or assume a data error.”*

**Fix:** Clarify dates, mark part-time, or merge duplicate extractions.

---

### 4.5 Unexplained transitions

**What recruiters see:** Career moves that break narrative without context.

| Transition type | Detection | Risk |
|-----------------|-----------|------|
| Seniority drop | Director → Junior title (later in timeline) | **High** |
| Industry pivot | Archetype A roles → unrelated archetype B | **Medium** |
| Employment type flip | 5× FTE → sudden freelance-only | **Low** |
| Title ≠ experience majority | Header “Engineer”, jobs are all “Designer” | **Medium** |
| Gap + role change | Gap ≥2y then different function | **Medium** |

**Algorithm** (proposed):

1. Score seniority per role (`detectSeniority()` — RCC)
2. Compare consecutive roles: `seniorityScore[i+1] < seniorityScore[i] - 2` → flag
3. `detectCvArchetype()` per role cluster — pivot if archetype changes without overlap in skills
4. Compare `identity.title` to mode of experience role tokens

**Recruiter impact:** *“They’ll probe the story — be ready with one sentence why.”*

**Fix:** Add summary line explaining pivot; align headline title with target role.

---

### 4.6 Weak descriptions

**What recruiters see:** Thin bullets — no proof of scope or outcome.

| Condition | Risk | Evidence |
|-----------|------|----------|
| Bullet <28 chars, no metric | **Low** | `"Managed team."` |
| <2 action verbs across ≥2 bullets | **Medium** | Passive list |
| No action verbs at all | **Medium** | Duty-only lines |
| Role line only, zero bullets | **High** | Company + title, no body |

**Algorithm** (existing — `checkWeakDescriptions`):

- `ACTION_RE` — action verb count
- Line length < 28 without `METRIC_RE`

**Recruiter impact:** *“They can’t assess impact — skim past to next candidate.”*

**Fix:** Expand with verb + scope + outcome; one bullet per role minimum.

---

### 4.7 Inflated claims

**What recruiters see:** Language that outruns evidence — credibility hit in interview.

| Pattern | Risk | Example |
|---------|------|---------|
| Superlative without metric | **Medium** | “World-class”, “best-in-class”, “industry-leading” |
| Vague scale | **Low** | “Significantly improved”, “dramatically increased” |
| Title inflation vs tenure | **High** | “CEO” with 1-year history and no company context |
| Metric without baseline | **Low** | “Increased sales 200%” (no from/to) |
| Buzzword stack | **Medium** | 5+ jargon terms, zero specifics in same bullet |
| Rewrite drift | **Medium** | Enhanced text adds facts not in source (`safe-rewrite-validation`) |

**Algorithm** (proposed):

```js
const SUPERLATIVE_RE = /\b(world[- ]class|best[- ]in[- ]class|industry[- ]leading|top[- ]tier|revolutionary|disruptive|guru|ninja|rockstar)\b/i;
const VAGUE_SCALE_RE = /\b(significantly|dramatically|substantially|hugely|massively)\b/i;
const BUZZWORD_RE = /\b(synergy|leverage|paradigm|holistic|ecosystem|stakeholder|thought leader)\b/gi;
```

Cross-check: if superlative present and no `METRIC_RE` in same line → flag.

**Recruiter impact:** *“They’ll challenge every claim in the interview.”*

**Fix:** Replace hype with one verifiable number or named deliverable.

---

### 4.8 Missing metrics

**What recruiters see:** No quantified proof — harder to justify shortlist.

| Condition | Risk | Evidence |
|-----------|------|----------|
| 0 metrics, ≥2 experience lines | **Medium** | No `%`, `$`, `K/M`, user counts |
| 0 metrics, senior role (5+ years) | **High** | Senior without numbers |
| Metrics only in summary, not experience | **Low** | Proof not in work history |
| ≥50% bullets have metrics | — | **No flag** (positive) |

**Algorithm** (existing partial):

- `METRIC_RE` from `recruiter-quality-audit.js` / `recruiter-score-v2.js`:
  ```
  \d+% | \d+[kKmM€$£] | \d+ users/clients/projects
  ```

**Standalone check** `checkMissingMetrics(rows)` — split from weak descriptions for clearer UX.

**Recruiter impact:** *“They default to ‘no evidence’ — especially for senior hires.”*

**Fix:** Add one metric per recent role (%, revenue, team size, time saved).

---

## 5. Risk matrix (quick reference)

| Flag | Low | Medium | High |
|------|-----|--------|------|
| Employment gap | 1–2 yr | 3–4 yr | ≥5 yr |
| Job hopping | 1 short stint | 2 short in 5 yr | ≥3 short or avg <18 mo |
| Missing dates | 1 of many | majority | all |
| Overlapping jobs | ≤3 mo | 4–12 mo | >12 mo / duplicate |
| Unexplained transition | freelance flip | pivot / title mismatch | seniority drop |
| Weak description | 1 short line | few verbs | empty role body |
| Inflated claim | vague scale | superlative / buzz | title inflation |
| Missing metrics | summary only | 0 metrics, 2+ roles | senior, 0 metrics |

---

## 6. Architecture

```
cvData / resumeData
        │
        ▼
collectExperienceRows()              ◄── recruiter-quality-audit.js
        │
        ▼
buildRedFlagReport()                 ◄── NEW orchestrator
        │
        ├── detectEmploymentGaps()      ← checkTimelineGaps
        ├── detectJobHopping()        ← NEW
        ├── detectMissingDates()      ← checkMissingDates
        ├── detectOverlappingJobs()   ← findDateOverlaps (ported)
        ├── detectUnexplainedTransitions() ← NEW
        ├── detectWeakDescriptions()  ← checkWeakDescriptions
        ├── detectInflatedClaims()    ← NEW
        └── detectMissingMetrics()    ← NEW (split from weak)
        │
        ▼
aggregateRiskLevel(flags)
        │
        ▼
RedFlagReport → UI + RECRUITER_BRAIN (reject quadrant)
```

### 6.1 Module map

| Module | Path | Role |
|--------|------|------|
| Orchestrator | `src/core/validation/red-flag-detection.js` | `buildRedFlagReport()` |
| Gap detector | `src/core/validation/red-flags/employment-gaps.js` | Timeline gaps |
| Hop detector | `src/core/validation/red-flags/job-hopping.js` | Short tenures |
| Overlap detector | `src/core/validation/red-flags/overlapping-jobs.js` | Date overlap |
| Transition detector | `src/core/validation/red-flags/unexplained-transitions.js` | Seniority / pivot |
| Claims detector | `src/core/validation/red-flags/inflated-claims.js` | Hype patterns |
| Metrics detector | `src/core/validation/red-flags/missing-metrics.js` | Proof density |
| UI panel | `src/ui/studio/red-flag-panel.js` | Risk badge + list |
| Styles | `src/ui/studio/red-flag-panel.css` | Low/Med/High chips |

### 6.2 Integration points

| Consumer | Usage |
|----------|-------|
| `auditRecruiterQuality()` | Add `redFlags` field to return |
| `buildRecruiterCommandCenterAudit()` | `interviewRiskAreas` ← high flags |
| `buildRecruiterBrainReport()` | **May reject** quadrant ← high + medium flags |
| Review Studio V2 | Risk badge next to completion ring |
| Export gate | Informational only — never block export on red flags |

---

## 7. UI presentation

```
┌─ Red flags ──────────────────────────────────────┐
│  RISK LEVEL:  MEDIUM                             │
│  ████████░░  52 / 100                            │
├──────────────────────────────────────────────────┤
│  HIGH (0)                                        │
│  —                                               │
│  MEDIUM (3)                                      │
│  ◆ No metrics in experience (senior profile)     │
│  ◆ 3-year employment gap (2019 → 2022)           │
│  ◆ Industry pivot: marketing → engineering       │
│  LOW (2)                                         │
│  ◇ One role missing dates                        │
│  ◇ Overlap 2 months (notice period)              │
└──────────────────────────────────────────────────┘
```

**Color tokens:**

| Risk | Token | Hex |
|------|-------|-----|
| Low | `--red-flag-low` | amber-500 muted |
| Medium | `--red-flag-medium` | orange-600 |
| High | `--red-flag-high` | red-600 |

Badge on Review step: `Risk: Medium` — click expands full list.

---

## 8. Corpus analysis (expected flags)

Based on `RECRUITER_QUALITY_REPORT.md` fixtures and test lab corpus.

| Fixture | Expected risk | Top flags |
|---------|---------------|-----------|
| developer-cv | **Low** | Missing metrics (medium), no summary |
| consultant-cv | **Low** | Weak descriptions (low) |
| marketing-cv | **Medium** | Missing metrics, weak verbs |
| creative-cv | **Medium** | Missing contact (high→contact separate), weak descriptions |
| yoaz-cv | **Medium** | Duplicate roles (3), weak descriptions (5) |
| student-cv | **Low** | Short history — few flags |
| executive-cv | **Low–Medium** | Missing metrics if no KPIs |
| two-column-cv | **Medium** | Parse artifacts → overlaps/duplicates |

---

## 9. Sample report — Developer CV

```json
{
  "version": "RED_FLAG_DETECTION_V1",
  "ready": true,
  "riskLevel": "medium",
  "riskScore": 24,
  "summary": { "high": 0, "medium": 2, "low": 1 },
  "flags": [
    {
      "id": "missing_metrics_1",
      "category": "missing_metrics",
      "risk": "medium",
      "headline": "No quantified results in experience",
      "detail": "Zero metrics detected across 4 experience entries.",
      "evidence": ["Stripe 2019–Present", "Dropbox 2015–2019"],
      "recruiterImpact": "Recruiters will question impact in screening.",
      "fix": "Add one number per role: %, team size, or revenue."
    },
    {
      "id": "weak_description_1",
      "category": "weak_description",
      "risk": "medium",
      "headline": "Few action verbs in bullets",
      "detail": "1 action verb detected across 4 description lines.",
      "evidence": ["1 ligne(s) avec verbe d'action sur 4"],
      "fix": "Start bullets with Led, Built, Shipped, etc."
    },
    {
      "id": "missing_dates_0",
      "category": "missing_dates",
      "risk": "low",
      "headline": "Summary not dated",
      "detail": "N/A — all roles dated.",
      "evidence": [],
      "fix": null
    }
  ]
}
```

---

## 10. i18n keys

| Key | EN | FR |
|-----|----|----|
| `redFlagTitle` | Red flags | Signaux d'alerte |
| `redFlagRiskLevel` | Risk level | Niveau de risque |
| `redFlagLow` | Low | Faible |
| `redFlagMedium` | Medium | Moyen |
| `redFlagHigh` | High | Élevé |
| `redFlagGap` | Employment gap | Trou dans le parcours |
| `redFlagHop` | Job hopping | Changements fréquents |
| `redFlagDates` | Missing dates | Dates manquantes |
| `redFlagOverlap` | Overlapping roles | Chevauchement de postes |
| `redFlagTransition` | Unexplained transition | Transition non expliquée |
| `redFlagWeak` | Weak descriptions | Descriptions faibles |
| `redFlagInflated` | Inflated claims | Claims exagérés |
| `redFlagMetrics` | Missing metrics | Résultats chiffrés absents |

---

## 11. Guardrails

| Rule | Rationale |
|------|-----------|
| Facts only | Every `evidence[]` string from CV — no invented gaps |
| No moral judgment | “Gap” not “unemployed” — neutral recruiter framing |
| Freelance-aware | Contract work downgrades hop severity |
| Creative mode | Project-based CVs use project signals, not employer hops |
| OCR tolerance | Single parse artifact → **Low** not **High** |
| Hallucination-safe | `hallucinationSafe: true` on report (deterministic) |

---

## 12. Implementation phases

### Phase 1 — Unify existing checks

- [ ] `red-flag-detection.js` wrapping timeline, dates, weak, duplicates
- [ ] Port `findDateOverlaps` into red-flag module
- [ ] `riskLevel` + `riskScore` aggregation
- [ ] Attach to `auditRecruiterQuality()` return

### Phase 2 — New detectors

- [ ] `job-hopping.js`
- [ ] `unexplained-transitions.js`
- [ ] `inflated-claims.js`
- [ ] `missing-metrics.js` (standalone)

### Phase 3 — UI + QA

- [ ] Red flag panel in Review Studio
- [ ] Wire to Recruiter Brain **reject** quadrant
- [ ] `qa-red-flag-detection.mjs`
- [ ] `npm run red-flag-report` → update this doc with live corpus

---

## 13. Acceptance criteria

| # | Criterion |
|---|-----------|
| 1 | All 8 categories have detection logic |
| 2 | Every flag has `risk` ∈ {low, medium, high} |
| 3 | Aggregate `riskLevel` matches matrix in §2.2 |
| 4 | `employment_gap` matches `checkTimelineGaps` on golden fixtures |
| 5 | `overlapping_jobs` matches `findDateOverlaps` on overlap fixture |
| 6 | `missing_metrics` fires on developer-cv, not on metric-rich consultant |
| 7 | No flag without `evidence` when claiming a specific role/gap |
| 8 | Freelance CV does not trigger **High** job hopping |
| 9 | Report generates in <50ms on typical CV |
| 10 | `npm run qa:red-flag-detection` passes |

---

## 14. QA commands

```bash
# Existing baseline
npm run qa:recruiter-quality
npm run test:recruiter-quality

# Future
npm run qa:red-flag-detection
npm run red-flag-report
```

---

## 15. Relation to other systems

| System | Relationship |
|--------|--------------|
| `RECRUITER_QUALITY_V1` | Source checks — red flags unify + re-label |
| `QUALITY_VALIDATOR_V1` | Overlap + date validity source |
| `RECRUITER_BRAIN_V1` | **May reject** ← high/medium red flags |
| `TRUSTED_CV_REVIEW_V1` | `impact_thin` → `missing_metrics` |
| `CV_ENHANCEMENT_ENGINE` | Weak descriptions may be auto-fixed |
| `safe-rewrite-validation` | Inflated claim guard on rewrites |

---

## 16. Summary

| Detector | Recruiter question | Risk when severe |
|----------|-------------------|------------------|
| Employment gaps | “What were you doing then?” | Medium–High |
| Job hopping | “Will they stay?” | High |
| Missing dates | “Can I trust this timeline?” | Medium–High |
| Overlapping jobs | “Is this real or a typo?” | Medium–High |
| Unexplained transitions | “Does this story make sense?” | Medium–High |
| Weak descriptions | “What did they actually do?” | Medium |
| Inflated claims | “Can they back this up?” | Medium |
| Missing metrics | “Where’s the proof?” | Medium–High |

**Red Flag Detection** turns scattered quality warnings into a single **Risk Level** recruiters understand in one glance: **Low**, **Medium**, or **High**.

---

*Report version `RED_FLAG_DETECTION_V1` — consolidates `recruiter-quality-audit.js` + `quality-validator.js` with four new strategic detectors.*
