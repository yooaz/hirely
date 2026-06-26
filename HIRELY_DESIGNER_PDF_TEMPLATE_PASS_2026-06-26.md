# Hirely Designer PDF + Template Pass — 2026-06-26

## Corrections

- PDF texte: extraction directe PDF.js conservée, lignes visuelles améliorées.
- Parsing: meilleurs splits des lignes longues et séparateurs.
- Nom/titre: évite de prendre Portfolio/Behance comme titre.
- Expérience: dédoublonnée, bullets plus propres.
- Formation: repérage LISAA/Créapole/school/university.
- Skills: filtrage plus court et lisible.
- Templates: rendu plus premium, meilleure hiérarchie, meilleur spacing, bullets custom, header plus propre.
- Export/preview: overflow limité, gallery ne masque pas le CV.

## QA

PASS:
- `node --check src/ui/product/hirely-v1-stabilizer.js`
- `npm run check:core`
- `npm run qa:vendor`
