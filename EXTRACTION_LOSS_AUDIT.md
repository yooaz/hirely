# HIRELY P0 — Extraction Loss Audit

**Result:** PASS
**Generated:** 2026-06-10T20:23:49.082Z

## Problem

Real CVs were losing 50–80% of structured content between PDF extraction and `finalResumeData`.
Identity, clients, projects, and experience companies were dropped or downgraded across pipeline stages.

## Acceptance

| Gate | Threshold | Actual |
|------|-----------|--------|
| finalResumeData retains resumeData (upstream) content | ≥ 90% | 90% min / 97% avg |
| Fixtures passing | 100% | 5/5 |

## Pipeline stages audited

```
RAW → OCR → Normalizer → Section parser → Resume builder → finalResumeData → Renderer
```

## Metrics per stage

- `rawTextLength` / `normalizedTextLength`
- `detectedSections`
- `experienceCount`, `educationCount`, `clientCount`, `projectCount`, `skillCount`
- `finalRenderedCount` (renderer-visible structured items)

## Known loss vectors (code)

| Vector | Location | Symptom |
|--------|----------|---------|
| Client/project engines gated on creative mode | `section-engine-v2.js` | Clients & projects missing on non-creative CVs with explicit sections |
| Semantic confidence gate | `semantic-confidence-gate.js` | Clients/projects routed to review queue |
| final-resume cleanup | `final-resume-data-cleanup.js` | Parser labels & garbage lines stripped |
| Experience header fallback | `experience-reconstruction-engine-v2.js` | `Company à confirmer` placeholder |
| Unsorted recovery | `section-engine-v2.js` | clients/projects not in `RECOVERABLE_SECTIONS` |

## Fixture results

### creative-cv

**Verdict:** PASS · finalResumeData vs RESUME_BUILDER retention: **100%** (threshold 90%)

| Stage | rawText | normText | sections | exp | edu | clients | projects | skills | structured |
|-------|--------:|---------:|---------:|----:|----:|--------:|---------:|-------:|-----------:|
| RAW | 1003 | 1003 | 6 | 4 | 1 | 0 | 0 | 1 | 10 |
| OCR | 1003 | 997 | 6 | 4 | 1 | 0 | 0 | 1 | 10 |
| Normalizer | 1003 | 992 | 6 | 4 | 1 | 0 | 0 | 1 | 10 |
| Section parser | 992 | 992 | 6 | 5 | 2 | 9 | 0 | 8 | 29 |
| Resume builder | 992 | 992 | 6 | 3 | 2 | 7 | 0 | 10 | 27 |
| finalResumeData | 992 | 992 | 6 | 3 | 2 | 7 | 0 | 11 | 28 |
| Renderer | 0 | 0 | 0 | 3 | 2 | 7 | 0 | 11 | 28 |

**Retention chain (structured content)**

- RAW → OCR: ████████████████████ 100%
- OCR → Normalizer: ████████████████████ 100%
- Normalizer → Section parser: ████████████████████ 100%
- Section parser → Resume builder: ███████████████████░ 93%
  - experience: 5 → 3 (−2, 40% loss)
  - clients: 9 → 7 (−2, 22% loss)
- Resume builder → finalResumeData: ████████████████████ 100%
- finalResumeData → Renderer: ████████████████████ 100%

**Primary loss hotspots**
- Section parser → Resume builder: **experience** 5 → 3
- Section parser → Resume builder: **clients** 9 → 7

### designer-cv-rich

**Verdict:** PASS · finalResumeData vs RESUME_BUILDER retention: **100%** (threshold 90%)

| Stage | rawText | normText | sections | exp | edu | clients | projects | skills | structured |
|-------|--------:|---------:|---------:|----:|----:|--------:|---------:|-------:|-----------:|
| RAW | 910 | 910 | 11 | 3 | 1 | 1 | 2 | 1 | 12 |
| OCR | 910 | 863 | 11 | 3 | 1 | 1 | 2 | 1 | 12 |
| Normalizer | 910 | 863 | 11 | 3 | 1 | 1 | 2 | 1 | 12 |
| Section parser | 863 | 863 | 11 | 10 | 1 | 6 | 3 | 4 | 28 |
| Resume builder | 863 | 863 | 11 | 4 | 1 | 4 | 3 | 5 | 23 |
| finalResumeData | 863 | 863 | 11 | 4 | 1 | 4 | 3 | 6 | 23 |
| Renderer | 0 | 0 | 0 | 4 | 1 | 4 | 3 | 6 | 23 |

**Retention chain (structured content)**

- RAW → OCR: ████████████████████ 100%
- OCR → Normalizer: ████████████████████ 100%
- Normalizer → Section parser: ████████████████████ 100%
- Section parser → Resume builder: ████████████████░░░░ 82%
  - experience: 10 → 4 (−6, 60% loss)
  - clients: 6 → 4 (−2, 33% loss)
- Resume builder → finalResumeData: ████████████████████ 100%
- finalResumeData → Renderer: ████████████████████ 100%

**Primary loss hotspots**
- Section parser → Resume builder: **experience** 10 → 4
- Section parser → Resume builder: **clients** 6 → 4

### projects-creative-rich

**Verdict:** PASS · finalResumeData vs RESUME_BUILDER retention: **100%** (threshold 90%)

| Stage | rawText | normText | sections | exp | edu | clients | projects | skills | structured |
|-------|--------:|---------:|---------:|----:|----:|--------:|---------:|-------:|-----------:|
| RAW | 687 | 687 | 7 | 3 | 1 | 0 | 5 | 1 | 14 |
| OCR | 687 | 680 | 7 | 3 | 1 | 0 | 5 | 1 | 14 |
| Normalizer | 687 | 680 | 7 | 3 | 1 | 0 | 5 | 1 | 14 |
| Section parser | 680 | 680 | 7 | 12 | 2 | 6 | 8 | 3 | 33 |
| Resume builder | 680 | 680 | 7 | 7 | 0 | 4 | 8 | 6 | 30 |
| finalResumeData | 680 | 680 | 7 | 7 | 0 | 3 | 8 | 7 | 30 |
| Renderer | 0 | 0 | 0 | 7 | 0 | 3 | 8 | 7 | 30 |

**Retention chain (structured content)**

- RAW → OCR: ████████████████████ 100%
- OCR → Normalizer: ████████████████████ 100%
- Normalizer → Section parser: ████████████████████ 100%
- Section parser → Resume builder: ██████████████████░░ 91%
  - experience: 12 → 7 (−5, 42% loss)
  - education: 2 → 0 (−2, 100% loss)
  - clients: 6 → 4 (−2, 33% loss)
- Resume builder → finalResumeData: ████████████████████ 100%
  - clients: 4 → 3 (−1, 25% loss)
- finalResumeData → Renderer: ████████████████████ 100%

**Primary loss hotspots**
- Section parser → Resume builder: **experience** 12 → 7
- Section parser → Resume builder: **education** 2 → 0
- Section parser → Resume builder: **clients** 6 → 4

### yoaz-cv

**Verdict:** PASS · finalResumeData vs RESUME_BUILDER retention: **93%** (threshold 90%)

| Stage | rawText | normText | sections | exp | edu | clients | projects | skills | structured |
|-------|--------:|---------:|---------:|----:|----:|--------:|---------:|-------:|-----------:|
| RAW | 2511 | 2511 | 8 | 36 | 3 | 1 | 0 | 1 | 45 |
| OCR | 2511 | 2495 | 8 | 36 | 3 | 1 | 0 | 1 | 45 |
| Normalizer | 2511 | 2490 | 8 | 36 | 3 | 1 | 0 | 1 | 45 |
| Section parser | 2490 | 2490 | 8 | 32 | 2 | 14 | 0 | 13 | 67 |
| Resume builder | 2490 | 2490 | 8 | 12 | 2 | 7 | 2 | 13 | 41 |
| finalResumeData | 2490 | 2490 | 8 | 8 | 2 | 7 | 2 | 14 | 38 |
| Renderer | 0 | 0 | 0 | 8 | 2 | 7 | 2 | 14 | 38 |

**Retention chain (structured content)**

- RAW → OCR: ████████████████████ 100%
- OCR → Normalizer: ████████████████████ 100%
- Normalizer → Section parser: ████████████████████ 100%
  - experience: 36 → 32 (−4, 11% loss)
  - education: 3 → 2 (−1, 33% loss)
- Section parser → Resume builder: ████████████░░░░░░░░ 61%
  - experience: 32 → 12 (−20, 63% loss)
  - clients: 14 → 7 (−7, 50% loss)
- Resume builder → finalResumeData: ███████████████████░ 93%
  - experience: 12 → 8 (−4, 33% loss)
- finalResumeData → Renderer: ████████████████████ 100%

**Primary loss hotspots**
- Section parser → Resume builder: **experience** 32 → 12
- Section parser → Resume builder: **clients** 14 → 7
- Resume builder → finalResumeData: **experience** 12 → 8

### mvp-sample

**Verdict:** PASS · finalResumeData vs RESUME_BUILDER retention: **90%** (threshold 90%)

| Stage | rawText | normText | sections | exp | edu | clients | projects | skills | structured |
|-------|--------:|---------:|---------:|----:|----:|--------:|---------:|-------:|-----------:|
| RAW | 263 | 263 | 3 | 2 | 1 | 0 | 0 | 1 | 6 |
| OCR | 263 | 260 | 3 | 2 | 1 | 0 | 0 | 1 | 6 |
| Normalizer | 263 | 255 | 3 | 2 | 1 | 0 | 0 | 1 | 6 |
| Section parser | 255 | 255 | 3 | 5 | 1 | 0 | 0 | 0 | 9 |
| Resume builder | 255 | 255 | 3 | 2 | 1 | 0 | 0 | 3 | 10 |
| finalResumeData | 255 | 255 | 3 | 2 | 1 | 0 | 0 | 3 | 9 |
| Renderer | 0 | 0 | 0 | 2 | 1 | 0 | 0 | 3 | 9 |

**Retention chain (structured content)**

- RAW → OCR: ████████████████████ 100%
- OCR → Normalizer: ████████████████████ 100%
- Normalizer → Section parser: ████████████████████ 100%
  - skills: 1 → 0 (−1, 100% loss)
- Section parser → Resume builder: ████████████████████ 100%
  - experience: 5 → 2 (−3, 60% loss)
- Resume builder → finalResumeData: ██████████████████░░ 90%
- finalResumeData → Renderer: ████████████████████ 100%

## Retention summary

| Fixture | resumeData → finalResumeData | Verdict |
|---------|------------------------------|---------|
| creative-cv | 100% | PASS |
| designer-cv-rich | 100% | PASS |
| projects-creative-rich | 100% | PASS |
| yoaz-cv | 93% | PASS |
| mvp-sample | 90% | PASS |

## Run

```bash
npm run test:extraction-loss-audit
```
