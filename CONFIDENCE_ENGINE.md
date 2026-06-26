# Hirely Confidence Engine — Spec

**Version:** `CONFIDENCE_ENGINE_V1`  
**Status:** Spec (builds on `EXTRACTION_FIELD_CONFIDENCE_V2`, `CONFIDENCE_GATE_V1`, `EXTRACTION_RECOVERY_V1`)  
**Goal:** Show **confidence for every extracted field** — section aggregates and per-item scores — **highlight low-confidence fields**, and **allow correction** before render and export.

---

## 1. Problem

Hirely already scores extraction internally (`field-confidence-v2.js`, `confidence-gate.js`, `extraction-recovery.js`), but the product surface is fragmented:

| Today | Gap |
|-------|-----|
| `extractionQualityStep` | Binary ✓/· per section — no percentages |
| `extraction-recovery-panel` | Low-confidence list — buried in recovery flow |
| `reviewQueue` | Per-item edit — no unified confidence map |
| CV preview | No inline confidence on fields |
| Export gate | Blocks broken output — user doesn't see *why* per field |

Candidates cannot answer: *“Which parts of my CV did Hirely get right — and what should I fix first?”*

**Confidence Engine** makes extraction trust **visible, actionable, and correctable**.

---

## 2. Canonical example

After import, the user sees **section confidence** at a glance:

```
Name          99%   ✓
Experience    95%   ✓
Education     92%   ✓
Skills        74%   ⚠ verify
Languages     68%   ⚠ verify
```

- **Green (≥85%)** — high confidence, auto-rendered  
- **Amber (70–84%)** — medium, shown with soft highlight  
- **Red (<70%)** — low, flagged for review, blocked from auto-render  

Clicking **Languages 68%** opens the correction panel with source text and suggested fix.

---

## 3. Definitions

### 3.1 Field confidence

Numeric score **0–100** for one extracted value.

| Source | Module |
|--------|--------|
| Identity scorers | `confidence-gate.js` — `scoreIdentityName`, `scoreIdentityTitle`, … |
| Experience | `scoreExperienceField()` — `field-confidence-v2.js` |
| Education | `scoreEducationLine()` |
| Skills / tools | `scoreSkillLine()` |
| Languages | `scoreLanguageField()` — strict language extraction |
| Location, URLs | `scoreLocationField`, `scoreLinkedInField`, … |
| Block-level | `applyConfidenceGate()` — `confidence-scoring.js` |

### 3.2 Section confidence

Aggregate over all fields of a section type:

```js
sectionConfidence = round(avg(field.confidence for field in section))
```

Matches `scoreCvFieldConfidence().sections[field].avg` — already computed.

### 3.3 Confidence tier

| Tier | Range | Field-specific HIGH floor | Behavior |
|------|-------|---------------------------|----------|
| **HIGH** | ≥ `FIELD_HIGH_MIN` | name 85, email 95, experience 85, skills 75… | Auto-render on CV |
| **MEDIUM** | 70–(HIGH_MIN−1) | — | Render with amber highlight |
| **LOW** | < 70 | `P0_CONFIDENCE_THRESHOLD` | Review queue + red highlight |

**Module:** `extraction-confidence-tiers.js` — `confidenceTier()`, `tierRequiresReviewQueue()`.

### 3.4 Extraction trust vs quality score

| Concept | Measures | Shown where |
|---------|----------|-------------|
| **Confidence** | “Did we extract this correctly?” | Confidence Engine |
| **Recruiter score** | “Is the CV strong?” | Score panel, RCC |

Never conflate them. A perfect extraction of a weak CV = high confidence, low recruiter score.

---

## 4. Field catalog

Every extractable field gets a confidence score. No silent omissions.

### 4.1 Identity fields

| Field ID | Label | Scorer | Typical HIGH |
|--------|-------|--------|--------------|
| `name` | Name | `scoreIdentityName` | 98–99% |
| `title` | Job title | `scoreIdentityTitle` | 97% |
| `email` | Email | `scoreIdentityEmail` | 100% |
| `phone` | Phone | `scoreIdentityPhone` | 95%+ |
| `location` | Location | `scoreLocationField` | 88% |
| `linkedin` | LinkedIn | `scoreLinkedInField` | 98% |
| `website` | Website / portfolio | `scoreWebsiteField` | 90% |

### 4.2 Content sections

| Section ID | Label | Aggregation | Per-item |
|------------|-------|-------------|----------|
| `summary` | Summary | Single field | — |
| `experience` | Experience | Avg of entries | Per role line |
| `education` | Education | Avg of entries | Per degree line |
| `skills` | Skills | Avg of entries | Per skill |
| `tools` | Software | Avg of entries | Per tool |
| `languages` | Languages | Avg of entries | Per language |
| `certifications` | Certifications | Avg | Per cert |
| `projects` | Projects | Avg | Per project |
| `achievements` | Achievements | Avg | Per item |
| `clients` | Clients | Avg | Per client (creative) |

### 4.3 Section rollup (user-facing)

Display order in confidence panel:

```
Identity  →  max(name, title, email, phone, location, linkedin, website)
Summary   →  summary
Experience → experience
Education →  education
Skills    →  avg(skills, tools) or separate rows
Languages →  languages
+ optional: Projects, Clients, Certifications (when present)
```

**Example rollup** (user query):

| Display | Computation |
|---------|-------------|
| Name 99% | `sections.name.avg` or identity `name` field |
| Experience 95% | `sections.experience.avg` |
| Education 92% | `sections.education.avg` |
| Skills 74% | `sections.skills.avg` |
| Languages 68% | `sections.languages.avg` |

---

## 5. Golden rules

| # | Rule |
|---|------|
| 1 | **Every extracted field has a score** — empty fields omitted, not scored 0 silently |
| 2 | **LOW tier never auto-renders as fact** — `CONFIDENCE_GATE` → unsorted/review |
| 3 | **Correction updates confidence** — user accept/edit re-scores field |
| 4 | **Show source** — every flagged field links to `sourceText` / import line |
| 5 | **No fake 100%** — placeholders (`Nom à compléter`) score 0, not displayed as 99% |
| 6 | **Export gate** — unresolved LOW on critical fields blocks export (existing recovery) |
| 7 | **OCR-aware** — scanned PDFs lower baseline; show import-quality banner |

---

## 6. Architecture

```
import → parse → cvData / finalResumeData
        │
        ▼
scoreCvFieldConfidence()           ◄── field-confidence-v2.js (existing)
        │
        ▼
buildConfidenceEngineReport()    ◄── NEW orchestrator
        │
        ├─► sectionRollups[]        Name 99%, Experience 95%, …
        ├─► fields[]                per-item scores
        ├─► flagged[]               LOW + MEDIUM highlights
        └─► overall                 weighted avg
        │
        ▼
applyFieldConfidenceV2()           ◄── meta.fieldConfidenceV2 (existing)
buildFieldReviewItems()            ◄── reviewQueue items (existing)
buildExtractionRecoveryReport()    ◄── lowConfidenceFields (existing)
        │
        ▼
UI: Confidence Panel + inline highlights + correction drawer
        │
        ▼
onCorrect(field, newValue)         ◄── re-score → update preview
```

### 6.1 Module map

| Module | Path | Status |
|--------|------|--------|
| **Confidence engine** | `src/core/validation/confidence-engine.js` | **New** — orchestrator |
| Field scorers | `src/core/extraction/field-confidence-v2.js` | Implemented |
| Identity gates | `src/core/validation/confidence-gate.js` | Implemented |
| Tiers | `src/core/validation/extraction-confidence-tiers.js` | Implemented |
| Block gate | `src/core/parsing/confidence-scoring.js` | Implemented |
| Recovery | `src/core/validation/extraction-recovery.js` | Implemented |
| Review items | `src/core/parsing/review-queue.js` | Implemented |
| **Confidence panel UI** | `src/ui/studio/confidence-panel.js` | **New** |
| **Inline highlights** | `src/ui/studio/confidence-highlights.css` | **New** |
| Extraction quality step | `index.html` `#extractionQualityStep` | Upgrade to % display |

---

## 7. Data model

```ts
type ConfidenceFieldRecord = {
  id: string;
  field: string;              // name, experience, skills, …
  value: string;
  confidence: number;         // 0–100
  tier: 'HIGH' | 'MEDIUM' | 'LOW';
  needsReview: boolean;
  sourceText?: string;
  sourceLine?: number;
  scorer: string;             // e.g. scoreIdentityName
};

type ConfidenceSectionRollup = {
  id: string;                 // name, experience, education, skills, languages
  label: string;
  confidence: number;
  tier: 'HIGH' | 'MEDIUM' | 'LOW';
  itemCount: number;
  flaggedCount: number;
  fields: string[];           // child field ids
};

type ConfidenceEngineReport = {
  version: 'CONFIDENCE_ENGINE_V1';
  overall: number;
  tier: 'HIGH' | 'MEDIUM' | 'LOW';
  threshold: number;          // 70
  sections: ConfidenceSectionRollup[];
  fields: ConfidenceFieldRecord[];
  flagged: ConfidenceFieldRecord[];  // needsReview || tier LOW
  criticalUnresolved: number;        // blocks export
  at: string;
};

// Persisted
resumeData.meta.confidenceEngine = ConfidenceEngineReport;
```

**Backward compat:** `meta.fieldConfidenceV2` remains; `confidenceEngine` extends with rollups + UI state.

---

## 8. Highlight low-confidence fields

### 8.1 Confidence panel (primary)

**Location:** Review step — above or beside A4 preview (`#confidencePanel`).

```
┌─ Extraction confidence ─────────────────────┐
│  Overall  84%  ·  2 fields need review      │
│                                             │
│  Name          99%  ████████████████████   │
│  Experience    95%  ███████████████████░   │
│  Education     92%  ██████████████████░░   │
│  Skills        74%  ██████████████░░░░░░ ⚠ │
│  Languages     68%  █████████████░░░░░░░ ⚠ │
│                                             │
│  [ Review flagged fields ]                  │
└─────────────────────────────────────────────┘
```

| Element | Spec |
|---------|------|
| Bar fill | Proportional to %; color by tier (green/amber/red) |
| Row click | Scroll preview to field + open correction drawer |
| Overall | Mean of section rollups, not recruiter score |

### 8.2 Inline CV highlights

Low and medium fields get subtle preview overlays:

| Tier | CV preview treatment |
|------|---------------------|
| HIGH | No overlay |
| MEDIUM | Amber left border 2px on section block |
| LOW | Amber background 6% + dashed underline on value |

**CSS:** `confidence-highlights.css` — `data-confidence-tier` on `.cvSection`, `[data-field="languages"]`.

**Rule:** Highlights are **review-only** — never appear in PDF export.

### 8.3 Extraction quality step upgrade

Replace binary ✓/· with **percentage + tier**:

```
✓ Name detected — 99%
✓ Experience — 95% (4 roles)
· Languages — 68% — tap to verify
```

Wire `buildExtractionQualityReport()` to `confidenceEngine.sections`.

### 8.4 Import analysis stages

During import loading rail, show per-stage confidence build-up:

```
Detecting sections…     82%
Parsing experience…     91%
Scoring fields…         done
```

Optional — uses pipeline stage outputs when available.

---

## 9. Allow correction

### 9.1 Correction flows

| Action | Effect |
|--------|--------|
| **Edit** | Inline or drawer editor → update `finalResumeData` → re-run `scoreCvFieldConfidence()` |
| **Accept** | User confirms LOW field is correct → `confidenceOverride: 85` + `userVerified: true` |
| **Reject** | Remove from CV → move to `unsorted` / drop |
| **Reassign** | Change section (e.g. skill → experience) → re-score |

**Existing:** `reviewQueue` items with `action: 'edit' | 'ignore' | 'accept'`.

### 9.2 Correction drawer

```
┌─ Verify: Languages ───────────────────────┐
│  Confidence: 68%  (LOW)                   │
│                                           │
│  Detected:                                │
│  ┌─────────────────────────────────────┐  │
│  │ English — fluent · Spanish — basic  │  │
│  └─────────────────────────────────────┘  │
│  Source: line 42 in imported text         │
│                                           │
│  [ Edit ]  [ Accept as correct ]  [ Remove ] │
└───────────────────────────────────────────┘
```

**On save:**

```js
function onFieldCorrected(fieldId, newValue, action) {
  updateResumeField(fieldId, newValue);
  const report = runConfidenceEngine(getFinalResumeData());
  mergeReviewQueue(report.flagged);
  renderCVInner();
  renderConfidencePanel(report);
}
```

### 9.3 Re-score after correction

| Action | New confidence |
|--------|----------------|
| Edit with valid value | Re-run field scorer |
| User accept | `max(previous, 85)` + `verified: true` |
| Reject | Field removed — dropped from rollups |

**Never** manually set 99% without scorer or user verify.

### 9.4 Export gate integration

| Condition | Export |
|-----------|--------|
| No unresolved LOW on name, email, experience | Allowed |
| LOW on languages/skills only | Warn + allow |
| `extractionRecovery.blockRender` | Blocked (existing) |
| User verified override | Treat as MEDIUM minimum |

**Source:** `extraction-recovery.js` + `isExportReady()` in `index.html`.

---

## 10. Scoring reference

### 10.1 Section aggregate formula

```js
export function buildSectionRollups(scored) {
  const LABELS = {
    name: 'Name',
    title: 'Title',
    experience: 'Experience',
    education: 'Education',
    skills: 'Skills',
    tools: 'Software',
    languages: 'Languages',
    summary: 'Summary',
    projects: 'Projects',
    clients: 'Clients',
  };

  // Identity rollup: weighted avg of identity fields (name 2×)
  const identityFields = scored.fields.filter((f) =>
    ['name', 'title', 'email', 'phone', 'location', 'linkedin', 'website'].includes(f.field)
  );
  const identityAvg = weightedAvg(identityFields, { name: 2, email: 1.5 });

  return [
    { id: 'identity', label: 'Name', confidence: identityAvg, ... }, // display "Name" for identity bundle
    ...Object.entries(scored.sections).map(([id, s]) => ({
      id,
      label: LABELS[id] || id,
      confidence: s.avg,
      tier: confidenceTier(s.avg, { field: id }),
      itemCount: s.count,
      flaggedCount: s.flagged,
    })),
  ].filter((s) => s.itemCount > 0 || s.id === 'identity');
}
```

**Display tweak:** When `name` alone is ≥95%, show **Name 99%** even if identity bundle is slightly lower — primary identity field drives the row.

### 10.2 Overall confidence

```js
overall = round(
  0.25 * identityAvg +
  0.30 * experienceAvg +
  0.15 * educationAvg +
  0.15 * skillsAvg +
  0.15 * languagesAvg
);
```

Weights configurable; omit sections with 0 items.

---

## 11. UI surfacing map

| Surface | Content |
|---------|---------|
| Review step | Full confidence panel |
| `#extractionQualityStep` | Section % before template |
| Recovery inspector | `lowConfidenceFields` — synced with engine |
| Recruiter Command Center | Global confidence dot (`SCORING_SYSTEM_V2`) |
| Debug panel | `meta.confidenceEngine` JSON |
| CV preview | Inline tier highlights |
| Export step | “2 fields verified by you” note |

**i18n keys:**

| Key | EN |
|-----|-----|
| `confidenceTitle` | Extraction confidence |
| `confidenceOverall` | Overall |
| `confidenceNeedsReview` | {n} fields need review |
| `confidenceVerify` | Verify |
| `confidenceAccept` | Accept as correct |
| `confidenceEdit` | Edit |
| `confidenceRemove` | Remove |
| `confidenceSource` | Source |
| `confidenceTierHigh` | High confidence |
| `confidenceTierMedium` | Review recommended |
| `confidenceTierLow` | Needs verification |

---

## 12. Integration map

| Engine | Relationship |
|--------|--------------|
| `EXTRACTION_FIELD_CONFIDENCE_V2` | Per-field scorers — core input |
| `CONFIDENCE_GATE_V1` | Render gate — LOW → unsorted |
| `EXTRACTION_CONFIDENCE_TIERS_V1` | HIGH/MEDIUM/LOW bands |
| `EXTRACTION_RECOVERY_V1` | Export block + low-confidence list |
| `SCORING_SYSTEM_V2` | Visual language — bars, dots, tiers |
| `REVIEW_QUEUE` | Correction workflow |
| `COMPARISON_MODE_V1` | Confidence delta before/after edits |
| `PIPELINE_LOCK` | Confidence attached post-canonical import |

---

## 13. Examples

### 13.1 Strong import

| Section | % | Tier |
|---------|---|------|
| Name | 99 | HIGH |
| Experience | 95 | HIGH |
| Education | 92 | HIGH |
| Skills | 88 | HIGH |
| Languages | 85 | HIGH |

Panel: green overall, no flagged fields, export unlocked.

### 13.2 OCR-noisy creative CV

| Section | % | Tier |
|---------|---|------|
| Name | 72 | MEDIUM |
| Experience | 81 | MEDIUM |
| Skills | 74 | MEDIUM |
| Languages | 68 | LOW |

Panel: amber overall, Languages flagged — user edits → re-score → 86% → export OK.

### 13.3 Missing email

| Field | % |
|-------|---|
| email | 0 (missing) |

Missing section in recovery + confidence panel shows `Email — missing` not 0% bar.

---

## 14. Implementation phases

### Phase 1 — Engine + panel

- [ ] `confidence-engine.js` — `runConfidenceEngine(resumeData)`
- [ ] Section rollups + `meta.confidenceEngine`
- [ ] `confidence-panel.js` — bar list UI
- [ ] Wire post-import in `hirely-import.js`

### Phase 2 — Highlights + correction

- [ ] `confidence-highlights.css` — preview overlays
- [ ] Correction drawer wired to `reviewQueue`
- [ ] Re-score on edit/accept
- [ ] Upgrade `extractionQualityStep` to percentages

### Phase 3 — Polish

- [ ] Import stage confidence rail
- [ ] RCC confidence dot sync
- [ ] `qa-confidence-engine.mjs` + report script

---

## 15. Acceptance criteria

| # | Criterion |
|---|-----------|
| 1 | Every populated section shows aggregate % in panel |
| 2 | Name, Experience, Education, Skills, Languages rows match user example format |
| 3 | Fields < 70% appear in `flagged[]` and review queue |
| 4 | LOW fields have amber/red highlight in preview |
| 5 | Edit correction re-scores and updates panel without re-import |
| 6 | Accept marks field verified — export gate respects override |
| 7 | Placeholder name/title never shows 99% |
| 8 | PDF export has no confidence overlays |
| 9 | `meta.confidenceEngine` persisted on `finalResumeData` |
| 10 | `npm run qa:confidence-engine` passes; `qa:extraction-recovery` unchanged |

---

## 16. QA commands

```bash
npm run qa:extraction-confidence-tiers
npm run qa:semantic-confidence-gate
npm run qa:extraction-recovery
# Future
npm run qa:confidence-engine
npm run confidence-engine-report
```

**Fixtures:**

| Fixture | Expect |
|---------|--------|
| `mvp-sample.txt` | HIGH experience, HIGH name |
| `designer-cv-rich.txt` | MEDIUM–HIGH skills, projects |
| OCR stress sample | Multiple LOW flags |
| Placeholder name | 0% / missing, blocks export |

---

## 17. Before / after

### Before

- Binary “detected / missing” in extraction quality step  
- Low-confidence fields only in recovery inspector  
- User guesses what to fix  

### After

```
Name          99%  ✓
Experience    95%  ✓
Education     92%  ✓
Skills        74%  ⚠ verify
Languages     68%  ⚠ verify
```

- Every field scored  
- Low fields highlighted on CV  
- One-click correction with re-score  

---

## 18. Summary

| Capability | Implementation |
|------------|----------------|
| Per-field confidence | `scoreCvFieldConfidence()` — existing |
| Section % display | `buildSectionRollups()` — new |
| Highlight LOW/MEDIUM | Preview CSS + panel bars |
| Allow correction | Review queue + drawer + re-score |
| Export safety | `EXTRACTION_RECOVERY` gate — existing |

The Confidence Engine makes extraction **transparent** — users see exactly what Hirely trusted and what still needs their eyes.

---

*Spec `CONFIDENCE_ENGINE_V1` — unifies `EXTRACTION_FIELD_CONFIDENCE_V2`, `CONFIDENCE_GATE_V1`, and `EXTRACTION_RECOVERY_V1`.*
