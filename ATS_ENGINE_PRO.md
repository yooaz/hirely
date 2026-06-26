# ATS Engine Pro

**Generated:** 2026-06-14
**Engine:** `ATS_ENGINE_PRO_V1`
**QA gate:** PASS

## Mission

Real ATS compatibility checker analyzing keywords, format, sections, readability, contact, experience structure, and skills relevance — benchmarked against Greenhouse, Lever, Workday, and SmartRecruiters.

## Analysis dimensions

| Dimension | Weight | Checks |
|-----------|--------|--------|
| Keywords | 14% | Role-specific scoring |
| Format | 14% | Role-specific scoring |
| Sections | 16% | Role-specific scoring |
| Readability | 12% | Role-specific scoring |
| Contact | 14% | Role-specific scoring |
| Experience | 20% | Role-specific scoring |
| Skills relevance | 20% | Role-specific scoring |

## Outputs

| Output | Field |
|--------|-------|
| ATS score | `score` / `atsScore` (0–100) |
| ATS risks | `risks[]` — level, label, dimension |
| ATS recommendations | `recommendations[]` — priority, action |
| ATS confidence | `confidence.score` + tier |
| Platform benchmarks | `benchmarks[]` — per-vendor score |

## Platform benchmarks

### Greenhouse

- **Focus:** Strong structured-field parser; rewards standard headings and parseable experience blocks.
- **Top weights:** experience 25%, sections 20%, contact 15%

### Lever

- **Focus:** Contact + chronology sensitive; expects clear role/company/date tuples.
- **Top weights:** experience 22%, contact 18%, sections 18%

### Workday

- **Focus:** Strict formatting; penalizes tables, columns, and non-standard section labels.
- **Top weights:** format 22%, sections 20%, experience 20%

### SmartRecruiters

- **Focus:** Keyword and skills taxonomy heavy; boolean search compatibility matters.
- **Top weights:** keywords 28%, skills 22%, experience 18%

## Fixture scores

| Tier | ATS score | Confidence | Risks | Recommendations |
|------|-----------|------------|-------|-----------------|
| strong | 86 | 85 | 0 | 1 |
| average | 68 | 71 | 2 | 4 |
| weak | 19 | 3 | 8 | 6 |

### Strong CV — dimension breakdown

| Dimension | Score |
|-----------|-------|
| Keywords | 68% |
| Format | 88% |
| Sections | 100% |
| Readability | 96% |
| Contact | 100% |
| Experience | 86% |
| Skills relevance | 69% |

**Platform scores**

| Platform | Score | Tier |
|----------|-------|------|
| Greenhouse | 89 | high |
| Lever | 88 | high |
| Workday | 88 | high |
| SmartRecruiters | 81 | moderate |

### Sample risks (weak CV)

- **high** — Contact block incomplete — parsers may drop candidate
- **high** — Experience structure not ATS-parseable
- **high** — Core ATS sections missing
- **medium** — Keyword match weak for SmartRecruiters search
- **medium** — Skills relevance low for role targeting

### Sample recommendations (weak CV)

- [high] Add a professional email and phone at the top of your CV.
- [high] Format each role as Company — Title — Dates with 2–4 bullet points.
- [high] Add standard sections: Experience, Education, Skills, and a short Summary.
- [medium] Mirror your target job title and role keywords in summary and skills.

## Integration

| Path | Role |
|------|------|
| `src/core/validation/ats-engine-pro.js` | Core engine |
| `src/core/validation/ats-analyzer.js` | Pipeline wrapper (`pro` field) |
| `src/core/validation/recruiter-command-center.js` | RCC audit `atsCompatibility` + `atsPro` |
| `src/ui/studio/recruiter-command-center.js` | UI: score, risks, benchmarks |
| `index.html` | Passes `jobDescInput` for keyword matching |

## Commands

```bash
npm run qa:ats-engine-pro
npm run ats-engine-pro-report
```
