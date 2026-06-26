# CREATIVE TEMPLATE SPEC

Generated: 2026-06-07T23:11:51.190Z
Engine: `HIRELY H4 — Creative Designer Template`

## Purpose

Dedicated magazine-layout CV for **designers**, **illustrators**, **art directors**, and **creative directors**. Portfolio-forward section order with strong typography while preserving ATS-parseable plain text.

## Canonical identity

| Field | Value |
|-------|-------|
| Template ID | `creative` |
| Render layer | `creativedirector` |
| CSS class | `template-creative` |
| Layout family | magazine |
| ATS safety | medium |
| Creative level | 4/5 |

## Target roles

- Graphic designer
- Illustrator
- Art director
- Creative director
- Brand / visual designer (portfolio-forward)

## Feature matrix

| Feature | Implementation | ATS note |
|---------|----------------|----------|
| Strong typography | DM Sans display · 26pt name · uppercase role · 3px header rule | Text remains selectable plain text |
| Project highlights | `cvSection--projects` · left-border entries | Each project is a `<p>` node |
| Client highlights | `cvSection--clients` · joined client line | Plain-text brand names |
| Software section | `cvSection--software` from `resumeData.tools` | Label: Software (or localized Tools) |
| Portfolio links | `cvSection--portfolio` from `portfolioLinks` + `identity.website` | URLs as text, no buttons |
| Skills footer | `cvMetaFooter` skills + languages (tools omitted — shown in Software) | Keyword-friendly chip-free lines |

## Section order (portfolio-first)

```
Header (name, title, summary, contact)
clients
projects
portfolio
software
experience
compact
education
```

Expected stack (`stackCreativeFirst`):

1. Clients
2. Projects / Selected Work
3. Exhibitions (if present)
4. Awards (if present)
5. Publications (if present)
6. Portfolio links
7. Software
8. Experience
9. Education
10. Skills · Languages (footer meta)

## Data contract (`resumeData` → view-model)

| resumeData field | Render section |
|------------------|----------------|
| `clients[]` | Client highlights |
| `projects[]` | Project highlights |
| `portfolioLinks[]` + `identity.website` | Portfolio |
| `tools[]` | Software |
| `experiences[]` | Experience |
| `skills[]` | Skills (footer) |
| `languages[]` | Languages (footer) |
| `exhibitions[]`, `awards[]`, `publications[]` | Optional creative blocks |

**No parser logic in templates.** Data flows through `resumeDataToTemplateView()` only.

## Typography tokens

| Token | Value |
|-------|-------|
| Display font | DM Sans, Inter fallback |
| Name size | 26pt / weight 700 / −0.04em tracking |
| Role | 9.5pt uppercase / 0.08em tracking |
| Section titles | 7.5pt uppercase / 0.14em / 2px ink rule |
| Body | 10.5pt / line-height 1.56 |
| Ink | `#09090b` |

## ATS readability rules

| Rule | Status |
|------|--------|
| Semantic `<h3>` section titles | pass |
| No image-only content blocks | pass |
| Plain-text clients extractable | pass |
| Plain-text software extractable | pass |
| Plain-text portfolio URLs | pass |
| Plain-text experience | pass |
| Single-column main flow | pass (magazine stack, no hidden columns) |
| Sample plain-text length | 730 chars |

## Page policy

| Constraint | Value |
|------------|------:|
| Format | A4 |
| Canvas | 794×1123 px |
| Priority | **1 page** |
| Maximum | **2 pages** |

## Legacy aliases → `creative`

- `creativedirector` · `creative-director` · `artdirector` · `pentagram` · `motiondesigner`

## Module map

| File | Role |
|------|------|
| `src/ui/templates/cv-templates.js` | `layoutCreativeMagazine`, `stackCreativeFirst`, section renderers |
| `src/ui/templates/cv-templates-professional.css` | Creative designer typography + section styles |
| `src/ui/templates/v2/registry.js` | V2 `creative` registry entry |
| `src/ui/templates/v2/view-model.js` | `resumeData` → render DTO |
| `src/tests/qa-creative-template.mjs` | H4 acceptance QA |

## Verification

```bash
npm run qa:creative-template
npm run creative:template-spec-report
npm run qa:template-system-v2
```
