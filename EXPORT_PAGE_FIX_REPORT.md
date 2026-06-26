# HIRELY P0 — Export Page Fix

**Result:** PASS
**Generated:** 2026-06-10T13:06:48.716Z

## Requirement

Export screen must show **exactly what will be exported**:

- Selected template name
- Full A4 preview (no blank canvas)
- PDF download button
- Cover letter button

No blank state. No hidden preview.

## QA snapshot

| Check | Value |
|-------|-------|
| Preview visible | yes |
| Template label | ATS Clean |
| CV live | yes |
| Preview name | Yohann Azancot |
| A4 stage height | 1484px |
| Export bar | visible |
| PDF button | yes |
| Letter button | yes |
| Letter panel default | closed |

## Root cause

1. `studioPreview` was only shown on the **edit** step — export hid the A4 canvas.
2. Export step scrolled to the **footer**, away from the preview.
3. Cover letter workspace auto-opened on export, crowding the layout.

## Fix

| Change | Location |
|--------|----------|
| Show preview on edit, style, and export | `syncResumeStudioChrome()` in `index.html` |
| Export step header with template name | `#exportStepHead` in `index.html` |
| A4 layout for style/export steps | `src/ui/studio/studio-layout.css` |
| Scroll to preview header, not footer | `setDocStep('export')` |
| Letter panel opens on user action only | `syncCoverLetterWorkspace()` |

## Gate

```bash
npm run test:export-page-fix
```

## Screenshot

![Export page A4 preview](tests/output/export-page-fix/export-page.png)

## QA output

```
OK style step shows A4 preview
OK doc step export (export)
OK studioPreview visible on export
OK preview height 1664px
OK A4 stage height 1484px
OK export step header visible
OK template label "ATS Clean"
OK cv live (415 chars)
OK preview name "Yohann Azancot"
OK export bar visible
OK PDF download button present
OK cover letter button present
OK letter panel closed until user opens

PASS export-page-fix
```

