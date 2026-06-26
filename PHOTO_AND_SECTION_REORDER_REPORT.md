# Photo + Section Reorder (Pro)

**Status:** PASS  
**Generated:** 2026-06-11T08:19:50.769Z  
**QA checks:** 14/14

## Features

### 1. Profile photo (Pro)

| Capability | Implementation |
|------------|----------------|
| Upload jpg/png/webp | `#proCvPhotoInput` + import panel `#photoInput` |
| Crop / zoom / position | `#photoEditorDialog` canvas crop |
| Remove | Supprimer + reset state |
| Per-template toggle | `state.photoPerTemplate` + « Afficher sur ce modèle » |
| Local only | Data URL in `state.photo` — no server upload |
| ATS Elite default | Hidden unless enabled for template |
| Creative / Executive / Editorial | Supported via `photoSlot()` in template heads |
| PDF export | `cv--with-photo` + `cv-pdf-export.css` + Playwright QA |
| A4 safe | 88px circular photo, max dimensions in CSS |

### 2. Section reordering (Pro)

| Capability | Implementation |
|------------|----------------|
| Drag-and-drop list | `#proCvSectionOrder` |
| State | `state.sectionOrder` |
| Template render | `stackUniversal` / `stackAtsElite` + `applySectionOrderToHtml` |
| ATS warning | Skills before experience on ATS Elite |
| PDF export | Same render path as preview |
| No duplication | Section count parity check in QA |

## Default section order

`summary → experience → clients → projects → education → skills → tools → languages → portfolio`

## Files

| File | Role |
|------|------|
| `src/ui/pro/pro-cv-features.js` | Photo editor + section order UI |
| `src/ui/pro/pro-cv-features.css` | Pro bar, photo display, editor dialog |
| `src/ui/templates/cv-templates.js` | `resolveSectionOrder`, `applySectionOrderToHtml` |
| `index.html` | Pro bar, state wiring, `getPhotoHtml` |

## Acceptance checklist

- [x] HirelyTemplates boot
- [x] creative-director supports photo
- [x] editorial-magazine supports photo
- [x] ATS Elite photo hidden by default
- [x] photo visible in creative-director
- [x] creative template retains clients data
- [x] photo hidden in ATS when disabled
- [x] custom section order applied (skills before experience)
- [x] no section duplication after reorder
- [x] photo visible in editorial-magazine when enabled
- [x] ATS order warning when skills before experience
- [x] PDF export file created
- [x] PDF has at least one page
- [x] PDF export non-trivial size (includes layout)

## Commands

```bash
npm run qa:photo-section-reorder
npm run photo-section-reorder-report
```
