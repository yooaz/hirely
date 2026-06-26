# Two-Column Recovery (P1)

**Status:** PASS  
**Generated:** 2026-06-11T08:43:19.001Z  
**QA checks:** 21/21

## Problem

Two-column CVs were merged into a single reading stream. Sidebar content leaked into the main column:

| Symptom | Cause |
|---------|--------|
| Skills → experience | Row-major sort interleaved columns; date/role heuristics fired in wrong section |
| Languages → education | Same-column y-band overlap without column context |
| Education → experience | Experience recovery ran on full flat text after layout blocks were correct |

## Solution

### 1. Column-aware reading order (`layout-memory.js`)

Positioned lines now use `applyReadingOrder` (full → left → right) instead of naive y-then-x sort when multi-column layout is detected.

### 2. Two-column recovery module

**File:** `src/core/layout/two-column-recovery.js`

| Step | Action |
|------|--------|
| Detect | `detectLayout` + `applyReadingOrder` → left / right / full columns |
| Reconstruct | `inferSemanticSectionBlocks` per column with isolated `layoutMemory` |
| Merge | Blocks tagged `two_column_recovery`, reading order preserved |

Exports: `recoverTwoColumnSections`, `isMultiColumnLayoutType`

### 3. Parser hooks

| Hook | Change |
|------|--------|
| `section-detect-v2.js` | Runs recovery before semantic classification; sets `twoColumnRecovery` flag |
| `semantic-section-infer.js` | Active section context — education/languages/skills lines stay in column section |
| `semantic-line-classifier.js` | Section headers reset context; schools checked before date-range → experience |
| `structured-resume-from-blocks.js` | Strips education schools from experience after block ingest; passes `readingStage` |

## Acceptance (Yoaz two-column fixture)

| Section | Expected |
|---------|----------|
| Skills | Illustration, Graphic Design, … |
| Languages | French — native, English — fluent |
| Education | LISAA, Créapole |
| Experience | Freelance, Nike clients |

**Guards:** LISAA ∉ experience · Nike ∉ education · Languages ∉ education

## QA

```bash
npm run qa:two-column-recovery
npm run qa:yoaz-two-column
npm run two-column-recovery-report
```

## Check results

- [x] **layout_detected** — two_column
- [x] **column_reconstruction** — usedColumnReconstruction
- [x] **layout_memory_multi_column** — two_column
- [x] **left_column_detected** — lines=8
- [x] **right_column_detected** — lines=15
- [x] **reading_order_left_first** — lang@5 exp@8
- [x] **recovery_applied** — two_column_recovery
- [x] **recovery_left_sections** — PREAMBLE,PROFILE,CONTACT,LANGUAGES
- [x] **recovery_right_sections** — PROFILE,EXPERIENCE,CLIENTS,EDUCATION,SKILLS,TOOLS,INTERESTS
- [x] **section_engine_two_column_flag** — true
- [x] **sections_skills** — PREAMBLE,PROFILE,CONTACT,LANGUAGES,EXPERIENCE,CLIENTS,EDUCATION,SKILLS,TOOLS,INTERESTS
- [x] **sections_languages** — PREAMBLE,PROFILE,CONTACT,LANGUAGES,EXPERIENCE,CLIENTS,EDUCATION,SKILLS,TOOLS,INTERESTS
- [x] **sections_education** — PREAMBLE,PROFILE,CONTACT,LANGUAGES,EXPERIENCE,CLIENTS,EDUCATION,SKILLS,TOOLS,INTERESTS
- [x] **sections_experience** — PREAMBLE,PROFILE,CONTACT,LANGUAGES,EXPERIENCE,CLIENTS,EDUCATION,SKILLS,TOOLS,INTERESTS
- [x] **cv_education_lisaa** — LISAA — Web & Motion Design | Créapole — Visual Communication / Product Design
- [x] **cv_experience_job** — 2011 — Present — 2011–Present | Freelance Illustrator / Graphic Designer — Freelance: Freelance Illustrator / Graphic Designer
- [x] **cv_languages** — French — native | English — fluent
- [x] **cv_skills** — Illustration | Graphic Design | Visual Identity
- [x] **cv_lisaa_not_experience** — LISAA leak
- [x] **cv_nike_not_education** — Nike leak
- [x] **cv_languages_not_education** — language leak

## Recovery stats

```json
{
  "applied": true,
  "stats": {
    "fullBlocks": 0,
    "leftBlocks": 5,
    "rightBlocks": 8,
    "mergedBlocks": 13
  },
  "leftColumn": {
    "lineCount": 8,
    "blockCount": 5,
    "sections": [
      "PREAMBLE",
      "PROFILE",
      "CONTACT",
      "LANGUAGES"
    ]
  },
  "rightColumn": {
    "lineCount": 15,
    "blockCount": 8,
    "sections": [
      "PROFILE",
      "EXPERIENCE",
      "CLIENTS",
      "EDUCATION",
      "SKILLS",
      "TOOLS",
      "INTERESTS"
    ]
  }
}
```
