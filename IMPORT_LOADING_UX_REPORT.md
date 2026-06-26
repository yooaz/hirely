# HIRELY UX P1 — Import Loading Experience

**Result:** PASS
**Generated:** 2026-06-08T22:00:51.858Z

## Goal

During CV import, the user always sees what Hirely is doing — no blank wait, no technical errors.

## Loading steps (French product copy)

| Step | Label | Explanation |
|------|-------|-------------|
| 1 | Lecture du fichier… | Nous ouvrons votre PDF, Word ou fichier texte. |
| 2 | Extraction du texte… | Nous récupérons le contenu de votre CV. |
| 3 | Analyse des sections… | Expérience, formation, compétences et coordonnées. |
| 4 | Création du CV propre… | Nous structurons votre parcours pour l'aperçu. |
| 5 | Préparation de l'aperçu… | Dernières vérifications avant affichage. |

## UX elements

- Progress bar (visible during `wsImport--loading`)
- Step title (`#importLiveStatus`)
- Short explanation (`#importLoadingDetail`)
- Estimated wait: *Cela peut prendre 10 à 30 secondes selon le fichier.*
- After **8s**: *Vous pouvez aussi coller le texte du CV.* (`#importLoadingPasteHint`)

## Scope

- **UI only** — `index.html` + CSS
- No OCR/parser pipeline changes

## QA checks

| Check | Status |
|-------|--------|
| Lecture du fichier… | PASS |
| Extraction du texte… | PASS |
| Analyse des sections… | PASS |
| Création du CV propre… | PASS |
| Préparation de l'aperçu… | PASS |

## Gate

| Command | Status |
|---------|--------|
| `npm run qa:import-loading-ux` | PASS |

```bash
npm run import-loading-ux-report
```