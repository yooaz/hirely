# HIRELY P1 — Projects Extraction

**Result:** PASS
**Generated:** 2026-06-10T16:47:30.022Z

## Problem

Creative CVs list campaign and poster work as unstructured lines. The parser failed to extract project title, client, year, and role into `resume.projects[]`.

## PROJECTS_ENGINE

Engine: `PROJECTS_ENGINE` · wired in `section-engine-v2.js` (creative/designer mode) and `polishResumeOutput`.

Detects per project:
- **Title** — e.g. God of War Poster, Max Campaign
- **Client** — PlayStation, Adobe, Marvel, Visa (entity dictionary + anchors)
- **Year** — `2021`, `2023`, …
- **Role** — Art Director, Lead Designer, … (from line or identity title)

Stores formatted entries in `structured.projects[]` → `resumeData.projects[]` → `cvData.projects[]` → template `cvSection--projects`.

Display format: `Title — Client · Year · Role`

### Anchor examples

| Source line | Client | Title |
|-------------|--------|-------|
| PlayStation God of War Poster | PlayStation | God of War Poster |
| Adobe Max Campaign | Adobe | Max Campaign |
| Marvel Black Panther Poster | Marvel | Black Panther Poster |
| Visa FIFA Campaign | Visa | FIFA Campaign |

## Fixture audits

| Fixture | projects[] | cvData.projects | Anchor recall | Template section |
|---------|----------:|----------------:|--------------:|:----------------:|
| projects-creative-rich | 8 | 8 | 100% | ✓ |
| designer-cv-rich | 3 | 3 | 0% | ✓ |

### projects-creative-rich

**resume.projects[]:**
- God of War Poster — PlayStation
- Max Campaign — Adobe · 2023 · Art Director
- Black Panther Poster — Marvel · 2021
- FIFA Campaign — Visa · 2022 · Lead Designer
- packaging and retail visuals — Nike
- Max Campaign — Adobe
- Black Panther Poster — Marvel
- FIFA Campaign — Visa

| Expected in source | Detected |
|--------------------|----------|
| PlayStation God of War Poster | ✓ |
| Adobe Max Campaign | ✓ |
| Marvel Black Panther Poster | ✓ |
| Visa FIFA Campaign | ✓ |

### designer-cv-rich

**resume.projects[]:**
- packaging and retail visuals — Nike
- UI design system — Adobe
- D&AD Pencil — Brand identity · 2022

| Expected in source | Detected |
|--------------------|----------|

## Rules

- Project lines must never be discarded as random unsorted text when they match poster/campaign patterns.
- Client names resolve via `clients.json` and creative client anchors (PlayStation, Visa, …).
- Experience job rows with date ranges are never promoted to projects.
- Templates render `cvSection--projects` on creative layouts (`portfolio-artist`, `behance-creative`, etc.).

## Acceptance

**PASS** — Creative CVs expose structured project work in `resume.projects[]` and templates.

## Run

```bash
npm run test:projects-engine
```
