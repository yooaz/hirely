# Recruiter Audit System

**Status:** PASS
**Generated:** 2026-06-15T23:04:55.937Z
**Engine:** `RECRUITER_AUDIT_ENGINE_V1`
**Corpus average overall:** 78/100

## Purpose

After extraction, the recruiter audit engine evaluates every CV across six dimensions and produces a recruiter-style review with strengths, weaknesses, and actionable recommendations.

## Pipeline

```
Import / paste → runRecruiterExtractionPipeline() → cvData v2
                              ↓
                   runRecruiterAuditEngine()
                              ↓
     ATS · Clarity · Experience · Structure · Keyword · Trust
                              ↓
              Overall /100 + recruiter review narrative
```

## Dimensions

| ID | Label | Weight |
|----|-------|-------:|
| ats | ATS | 20% |
| clarity | Clarity | 18% |
| experience | Experience | 20% |
| structure | Structure | 15% |
| keyword | Keyword | 12% |
| trust | Trust | 15% |

## Integration points

| Location | Function |
|----------|----------|
| `src/core/validation/recruiter-audit-engine.js` | `runRecruiterAuditEngine()` |
| `src/core/validation/recruiter-audit.js` | `runRecruiterAudit()` wraps engine + legacy fixes |
| `src/core/import/import-fallback-chain.js` | `attachRecruiterAuditToImportResult()` post-import |

## Corpus results

| Fixture | Overall | ATS | Clarity | Experience | Structure | Keyword | Trust | Band |
|---------|--------:|----:|--------:|-----------:|----------:|--------:|------:|------|
| Developer CV | 88 | 78 | 86 | 96 | 94 | 100 | 77 | excellent |
| Marketing CV | 83 | 77 | 87 | 71 | 94 | 100 | 75 | strong |
| Consultant CV | 87 | 71 | 87 | 96 | 94 | 100 | 80 | excellent |
| Creative CV | 79 | 71 | 86 | 100 | 83 | 50 | 73 | strong |
| Student CV | 51 | 50 | 75 | 0 | 56 | 100 | 47 | developing |
| Recruiter CV | 78 | 67 | 87 | 71 | 94 | 75 | 75 | strong |

## Sample recruiter reviews

### Developer CV

# Recruiter Review

**Candidate:** Alex Chen · Senior Software Engineer
**Overall score:** 88/100 — Excellent — recruiter-ready

Alex Chen (Software Engineer.) presents a polished, ATS-friendly profile that would pass initial recruiter screening.

## Dimension scores

| Dimension | Score |
|-----------|------:|
| ATS | 78 |
| Clarity | 86 |
| Experience | 96 |
| Structure | 94 |
| Keyword | 100 |
| Trust | 77 |

## Strengths

- Name and job title clear
- Contact information complete
- Experience section present
- 7 years experience
- Experience dates included
- Strong skills section (12 skills)

## Weaknesses

- Only one experience entry
- Experience lacks measurable results
- No LinkedIn profile

## Recommendations

1. **[high]** Rewrite experience bullets with action verbs and quantified outcomes (%, revenue, team size, delivery time).
2. **[medium]** Add missing keywords: javascript, node, aws, git.
3. **[low]** Include your LinkedIn URL in the header — recruiters often cross-check profiles before outreach.

_Archetype: developer · Engine: RECRUITER_AUDIT_ENGINE_V1_

---

### Marketing CV

# Recruiter Review

**Candidate:** Laura Bennett · Digital Marketing Manager
**Overall score:** 83/100 — Strong — competitive profile

Laura Bennett (Digital Marketing Manager.) presents a polished, ATS-friendly profile that would pass initial recruiter screening.

## Dimension scores

| Dimension | Score |
|-----------|------:|
| ATS | 77 |
| Clarity | 87 |
| Experience | 71 |
| Structure | 94 |
| Keyword | 100 |
| Trust | 75 |

## Strengths

- Name and job title clear
- Contact information complete
- Experience section present
- 6 years experience
- Experience dates included
- Strong skills section (7 skills)

## Weaknesses

- Only one experience entry
- Experience lacks measurable results
- No LinkedIn profile

## Recommendations

1. **[high]** Rewrite experience bullets with action verbs and quantified outcomes (%, revenue, team size, delivery time).
2. **[high]** Add year ranges to every role (e.g. 2020–Present).
3. **[medium]** Add missing keywords: seo, analytics, social, crm.
4. **[low]** Include your LinkedIn URL in the header — recruiters often cross-check profiles before outreach.

_Archetype: marketing · Engine: RECRUITER_AUDIT_ENGINE_V1_

---

### Consultant CV

# Recruiter Review

**Candidate:** Sophie Martin · Management Consultant
**Overall score:** 87/100 — Excellent — recruiter-ready

Sophie Martin (Consultant.) presents a polished, ATS-friendly profile that would pass initial recruiter screening.

## Dimension scores

| Dimension | Score |
|-----------|------:|
| ATS | 71 |
| Clarity | 87 |
| Experience | 96 |
| Structure | 94 |
| Keyword | 100 |
| Trust | 80 |

## Strengths

- Name and job title clear
- Contact information complete
- Experience section present
- Strong skills section (8 skills)
- Professional summary present
- Languages listed

## Weaknesses

- Experience dates unclear
- Only one experience entry
- Experience lacks measurable results
- No LinkedIn profile

## Recommendations

1. **[high]** Rewrite experience bullets with action verbs and quantified outcomes (%, revenue, team size, delivery time).
2. **[medium]** Add clear start/end dates to every role (e.g. Jan 2020 – Present) so recruiters can assess tenure quickly.
3. **[medium]** Mirror your target job title and role keywords in summary and skills.
4. **[medium]** List 6–12 tools and skills relevant to consultant roles; remove generic filler.
5. **[low]** Include your LinkedIn URL in the header — recruiters often cross-check profiles before outreach.

_Archetype: consultant · Engine: RECRUITER_AUDIT_ENGINE_V1_

---

## Verification

```bash
npm run qa:recruiter-audit-engine
npm run recruiter-audit-system-report
```
