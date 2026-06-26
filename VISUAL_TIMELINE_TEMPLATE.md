# Visual Timeline Template

**Status:** PASS  
**Generated:** 2026-06-11T01:29:25.165Z  
**Template ID:** `visual-timeline`  
**Display name:** Visual Timeline

## Design brief

Timeline-based resume with Apple keynote quality and premium minimalism.

| Attribute | Value |
|-----------|-------|
| Main feature | Vertical career timeline |
| Per role | Role · Company · Years · Highlights |
| Connected work | Clients & projects branch from spine |
| Style | Inter · minimal · #0071e3 accent |

## Layout

1. Name · Title · Summary · Contact
2. **Career Timeline** — vertical spine with nodes
3. **Connected Work** — clients & projects with branch connectors
4. Education · Skills · Tools · Languages

## Implementation

| File | Role |
|------|------|
| `src/ui/templates/cv-templates.js` | `layoutVisualTimeline`, `visualTimelineSection`, connected branches |
| `src/ui/templates/cv-templates-visual-timeline.css` | Keynote-style timeline styling |
| `src/ui/templates/v2/registry.js` | V2 metadata |

## QA

```bash
npm run qa:visual-timeline-template
```

**Checks:** 31/31 passed

- [x] resolve visual-timeline id
- [x] Visual Timeline display name
- [x] timeline alias
- [x] V2 registry resolves visual-timeline
- [x] visual timeline header
- [x] career timeline title
- [x] vertical timeline rail
- [x] timeline nodes
- [x] role per position
- [x] company per position
- [x] years per position
- [x] highlights per position
- [x] connected work section
- [x] visual branches
- [x] branch connectors
- [x] renders name
- [x] renders timeline company
- [x] renders timeline company 2
- [x] renders connected client
- [x] renders connected project
- [x] renders skills
- [x] no cvSkillChip
- [x] no cvClientChip
- [x] no cvProgress
- [x] no cvPhoto
- [x] timeline rail CSS
- [x] Apple-style accent
- [x] index links stylesheet
- [x] PDF export bytes (183513)
- [x] PDF page count (2)
- [x] A4 layout ran

## PDF artifact

`tests/output/visual-timeline/visual-timeline.pdf`
