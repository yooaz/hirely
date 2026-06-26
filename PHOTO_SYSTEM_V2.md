# Photo System V2 Audit

Generated: 2026-06-14
Engine: `PHOTO_SYSTEM_V2`

## User-reported issues

| Issue | Root cause (V1) | V2 fix |
|-------|-----------------|--------|
| Photo overlaps text | `transform: scale()` on `.cvPhoto` escaped the wrap | Scale removed; crop baked into image; `overflow: hidden` safe zone |
| Photo disappears | Simple upload never set `includePhoto`; ATS templates hidden by default | Upload enables photo per template; `cv--with-photo` gated on `isPhotoActive()` |
| Photo breaks templates | Inconsistent slot sizing + float layouts | Fixed 88×88 circle, grid gap, `float: none` on V2 headers |

## Audit areas

### 1. Image upload

- **Paths:** `#proCvPhotoInput` (Pro drawer), `#photoInput` (import panel)
- **Formats:** JPEG, PNG, WebP → local base64 (`state.photo`)
- **V2:** Auto square crop + face-centered focus on upload

### 2. Image crop

- **Manual:** `#photoEditorDialog` — zoom/X/Y sliders, canvas bake on save (512×512 JPEG)
- **Automatic:** `autoCropPhotoDataUrl()` — square crop with portrait focus heuristic
- **Face centering:** `inferPortraitFocusPoint()` — portrait Y=38%, landscape Y=45%, square Y=42%

### 3. Image scaling

- **Removed:** Live `transform: scale(zoom)` (overlap risk)
- **Safe display:** `object-fit: cover` inside fixed 88×88 wrap
- **Zoom:** Applied only during editor crop bake, not at render time

### 4. Template placement

- Slot: `photoSlot()` → `getPhotoHtml()` in `cv-templates.js` headers
- Class gate: `#cvDoc.cv--with-photo` when `isPhotoActive(state, templateId)`
- Per-template toggle: `state.photoPerTemplate[templateId]`
- Hidden by default: `ats`, `ats-elite`, `ats-recruiter`, `ats-executive`

### 5. PDF rendering

- Export: `body.export-pdf` + `photo-system-v2.css` + `cv-pdf-export.css`
- Rules: 88px circle, `overflow: hidden`, `transform: none`
- Packet V2 export clones live `#cvDoc` sheets (WYSIWYG)

## Safe zone contract

| Rule | Value |
|------|-------|
| Max photo size | 88×88 px |
| Text gap | 12 px minimum |
| Wrap overflow | `hidden` (clip) |
| Transform at render | `none` |
| Export resolution | 512×512 JPEG after crop |

## Requirements checklist

| Requirement | Status |
|-------------|--------|
| Photo must never overlap text | ✅ Safe wrap + no scale transform |
| Automatic crop | ✅ On upload + editor save |
| Automatic face centering | ✅ Portrait heuristic (no ML dep) |
| Safe zones | ✅ CSS `photo-system-v2.css` |

## Files

| File | Role |
|------|------|
| `src/ui/pro/photo-system-v2.mjs` | Core: auto crop, face focus, safe HTML |
| `src/ui/pro/photo-system-v2.js` | Browser facade |
| `src/ui/pro/photo-system-v2.css` | Safe zone layout + PDF rules |
| `src/ui/pro/photo-system.mjs` | Template support + V2 delegation |
| `src/ui/pro/pro-cv-features.js` | Upload UI, editor, per-template toggle |

## QA snapshot

| Suite | Result |
|-------|--------|
| `qa-photo-system-v2` | **PASS** |
| `qa-photo-system` | **FAIL** |

```bash
npm run qa:photo-system-v2
npm run photo-system-v2-report
npm run qa:photo-system
```

## Future improvements

- Optional `FaceDetector` API when available in browser
- Template-specific photo sizes (sidebar vs header)
- Regression screenshots per template with photo on/off
