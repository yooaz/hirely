# Executive Luxury Template

**Status:** PASS  
**Generated:** 2026-06-11T01:22:45.728Z  
**Template ID:** `executive-luxury`  
**Display name:** Executive Luxury

## Design brief

Inspired by McKinsey, BCG, Goldman Sachs, and Airbnb executives.

| Attribute | Value |
|-----------|-------|
| Style | Luxury minimalism · strong hierarchy |
| Typography | Source Serif 4 headings · IBM Plex Sans body |
| Tier | Pro |
| ATS safety | High |
| Focus | Impact — result · revenue · team · achievement |

## Layout (fixed order)

1. Large name + professional title + contact
2. Executive Summary
3. Leadership Experience (impact metrics per role)
4. Achievements
5. Education
6. Skills
7. Languages

## Impact fields (per experience)

Explicit on `experiences[]`:

- `result`
- `revenue`
- `teamSize` (or `team`)
- `achievement`
- `impact: { result, revenue, teamSize, achievement }`

Bullets are used as fallback inference when explicit fields are absent.

## Implementation

| File | Role |
|------|------|
| `src/ui/templates/cv-templates.js` | `layoutExecutiveLuxury`, impact rendering |
| `src/ui/templates/cv-templates-executive-luxury.css` | Luxury minimal typography |
| `src/ui/templates/v2/registry.js` | V2 metadata |
| `index.html` | Stylesheet + featured picker |

## QA

```bash
npm run qa:executive-luxury-template
```

**Checks:** 34/34 passed

- [x] resolve executive-luxury id
- [x] Executive Luxury display name
- [x] alias maps to executive-luxury
- [x] V2 registry resolves executive-luxury
- [x] executive luxury header
- [x] executive summary title
- [x] leadership experience title
- [x] achievements section
- [x] impact metrics row
- [x] impact labels
- [x] renders name
- [x] renders title
- [x] renders leadership role
- [x] renders leadership role 2
- [x] renders revenue impact
- [x] renders team size
- [x] renders result
- [x] renders achievements
- [x] renders education
- [x] renders skills
- [x] renders languages
- [x] no clients/projects
- [x] no cvClientChip
- [x] no cvSkillChip
- [x] no cvSection--clients
- [x] no cvSection--projects
- [x] section order: summary → experience → achievements → education → skills → languages
- [x] impact grid CSS
- [x] elegant heading font
- [x] index links stylesheet
- [x] index features executive-luxury
- [x] PDF export bytes (174765)
- [x] PDF page count (2)
- [x] A4 layout ran

## Section order

`summary → experience → achievements → education → skills → languages`

## PDF artifact

`tests/output/executive-luxury/executive-luxury.pdf`
