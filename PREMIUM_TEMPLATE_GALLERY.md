# Premium Template Gallery

**Status:** PASS  
**Generated:** 2026-06-11T01:40:00.426Z  
**Goal:** Apple Keynote theme-picker experience for template selection

## Problem

Users could not tell which premium template matched their hiring context. The old picker showed tiny thumbnails and a single tag line.

## Solution

Premium gallery with:

- **Large previews** — 148px mini renders in a responsive grid
- **Use-case filters** — ATS · Creative · Executive · Portfolio · Tech · Consulting
- **Card metadata** — Hiring success · Best for · Visual style
- **Instant switching** — one click updates live A4 preview
- **Keynote transitions** — blur/fade/scale on CV preview swap

## Use-case filters

| Filter | Purpose |
|--------|---------|
| All | Full premium catalog |
| ATS | Parse-safe corporate applications |
| Creative | Art direction · design · culture |
| Executive | Leadership · C-suite · consulting firms |
| Portfolio | Behance · Dribbble · campaign books |
| Tech | Engineering · product · structured profiles |
| Consulting | McKinsey · BCG · Swiss editorial |

## Template catalog

| Template | Use cases | Hiring success | Visual style |
|----------|-----------|----------------|--------------|
| `ats` | ats, tech | 98% ATS readability | System sans · pure black & white |
| `ats-elite` | ats, tech | 96% parse success · dense hire | Google · Stripe · Linear density |
| `executive-luxury` | executive, consulting | C-suite shortlist ready | McKinsey minimal · impact metrics |
| `swiss-editorial` | consulting, creative | Editorial credibility · 94% | Neue Grafik grid · Monocle rhythm |
| `creative-director` | creative, portfolio | Creative director shortlist | Kinfolk · Wallpaper · luxury whitespace |
| `creative-portfolio` | portfolio, creative | Portfolio-first creative hire | Bold type · clients & projects lead |
| `editorial-magazine` | creative, portfolio | Culture & luxury editorial pick | Magazine spread · serif headlines |
| `luxury-minimal` | consulting, executive | Senior profile · refined clarity | Stone palette · centered serif |
| `agency-designer` | creative, consulting | Agency studio interview rate | Studio grid · brand-forward layout |
| `visual-timeline` | portfolio, tech | Career story · keynote clarity | Apple keynote timeline · blue accent |
| `tech-structured` | tech, ats | 92% engineering screen pass | Dark skills rail · mono identity |
| `art-director-portfolio` | portfolio, creative | Luxury campaign portfolio pick | Hero masthead · bronze editorial |

## Implementation

| File | Role |
|------|------|
| `src/ui/templates/premium-template-gallery.mjs` | Use-case catalog + filter helpers |
| `src/ui/templates/premium-template-gallery.css` | Keynote-style grid + animations |
| `index.html` | Gallery UI, filters, `switchTemplateAnimated` |

## QA

```bash
npm run qa:premium-template-gallery
```

**Checks:** 81/81 passed

- [x] index links gallery stylesheet
- [x] index imports gallery module
- [x] premium gallery container
- [x] use-case filter tabs
- [x] large preview grid
- [x] animated template switching
- [x] gallery filter state
- [x] premium template cards
- [x] hiring success on cards
- [x] visual style on cards
- [x] keynote preview transition out
- [x] keynote preview transition in
- [x] gallery grid CSS
- [x] large preview CSS
- [x] use-case filter CSS
- [x] keynote animation keyframes
- [x] card switch pulse
- [x] use case tabs include All + 6 categories
- [x] use case tab: ats
- [x] use case tab: creative
- [x] use case tab: executive
- [x] use case tab: portfolio
- [x] use case tab: tech
- [x] use case tab: consulting
- [x] gallery meta for ats
- [x] ats has useCases
- [x] ats hiring success copy
- [x] ats visual style copy
- [x] gallery meta for ats-elite
- [x] ats-elite has useCases
- [x] ats-elite hiring success copy
- [x] ats-elite visual style copy
- [x] gallery meta for executive-luxury
- [x] executive-luxury has useCases
- [x] executive-luxury hiring success copy
- [x] executive-luxury visual style copy
- [x] gallery meta for swiss-editorial
- [x] swiss-editorial has useCases
- [x] swiss-editorial hiring success copy
- [x] swiss-editorial visual style copy
- [x] gallery meta for creative-director
- [x] creative-director has useCases
- [x] creative-director hiring success copy
- [x] creative-director visual style copy
- [x] gallery meta for creative-portfolio
- [x] creative-portfolio has useCases
- [x] creative-portfolio hiring success copy
- [x] creative-portfolio visual style copy
- [x] gallery meta for editorial-magazine
- [x] editorial-magazine has useCases
- [x] editorial-magazine hiring success copy
- [x] editorial-magazine visual style copy
- [x] gallery meta for luxury-minimal
- [x] luxury-minimal has useCases
- [x] luxury-minimal hiring success copy
- [x] luxury-minimal visual style copy
- [x] gallery meta for agency-designer
- [x] agency-designer has useCases
- [x] agency-designer hiring success copy
- [x] agency-designer visual style copy
- [x] gallery meta for visual-timeline
- [x] visual-timeline has useCases
- [x] visual-timeline hiring success copy
- [x] visual-timeline visual style copy
- [x] gallery meta for tech-structured
- [x] tech-structured has useCases
- [x] tech-structured hiring success copy
- [x] tech-structured visual style copy
- [x] gallery meta for art-director-portfolio
- [x] art-director-portfolio has useCases
- [x] art-director-portfolio hiring success copy
- [x] art-director-portfolio visual style copy
- [x] ATS filter shows 3 templates
- [x] Creative filter shows 6 templates
- [x] all filter matches every template
- [x] ATS not in portfolio-only filter
- [x] card exposes hiringSuccess
- [x] card exposes visualStyle
- [x] card exposes bestFor
- [x] French use-case label
- [x] English use-case label

## Filter coverage

```json
{
  "ats": 3,
  "creative": 6,
  "executive": 2,
  "portfolio": 5,
  "tech": 4,
  "consulting": 4
}
```
