# Photo & Section Order Report (P1)

**Verdict:** PASS

**System:** `PHOTO_SECTION_ORDER_V1`

**Generated:** 2026-06-14T00:07:46.644Z

**Checks:** 23/23

## Goal

Optional profile photo with full editor controls, plus drag/reorder and hide/show for CV sections. State persists in the UI; templates respect order and visibility when compatible. PDF export must remain safe with no layout overflow.

## Photo capabilities

| Capability | Implementation |
|------------|----------------|
| Upload (jpg/png/webp) | `#proCvPhotoInput` → data URL in `state.photo` |
| Crop | `#photoEditorDialog` canvas square crop on save |
| Scale | Zoom slider → baked into crop or `photoCrop.zoom` |
| Reposition | X/Y sliders → `object-position` + crop offset |
| Hide on template | `state.photoPerTemplate[id]` + toggle |
| Remove | Clears `state.photo` and per-template flags |
| PDF export | `cv--with-photo` + inline styles + Playwright QA |
| Optional | CV renders without photo when disabled or absent |

## Section order capabilities

| Capability | Implementation |
|------------|----------------|
| Drag reorder | `#proCvSectionOrder` → `state.sectionOrder` |
| Hide / show | Checkbox per section → `state.sectionHidden` |
| Save in state | Passed via `safe.sectionOrder` + `safe.sectionHidden` in `renderCV` |
| Template respect | `resolveSectionOrder` + `stackFromSectionOrder` + `removeHiddenSectionsFromHtml` |
| Reset | Restores default order and clears hidden map |
| ATS hint | Warning when skills precede experience on ATS templates |

## Default section order

`summary → experience → clients → projects → education → skills → tools → languages → portfolio`

## Modules

| Module | Role |
|--------|------|
| `src/ui/pro/photo-system.mjs` | Photo state helpers + HTML builder |
| `src/ui/pro/section-order-system.mjs` | Order + visibility contract |
| `src/ui/pro/pro-cv-features.js` | Pro drawer UI (photo + sections) |
| `src/ui/pro/pro-cv-features.css` | Photo display + editor + section list |
| `src/ui/templates/cv-templates.js` | `resolveSectionOrder`, `removeHiddenSectionsFromHtml` |
| `index.html` | `getPhotoHtml`, state wiring, export path |

## QA suites

| Suite | Result |
|-------|--------|
| `qa-photo-section-order` | PASS |
| `qa-photo-system` | PASS |
| `qa-photo-section-reorder` | PASS |

## Unit checks

| Check | Result | Detail |
|-------|--------|--------|
| version | PASS | — |
| photo_module | PASS | — |
| photo_upload_markup | PASS | — |
| photo_scale | PASS | — |
| photo_reposition | PASS | — |
| photo_active | PASS | — |
| photo_hide | PASS | — |
| photo_remove | PASS | — |
| section_hide_state | PASS | — |
| section_visible_api | PASS | — |
| section_order_respects_hidden | PASS | — |
| section_reorder | PASS | — |
| section_hidden_render | PASS | — |
| hide_tools | PASS | — |
| no_section_duplication | PASS | — |
| photo_template_creative-director-portfolio | PASS | — |
| photo_template_luxury-executive | PASS | — |
| photo_template_classic-corporate | PASS | — |
| pdf_export | PASS | — |
| pdf_no_overflow_signal | PASS | — |
| v2_photo_support | PASS | — |
| index_photo_wiring | PASS | — |
| index_section_state | PASS | — |

## Rules

| Rule | Status |
|------|--------|
| Photo optional | PASS — CV valid with or without photo |
| No broken export | PASS |
| No layout overflow | PASS |
| Section hide removes DOM blocks | PASS |
| Templates respect custom order | PASS |

## Verify

```bash
npm run qa:photo-section-order
npm run photo-section-order-report
```

## Bench output

```
--- qa-photo-section-order ---
PASS version
PASS photo_module
PASS photo_upload_markup
PASS photo_scale
PASS photo_reposition
PASS photo_active
PASS photo_hide
PASS photo_remove
PASS section_hide_state
PASS section_visible_api
PASS section_order_respects_hidden
CV_TEMPLATE_BOOT_OK
PASS section_reorder
PASS section_hidden_render
PASS hide_tools
PASS no_section_duplication
CV_TEMPLATE_BOOT_OK
PASS photo_template_creative-director-portfolio
CV_TEMPLATE_BOOT_OK
PASS photo_template_luxury-executive
CV_TEMPLATE_BOOT_OK
PASS photo_template_classic-corporate
CV_TEMPLATE_BOOT_OK
PASS pdf_export
PASS pdf_no_overflow_signal
PASS v2_photo_support
PASS index_photo_wiring
PASS index_section_state

═══ Photo + Section Order: 23/23 PASS ═══
(node:72782) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/export/pdf-export-config.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

--- qa-photo-system ---
PASS version
PASS v2 templates supported
PASS upload markup
PASS scale in style
PASS position in style
PASS photo active kinfolk
PASS photo hidden ats default
PASS hidden by default list
PASS hide photo
PASS remove photo
CV_TEMPLATE_BOOT_OK
CV_TEMPLATE_BOOT_OK
PASS photo on ats-recruiter
CV_TEMPLATE_BOOT_OK
PASS photo off ats-recruiter
CV_TEMPLATE_BOOT_OK
PASS photo on mckinsey-consulting
CV_TEMPLATE_BOOT_OK
PASS photo off mckinsey-consulting
CV_TEMPLATE_BOOT_OK
PASS photo on apple-minimal
CV_TEMPLATE_BOOT_OK
PASS photo off apple-minimal
CV_TEMPLATE_BOOT_OK
PASS photo on kinfolk-editorial
CV_TEMPLATE_BOOT_OK
PASS photo off kinfolk-editorial
CV_TEMPLATE_BOOT_OK
PASS photo on creative-director-portfolio
CV_TEMPLATE_BOOT_OK
PASS photo off creative-director-portfolio
CV_TEMPLATE_BOOT_OK
PASS photo on luxury-executive
CV_TEMPLATE_BOOT_OK
PASS photo off luxury-executive
CV_TEMPLATE_BOOT_OK
PASS photo on startup-founder
CV_TEMPLATE_BOOT_OK
PASS photo off startup-founder
CV_TEMPLATE_BOOT_OK
PASS photo on tech-engineer
CV_TEMPLATE_BOOT_OK
PASS photo off tech-engineer
CV_TEMPLATE_BOOT_OK
PASS photo on art-director
CV_TEMPLATE_BOOT_OK
PASS photo off art-director
CV_TEMPLATE_BOOT_OK
PASS photo on classic-corporate
CV_TEMPLATE_BOOT_OK
PASS photo off classic-corporate
CV_TEMPLATE_BOOT_OK
PASS pdf export bytes
PASS pdf pages

qa-photo-system: PASS (32 pass / 0 fail)
(node:72845) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/export/pdf-export-config.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)

--- qa-photo-section-reorder ---
CV_TEMPLATE_BOOT_OK
OK HirelyTemplates boot
OK creative-director supports photo
OK editorial-magazine supports photo
OK ATS Elite photo hidden by default
OK photo visible in creative-director
OK creative template retains clients data
OK photo hidden in ATS when disabled
OK custom section order applied (skills before experience)
OK no section duplication after reorder
OK photo visible in editorial-magazine when enabled
OK ATS order warning when skills before experience
OK PDF export file created
OK PDF has at least one page
OK PDF export non-trivial size (includes layout)

Photo + section reorder QA: PASS
(node:72902) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/export/pdf-export-config.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
