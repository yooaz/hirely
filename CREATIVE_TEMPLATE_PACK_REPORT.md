# HIRELY P1 — Creative Template Pack

**Result:** PASS
**Generated:** 2026-06-10T16:04:47.624Z

## Pack lineup (10 templates)

| # | Template | ID | Layout | Typography |
|---|----------|-----|--------|------------|
| 1 | ATS Clean | `ats` | single-column | IBM Plex Sans |
| 2 | ATS Executive | `ats-executive` | 38-62-split | Libre Baskerville + Inter |
| 3 | Portfolio Artist | `portfolio-artist` | hero-masonry | Instrument Serif + DM Sans |
| 4 | Behance Creative | `behance-creative` | accent-rail-cards | DM Sans |
| 5 | Editorial Magazine | `editorial-magazine` | masthead-3col | Playfair Display + Source Serif |
| 6 | Luxury Fashion | `luxury-fashion` | narrow-centered | Cormorant Garamond |
| 7 | Agency Designer | `agency-designer` | dark-header-28-72 | Helvetica Neue + Inter |
| 8 | Modern Minimal | `modern-minimal` | single-whitespace | Inter |
| 9 | Visual Timeline | `visual-timeline` | timeline-rail | JetBrains Mono + Inter |
| 10 | Creative Director | `creative-director` | stacked-asymmetric | Playfair Display + DM Sans |

## Requirements

- **Not ATS clones** — each skin has its own grid, hierarchy, typography, and section order.
- **No content loss** — all templates score 100% on `scoreAllTemplatesLock` against the same `finalResumeData`.
- **Same data** — render-only; one canonical `finalResumeData` feeds every template.

## Content visibility (lock scores)

| Template | Score | Pass |
|----------|-------|------|
| ATS Clean | 100% | yes |
| ATS Executive | 100% | yes |
| Portfolio Artist | 100% | yes |
| Behance Creative | 100% | yes |
| Editorial Magazine | 100% | yes |
| Luxury Fashion | 100% | yes |
| Agency Designer | 100% | yes |
| Modern Minimal | 100% | yes |
| Visual Timeline | 100% | yes |
| Creative Director | 100% | yes |

## Layout signatures

Each template exposes a unique layout class (no duplicate shells):

- **ATS Clean** → `cvLayout-h20-ats`
- **ATS Executive** → `cvLayout-ats-exec`
- **Portfolio Artist** → `cvLayout-portfolio`
- **Behance Creative** → `cvLayout-behance`
- **Editorial Magazine** → `cvLayout-magazine-3col`
- **Luxury Fashion** → `cvLayout-luxury-fashion`
- **Agency Designer** → `cvLayout-agency-designer`
- **Modern Minimal** → `cvLayout-h20-modern-minimal`
- **Visual Timeline** → `cvLayout-timeline`
- **Creative Director** → `cvLayout-director`

## Files

- `src/ui/templates/cv-templates.js` — layout functions + template registry
- `src/ui/templates/cv-templates-pack.css` — pack typography + grid styles
- `src/ui/templates/production-template-ids.mjs` — production IDs + display names
- `src/ui/templates/creative-template-pack.mjs` — pack contract metadata

## Acceptance

**PASS** — 10 real premium templates with distinct layouts; no content loss on shared finalResumeData.

## Run

```bash
npm run test:creative-template-pack
```
