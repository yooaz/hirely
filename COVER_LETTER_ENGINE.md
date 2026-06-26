# COVER LETTER ENGINE

Generated: 2026-06-07T23:18:03.779Z
Engine: `HIRELY_COVER_LETTER_ENGINE`

## Purpose

Deterministic cover letter generator from **`resumeData`** facts only — no invented employers, skills, or achievements.

## Input contract

| Field | Required | Source |
|-------|----------|--------|
| `resumeData` | yes | Post-import canonical resume |
| `jobTitle` | yes | User / export form (`letterTargetRole`) |
| `companyName` | no | User / export form (`letterTargetCompany`) |
| `mode` | no | Default `formal` |
| `lang` | no | `fr` or `en` |

## Output

| Field | Description |
|-------|-------------|
| `text` | Plain-text cover letter (editable) |
| `html` | Preview HTML for studio panel |
| `meta` | `mode`, `jobTitle`, `companyName`, `lang`, counts |

## Modes

| Mode | Tone | Best for |
|------|------|----------|
| **Formal** | Classic professional | Agencies, traditional employers |
| **Creative** | Portfolio-forward, passion-led | Design, illustration, art direction |
| **Startup** | Concise, energetic, impact-first | Scale-ups, product teams |
| **Corporate** | Structured, enterprise register | Large companies, consulting |

Legacy aliases: `professional` → `formal`, `ats` → `corporate`.

## Pipeline

```
resumeData + jobTitle + companyName + mode
    │
    ├─ resumeDataToLetterProfile()
    ├─ validateCoverLetterInputs()
    └─ buildCoverLetterDraft()
            └─ renderCoverLetter() → text + html
```

## Mode samples (English · Adobe · Senior Graphic Designer)

### Formal

- Length: **779** chars
- Experience lines: 2
- Skills listed: 6

```
Dear Hiring Manager, I am writing to apply for the Senior Graphic Designer position at Adobe. As a Graphic Designer & Illustrator, I would welcome the opportunity to contribute my experience to your team. Creative professional specializing in illustration, graphic design and visual storytelling Relevant experience includes: • Freelance Illustrator / Graphic Designer — Independent — 2011–2022: Posters, packaging, logos for global brands. • Designer — McCann G. Agency — 2011–2014: Campaign creativ…
```

### Creative

- Length: **779** chars
- Experience lines: 2
- Skills listed: 6

```
Dear Hiring Manager, As a Graphic Designer & Illustrator, I am excited to apply for the Senior Graphic Designer role at Adobe and bring distinctive work and proven outcomes to your team. Creative professional specializing in illustration, graphic design and visual storytelling Selected work: → Freelance Illustrator / Graphic Designer — Independent — 2011–2022: Posters, packaging, logos for global brands. → Designer — McCann G. Agency — 2011–2014: Campaign creative for international clients. Expe…
```

### Startup

- Length: **639** chars
- Experience lines: 2
- Skills listed: 5

```
Hello, I'm applying for the Senior Graphic Designer role at Adobe. As a Graphic Designer & Illustrator, I thrive in fast-moving teams and focus on shipping measurable impact. Creative professional specializing in illustration, graphic design and visual storytelling Recent impact: • Freelance Illustrator / Graphic Designer — Independent — 2011–2022: Posters, packaging, logos for global brands. • Designer — McCann G. Agency — 2011–2014: Campaign creative for international clients. Skills & tools: …
```

### Corporate

- Length: **719** chars
- Experience lines: 2
- Skills listed: 8

```
Dear Hiring Manager, I am writing to express my interest in the Senior Graphic Designer position at Adobe. My background as a Graphic Designer & Illustrator aligns with the standards of rigor and collaboration expected in a structured organization. Relevant professional experience: - Freelance Illustrator / Graphic Designer — Independent — 2011–2022: Posters, packaging, logos for global brands. - Designer — McCann G. Agency — 2011–2014: Campaign creative for international clients. Skills: Illust…
```

## Validation gates

Generation blocked unless:

- Valid **name** and **title**
- At least one **experience** entry
- At least one **skill** or **tool**
- **jobTitle** provided

## Module map

| File | Role |
|------|------|
| `src/core/export/cover-letter-engine.js` | Draft builder + validation |
| `src/core/export/cover-letter-renderer.js` | HTML preview renderer |
| `src/core/export/letter-ai-generation.js` | Optional API path + local fallback |
| `src/core/export/letter-exporter.js` | TXT / clipboard export |
| `src/tests/qa-cover-letter-engine.mjs` | H6 acceptance QA |

## Verification

```bash
npm run qa:cover-letter-engine
npm run cover-letter:engine-report
npm run qa:letter-pipeline
```
