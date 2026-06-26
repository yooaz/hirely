# Hirely PDF + Template Readability Pass — 2026-06-26

## Objectif

Continuer depuis la version qui importe correctement DOCX, puis améliorer:

- PDF texte
- paragraphes DOCX/PDF collés
- lisibilité des templates
- overflow
- Review / Style / Export
- bouton PDF export visible

## Corrections appliquées

### `src/ui/product/hirely-v1-stabilizer.js`

- Reconstruction PDF par lignes visuelles avec les coordonnées PDF.js.
- Ne joint plus toute une page PDF en une seule phrase.
- Ajout `fixJoinedWords()` pour corriger:
  - `Design2011`
  - `oldSpecialized`
  - `EducationLISAA`
  - mots collés après extraction PDF/DOCX
- Parsing CV plus robuste:
  - nom mieux détecté
  - résumé plus court
  - expérience séparée en bullets lisibles
  - éducation nettoyée
  - skills filtrés
- Nettoyage des séparateurs `|`, `•`, titres de sections.
- Review reste forcée après import pour empêcher l'ancien runtime de revenir à étape 1.

### `src/ui/product/hirely-v1-stabilizer.css`

- Lisibilité template améliorée.
- Header plus stable.
- Expériences avec espacement.
- Skills en pills lisibles.
- Overflow évité.
- Gallery Style limitée en hauteur pour ne pas cacher le CV.
- Export bar sticky en bas.
- Responsive preview renforcée.

## QA exécutée

PASS:

```bash
npm run check:core
npm run qa:vendor
node --check src/ui/product/hirely-v1-stabilizer.js
```

PASS serveur:

```txt
/ => 200
/src/ui/product/hirely-v1-stabilizer.js => 200
/vendor/pdf.min.mjs => 200
```

## Notes

PDF texte doit maintenant produire un CV lisible.
PDF scanné/protégé reste volontairement en fallback paste.
DOCX est amélioré mais dépend toujours de la qualité du texte source Word.
