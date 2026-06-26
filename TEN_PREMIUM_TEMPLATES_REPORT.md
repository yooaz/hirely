# Ten Premium Templates Report (P0)

**Verdict:** PASS

**Engine:** `TEN_PREMIUM_TEMPLATES_V1`

**Generated:** 2026-06-12T19:06:38.697Z

**Score:** 85/85

## Mission

Professional redesign of the Hirely template gallery — ten real premium layouts that look hire-ready, not amateur or empty.

All templates consume the **same `finalResumeData`** surface. Render-only — no parser or OCR logic in templates.

## Catalog

| # | Display name | ID | Layout brief | CSS | Page-1 useful | Empty sections |
|---|--------------|-----|--------------|-----|---------------|----------------|
| 1 | ATS Clean | `ats-elite` | Dense mono-column · elite ATS parse · page-1 hire density | cv-templates-ats-elite.css | ✓ | 0 |
| 2 | Executive Minimal | `ats-executive` | Board-ready minimal · tight meta grid · leadership hierarchy | cv-templates-ats-executive.css | ✓ | 0 |
| 3 | Modern Editorial | `editorial-magazine` | Kinfolk cover spread · display typography · culture roles | cv-templates-editorial-magazine.css | ✓ | 0 |
| 4 | Creative Portfolio | `creative-director` | Portfolio hero · client grid · case-study rhythm | cv-templates-creative-director.css | ✓ | 0 |
| 5 | Tech Structured | `tech-structured` | Skills rail split · engineering density · mono identity | cv-templates-tech-structured.css | ✓ | 0 |
| 6 | Consultant Compact | `agency-designer` | Compact consulting split · studio credibility band | cv-templates-agency-designer.css | ✓ | 0 |
| 7 | Luxury Serif | `executive-luxury` | Source Serif display · McKinsey impact metrics | cv-templates-executive-luxury.css | ✓ | 0 |
| 8 | Startup Builder | `startup-builder` | Venture hero · traction strip · operator narrative | cv-templates-startup-builder.css | ✓ | 0 |
| 9 | Art Director Portfolio | `art-director-portfolio` | Campaign masthead · awards · platform links | cv-templates-art-director-portfolio.css | ✓ | 0 |
| 10 | Classic Corporate | `swiss-editorial` | Swiss corporate grid · Neue Grafik discipline | cv-templates-swiss-editorial.css | ✓ | 0 |

## Rules

| Rule | Enforcement |
|------|-------------|
| Same finalResumeData | `resumeDataToTemplateView` → `HirelyTemplates.render` |
| No fake placeholder text | QA rejects lorem / john doe / TODO |
| Empty sections hidden | JS early-return + `:empty` CSS + completeness lock |
| No huge empty first page | `passesFirstPageFillGate` + major-section gate |
| First page useful content | Identity + summary/experience on page 1 |
| PDF-safe | Playwright vector export per template |
| A4-safe | `cv-a4-pages.css` + `cv-pdf-export.css` |
| Free preview for all | `isTemplatePreviewAllowedForFreeUser` (preview never paywalled) |
| Export lock remains Pro | Unchanged — preview-only for free tier |

## QA checks

| Check | Result | Detail |
|-------|--------|--------|
| version | PASS | — |
| count_10 | PASS | — |
| free_preview_mode | PASS | — |
| user_facing_names | PASS | ATS Clean, Executive Minimal, Modern Editorial, Creative Portfolio, Tech Structured, Consultant Compact, Luxury Serif, Startup Builder, Art Director Portfolio, Classic Corporate |
| ats-elite:name | PASS | ATS Clean |
| ats-elite:renders_identity | PASS | — |
| ats-elite:no_placeholder | PASS | — |
| ats-elite:completeness_lock | PASS | score=100 |
| ats-elite:no_empty_sections | PASS | 0 |
| ats-elite:page1_useful | PASS | major=8 fill=64.7% |
| ats-elite:export_pro_locked | PASS | — |
| ats-elite:pdf_safe | PASS | — |
| ats-executive:name | PASS | Executive Minimal |
| ats-executive:renders_identity | PASS | — |
| ats-executive:no_placeholder | PASS | — |
| ats-executive:completeness_lock | PASS | score=100 |
| ats-executive:no_empty_sections | PASS | 0 |
| ats-executive:page1_useful | PASS | major=8 fill=74.7% |
| ats-executive:export_pro_locked | PASS | — |
| ats-executive:pdf_safe | PASS | — |
| editorial-magazine:name | PASS | Modern Editorial |
| editorial-magazine:renders_identity | PASS | — |
| editorial-magazine:no_placeholder | PASS | — |
| editorial-magazine:completeness_lock | PASS | score=100 |
| editorial-magazine:no_empty_sections | PASS | 0 |
| editorial-magazine:page1_useful | PASS | major=7 fill=61.7% |
| editorial-magazine:export_pro_locked | PASS | — |
| editorial-magazine:pdf_safe | PASS | — |
| creative-director:name | PASS | Creative Portfolio |
| creative-director:renders_identity | PASS | — |
| creative-director:no_placeholder | PASS | — |
| creative-director:completeness_lock | PASS | score=100 |
| creative-director:no_empty_sections | PASS | 0 |
| creative-director:page1_useful | PASS | major=7 fill=97.9% |
| creative-director:export_pro_locked | PASS | — |
| creative-director:pdf_safe | PASS | — |
| tech-structured:name | PASS | Tech Structured |
| tech-structured:renders_identity | PASS | — |
| tech-structured:no_placeholder | PASS | — |
| tech-structured:completeness_lock | PASS | score=100 |
| tech-structured:no_empty_sections | PASS | 0 |
| tech-structured:page1_useful | PASS | major=7 fill=68.7% |
| tech-structured:export_pro_locked | PASS | — |
| tech-structured:pdf_safe | PASS | — |
| agency-designer:name | PASS | Consultant Compact |
| agency-designer:renders_identity | PASS | — |
| agency-designer:no_placeholder | PASS | — |
| agency-designer:completeness_lock | PASS | score=100 |
| agency-designer:no_empty_sections | PASS | 0 |
| agency-designer:page1_useful | PASS | major=7 fill=69.2% |
| agency-designer:export_pro_locked | PASS | — |
| agency-designer:pdf_safe | PASS | — |
| executive-luxury:name | PASS | Luxury Serif |
| executive-luxury:renders_identity | PASS | — |
| executive-luxury:no_placeholder | PASS | — |
| executive-luxury:completeness_lock | PASS | score=100 |
| executive-luxury:no_empty_sections | PASS | 0 |
| executive-luxury:page1_useful | PASS | major=5 fill=94.8% |
| executive-luxury:export_pro_locked | PASS | — |
| executive-luxury:pdf_safe | PASS | — |
| startup-builder:name | PASS | Startup Builder |
| startup-builder:renders_identity | PASS | — |
| startup-builder:no_placeholder | PASS | — |
| startup-builder:completeness_lock | PASS | score=100 |
| startup-builder:no_empty_sections | PASS | 0 |
| startup-builder:page1_useful | PASS | major=7 fill=70.3% |
| startup-builder:export_pro_locked | PASS | — |
| startup-builder:pdf_safe | PASS | — |
| art-director-portfolio:name | PASS | Art Director Portfolio |
| art-director-portfolio:renders_identity | PASS | — |
| art-director-portfolio:no_placeholder | PASS | — |
| art-director-portfolio:completeness_lock | PASS | score=100 |
| art-director-portfolio:no_empty_sections | PASS | 0 |
| art-director-portfolio:page1_useful | PASS | major=6 fill=94.5% |
| art-director-portfolio:export_pro_locked | PASS | — |
| art-director-portfolio:pdf_safe | PASS | — |
| swiss-editorial:name | PASS | Classic Corporate |
| swiss-editorial:renders_identity | PASS | — |
| swiss-editorial:no_placeholder | PASS | — |
| swiss-editorial:completeness_lock | PASS | score=100 |
| swiss-editorial:no_empty_sections | PASS | 0 |
| swiss-editorial:page1_useful | PASS | major=8 fill=71.1% |
| swiss-editorial:export_pro_locked | PASS | — |
| swiss-editorial:pdf_safe | PASS | — |
| featured_gallery_sync | PASS | — |

## Implementation

- `src/ui/templates/ten-premium-templates.mjs` — canonical 10-template registry + aliases
- `src/ui/templates/production-template-ids.mjs` — gallery IDs + display names
- `src/ui/templates/cv-templates.js` — layout functions + `PRODUCTION_TEMPLATE_IDS`
- `src/ui/templates/cv-templates-ats-executive.css` — **Executive Minimal** dedicated skin (new)
- `index.html` — featured gallery + CSS links

## Run

```bash
npm run qa:ten-premium-templates
npm run ten-premium-templates-report
npm run qa:premium-template-system-v1
```

## Bench output

```
PASS version
PASS count_10
PASS free_preview_mode
PASS user_facing_names
CV_TEMPLATE_BOOT_OK
PASS ats-elite:name
PASS ats-elite:renders_identity
PASS ats-elite:no_placeholder
PASS ats-elite:completeness_lock
PASS ats-elite:no_empty_sections
PASS ats-elite:page1_useful
PASS ats-elite:export_pro_locked
PASS ats-elite:pdf_safe
PASS ats-executive:name
PASS ats-executive:renders_identity
PASS ats-executive:no_placeholder
PASS ats-executive:completeness_lock
PASS ats-executive:no_empty_sections
PASS ats-executive:page1_useful
PASS ats-executive:export_pro_locked
PASS ats-executive:pdf_safe
PASS editorial-magazine:name
PASS editorial-magazine:renders_identity
PASS editorial-magazine:no_placeholder
PASS editorial-magazine:completeness_lock
PASS editorial-magazine:no_empty_sections
PASS editorial-magazine:page1_useful
PASS editorial-magazine:export_pro_locked
PASS editorial-magazine:pdf_safe
PASS creative-director:name
PASS creative-director:renders_identity
PASS creative-director:no_placeholder
PASS creative-director:completeness_lock
PASS creative-director:no_empty_sections
PASS creative-director:page1_useful
PASS creative-director:export_pro_locked
PASS creative-director:pdf_safe
PASS tech-structured:name
PASS tech-structured:renders_identity
PASS tech-structured:no_placeholder
PASS tech-structured:completeness_lock
PASS tech-structured:no_empty_sections
PASS tech-structured:page1_useful
PASS tech-structured:export_pro_locked
PASS tech-structured:pdf_safe
PASS agency-designer:name
PASS agency-designer:renders_identity
PASS agency-designer:no_placeholder
PASS agency-designer:completeness_lock
PASS agency-designer:no_empty_sections
PASS agency-designer:page1_useful
PASS agency-designer:export_pro_locked
PASS agency-designer:pdf_safe
PASS executive-luxury:name
PASS executive-luxury:renders_identity
PASS executive-luxury:no_placeholder
PASS executive-luxury:completeness_lock
PASS executive-luxury:no_empty_sections
PASS executive-luxury:page1_useful
PASS executive-luxury:export_pro_locked
PASS executive-luxury:pdf_safe
PASS startup-builder:name
PASS startup-builder:renders_identity
PASS startup-builder:no_placeholder
PASS startup-builder:completeness_lock
PASS startup-builder:no_empty_sections
PASS startup-builder:page1_useful
PASS startup-builder:export_pro_locked
PASS startup-builder:pdf_safe
PASS art-director-portfolio:name
PASS art-director-portfolio:renders_identity
PASS art-director-portfolio:no_placeholder
PASS art-director-portfolio:completeness_lock
PASS art-director-portfolio:no_empty_sections
PASS art-director-portfolio:page1_useful
PASS art-director-portfolio:export_pro_locked
PASS art-director-portfolio:pdf_safe
PASS swiss-editorial:name
PASS swiss-editorial:renders_identity
PASS swiss-editorial:no_placeholder
PASS swiss-editorial:completeness_lock
PASS swiss-editorial:no_empty_sections
PASS swiss-editorial:page1_useful
PASS swiss-editorial:export_pro_locked
PASS swiss-editorial:pdf_safe
PASS featured_gallery_sync

═══ Ten Premium Templates: 85/85 PASS ═══
(node:9957) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/import/import-stability-lock.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

--- premium-template-system-v1 ---
OK V1 has exactly 10 templates
OK template system version lock
CV_TEMPLATE_BOOT_OK
OK resolve ats-elite
OK display name ats-elite
OK ats-elite renders name
OK ats-elite renders education
OK ats-elite no placeholder copy
OK ats-elite layout marker cvLayout-ats-elite
OK ats-elite layout marker cvHead--ats-elite
OK ats-elite no duplicate section titles (none)
OK ats-elite no duplicate section slugs (none)
OK ats-elite dedicated CSS file
OK index links cv-templates-ats-elite.css
OK resolve ats-executive
OK display name ats-executive
OK ats-executive renders name
OK ats-executive renders education
OK ats-executive no placeholder copy
OK ats-executive layout marker cvLayout-ats-exec
OK ats-executive layout marker cvHead--ats-exec
OK ats-executive no duplicate section titles (none)
OK ats-executive no duplicate section slugs (none)
OK ats-executive dedicated CSS file
OK index links cv-templates-ats-executive.css
OK resolve editorial-magazine
OK display name editorial-magazine
OK editorial-magazine renders name
OK editorial-magazine renders education
OK editorial-magazine no placeholder copy
OK editorial-magazine layout marker cvLayout-editorial-magazine
OK editorial-magazine layout marker cvEmCover
OK editorial-magazine no duplicate section titles (none)
OK editorial-magazine no duplicate section slugs (none)
OK editorial-magazine dedicated CSS file
OK index links cv-templates-editorial-magazine.css
OK resolve creative-director
OK display name creative-director
OK creative-director renders name
OK creative-director renders education
OK creative-director no placeholder copy
OK creative-director layout marker cvLayout-director
OK creative-director layout marker cvDirectorClientGrid
OK creative-director no duplicate section titles (none)
OK creative-director no duplicate section slugs (none)
OK creative-director dedicated CSS file
OK index links cv-templates-creative-director.css
OK resolve tech-structured
OK display name tech-structured
OK tech-structured renders name
OK tech-structured renders education
OK tech-structured no placeholder copy
OK tech-structured layout marker cvLayout-tech-structured
OK tech-structured layout marker cvBody--tech-structured
OK tech-structured no duplicate section titles (none)
OK tech-structured no duplicate section slugs (none)
OK tech-structured dedicated CSS file
OK index links cv-templates-tech-structured.css
OK resolve agency-designer
OK display name agency-designer
OK agency-designer renders name
OK agency-designer renders education
OK agency-designer no placeholder copy
OK agency-designer layout marker cvLayout-agency-designer
OK agency-designer layout marker cvBody--agency
OK agency-designer no duplicate section titles (none)
OK agency-designer no duplicate section slugs (none)
OK agency-designer dedicated CSS file
OK index links cv-templates-agency-designer.css
OK resolve executive-luxury
OK display name executive-luxury
OK executive-luxury renders name
OK executive-luxury renders education
OK executive-luxury no placeholder copy
OK executive-luxury layout marker cvLayout-executive-luxury
OK executive-luxury layout marker cvHead--executive-luxury
OK executive-luxury no duplicate section titles (none)
OK executive-luxury no duplicate section slugs (none)
OK executive-luxury dedicated CSS file
OK index links cv-templates-executive-luxury.css
OK resolve startup-builder
OK display name startup-builder
OK startup-builder renders name
OK startup-builder renders education
OK startup-builder no placeholder copy
OK startup-builder layout marker cvLayout-startup-builder
OK startup-builder layout marker cvSbTraction
OK startup-builder no duplicate section titles (none)
OK startup-builder no duplicate section slugs (none)
OK startup-builder dedicated CSS file
OK index links cv-templates-startup-builder.css
OK resolve art-director-portfolio
OK display name art-director-portfolio
OK art-director-portfolio renders name
OK art-director-portfolio renders education
OK art-director-portfolio no placeholder copy
OK art-director-portfolio layout marker cvLayout-art-director-portfolio
OK art-director-portfolio layout marker cvAdpHero
OK art-director-portfolio no duplicate section titles (none)
OK art-director-portfolio no duplicate section slugs (none)
OK art-director-portfolio dedicated CSS file
OK index links cv-templates-art-director-portfolio.css
OK resolve swiss-editorial
OK display name swiss-editorial
OK swiss-editorial renders name
OK swiss-editorial renders education
OK swiss-editorial no placeholder copy
OK swiss-editorial layout marker cvLayout-swiss-editorial
OK swiss-editorial layout marker cvSwissMasthead
OK swiss-editorial no duplicate section titles (none)
OK swiss-editorial no duplicate section slugs (none)
OK swiss-editorial dedicated CSS file
OK index links cv-templates-swiss-editorial.css
OK all V1 layout families are unique
OK ats-elite PDF bytes (149505)
OK ats-elite PDF pages (1)
OK ats-executive PDF bytes (121487)
OK ats-executive PDF pages (1)
OK editorial-magazine PDF bytes (134011)
OK editorial-magazine PDF pages (1)
OK creative-director PDF bytes (137460)
OK creative-director PDF pages (2)
OK tech-structured PDF bytes (110469)
OK tech-structured PDF pages (1)
OK agency-designer PDF bytes (101445)
OK agency-designer PDF pages (1)
OK executive-luxury PDF bytes (200537)
OK executive-luxury PDF pages (2)
OK startup-builder PDF bytes (174135)
OK startup-builder PDF pages (1)
OK art-director-portfolio PDF bytes (158967)
OK art-director-portfolio PDF pages (2)
OK swiss-editorial PDF bytes (68809)
OK swiss-editorial PDF pages (1)

qa-premium-template-system-v1: PASS
(node:10544) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/import/import-stability-lock.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
