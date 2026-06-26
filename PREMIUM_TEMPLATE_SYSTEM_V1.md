# Premium Template System V1

**Status:** PASS  
**Generated:** 2026-06-11T08:10:31.764Z  
**System version:** `premium-template-system-v1`  
**Template count:** 10

## Scope

Ten intentionally different premium layouts — not color variations. Each template has dedicated CSS, unique layout markers, real-data rendering, A4-safe PDF export, and duplicate-section guards.

## Requirements

| Requirement | Status |
|-------------|--------|
| Fully responsive | CSS breakpoints per template |
| Real PDF export | Playwright vector export per template |
| No placeholder data | QA rejects placeholder copy |
| No duplicated sections | Section title + slug dedupe checks |
| Auto-pagination | A4 pages engine + density CSS |
| A4 safe | `cv-a4-pages.css` + PDF margins |
| ATS compatible where applicable | ATS Elite · Tech Structured · Startup Builder · Swiss Editorial |

## V1 catalog

| # | Name | ID | Layout family | Dedicated CSS |
|---|------|----|---------------|---------------|
| 1 | ATS Elite | `ats-elite` | Dense ATS mono-column · elite contact rail | cv-templates-ats-elite.css |
| 2 | Swiss Editorial | `swiss-editorial` | Masthead + 2-column Swiss grid | cv-templates-swiss-editorial.css |
| 3 | Creative Director | `creative-director` | Editorial hero · clients · projects · timeline | cv-templates-creative-director.css |
| 4 | Art Director Portfolio | `art-director-portfolio` | Dark hero · awards · press · platform links | cv-templates-art-director-portfolio.css |
| 5 | Executive Luxury | `executive-luxury` | Leadership hierarchy · impact metrics | cv-templates-executive-luxury.css |
| 6 | Visual Timeline | `visual-timeline` | Vertical career spine · connected work branches | cv-templates-visual-timeline.css |
| 7 | Tech Structured | `tech-structured` | Skills rail split · engineering density | cv-templates-tech-structured.css |
| 8 | Startup Builder | `startup-builder` | Venture hero · traction strip · impact split | cv-templates-startup-builder.css |
| 9 | Agency Designer | `agency-designer` | Dark band header · studio split rail | cv-templates-agency-designer.css |
| 10 | Editorial Magazine | `editorial-magazine` | Kinfolk cover · 3-column editorial spread | cv-templates-editorial-magazine.css |

## Implementation map

| Layer | Path |
|-------|------|
| Layout engine | `src/ui/templates/cv-templates.js` |
| Production IDs | `src/ui/templates/production-template-ids.mjs` |
| V2 registry | `src/ui/templates/v2/registry.js` |
| Gallery metadata | `src/ui/templates/premium-template-gallery.mjs` |
| PDF stack | `src/tests/lib/pdf-export-playwright.mjs` |
| Picker | `index.html` `FEATURED_TEMPLATE_IDS` |

## QA

```bash
npm run qa:premium-template-system-v1
```

**Checks:** 133/133 passed

- [x] V1 has exactly 10 templates
- [x] template system version lock
- [x] resolve ats-elite
- [x] display name ats-elite
- [x] ats-elite renders name
- [x] ats-elite renders education
- [x] ats-elite no placeholder copy
- [x] ats-elite layout marker cvLayout-ats-elite
- [x] ats-elite layout marker cvHead--ats-elite
- [x] ats-elite no duplicate section titles (none)
- [x] ats-elite no duplicate section slugs (none)
- [x] ats-elite dedicated CSS file
- [x] index links cv-templates-ats-elite.css
- [x] resolve swiss-editorial
- [x] display name swiss-editorial
- [x] swiss-editorial renders name
- [x] swiss-editorial renders education
- [x] swiss-editorial no placeholder copy
- [x] swiss-editorial layout marker cvLayout-swiss-editorial
- [x] swiss-editorial layout marker cvSwissGrid
- [x] swiss-editorial no duplicate section titles (none)
- [x] swiss-editorial no duplicate section slugs (none)
- [x] swiss-editorial dedicated CSS file
- [x] index links cv-templates-swiss-editorial.css
- [x] resolve creative-director
- [x] display name creative-director
- [x] creative-director renders name
- [x] creative-director renders education
- [x] creative-director no placeholder copy
- [x] creative-director layout marker cvLayout-director
- [x] creative-director layout marker cvDirectorClientGrid
- [x] creative-director no duplicate section titles (none)
- [x] creative-director no duplicate section slugs (none)
- [x] creative-director dedicated CSS file
- [x] index links cv-templates-creative-director.css
- [x] resolve art-director-portfolio
- [x] display name art-director-portfolio
- [x] art-director-portfolio renders name
- [x] art-director-portfolio renders education
- [x] art-director-portfolio no placeholder copy
- [x] art-director-portfolio layout marker cvLayout-art-director-portfolio
- [x] art-director-portfolio layout marker cvAdpHero
- [x] art-director-portfolio no duplicate section titles (none)
- [x] art-director-portfolio no duplicate section slugs (none)
- [x] art-director-portfolio dedicated CSS file
- [x] index links cv-templates-art-director-portfolio.css
- [x] resolve executive-luxury
- [x] display name executive-luxury
- [x] executive-luxury renders name
- [x] executive-luxury renders education
- [x] executive-luxury no placeholder copy
- [x] executive-luxury layout marker cvLayout-executive-luxury
- [x] executive-luxury layout marker cvHead--executive-luxury
- [x] executive-luxury no duplicate section titles (none)
- [x] executive-luxury no duplicate section slugs (none)
- [x] executive-luxury dedicated CSS file
- [x] index links cv-templates-executive-luxury.css
- [x] resolve visual-timeline
- [x] display name visual-timeline
- [x] visual-timeline renders name
- [x] visual-timeline renders education
- [x] visual-timeline no placeholder copy
- [x] visual-timeline layout marker cvLayout-visual-timeline
- [x] visual-timeline layout marker cvVtRail
- [x] visual-timeline no duplicate section titles (none)
- [x] visual-timeline no duplicate section slugs (none)
- [x] visual-timeline dedicated CSS file
- [x] index links cv-templates-visual-timeline.css
- [x] resolve tech-structured
- [x] display name tech-structured
- [x] tech-structured renders name
- [x] tech-structured renders education
- [x] tech-structured no placeholder copy
- [x] tech-structured layout marker cvLayout-tech-structured
- [x] tech-structured layout marker cvBody--tech-structured
- [x] tech-structured no duplicate section titles (none)
- [x] tech-structured no duplicate section slugs (none)
- [x] tech-structured dedicated CSS file
- [x] index links cv-templates-tech-structured.css
- [x] resolve startup-builder
- [x] display name startup-builder
- [x] startup-builder renders name
- [x] startup-builder renders education
- [x] startup-builder no placeholder copy
- [x] startup-builder layout marker cvLayout-startup-builder
- [x] startup-builder layout marker cvSbTraction
- [x] startup-builder no duplicate section titles (none)
- [x] startup-builder no duplicate section slugs (none)
- [x] startup-builder dedicated CSS file
- [x] index links cv-templates-startup-builder.css
- [x] resolve agency-designer
- [x] display name agency-designer
- [x] agency-designer renders name
- [x] agency-designer renders education
- [x] agency-designer no placeholder copy
- [x] agency-designer layout marker cvLayout-agency-designer
- [x] agency-designer layout marker cvBody--agency
- [x] agency-designer no duplicate section titles (none)
- [x] agency-designer no duplicate section slugs (none)
- [x] agency-designer dedicated CSS file
- [x] index links cv-templates-agency-designer.css
- [x] resolve editorial-magazine
- [x] display name editorial-magazine
- [x] editorial-magazine renders name
- [x] editorial-magazine renders education
- [x] editorial-magazine no placeholder copy
- [x] editorial-magazine layout marker cvLayout-editorial-magazine
- [x] editorial-magazine layout marker cvEmCover
- [x] editorial-magazine no duplicate section titles (none)
- [x] editorial-magazine no duplicate section slugs (none)
- [x] editorial-magazine dedicated CSS file
- [x] index links cv-templates-editorial-magazine.css
- [x] all V1 layout families are unique
- [x] ats-elite PDF bytes (147257)
- [x] ats-elite PDF pages (1)
- [x] swiss-editorial PDF bytes (56238)
- [x] swiss-editorial PDF pages (1)
- [x] creative-director PDF bytes (125934)
- [x] creative-director PDF pages (2)
- [x] art-director-portfolio PDF bytes (130356)
- [x] art-director-portfolio PDF pages (2)
- [x] executive-luxury PDF bytes (173390)
- [x] executive-luxury PDF pages (2)
- [x] visual-timeline PDF bytes (186401)
- [x] visual-timeline PDF pages (2)
- [x] tech-structured PDF bytes (74041)
- [x] tech-structured PDF pages (1)
- [x] startup-builder PDF bytes (177519)
- [x] startup-builder PDF pages (1)
- [x] agency-designer PDF bytes (64529)
- [x] agency-designer PDF pages (1)
- [x] editorial-magazine PDF bytes (48177)
- [x] editorial-magazine PDF pages (1)

## PDF artifacts

`tests/output/premium-template-system-v1/{template-id}.pdf`
