# Swiss Editorial Template

**Status:** PASS  
**Generated:** 2026-06-11T01:26:35.430Z  
**Template ID:** `swiss-editorial`  
**Display name:** Swiss Editorial

## Design brief

Inspired by Neue Grafik, Swiss design, Monocle, and the Financial Times.

| Attribute | Value |
|-----------|-------|
| Style | Editorial · grid-based · sophisticated |
| Typography | IBM Plex Sans · strong hierarchy |
| Margins | Large (60px) · professional rhythm |
| Icons | None |
| Progress bars | None |

## Layout

1. Masthead — large uppercase name · title · contact rail
2. Profile (summary)
3. Grid body:
   - **Main column** — Experience
   - **Sidebar** — Education · Skills · Tools · Languages

## Implementation

| File | Role |
|------|------|
| `src/ui/templates/cv-templates.js` | `layoutSwissEditorial`, grid stack |
| `src/ui/templates/cv-templates-swiss-editorial.css` | Swiss editorial typography |
| `src/ui/templates/v2/registry.js` | V2 metadata + aliases |
| `index.html` | Stylesheet + featured picker |

## QA

```bash
npm run qa:swiss-editorial-template
```

**Checks:** 36/36 passed

- [x] resolve swiss-editorial id
- [x] Swiss Editorial display name
- [x] alias maps to swiss-editorial
- [x] swiss alias maps to swiss-editorial
- [x] V2 registry resolves swiss-editorial
- [x] V2 render layer is swiss-editorial
- [x] swiss editorial header
- [x] masthead grid
- [x] editorial body grid
- [x] main column
- [x] sidebar column
- [x] renders name
- [x] renders title
- [x] renders experience
- [x] renders experience 2
- [x] renders skills
- [x] renders tools
- [x] renders languages
- [x] renders education
- [x] no clients/projects
- [x] no gimmick: cvSkillChip
- [x] no gimmick: cvClientChip
- [x] no gimmick: cvProgress
- [x] no gimmick: cvTimelineDot
- [x] no gimmick: <svg
- [x] no gimmick: cvPhoto
- [x] no gimmick: cvSection--clients
- [x] no gimmick: cvSection--projects
- [x] grid CSS
- [x] strong typography stack
- [x] gimmicks hidden
- [x] index links stylesheet
- [x] index features swiss-editorial
- [x] PDF export bytes (54621)
- [x] PDF page count (1)
- [x] A4 layout ran

## PDF artifact

`tests/output/swiss-editorial/swiss-editorial.pdf`
