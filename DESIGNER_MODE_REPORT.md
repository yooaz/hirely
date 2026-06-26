# HIRELY P1 — Designer CV Mode

**Result:** PASS
**Generated:** 2026-06-10T16:38:19.162Z

## Problem

The parser and ATS scorer were optimized for corporate CVs — penalizing portfolio-heavy designer profiles and under-weighting clients, projects, awards, and exhibitions.

## DESIGNER_CV_MODE

Engine: `DESIGNER_CV_MODE` · wired in `section-engine-v2.js`, `section-sanity.js`, and `ats-quality-h8.js`.

### Trigger roles

- **Illustrator**
- **Graphic Designer**
- **Art Director**
- **Creative Director**
- **Motion Designer**
- **Brand Designer**
- **UI Designer**

### Priority sections (increased weight)

- `clients[]` × 1.45
- `projects[]` × 1.4
- `portfolioLinks[]` × 1.5
- `awards[]` × 1.35
- `exhibitions[]` × 1.35

### ATS adjustments

- Corporate ATS readiness factor: **0.72** (dampened)
- Creative portfolio boost: **1.35**
- Experience weight factor: **0.88**
- Education weight factor: **0.9**

When designer mode is active:
- Parser confidence increases for clients, projects, portfolio, awards, exhibitions
- Creative section scoring bonus applied in H8 ATS
- Corporate `atsReadiness` score is dampened — portfolio reach matters more than ATS checklist compliance

## Fixture audits

| Fixture | Mode | clients | projects | portfolio | awards | exhibitions | Score | ATS readiness | Archetype |
|---------|:----:|--------:|---------:|----------:|-------:|------------:|------:|--------------:|:---------:|
| designer-cv-rich | ✓ | 3 | 1 | 4 | 0 | 0 | 83 | 65 | designer |
| creative-cv | ✓ | 8 | 0 | 0 | 0 | 0 | 84 | 67 | designer |

### Corporate vs designer ATS readiness

- Designer fixture readiness: **65**
- Developer fixture readiness: **78**
- Designer mode dampens corporate ATS scoring while boosting creative signals

## Pipeline

```
RAW_TEXT → SECTION_ENGINE_V2 → detectDesignerCvMode()
  → creative pipelines (clients, portfolio, experience recovery)
  → resumeData.meta.designerMode
  → computeAtsQualityH8() → applyDesignerAtsAdjustments()
```

## Acceptance

**PASS** — Designer CVs activate designer mode, prioritize creative sections, and use dampened corporate ATS scoring.

## Run

```bash
npm run test:designer-mode
```
