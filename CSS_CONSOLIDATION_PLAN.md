# CSS Consolidation Plan

**Generated:** 2026-06-15T11:01:51.637Z
**Scope:** Active `src/ui/**` stylesheets linked from `index.html` + inline `<style>` block

## Executive summary

| Metric | Value |
|--------|-------|
| Linked CSS files | 50 |
| Orphan CSS files (not linked) | 2 |
| Inline `<style>` in index.html | 80.7 KB |
| Total raw CSS delivered | **431.3 KB** (441,628 bytes) |
| Est. gzip today | ~138.0 KB |
| Unique selector rules parsed | 4,104 |
| Duplicate selector groups | 541 |
| Debug-tagged rules | 23 |
| Dead selector candidates (app chrome) | 293 |
| Unused template selector candidates | 16 |

### Target bundles

| Bundle | Purpose | Current raw | Post-consolidation est. |
|--------|---------|-------------|-------------------------|
| `core.css` | App shell, import, studio layout, editor, export viewport | 204.1 KB | 179.6 KB |
| `design-system.css` | Tokens, typography, buttons, polish, pro/photo UI | 55.5 KB | 47.2 KB |
| `templates.css` | CV template families, density, PDF print rules | 171.7 KB | 123.6 KB |

### Bundle reduction estimate

| Savings source | Raw bytes | Notes |
|----------------|-----------|-------|
| File merge + dedupe overhead (3 files vs 50 links) | ~22,081 | HTTP/header elimination; minify pass |
| Duplicate selector merge | ~91,743 | 541 selector groups repeat across files |
| Dead app selectors removal | ~21,478 | Classes/IDs not referenced in HTML/JS corpus |
| Debug-only CSS (dev gate) | ~2,369 | Load `import-debug-panel.css` only when `?debug=1` |
| Orphan file deletion | ~17,338 | Not linked from index.html |
| Legacy template CSS trim | ~1,045 | Per-template files for gallery-unused IDs |
| **Conservative total** | **~173 KB** | **~40% raw reduction** |
| **Aggressive total** | **~212 KB** | **~49% raw reduction** |
| Est. gzip after conservative | ~82.7 KB | from ~138.0 KB today |

## Current inventory (linked, by size)

| File | Bytes | Target bundle |
|------|------:|---------------|
| `src/ui/templates/cv-templates-professional.css` | 23,820 | templates |
| `src/ui/templates/cv-templates-v2-families.css` | 20,072 | templates |
| `src/ui/templates/cv-templates-pack.css` | 19,738 | templates |
| `src/ui/design-system-v3.css` | 16,267 | design-system |
| `src/ui/studio/studio-layout.css` | 15,881 | core |
| `src/ui/templates/cv-templates-v3-families.css` | 14,610 | templates |
| `src/ui/hirely-wow-factor.css` | 13,094 | design-system |
| `src/ui/templates/cv-templates-h20.css` | 12,765 | templates |
| `src/ui/hirely-document.css` | 12,720 | core |
| `src/ui/hirely-premium-polish.css` | 12,681 | design-system |
| `src/ui/product/ui-scale-fix.css` | 12,640 | core |
| `src/ui/document-experience-v1.css` | 12,395 | core |
| `src/ui/studio/review-studio-v2.css` | 11,959 | core |
| `src/ui/hirely-ui-scale.css` | 9,890 | core |
| `src/ui/studio/recruiter-command-center.css` | 8,700 | core |
| `src/ui/templates/cv-templates-showcase-v8.css` | 8,121 | templates |
| `src/ui/templates/cv-templates-editorial-magazine.css` | 8,086 | templates |
| `src/ui/templates/cv-template-density.css` | 7,066 | templates |
| `src/ui/typography-system.css` | 6,621 | design-system |
| `src/ui/templates/cv-pdf-export.css` | 5,860 | templates |
| `src/ui/templates/cv-templates-creative-director.css` | 5,735 | templates |
| `src/ui/templates/premium-template-gallery.css` | 5,527 | templates |
| `src/ui/templates/cv-templates-visual-timeline.css` | 5,476 | templates |
| `src/ui/templates/cv-templates-art-director-portfolio.css` | 5,397 | templates |
| `src/ui/product/p0-subtraction.css` | 5,348 | core |
| `src/ui/export/pdf-export-v2.css` | 5,283 | templates |
| `src/ui/studio/resume-studio.css` | 4,835 | core |
| `src/ui/templates/cv-templates-swiss-editorial.css` | 4,514 | templates |
| `src/ui/product/import-flow-v2.css` | 4,471 | core |
| `src/ui/templates/cv-templates-executive-luxury.css` | 4,340 | templates |
| `src/ui/templates/cv-templates-startup-builder.css` | 4,191 | templates |
| `src/ui/pro/pro-cv-features.css` | 4,084 | design-system |
| `src/ui/studio/recruiter-mode.css` | 3,994 | core |
| `src/ui/export/cv-a4-pages.css` | 3,742 | core |
| `src/ui/export/a4-viewport.css` | 3,717 | core |
| `src/ui/templates/cv-templates-ats-elite.css` | 3,281 | templates |
| `src/ui/templates/cv-design-tokens.css` | 3,189 | templates |
| `src/ui/hirely-progress-nav.css` | 3,153 | core |
| `src/ui/templates/cv-templates-h16.css` | 3,051 | templates |
| `src/ui/templates/cv-templates-ats-executive.css` | 2,651 | templates |
| `src/ui/product/import-analysis-stages.css` | 2,576 | core |
| `src/ui/product/extraction-recovery.css` | 2,519 | core |
| `src/ui/pro/photo-system-v2.css` | 2,283 | design-system |
| `src/ui/studio/resume-blocks.css` | 2,186 | core |
| `src/ui/editor/resume-editor.css` | 2,159 | core |
| `src/ui/product/import-debug-panel.css` | 1,809 | design-system |
| `src/ui/studio/template-gallery-position.css` | 1,805 | core |
| `src/ui/templates/cv-templates-tech-structured.css` | 1,684 | templates |
| `src/ui/product/linkedin-import.css` | 1,619 | core |
| `src/ui/templates/cv-templates-agency-designer.css` | 1,356 | templates |
| `inline:index.html` | 82,667 | core |

## Orphan files (delete or archive)

- `src/ui/templates/cv-templates-premium.css` — 7,810 bytes (not linked from index.html)
- `src/ui/visual-density-pass.css` — 9,528 bytes (not linked from index.html)

## Proposed bundle contents

### `core.css`
App chrome, workspace grid, import pipeline UI, progress nav, studio shell, editor, A4 viewport.

- `src/ui/hirely-document.css`
- `src/ui/hirely-progress-nav.css`
- `src/ui/studio/studio-layout.css`
- `src/ui/document-experience-v1.css`
- `src/ui/product/p0-subtraction.css`
- `src/ui/product/ui-scale-fix.css`
- `src/ui/hirely-ui-scale.css`
- `src/ui/product/import-flow-v2.css`
- `src/ui/product/import-analysis-stages.css`
- `src/ui/product/linkedin-import.css`
- `src/ui/product/extraction-recovery.css`
- `src/ui/studio/resume-studio.css`
- `src/ui/studio/resume-blocks.css`
- `src/ui/studio/review-studio-v2.css`
- `src/ui/studio/recruiter-mode.css`
- `src/ui/studio/recruiter-command-center.css`
- `src/ui/studio/template-gallery-position.css`
- `src/ui/editor/resume-editor.css`
- `src/ui/export/a4-viewport.css`
- `src/ui/export/cv-a4-pages.css`
- `inline:index.html`

### `design-system.css`
Design tokens, typography scale, buttons, cards, modals, pro/photo controls. Debug panel behind dev flag.

- `src/ui/design-system-v3.css`
- `src/ui/typography-system.css`
- `src/ui/hirely-premium-polish.css`
- `src/ui/hirely-wow-factor.css`
- `src/ui/pro/pro-cv-features.css`
- `src/ui/pro/photo-system-v2.css`
- `src/ui/product/import-debug-panel.css`

### `templates.css`
All `.cv` / `template-*` rules, v2/v3 families, density, PDF export. Lazy-load optional for non-style steps.

- `src/ui/templates/cv-design-tokens.css`
- `src/ui/templates/cv-templates-pack.css`
- `src/ui/templates/cv-templates-professional.css`
- `src/ui/templates/cv-templates-h16.css`
- `src/ui/templates/cv-templates-h20.css`
- `src/ui/templates/cv-templates-ats-elite.css`
- `src/ui/templates/cv-templates-ats-executive.css`
- `src/ui/templates/cv-templates-creative-director.css`
- `src/ui/templates/cv-templates-executive-luxury.css`
- `src/ui/templates/cv-templates-swiss-editorial.css`
- `src/ui/templates/cv-templates-visual-timeline.css`
- `src/ui/templates/cv-templates-art-director-portfolio.css`
- `src/ui/templates/premium-template-gallery.css`
- `src/ui/templates/cv-templates-tech-structured.css`
- `src/ui/templates/cv-templates-agency-designer.css`
- `src/ui/templates/cv-templates-editorial-magazine.css`
- `src/ui/templates/cv-templates-startup-builder.css`
- `src/ui/templates/cv-templates-v2-families.css`
- `src/ui/templates/cv-templates-showcase-v8.css`
- `src/ui/templates/cv-templates-v3-families.css`
- `src/ui/templates/cv-template-density.css`
- `src/ui/templates/cv-pdf-export.css`
- `src/ui/export/pdf-export-v2.css`

## Duplicate selectors (top 40 by wasted bytes)

| Selector | Occurrences | Sources | Est. duplicate bytes |
|----------|------------:|---------|---------------------:|
| `:root` | 13 | design-system-v3.css, hirely-wow-factor.css, hirely-document.css, hirely-premium-polish.css, product/ui-scale-fix.css, document-experience-v1.css, hirely-ui-scale.css, typography-system.css, export/cv-a4-pages.css, inline:index.html | 6259 |
| `.cv` | 5 | typography-system.css, templates/cv-design-tokens.css, inline:index.html | 1255 |
| `.hirelyProgressBtn` | 9 | design-system-v3.css, hirely-premium-polish.css, product/ui-scale-fix.css, hirely-ui-scale.css, product/p0-subtraction.css, hirely-progress-nav.css | 948 |
| `html:not(.debug-mode) .workspaceGrid--ready.docStep-edit .reviewStudioAnalysis` | 6 | product/ui-scale-fix.css, studio/review-studio-v2.css, hirely-ui-scale.css, product/p0-subtraction.css | 898 |
| `.cvInner` | 3 | typography-system.css, templates/cv-design-tokens.css, inline:index.html | 898 |
| `body` | 8 | design-system-v3.css, hirely-document.css, hirely-premium-polish.css, product/ui-scale-fix.css, hirely-ui-scale.css, typography-system.css, templates/cv-pdf-export.css, inline:index.html | 886 |
| `.top` | 9 | design-system-v3.css, hirely-document.css, hirely-premium-polish.css, product/ui-scale-fix.css, hirely-ui-scale.css, inline:index.html | 855 |
| `.cv-page` | 6 | templates/cv-pdf-export.css, export/cv-a4-pages.css, export/a4-viewport.css, inline:index.html | 817 |
| `.heroCopy h1` | 10 | design-system-v3.css, hirely-wow-factor.css, hirely-document.css, hirely-premium-polish.css, product/ui-scale-fix.css, hirely-ui-scale.css, inline:index.html | 810 |
| `.btn` | 6 | design-system-v3.css, hirely-premium-polish.css, product/ui-scale-fix.css, hirely-ui-scale.css, inline:index.html | 807 |
| `.workspaceGrid--ready .cvStage` | 8 | design-system-v3.css, hirely-document.css, hirely-premium-polish.css, hirely-ui-scale.css, inline:index.html | 799 |
| `.premiumTplCard` | 4 | design-system-v3.css, hirely-wow-factor.css, hirely-ui-scale.css, templates/premium-template-gallery.css | 790 |
| `.cvStageInner` | 7 | design-system-v3.css, hirely-ui-scale.css, inline:index.html | 714 |
| `.app--workspace .cvFocus` | 7 | design-system-v3.css, hirely-document.css, hirely-premium-polish.css, hirely-ui-scale.css | 693 |
| `.cv-preview-shell` | 7 | hirely-premium-polish.css, export/cv-a4-pages.css, export/a4-viewport.css, inline:index.html | 671 |
| `.drop` | 4 | design-system-v3.css, hirely-premium-polish.css, hirely-ui-scale.css, inline:index.html | 667 |
| `.premiumGalleryFilter` | 4 | design-system-v3.css, product/ui-scale-fix.css, hirely-ui-scale.css, templates/premium-template-gallery.css | 657 |
| `.hirelyProgressHint` | 6 | design-system-v3.css, hirely-premium-polish.css, product/ui-scale-fix.css, hirely-ui-scale.css, hirely-progress-nav.css | 651 |
| `.reviewV2ScoreRing` | 7 | design-system-v3.css, hirely-wow-factor.css, hirely-premium-polish.css, studio/review-studio-v2.css, hirely-ui-scale.css | 638 |
| `html:not(.debug-mode) .workspaceGrid--ready.docStep-edit .wsCenterStack` | 6 | product/ui-scale-fix.css, hirely-ui-scale.css, product/p0-subtraction.css, inline:index.html | 620 |
| `.heroBadge` | 7 | design-system-v3.css, hirely-wow-factor.css, hirely-document.css, product/ui-scale-fix.css, hirely-ui-scale.css, inline:index.html | 617 |
| `.tplCard` | 5 | design-system-v3.css, hirely-document.css, hirely-premium-polish.css, inline:index.html | 600 |
| `html:not(.debug-mode) .workspaceGrid--ready.docStep-edit .wsProduct` | 4 | studio/studio-layout.css, studio/review-studio-v2.css | 587 |
| `html:not(.debug-mode) .workspaceGrid--ready.docStep-edit .studioPreview .cvStage` | 4 | design-system-v3.css, studio/studio-layout.css, hirely-ui-scale.css | 585 |
| `#cvStage .cv` | 4 | design-system-v3.css, hirely-document.css, hirely-premium-polish.css | 585 |
| `.hirelyProgressIcon` | 5 | design-system-v3.css, hirely-premium-polish.css, product/ui-scale-fix.css, product/p0-subtraction.css, hirely-progress-nav.css | 573 |
| `.cv.template-startup-founder` | 5 | templates/cv-templates-v2-families.css, templates/cv-templates-v3-families.css, templates/cv-templates-showcase-v8.css | 543 |
| `.templatePickerBar` | 7 | design-system-v3.css, hirely-premium-polish.css, hirely-ui-scale.css, inline:index.html | 542 |
| `.hirelyProgressLabel` | 9 | design-system-v3.css, hirely-premium-polish.css, product/ui-scale-fix.css, hirely-ui-scale.css, product/p0-subtraction.css, hirely-progress-nav.css | 530 |
| `.reviewStudioCenter .suggestionCard` | 4 | design-system-v3.css, hirely-premium-polish.css, studio/review-studio-v2.css, hirely-ui-scale.css | 526 |
| `html:not(.debug-mode) .workspaceGrid--ready.docStep-export .studioPreview` | 5 | design-system-v3.css, studio/studio-layout.css, product/ui-scale-fix.css, studio/review-studio-v2.css, hirely-ui-scale.css | 519 |
| `.coverLetterWorkspace` | 5 | design-system-v3.css, hirely-premium-polish.css, product/ui-scale-fix.css, hirely-ui-scale.css, inline:index.html | 517 |
| `.reviewStudioCenter` | 6 | design-system-v3.css, hirely-wow-factor.css, hirely-premium-polish.css, product/ui-scale-fix.css, hirely-ui-scale.css | 488 |
| `.logo` | 6 | design-system-v3.css, hirely-document.css, hirely-premium-polish.css, product/ui-scale-fix.css, hirely-ui-scale.css, inline:index.html | 483 |
| `html:not(.debug-mode) .workspaceGrid--ready.docStep-edit .studioPreview .workspa…` | 5 | studio/studio-layout.css, hirely-ui-scale.css, studio/template-gallery-position.css | 479 |
| `.workspaceGrid` | 4 | design-system-v3.css, hirely-ui-scale.css, inline:index.html | 478 |
| `html:not(.debug-mode) .workspaceGrid--ready.docStep-export .studioPreview .cvSta…` | 4 | studio/studio-layout.css, studio/review-studio-v2.css, hirely-ui-scale.css | 454 |
| `.cv.template-creative-director` | 3 | templates/cv-templates-v3-families.css, typography-system.css, templates/cv-templates-creative-director.css | 450 |
| `html:not(.debug-mode) .workspaceGrid--ready:not(.docStep-edit)` | 3 | design-system-v3.css, hirely-ui-scale.css, inline:index.html | 444 |
| `.trustStrip` | 5 | hirely-document.css, product/ui-scale-fix.css, hirely-ui-scale.css, inline:index.html | 444 |

*…and 501 more duplicate groups.*

## Debug selectors (gate behind `?debug=1` or remove)

| Selector | Source |
|----------|--------|
| `html.debug-mode .premiumTemplateGallery` | `src/ui/templates/premium-template-gallery.css` |
| `html.debug-mode #templateGrid.templatePicker` | `src/ui/templates/premium-template-gallery.css` |
| `.importDebugPanel` | `src/ui/product/import-debug-panel.css` |
| `.importDebugPanel__head` | `src/ui/product/import-debug-panel.css` |
| `.importDebugPanel__title` | `src/ui/product/import-debug-panel.css` |
| `.importDebugPanel__badge` | `src/ui/product/import-debug-panel.css` |
| `.importDebugPanel__metrics` | `src/ui/product/import-debug-panel.css` |
| `.importDebugMetric` | `src/ui/product/import-debug-panel.css` |
| `.importDebugMetric__label` | `src/ui/product/import-debug-panel.css` |
| `.importDebugMetric__value` | `src/ui/product/import-debug-panel.css` |
| `.importDebugPanel__steps` | `src/ui/product/import-debug-panel.css` |
| `.importDebugStep` | `src/ui/product/import-debug-panel.css` |
| `.importDebugStep code` | `src/ui/product/import-debug-panel.css` |
| `.importDebugStep--done` | `src/ui/product/import-debug-panel.css` |
| `.importDebugStep--done .importDebugStep__mark` | `src/ui/product/import-debug-panel.css` |
| `html.debug-mode .workspaceGrid--ready .wsInsights` | `inline:index.html` |
| `html.debug-mode #hirelyTestImport` | `inline:index.html` |
| `html.debug-mode .cvReviewPanel` | `inline:index.html` |
| `html.debug-mode .workspaceGrid--ready.docStep-style .docFooter` | `inline:index.html` |
| `html.debug-mode .workspaceGrid--ready.docStep-verify .wsInsights` | `inline:index.html` |
| `html.debug-mode .workspaceGrid--ready.docStep-export .wsInsights` | `inline:index.html` |
| `html.debug-mode .workspaceGrid--ready.docStep-export .templatePickerBar` | `inline:index.html` |
| `html.debug-mode .wsInsights .scoreCardPremium` | `inline:index.html` |

## Dead selector candidates (app chrome — top 50)

Selectors whose class/id tokens were **not** found in `index.html` + `src/**` JS corpus. Manual review required before deletion (dynamic templates may false-negative).

| Selector | Source |
|----------|--------|
| `.tplMiniWrap--ats` | `src/ui/templates/cv-templates-professional.css` |
| `.tplMiniWrap--executive` | `src/ui/templates/cv-templates-professional.css` |
| `.tplMiniWrap--swiss` | `src/ui/templates/cv-templates-professional.css` |
| `.tplMiniWrap--productdesigner` | `src/ui/templates/cv-templates-professional.css` |
| `.tplMiniWrap--agencyportfolio` | `src/ui/templates/cv-templates-professional.css` |
| `.tplMiniWrap--minimal` | `src/ui/templates/cv-templates-professional.css` |
| `.tplMiniWrap--creative` | `src/ui/templates/cv-templates-professional.css` |
| `.tplMiniWrap--creativedirector` | `src/ui/templates/cv-templates-professional.css` |
| `.tplMiniWrap--premium` | `src/ui/templates/cv-templates-professional.css` |
| `.tplMiniWrap--executive-minimal` | `src/ui/templates/cv-templates-professional.css` |
| `.tplMiniWrap--modern-two-column` | `src/ui/templates/cv-templates-professional.css` |
| `.tplMiniWrap--editorial` | `src/ui/templates/cv-templates-professional.css` |
| `.tplMiniWrap--ats-recruiter` | `src/ui/templates/cv-templates-v2-families.css` |
| `.tplMiniWrap--mckinsey-consulting` | `src/ui/templates/cv-templates-v2-families.css` |
| `.tplMiniWrap--apple-minimal` | `src/ui/templates/cv-templates-v2-families.css` |
| `.tplMiniWrap--kinfolk-editorial` | `src/ui/templates/cv-templates-v2-families.css` |
| `.tplMiniWrap--luxury-executive` | `src/ui/templates/cv-templates-v2-families.css` |
| `.tplMiniWrap--creative-director-portfolio` | `src/ui/templates/cv-templates-v2-families.css` |
| `.tplMiniWrap--art-director` | `src/ui/templates/cv-templates-v2-families.css` |
| `.tplMiniWrap--startup-founder` | `src/ui/templates/cv-templates-v2-families.css` |
| `.tplMiniWrap--tech-engineer` | `src/ui/templates/cv-templates-v2-families.css` |
| `.tplMiniWrap--classic-corporate` | `src/ui/templates/cv-templates-v2-families.css` |
| `.tplMiniWrap--creative-portfolio` | `src/ui/templates/cv-templates-pack.css` |
| `.tplMiniWrap--luxury-minimal` | `src/ui/templates/cv-templates-pack.css` |
| `.tplMiniWrap--tech-structured` | `src/ui/templates/cv-templates-pack.css` |
| `.tplMiniWrap--art-director-portfolio` | `src/ui/templates/cv-templates-pack.css` |
| `.tplMiniWrap--ats-executive` | `src/ui/templates/cv-templates-pack.css` |
| `.tplMiniWrap--portfolio-artist` | `src/ui/templates/cv-templates-pack.css` |
| `.tplMiniWrap--behance-showcase` | `src/ui/templates/cv-templates-pack.css` |
| `.tplMiniWrap--editorial-magazine` | `src/ui/templates/cv-templates-pack.css` |
| `.tplMiniWrap--luxury-fashion` | `src/ui/templates/cv-templates-pack.css` |
| `.tplMiniWrap--agency-designer` | `src/ui/templates/cv-templates-pack.css` |
| `.tplMiniWrap--minimal-swiss` | `src/ui/templates/cv-templates-pack.css` |
| `.tplMiniWrap--visual-timeline` | `src/ui/templates/cv-templates-pack.css` |
| `.tplMiniWrap--creative-director` | `src/ui/templates/cv-templates-pack.css` |
| `.tplMiniWrap--art-director` | `src/ui/templates/cv-templates-pack.css` |
| `.tplMiniWrap--illustrator-portfolio` | `src/ui/templates/cv-templates-pack.css` |
| `.tplMiniWrap--magazine-editorial` | `src/ui/templates/cv-templates-pack.css` |
| `.hirelyProgressHint` | `src/ui/design-system-v3.css` |
| `.reviewV2Gate` | `src/ui/design-system-v3.css` |
| `.reviewV2Empty` | `src/ui/hirely-wow-factor.css` |
| `.tplMiniWrap--ats` | `src/ui/templates/cv-templates-h20.css` |
| `.tplMiniWrap--executive-minimal` | `src/ui/templates/cv-templates-h20.css` |
| `.tplMiniWrap--creative` | `src/ui/templates/cv-templates-h20.css` |
| `.tplMiniWrap--editorial` | `src/ui/templates/cv-templates-h20.css` |
| `.tplMiniWrap--modern-two-column` | `src/ui/templates/cv-templates-h20.css` |
| `.tplMiniWrap--modern-two-column::before` | `src/ui/templates/cv-templates-h20.css` |
| `.scoreBandLabel` | `src/ui/hirely-document.css` |
| `.heroStep--audit` | `src/ui/hirely-document.css` |
| `.docNav` | `src/ui/hirely-document.css` |

Total dead candidates: **280** (~24.7 KB rule bodies).

## Unused template selectors

**16** rules target `.cv` / `template-*` classes not present in the usage corpus. Many are valid for gallery templates not exercised in static analysis — trim only after matching against `production-template-ids.mjs`.

### Legacy per-template files (consolidation candidates)

- `src/ui/templates/cv-templates-h16.css` — 3,051 bytes → merge into `templates.css`; drop if template ID retired
- `src/ui/templates/cv-templates-h20.css` — 12,765 bytes → merge into `templates.css`; drop if template ID retired
- `src/ui/templates/cv-templates-ats-elite.css` — 3,281 bytes → merge into `templates.css`; drop if template ID retired
- `src/ui/templates/cv-templates-ats-executive.css` — 2,651 bytes → merge into `templates.css`; drop if template ID retired
- `src/ui/templates/cv-templates-creative-director.css` — 5,735 bytes → merge into `templates.css`; drop if template ID retired
- `src/ui/templates/cv-templates-executive-luxury.css` — 4,340 bytes → merge into `templates.css`; drop if template ID retired
- `src/ui/templates/cv-templates-swiss-editorial.css` — 4,514 bytes → merge into `templates.css`; drop if template ID retired
- `src/ui/templates/cv-templates-visual-timeline.css` — 5,476 bytes → merge into `templates.css`; drop if template ID retired
- `src/ui/templates/cv-templates-art-director-portfolio.css` — 5,397 bytes → merge into `templates.css`; drop if template ID retired
- `src/ui/templates/cv-templates-tech-structured.css` — 1,684 bytes → merge into `templates.css`; drop if template ID retired
- `src/ui/templates/cv-templates-agency-designer.css` — 1,356 bytes → merge into `templates.css`; drop if template ID retired
- `src/ui/templates/cv-templates-editorial-magazine.css` — 8,086 bytes → merge into `templates.css`; drop if template ID retired
- `src/ui/templates/cv-templates-startup-builder.css` — 4,191 bytes → merge into `templates.css`; drop if template ID retired

Legacy per-template subtotal: **61.1 KB**. Prefer v2/v3 family files as canonical.

## Overlap hotspots

| Area | Files | Issue |
|------|-------|-------|
| Typography / scale | `typography-system.css`, `hirely-ui-scale.css`, `ui-scale-fix.css`, `design-system-v3.css` | Competing `--font-*` and scale overrides |
| Document shell | `hirely-document.css`, inline `index.html`, `document-experience-v1.css` | `.workspaceGrid`, step panels defined 2–3× |
| Template families | `cv-templates-v2-families.css`, `cv-templates-v3-families.css`, `cv-templates-pack.css`, `cv-templates-professional.css` | Duplicate `.cv.template-*` blocks |
| PDF export | `cv-pdf-export.css`, `pdf-export-v2.css`, `cv-a4-pages.css`, `a4-viewport.css` | Print margin/page rules repeated |
| Polish passes | `hirely-premium-polish.css`, `hirely-wow-factor.css`, `p0-subtraction.css` | Layered overrides on same selectors |

## Migration plan (phased)

### Phase 0 — Safety
1. Add `npm run qa:css-consolidation` (this script) to CI as informational.
2. Screenshot baseline: import, review, style, export at 1280px and 390px.
3. Do **not** change selectors used by PDF export or template `renderCV()` output.

### Phase 1 — Stop the bleed
1. Delete or move orphans: `visual-density-pass.css`, unused `cv-templates-premium.css` (only parser-lab/debug).
2. Gate `import-debug-panel.css` behind `?debug=1` dynamic `<link>`.
3. Extract inline `index.html` `<style>` (~83 KB) into `src/ui/core-inline-migration.css` → fold into `core.css`.

### Phase 2 — Build bundles
1. Concatenate per bundle order; run CSSO/cssnano minify.
2. Merge duplicate selectors (keep last in cascade order).
3. Replace 50 `<link>` tags with 3 (+ optional debug).

### Phase 3 — Template trim
1. Cross-reference rules with `listProduction()` / `production-template-ids.mjs`.
2. Remove CSS for 26 unused legacy template IDs (see `TEMPLATE_ENGINE_REPORT.md`).
3. Collapse h16/h20/ats-elite per-file CSS into v3 families where redundant.

### Phase 4 — Lazy load
1. Load `templates.css` only when user enters Style step (or on first `renderCV`).
2. Keeps import/review path ~172 KB lighter on cold start.

## Risks

- **Cascade order**: 50 files impose order; bundling must preserve final specificity order.
- **Template false negatives**: Static corpus misses dynamically rendered CV classes.
- **PDF parity**: Print rules must stay byte-identical until `npm run qa:pdf-export` passes.
- **Import gate**: Consolidation is infrastructure; avoid visual polish churn until import gates PASS.

## Verification

```bash
npm run qa:css-consolidation   # regenerate this report
npm run qa:dom-contract
npm run qa:template-engine
# After bundle swap:
npm run qa:boot
```
