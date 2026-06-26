# Real Template System Report (H20)

**Verdict:** PASS

## Goal

Five production templates that a recruiter can identify in **under 2 seconds** — each with a distinct grid, hierarchy, typography, section layout, spacing system, and PDF output.

## Production templates

| Template | Grid | Typography | Section layout | Spacing | PDF signature |
|----------|------|------------|----------------|---------|---------------|
| ATS Professional | single-column | IBM Plex Sans | linear-all-sections | tight-14px | h20-ats-main-padding |
| Creative Portfolio | magazine-split-head | Playfair Display + DM Sans | magazine-stack | airy-20px | h20-creative-split-head |
| Executive | centered-single | Cormorant Garamond + Source Serif | centered-narrow-column | executive-22px | h20-executive-stone-bg |
| Tech Resume | 30-70-dark-rail | JetBrains Mono + DM Sans | skills-rail-experience-main | tech-16px | h20-tech-dark-rail |
| Modern Editorial | 34-66-asymmetric | Helvetica Neue + Georgia | meta-rail-experience-main | editorial-24px | h20-editorial-asymmetric |

## Differentiation axes

| Axis | Implementation |
|------|----------------|
| Grid | Single (ATS) · centered narrow (Executive) · magazine split (Creative) · 34/66 editorial · 30/70 tech rail |
| Hierarchy | Dense scan · serif authority · clients/projects first · Swiss meta rail · mono name + skills sidebar |
| Typography | IBM Plex · Cormorant/Source Serif · Playfair/DM Sans · Helvetica/Georgia · JetBrains/DM Sans |
| Section layout | Linear · centered column · creative reorder · side meta + main · dark skills rail |
| Spacing | 14px tight · 22px executive · 20px airy · 24px editorial · 16px tech |
| PDF output | Per-template rules in `cv-pdf-export.css` (grids, rails, backgrounds) |

## Files

- `src/ui/templates/cv-templates.js` — layout renderers + `cvLayout-h20-*` classes
- `src/ui/templates/cv-templates-h20.css` — typography, grid, spacing tokens
- `src/ui/templates/cv-pdf-export.css` — print/PDF differentiation
- `src/ui/templates/template-system-h20.mjs` — fingerprints + contract
- `src/ui/templates/production-template-ids.mjs` — canonical ids + display names

## Acceptance checks

| Check | Result | Detail |
|-------|--------|--------|
| five production template ids | PASS | — |
| production includes ATS Professional | PASS | — |
| production includes Executive | PASS | — |
| production includes Creative Portfolio | PASS | — |
| production includes Modern Editorial | PASS | — |
| production includes Tech Resume | PASS | — |
| cv-templates defines ATS Professional | PASS | — |
| cv-templates defines Executive | PASS | — |
| cv-templates defines Creative Portfolio | PASS | — |
| cv-templates defines Modern Editorial | PASS | — |
| cv-templates defines Tech Resume | PASS | — |
| H20 layout class ats | PASS | — |
| H20 layout class executive | PASS | — |
| H20 layout class creative | PASS | — |
| H20 layout class editorial | PASS | — |
| H20 layout class tech | PASS | — |
| wrap adds cvTpl-h20-* class | PASS | — |
| five distinct H20 layout classes | PASS | — |
| h20 css linked in index | PASS | — |
| ats IBM Plex typography | PASS | — |
| executive Cormorant typography | PASS | — |
| creative Playfair typography | PASS | — |
| editorial Helvetica typography | PASS | — |
| tech JetBrains typography | PASS | — |
| tech dark rail | PASS | — |
| editorial asymmetric grid | PASS | — |
| ats single column grid var | PASS | — |
| executive centered hierarchy | PASS | — |
| creative section reorder | PASS | — |
| pdf ats h20 rules | PASS | — |
| pdf executive h20 rules | PASS | — |
| pdf creative h20 rules | PASS | — |
| pdf editorial h20 rules | PASS | — |
| pdf tech h20 dark rail | PASS | — |
| unique grid fingerprints | PASS | single-column | magazine-split-head | centered-single | 30-70-dark-rail | 34-66-asymmetric |
| unique typography fingerprints | PASS | IBM Plex Sans | Playfair Display + DM Sans | Cormorant Garamond + Source Serif | JetBrains Mono + DM Sans | Helvetica Neue + Georgia |

## Run

```bash
npm run qa:h20-real-template-system
```

---
Generated: 2026-06-09T14:44:43.355Z
