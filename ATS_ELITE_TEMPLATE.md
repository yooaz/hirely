# ATS Elite Template

**Status:** PASS  
**Generated:** 2026-06-11T01:10:43.839Z  
**Template ID:** `ats-elite`  
**Display name:** ATS Elite

## Design brief

Inspired by hiring teams at Google, Stripe, Linear, and Notion.

| Attribute | Value |
|-----------|-------|
| Style | Clean black & white, professional, dense, high readability |
| Tier | Pro |
| ATS safety | High |
| Icons | None |
| Progress bars | None |
| Colored blocks | None |
| Visual gimmicks | None |

## Layout (fixed order)

1. Name
2. Title
3. Contact (compact line)
4. Summary
5. Experience (tight density)
6. Education
7. Skills (comma-separated line)
8. Tools (comma-separated line)
9. Languages (plain lines)

## Implementation

| File | Role |
|------|------|
| `src/ui/templates/cv-templates.js` | `layoutAtsElite`, `stackAtsElite`, `headAtsElite` |
| `src/ui/templates/cv-templates-ats-elite.css` | Black/white dense typography |
| `src/ui/templates/v2/registry.js` | V2 metadata + alias `ats-elite → ats-elite` |
| `src/ui/templates/production-template-ids.mjs` | Featured + display name |
| `index.html` | Stylesheet link, picker, display name |

## QA

```bash
npm run qa:ats-elite-template
```

**Checks:** 40/40 passed

- [x] resolve ats-elite canonical id
- [x] ATS Elite display name
- [x] alias maps to ats-elite not ats
- [x] V2 registry resolves ats-elite
- [x] V2 render layer is ats-elite
- [x] render uses ats-elite classes
- [x] elite header class
- [x] elite main class
- [x] renders name
- [x] renders title
- [x] renders experience company
- [x] renders experience company 2
- [x] renders skills
- [x] renders tools
- [x] renders languages
- [x] no clients/projects in production render
- [x] no gimmick marker: cvSkillChip
- [x] no gimmick marker: cvClientChip
- [x] no gimmick marker: cvProgress
- [x] no gimmick marker: cvTimelineDot
- [x] no gimmick marker: <svg
- [x] no gimmick marker: cvPhoto
- [x] no gimmick marker: cvSection--clients
- [x] no gimmick marker: cvSection--projects
- [x] section present: summary
- [x] section present: experience
- [x] section present: education
- [x] section present: skills
- [x] section present: tools
- [x] section present: languages
- [x] section order: summary → experience → education → skills → tools → languages
- [x] ats-elite CSS block
- [x] gimmick elements hidden in CSS
- [x] index links ats-elite stylesheet
- [x] index features ats-elite
- [x] index display name ATS Elite
- [x] PDF export bytes (142518)
- [x] PDF page count (1)
- [x] A4 layout ran for PDF
- [x] no horizontal crop (794 ≤ 794)

## Section order (render)

`summary → experience → compact → education → skills → tools → languages`
