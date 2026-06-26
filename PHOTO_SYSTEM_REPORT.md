# PHOTO_SYSTEM_REPORT

Generated: 2026-06-13T09:21:20.016Z

## P2 status

| Item | Value |
|------|-------|
| Version | `PHOTO_SYSTEM_V2` |
| Module | `src/ui/pro/photo-system.mjs` |
| UI | `src/ui/pro/pro-cv-features.js` + `#photoEditorDialog` |
| Template slot | `photoSlot()` in `cv-templates.js` headers |
| PDF | `cv--with-photo` + `cv-pdf-export.css` + Playwright QA |
| QA | **PASS** |

## Capabilities

| Action | Implementation |
|--------|----------------|
| **Upload** | `#proCvPhotoInput` / `#photoInput` — JPEG, PNG, WebP → base64 local state |
| **Crop** | `#photoEditorDialog` — canvas square crop on save (512×512 JPEG) |
| **Scale** | Zoom slider 1×–3× in editor; baked into image on save |
| **Position** | X/Y sliders → `object-position` + editor preview transform |
| **Hide photo** | `hidePhotoOnTemplate()` + « Masquer » + per-template checkbox |
| **Remove photo** | `removePhoto()` clears asset + crop + per-template map |

## Template support (photo on / off)

All **10 V2 families** support optional photo via `cv--with-photo` class:

- `ats-recruiter`
- `mckinsey-consulting`
- `apple-minimal`
- `kinfolk-editorial`
- `creative-director-portfolio`
- `luxury-executive`
- `startup-founder`
- `tech-engineer`
- `art-director`
- `freelance-creative`

**Hidden by default** (user must enable): `ats`, `ats-elite`, `ats-recruiter`, `ats-executive`

**Accepted formats:** image/jpeg, image/png, image/webp

## Data model (local only)

```javascript
state.photo          // data URL (never sent to server)
state.photoCrop      // { zoom, x, y } — reset after canvas bake
state.includePhoto   // global toggle for active template
state.photoPerTemplate // { [templateId]: boolean }
```

## PDF export path

1. `renderCV()` sets `#cvDoc.cv--with-photo` when `isPhotoActive()`
2. `getPhotoHtml()` injects `<div class="cvPhotoWrap"><img class="cvPhoto">`
3. Export adds `body.export-pdf` + `cv-pdf-export.css` rules (88px circle, object-fit cover)
4. Playwright print path includes `cv-templates-v2-families.css` + `pro-cv-features.css`

## QA snapshot

| Suite | Result |
|-------|--------|
| `qa-photo-system` | **PASS** |
| `qa-photo-section-reorder` | **FAIL** |

## Verification

```bash
npm run qa:photo-system
npm run photo-system-report
```
