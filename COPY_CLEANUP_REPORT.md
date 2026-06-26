# COPY_CLEANUP_REPORT

**Status:** PASS
**Generated:** 2026-06-15T10:08:53.879Z

## Root cause

Missing i18n keys caused `applyI18n()` to render raw key names (e.g. `liImportDropHint`) via `t(k) ?? k`.

## Dropzone copy (FR)

| Line | Key | Text |
|------|-----|------|
| Title | dropTitle | Déposez votre CV |
| Subtitle | dropHint | PDF, DOCX, TXT ou image |
| Hint | dropActionHint | Glissez votre fichier ici, ou cliquez pour choisir un fichier. |

## Fixed strings

- **dropTitle** — FR: Déposez votre CV · EN: Drop your CV
- **dropHint** — FR: PDF, DOCX, TXT ou image · EN: PDF, DOCX, TXT or image
- **dropActionHint** — FR: Glissez votre fichier ici, ou cliquez pour choisir un fichier. · EN: Drag your file here, or click to choose a file.
- **liImportDropHint** — FR: (removed from main dropzone) · EN: (LinkedIn block only)
- **importPasteFallbackTitle** — FR: Nous avons besoin d'un peu plus de texte · EN: We need a little more text
- **importPasteFallbackLead** — FR: Collez le texte de votre CV ci-dessous pour continuer. · EN: Paste your CV text below so we can continue.
- **exportStepLead** — FR: Aperçu A4 — exactement ce qui sera dans votre PDF. · EN: A4 preview — exactly what will be in your PDF.
- **modeEdit** — FR: Mode édition · EN: Edit mode
- **modeRecruiter** — FR: Mode recruteur · EN: Recruiter preview
- **reviewSlimTitle** — FR: Relecture · EN: Review
- **spacingSpacious** — FR: Aéré · EN: Spacious
- **liImportTitle** — FR: Import LinkedIn · EN: LinkedIn import
- **liImportSub** — FR: Combinez export LinkedIn… · EN: Combine LinkedIn PDF…
- **liImportPickBtn** — FR: Ajouter LinkedIn et CV · EN: Add LinkedIn + resume files
- **coreLoadFail** — FR: Le moteur Hirely n'a pas chargé. · EN: Hirely engine failed to load.

## Browser verification

### French
```json
{
  "dropTitle": "Déposez votre CV",
  "dropHint": "PDF, DOCX, TXT ou image",
  "dropActionHint": "Glissez votre fichier ici, ou cliquez pour choisir un fichier.",
  "screenshot": "docs/screenshots/copy-cleanup/import-dropzone-fr-after.png"
}
```

### English
```json
{
  "dropTitle": "Drop your CV",
  "dropHint": "PDF, DOCX, TXT or image",
  "dropActionHint": "Drag your file here, or click to choose a file.",
  "screenshot": "docs/screenshots/copy-cleanup/import-dropzone-en-after.png"
}
```

## Screenshots

- Before: raw key `liImportDropHint` visible in dropzone (pre-fix; see git history)
- After FR: `docs/screenshots/copy-cleanup/import-dropzone-fr-after.png`
- After EN: `docs/screenshots/copy-cleanup/import-dropzone-en-after.png`

## Missing keys audit (data-i)

- FR missing (0): none
- EN missing (0): none
