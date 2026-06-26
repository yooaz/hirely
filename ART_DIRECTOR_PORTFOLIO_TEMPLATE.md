# Art Director Portfolio Template

**Status:** PASS  
**Generated:** 2026-06-11T01:35:54.535Z  
**Template ID:** `art-director-portfolio`  
**Display name:** Art Director Portfolio

## Design brief

Luxury portfolio document for creative industry art directors — not a classic CV.

| Attribute | Value |
|-----------|-------|
| Audience | Creative industry · luxury campaigns |
| Hero | Dark masthead · name · title · summary · contact |
| Body | Cream editorial canvas · bronze accent |
| Typography | Instrument Serif + DM Sans |
| Excluded | Skill chips · client chips · progress bars · photo |

## Section order

1. **Hero** — identity + summary + contact
2. **Selected Clients**
3. **Selected Projects**
4. **Awards**
5. **Press** (publications + press)
6. **Experience** (airy)
7. **Education**
8. **Portfolio Links** — Behance · Instagram · Dribbble · Website

## Implementation

| File | Role |
|------|------|
| `src/ui/templates/cv-templates.js` | `layoutArtDirectorPortfolio`, `headArtDirectorPortfolio`, awards/press/links sections |
| `src/ui/templates/cv-templates-art-director-portfolio.css` | Luxury portfolio styling |
| `src/ui/templates/v2/registry.js` | V2 metadata + aliases |

## QA

```bash
npm run qa:art-director-portfolio-template
```

**Checks:** 55/55 passed

- [x] resolve art-director-portfolio id
- [x] Art Director Portfolio display name
- [x] artdirector alias
- [x] art-director alias
- [x] V2 registry resolves art-director-portfolio
- [x] V2 render layer is art-director-portfolio
- [x] hero header
- [x] hero section
- [x] portfolio main
- [x] selected clients title
- [x] selected projects title
- [x] client grid
- [x] project highlights
- [x] awards section
- [x] press section
- [x] award entries
- [x] press entries
- [x] portfolio links section
- [x] portfolio link rows
- [x] portfolio link labels
- [x] renders name
- [x] renders title
- [x] renders client
- [x] renders project
- [x] renders award
- [x] renders publication
- [x] renders press
- [x] renders experience
- [x] renders education
- [x] renders Behance label
- [x] renders Instagram label
- [x] renders Dribbble label
- [x] renders Website label
- [x] no skills section (portfolio doc)
- [x] no tools section (portfolio doc)
- [x] no cvClientChip
- [x] no cvSkillChip
- [x] no cvProgress
- [x] no cvPhoto
- [x] section present: clients
- [x] section present: projects
- [x] section present: awards
- [x] section present: press
- [x] section present: experience
- [x] section present: education
- [x] section present: portfolio
- [x] section order: clients → projects → awards → press → experience → education → portfolio
- [x] hero CSS
- [x] luxury display font
- [x] bronze accent
- [x] portfolio link styles
- [x] index links stylesheet
- [x] PDF export bytes (133764)
- [x] PDF page count (2)
- [x] A4 layout ran

## PDF artifact

`tests/output/art-director-portfolio/art-director-portfolio.pdf`
