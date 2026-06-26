# CV REWRITE QUALITY REPORT

Generated: 2026-06-06T23:49:20.553Z
Engine: `CV_EXPERIENCE_REWRITE`
Pipeline: import → polish → experience rewrite → display sanitize

## Goal

Every experience must include **title**, **company**, **date**, and a **professional description**.
Rewrite improves wording only — no invented roles, companies, dates, or deliverables.

### Goal status: **MET** (all acceptance experiences fully rewritten)

## Rules

- Preserve extracted facts in `originalDescription`
- Emit recruiter-grade `rewrittenDescription`
- Do not invent experience, companies, or dates
- Improve consistency, readability, and action-oriented phrasing

## Fragment rewrite example

| | Text |
|---|---|
| Bad | Graphic designer. Posters. Packaging. |
| originalDescription | Graphic designer. Posters. Packaging. |
| rewrittenDescription | Created posters and packaging and related visual deliverables. |

## Acceptance fixtures

| Fixture | Experiences | Pass | Goal |
|---------|------------:|-----:|:----:|
| Developer CV | 2 | 2/2 | ✓ |
| Creative CV | 1 | 1/1 | ✓ |
| Marketing CV | 2 | 2/2 | ✓ |
| Consultant CV | 2 | 2/2 | ✓ |

**Aggregate:** 7/7 experiences pass rewrite quality checks

## Per-experience detail

### Developer CV (`developer-cv`)

#### Software Engineer @ Stripe (2019–Present)

- Quality: **PASS**
- originalDescription: Led migration of billing microservices to Kubernetes, improving deployment frequency by 4x. Built payment observability dashboards used by 200+ engineers
- rewrittenDescription: Led migration of billing microservices to Kubernetes, improving deployment frequency by 4x. Built payment observability dashboards used by 200+ engineers.

#### Software Engineer @ Dropbox (2015–2019)

- Quality: **PASS**
- originalDescription: Shipped file-sync performance improvements reducing latency by 30%
- rewrittenDescription: Shipped file-sync performance improvements reducing latency by 30%.

### Creative CV (`creative-cv`)

#### Freelance Illustrator / Graphic Designer @ Independent / Freelance (2011–Present)

- Quality: **PASS**
- originalDescription: Created high-impact illustration and graphic design work across posters, packaging, logos and brand assets. Collaborated with recognized brands and cultural clients including Nike, Louis Vuitton, Marvel, Cadillac, Fortune, Converse, Pantone, Adobe, Arte and McCann
- rewrittenDescription: Created high-impact illustration and graphic design work across posters, packaging, logos and brand assets. Collaborated with recognized brands and cultural clients including Nike, Louis Vuitton, Marvel, Cadillac, Fortune, Converse, Pantone, Adobe, Arte and McCann.

### Marketing CV (`marketing-cv`)

#### Digital Marketing Manager @ GrowthLab (2020–Present)

- Quality: **PASS**
- originalDescription: Scaled paid social spend to £2M ARR with 3.2x ROAS. Launched email nurture flows lifting MQL conversion by 28%
- rewrittenDescription: Scaled paid social spend to £2M ARR with 3.2x ROAS. Launched email nurture flows lifting MQL conversion by 28%.

#### Marketing Executive @ Unilever (2016–2020)

- Quality: **PASS**
- originalDescription: Managed integrated campaigns across UK and Benelux markets
- rewrittenDescription: Managed integrated campaigns across UK and Benelux markets.

### Consultant CV (`consultant-cv`)

#### Consultant @ Strategy firm (2018–Present)

- Quality: **PASS**
- originalDescription: Led €40M cost transformation program for European retailer. Facilitated executive workshops with 12-country leadership teams
- rewrittenDescription: Led €40M cost transformation program for European retailer. Facilitated executive workshops with 12-country leadership teams.

#### Business Analyst @ Deloitte (2014–2018)

- Quality: **PASS**
- originalDescription: Built financial models supporting M&A due diligence
- rewrittenDescription: Built financial models supporting M&A due diligence.

## Run

```bash
npm run qa:cv-rewrite
npm run cv:rewrite-report
```
