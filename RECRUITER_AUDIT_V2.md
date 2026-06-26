# Recruiter Audit V2

Generated: 2026-06-14
Engine: `RECRUITER_COMMAND_CENTER_V2`

## Vision

Transform the analysis page into a **Recruiter Command Center** — professional audit presentation inspired by McKinsey, Bain, BCG, and LinkedIn Talent Solutions.

### Visual hierarchy

1. **Score at top** — recruiter score ring + confidence badge
2. **Insights underneath** — executive summary, strengths, weaknesses
3. **Details collapsible** — ATS, keywords, market, salary, interview risks

## Audit sections

| Section | Source |
|---------|--------|
| Executive Summary | Trusted CV review headline + summary |
| Strengths | `trusted-cv-review-engine` detections |
| Weaknesses | Trusted review weakness flags |
| ATS Compatibility | Score breakdown dimensions |
| Keyword Coverage | Title/archetype keywords vs CV blob |
| Market Positioning | Archetype + years + score tier |
| Salary Estimation | Seniority heuristic (indicative range) |
| Interview Risk Areas | High-impact weakness/missing flags |
| Recruiter Confidence Score | Score + extraction + completeness composite |

## Corpus results

| Fixture | Score | Confidence | ATS | Keywords | Salary | Risks |
|---------|-------|------------|-----|----------|--------|-------|
| Developer CV | 73 | 73 | 73 | 75% | €49k–€76k | 3 |
| Marketing CV | 72 | 72 | 72 | 100% | €76k–€114k | 3 |
| Consultant CV | 84 | 84 | 84 | 100% | €59k–€99k | 2 |
| Creative CV | 30 | 30 | 30 | 100% | €45k–€72k | 4 |

## Sample audit — Developer CV

### Executive Summary

**Needs attention**

Solid base — address the items below to strengthen your application.

### Strengths

- Name and job title clear
- Contact information complete
- Experience section present
- 11 years experience
- Experience dates included
- Education listed
- Strong skills section (9 skills)
- Languages listed

### Weaknesses

- Experience lacks measurable results
- Summary missing
- No LinkedIn profile

### ATS Compatibility

Score: **73** (moderate)

### Keyword Coverage

Coverage: **75%** — matched: engineer, software, engineer.

### Market Positioning

Positioned as a Software Engineer. candidate in the developer segment with 4 years of visible experience.

### Salary Estimation

€49k–€76k — _Indicative gross annual range based on title and experience — not employer-specific._

### Interview Risk Areas

- Experience lacks measurable results
- Summary missing
- No LinkedIn profile

### Recruiter Confidence

**73** (moderate)

## Integration

- `src/core/validation/recruiter-command-center.js` — audit builder
- `src/ui/studio/recruiter-command-center.js` — UI renderer
- `src/ui/studio/recruiter-command-center.css` — consulting-grade layout
- `index.html` — `#recruiterCommandCenter` host, wired via `renderRecruiterCommandCenter()`

## Run QA

```bash
npm run qa:recruiter-command-center
npm run recruiter:audit-v2-report
```