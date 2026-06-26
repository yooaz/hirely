# Creative Director Template

**Status:** PASS  
**Generated:** 2026-06-11T01:17:27.653Z  
**Template ID:** `creative-director`  
**Display name:** Creative Director

## Design brief

Luxury creative portfolio CV for creative directors, illustrators, designers, and art directors.

Inspired by Kinfolk, Wallpaper Magazine, Aesop, and Apple editorial.

| Attribute | Value |
|-----------|-------|
| Style | Editorial typography · magazine aesthetic · large whitespace |
| Tier | Pro |
| ATS safety | Medium |
| Client logos | Optional (`clientLogos[]` on resume data) |
| Project highlights | Featured editorial cards |

## Layout (fixed order)

1. Large name
2. Professional title
3. Summary lead (optional, in header)
4. Contact (subtle)
5. Selected Clients
6. Selected Projects
7. Experience timeline
8. Skills
9. Tools
10. Education

## Implementation

| File | Role |
|------|------|
| `src/ui/templates/cv-templates.js` | `layoutCreativeDirector`, `stackCreativeDirector`, `headCreativeDirector` |
| `src/ui/templates/cv-templates-creative-director.css` | Kinfolk editorial typography & spacing |
| `src/ui/templates/v2/registry.js` | V2 metadata + alias `creative-director → creative-director` |
| `src/ui/templates/production-template-ids.mjs` | Featured + display name |
| `index.html` | Stylesheet link, picker, display name |

## QA

```bash
npm run qa:creative-director-template
```

**Checks:** 40/40 passed

- [x] resolve creative-director canonical id
- [x] Creative Director display name
- [x] alias maps to creative-director
- [x] creativedirector alias
- [x] V2 registry resolves creative-director
- [x] V2 render layer is creative-director
- [x] director header
- [x] director main
- [x] selected clients title
- [x] selected projects title
- [x] project highlight cards
- [x] experience timeline
- [x] optional client logos render
- [x] renders name
- [x] renders title
- [x] renders client
- [x] renders client 2
- [x] renders project highlight
- [x] renders timeline experience
- [x] renders skills
- [x] renders tools
- [x] renders education
- [x] no client chips
- [x] no skill chips
- [x] section present: clients
- [x] section present: projects
- [x] section present: experience
- [x] section present: skills
- [x] section present: tools
- [x] section present: education
- [x] section order: clients → projects → experience → skills → tools → education
- [x] editorial display font
- [x] client logo styles
- [x] project highlight styles
- [x] index links creative-director stylesheet
- [x] index features creative-director
- [x] PDF export bytes (127567)
- [x] PDF page count (2)
- [x] A4 layout ran for PDF
- [x] no horizontal crop (794 ≤ 794)

## Section order (render)

`clients → projects → experience → skills → tools → education`

## PDF artifact

`tests/output/creative-director/creative-director.pdf`
