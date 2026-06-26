# COVER LETTER ENGINE REPORT (P4)

Generated: 2026-06-08T17:39:28.682Z
Engine: `HIRELY_COVER_LETTER_ENGINE_P4`

## Status

| Gate | Result |
|------|--------|
| Production tones (Professional / Creative / Executive) | PASS |
| Letter visible in `#coverLetterPreview` | PASS (export step auto-opens workspace) |
| PDF export (`downloadLetterPdf` + html2pdf) | PASS (browser; Node validates text readiness) |
| No invented experience | PASS (`auditCoverLetterFacts`) |
| `finalResumeData` input path | PASS |

## Inputs

| Field | Required | Source |
|-------|----------|--------|
| Candidate data | yes | `finalResumeData` → `resumeDataToLetterProfile()` |
| Company | no | `#letterTargetCompany` / export form |
| Job title | no* | `#letterTargetRole` — generic letter if empty |
| Tone | no | `professional` (default), `creative`, `executive` |

*Validation requires name, title, experience, and skills from resume — not job title.

## Tones

| Tone | Register | Best for |
|------|----------|----------|
| **Professional** | Classic, clear | Agencies, most employers |
| **Creative** | Portfolio-forward | Design, illustration, art direction |
| **Executive** | Leadership, strategic | Senior / director-level roles |

Legacy aliases: `formal` → professional, `corporate` / `ats` → executive.

## Pipeline

```
finalResumeData + jobTitle + companyName + tone
    │
    ├─ finalResumeDataToResumeShape()
    ├─ resumeDataToLetterProfile()  (preserves structured experiences)
    ├─ validateCoverLetterInputs()
    └─ buildCoverLetterDraft() → renderCoverLetter() → text + html
            └─ letter-exporter.downloadLetterPdf()
```

## Tone samples (English · Adobe · Senior Graphic Designer)

### Professional

- Length: **626** chars
- Experience lines used: 1
- Fact audit: **PASS**
- PDF text ready: **PASS** (626 chars)

```
Dear Hiring Manager, I am writing to apply for the Senior Graphic Designer position at Adobe. As a Graphic Designer & Illustrator, I would welcome the opportunity to contribute my experience to your team. Creative professional specializing in illustration, graphic design and visual storytelling Relevant experience includes: • Freelance — Independent / Freelance — 2011–2014 Core skills: Illustration · Graphic Design · Brand Identity · Art Direction · Photoshop · Illustrator I …
```

### Creative

- Length: **626** chars
- Experience lines used: 1
- Fact audit: **PASS**
- PDF text ready: **PASS** (626 chars)

```
Dear Hiring Manager, As a Graphic Designer & Illustrator, I am excited to apply for the Senior Graphic Designer role at Adobe and bring distinctive work and proven outcomes to your team. Creative professional specializing in illustration, graphic design and visual storytelling Selected work: → Freelance — Independent / Freelance — 2011–2014 Expertise: Illustration · Graphic Design · Brand Identity · Art Direction · Photoshop · Illustrator Selected clients / brands: Nike · Lou…
```

### Executive

- Length: **586** chars
- Experience lines used: 1
- Fact audit: **PASS**
- PDF text ready: **PASS** (586 chars)

```
Dear Hiring Manager, I am writing regarding the Senior Graphic Designer opportunity at Adobe. As a Graphic Designer & Illustrator, I bring strategic direction and disciplined delivery aligned with your organization's priorities. Leadership and delivery highlights: - Freelance — Independent / Freelance — 2011–2014 Core capabilities: Illustration, Graphic Design, Brand Identity, Art Direction, Photoshop, Illustrator, InDesign, Figma I would welcome a conversation about how my e…
```

## finalResumeData path

- Generated: yes
- Length: 626 chars

## Module map

| File | Role |
|------|------|
| `src/core/export/cover-letter-engine.js` | Draft builder, tones, validation, fact audit |
| `src/core/export/cover-letter-renderer.js` | HTML preview renderer |
| `src/core/export/letter-exporter.js` | TXT / clipboard / PDF export |
| `index.html` | `#coverLetterWorkspace`, tone toggles, export step auto-generate |
| `src/tests/qa-cover-letter-engine.mjs` | P4 acceptance QA |

## Verification

```bash
npm run qa:cover-letter-engine
npm run cover-letter-engine-report
npm run qa:letter-pipeline
```
