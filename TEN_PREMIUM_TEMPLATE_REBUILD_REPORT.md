# Ten Premium Template Rebuild Report (P1)

**Verdict:** PASS

**Rebuild:** `TEN_PREMIUM_TEMPLATE_REBUILD_V1`

**Generated:** 2026-06-14T00:02:57.402Z

**Prerequisite:** Import + review gates must pass before template gallery unlocks.

**Review lock:** PASS (13/13 checks)

**Template QA:** 86/86 checks

## Goal

Ten distinct premium templates — different **layouts**, not just fonts. Same `finalResumeData` for all. Free users can **preview and select** any template; **PDF export** remains Pro-only.

## Catalog

| # | Display name | ID | Layout family | Brief | Page-1 | Empty sections |
|---|--------------|-----|---------------|-------|--------|----------------|
| 1 | ATS Recruiter | `ats-recruiter` | dense-single | Single column · 72ch measure · contact utility band · Parse density · role-date-company rows · zero decoration | PASS | 0 |
| 2 | McKinsey Consulting | `mckinsey-consulting` | consulting-split | 4/8 asymmetric split · impact matrix footer band · Quantified outcomes · engagement framing · board credibility | PASS | 0 |
| 3 | Apple Minimal | `apple-minimal` | timeline-minimal | Single column · 56px side margins · vertical timeline spine · Clarity · one idea per band · keynote restraint | PASS | 0 |
| 4 | Kinfolk Editorial | `kinfolk-editorial` | magazine-spread | 3-column magazine spread · feature column center · Culture narrative · selected work · literary pacing | PASS | 0 |
| 5 | Creative Director | `creative-director-portfolio` | portfolio-hero | Hero band · 3-col client grid · 2-col project cases · Brand proof · client logos grid · case-study rhythm | PASS | 0 |
| 6 | Luxury Executive | `luxury-executive` | executive-centered | Centered masthead · full-width achievements ribbon · single narrative · C-suite presence · achievement ribbon · serif gravitas | PASS | 0 |
| 7 | Startup Founder | `startup-founder` | founder-split | Venture hero · traction metrics strip · 22/78 operator split · ARR · growth · team scale · venture narrative | PASS | 0 |
| 8 | Tech Engineer | `tech-engineer` | tech-rail | 28/72 dark skills rail · mono identity header · Languages · frameworks · systems shipped | PASS | 0 |
| 9 | Art Director Portfolio | `art-director` | campaign-masthead | Full-bleed campaign masthead · 2-col press/awards · project reel · Luxury campaigns · platform links · press quotes | PASS | 0 |
| 10 | Classic Corporate | `classic-corporate` | corporate-split | Corporate masthead · 68/32 credentials split · ruled summary band · Fortune-500 discipline · dual-rule header · recruiter scan order | PASS | 0 |

## Rules

| Rule | Status |
|------|--------|
| Same finalResumeData | `resumeDataToTemplateView` → `HirelyTemplates.render` |
| Different layouts (not fonts only) | PASS — ≥8 layout families |
| No fake content | QA rejects lorem / placeholders |
| Empty sections hidden | Early-return + completeness lock |
| A4 safe | 794×1123 px sheets |
| PDF safe | Playwright vector export per template |
| Readable at 100% | Density + page-1 fill gates |
| First page not empty | Identity + major sections on page 1 |
| Free preview all templates | PASS |
| Export Pro lock only | `requirePro()` on download — preview never paywalled |

## Gate suites

| Suite | Result |
|-------|--------|
| `reviewBeforeTemplateLock` | PASS |
| `tenPremium` | PASS |
| `v2Families` | PASS |
| `freePreview` | PASS |

## Modules

| Module | Role |
|--------|------|
| `template-families-v2.mjs` | Canonical 10 IDs, names, architecture |
| `cv-templates.js` | Layout functions (`layoutClassicCorporate`, etc.) |
| `cv-templates-v2-families.css` | Per-family structural CSS |
| `review-before-template-lock.js` | Blocks template step until review safe |
| `free-template-preview-mode.js` | Preview all · export Pro |

## Run

```bash
npm run qa:review-before-template-lock
npm run qa:ten-premium-templates
npm run qa:template-system-v2-families
npm run ten-premium-template-rebuild-report
```

## Bench output

```
--- review-before-template-lock ---
PASS policy_version
PASS classify_uncertain_name
PASS classify_uncertain_experience
PASS non_critical_skill
PASS blocks_template_uncertain_name
PASS blocks_export_uncertain_name
PASS shows_name_reason
PASS blocks_template_ocr_fallback
PASS ocr_action
PASS unlocks_template_when_clear
PASS unlocks_export_when_clear
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 0,
  education: 0,
  skills: 1,
  tools: 0,
  languages: 0,
  clients: 0,
  projects: 0,
  unsorted: 2
}
PASS pipeline_blocks_template_with_review
PASS pipeline_no_profil_experience

═══ Review Before Template Lock: 13/13 PASS ═══
(node:59963) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/validation/review-before-template-lock.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

--- ten-premium-templates ---
PASS version
PASS engine_version
PASS count_10
PASS free_preview_mode
PASS user_facing_names
CV_TEMPLATE_BOOT_OK
PASS ats-recruiter:name
PASS ats-recruiter:renders_identity
PASS ats-recruiter:no_placeholder
PASS ats-recruiter:completeness_lock
PASS ats-recruiter:no_empty_sections
PASS ats-recruiter:page1_useful
PASS ats-recruiter:export_pro_locked
PASS ats-recruiter:pdf_safe
PASS mckinsey-consulting:name
PASS mckinsey-consulting:renders_identity
PASS mckinsey-consulting:no_placeholder
PASS mckinsey-consulting:completeness_lock
PASS mckinsey-consulting:no_empty_sections
PASS mckinsey-consulting:page1_useful
PASS mckinsey-consulting:export_pro_locked
PASS mckinsey-consulting:pdf_safe
PASS apple-minimal:name
PASS apple-minimal:renders_identity
PASS apple-minimal:no_placeholder
PASS apple-minimal:completeness_lock
PASS apple-minimal:no_empty_sections
PASS apple-minimal:page1_useful
PASS apple-minimal:export_pro_locked
PASS apple-minimal:pdf_safe
PASS kinfolk-editorial:name
PASS kinfolk-editorial:renders_identity
PASS kinfolk-editorial:no_placeholder
PASS kinfolk-editorial:completeness_lock
PASS kinfolk-editorial:no_empty_sections
PASS kinfolk-editorial:page1_useful
PASS kinfolk-editorial:export_pro_locked
PASS kinfolk-editorial:pdf_safe
PASS creative-director-portfolio:name
PASS creative-director-portfolio:renders_identity
PASS creative-director-portfolio:no_placeholder
PASS creative-director-portfolio:completeness_lock
PASS creative-director-portfolio:no_empty_sections
PASS creative-director-portfolio:page1_useful
PASS creative-director-portfolio:export_pro_locked
PASS creative-director-portfolio:pdf_safe
PASS luxury-executive:name
PASS luxury-executive:renders_identity
PASS luxury-executive:no_placeholder
PASS luxury-executive:completeness_lock
PASS luxury-executive:no_empty_sections
PASS luxury-executive:page1_useful
PASS luxury-executive:export_pro_locked
PASS luxury-executive:pdf_safe
PASS startup-founder:name
PASS startup-founder:renders_identity
PASS startup-founder:no_placeholder
PASS startup-founder:completeness_lock
PASS startup-founder:no_empty_sections
PASS startup-founder:page1_useful
PASS startup-founder:export_pro_locked
PASS startup-founder:pdf_safe
PASS tech-engineer:name
PASS tech-engineer:renders_identity
PASS tech-engineer:no_placeholder
PASS tech-engineer:completeness_lock
PASS tech-engineer:no_empty_sections
PASS tech-engineer:page1_useful
PASS tech-engineer:export_pro_locked
PASS tech-engineer:pdf_safe
PASS art-director:name
PASS art-director:renders_identity
PASS art-director:no_placeholder
PASS art-director:completeness_lock
PASS art-director:no_empty_sections
PASS art-director:page1_useful
PASS art-director:export_pro_locked
PASS art-director:pdf_safe
PASS classic-corporate:name
PASS classic-corporate:renders_identity
PASS classic-corporate:no_placeholder
PASS classic-corporate:completeness_lock
PASS classic-corporate:no_empty_sections
PASS classic-corporate:page1_useful
PASS classic-corporate:export_pro_locked
PASS classic-corporate:pdf_safe
PASS featured_gallery_sync

═══ Ten Premium Templates: 86/86 PASS ═══
(node:59986) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/import/import-stability-lock.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

--- template-system-v2-families ---
CV_TEMPLATE_BOOT_OK
PASS v2 css exists
PASS ten premium sync
PASS resolve ats-recruiter
PASS render ats-recruiter
PASS wrapV2 ats-recruiter
PASS resolve mckinsey-consulting
PASS render mckinsey-consulting
PASS wrapV2 mckinsey-consulting
PASS resolve apple-minimal
PASS render apple-minimal
PASS wrapV2 apple-minimal
PASS resolve kinfolk-editorial
PASS render kinfolk-editorial
PASS wrapV2 kinfolk-editorial
PASS resolve creative-director-portfolio
PASS render creative-director-portfolio
PASS wrapV2 creative-director-portfolio
PASS resolve luxury-executive
PASS render luxury-executive
PASS wrapV2 luxury-executive
PASS resolve startup-founder
PASS render startup-founder
PASS wrapV2 startup-founder
PASS resolve tech-engineer
PASS render tech-engineer
PASS wrapV2 tech-engineer
PASS resolve art-director
PASS render art-director
PASS wrapV2 art-director
PASS resolve classic-corporate
PASS render classic-corporate
PASS wrapV2 classic-corporate
PASS distinct layout families >= 8
PASS alias ats-elite
PASS alias consulting
PASS display names
PASS classic corporate grid
PASS mckinsey split html
PASS ats recruiter table

qa-template-system-v2-families: PASS (39 pass / 0 fail)
(node:60403) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/export/pdf-export-config.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

--- free-template-preview-mode ---
PASS policy_version
PASS preview_allowed_flag
PASS index_wiring
PASS featured_count
PASS no_render_downgrade
PASS no_switch_paywall
PASS pro_badge_css
PASS export_still_pro
PASS switch_updates_preview
PASS pro_tier_locked_export_meta
PASS free_tier_not_locked
PASS featured_listed_ats-recruiter
PASS featured_listed_mckinsey-consulting
PASS featured_listed_apple-minimal

═══ Free Template Preview Mode: 14/14 PASS ═══
(node:60426) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/ui/templates/free-template-preview-mode.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
