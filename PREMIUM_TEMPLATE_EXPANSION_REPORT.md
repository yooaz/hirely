# HIRELY P1 — Premium Template Expansion

**Result:** PASS
**Generated:** 2026-06-10T16:54:16.544Z

## Problem

Premium templates felt too similar — same grids, typography, and section order. Creative CVs need distinct visual identities while rendering **all** content (clients, projects, portfolio links, experience, education, skills).

## Expansion lineup (10 templates)

| # | Template | ID | Grid | Typography |
|---|----------|-----|------|------------|
| 1 | Portfolio Artist | `portfolio-artist` | hero-masonry | Instrument Serif + DM Sans |
| 2 | Creative Director | `creative-director` | stacked-asymmetric | Playfair Display + DM Sans |
| 3 | Luxury Fashion | `luxury-fashion` | narrow-centered | Cormorant Garamond |
| 4 | Behance Showcase | `behance-showcase` | accent-rail-cards | DM Sans |
| 5 | Magazine Editorial | `magazine-editorial` | masthead-3col | Playfair Display + Source Serif |
| 6 | Agency Designer | `agency-designer` | dark-header-28-72 | Helvetica Neue + Inter |
| 7 | Visual Timeline | `visual-timeline` | timeline-rail | JetBrains Mono + Inter |
| 8 | Art Director | `art-director` | split-meta-dominant | Archivo + Inter |
| 9 | Illustrator Portfolio | `illustrator-portfolio` | centered-warm | Fraunces + Nunito |
| 10 | Minimal Swiss | `minimal-swiss` | swiss-grid-rules | Helvetica Neue |

## Requirements

Each template must:
- Render **all populated content** (identity, summary, experience, education, skills, tools, languages)
- Render **clients**, **projects**, and **portfolio links** sections
- Support **multiple pages** via `cv-a4-pages.js` pagination on `.cvInner`
- Use a **distinct layout class** and **pack CSS skin** (`cv-templates-pack.css`)

## Layout differentiation

| Template | Layout signature | Distinctive trait |
|----------|------------------|-------------------|
| Portfolio Artist | `cvLayout-portfolio` | Hero clients + projects-first |
| Creative Director | `cvLayout-director` | Oversized name + asymmetric grid |
| Luxury Fashion | `cvLayout-luxury-fashion` | Narrow centered serif |
| Behance Showcase | `cvLayout-behance` | Cobalt rail + card sections |
| Magazine Editorial | `cvLayout-magazine-3col` | 3-column masthead |
| Agency Designer | `cvLayout-agency-designer` | Dark header band + skills rail |
| Visual Timeline | `cvLayout-timeline` | Chrono left rail |
| Art Director | `cvLayout-art-director` | Split meta + creative stack |
| Illustrator Portfolio | `cvLayout-illustrator` | Warm paper + links-first |
| Minimal Swiss | `cvLayout-swiss` | Helvetica grid + red accent |

## Legacy aliases

| Legacy ID | Resolves to |
|-----------|-------------|
| `behance-creative` | `behance-showcase` |
| `editorial-magazine` | `magazine-editorial` |
| `modern-minimal` | `minimal-swiss` |
| `swiss` | `minimal-swiss` |
| `artdirector` | `art-director` |

## Multipage

Templates output a single `.cvInner` document. `HirelyA4Pages.layoutCvA4Pages()` splits content into `.cvA4Sheet` pages (794×1123px) with `page-break` rules from `cv-a4-pages.css` and `cv-pdf-export.css`.

## Acceptance

**PASS** — Ten visually distinct premium templates render full creative content including clients, projects, and portfolio links.

## Run

```bash
npm run test:premium-template-expansion
```

## Content lock scores

| Template | Score | Pass |
|----------|------:|:----:|
| Portfolio Artist | 100% | ✓ |
| Creative Director | 100% | ✓ |
| Luxury Fashion | 100% | ✓ |
| Behance Showcase | 100% | ✓ |
| Magazine Editorial | 100% | ✓ |
| Agency Designer | 100% | ✓ |
| Visual Timeline | 100% | ✓ |
| Art Director | 100% | ✓ |
| Illustrator Portfolio | 100% | ✓ |
| Minimal Swiss | 100% | ✓ |
