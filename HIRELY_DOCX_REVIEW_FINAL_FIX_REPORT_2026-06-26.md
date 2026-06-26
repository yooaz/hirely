# Hirely DOCX + Review Final Fix — 2026-06-26

## Blocker visible dans la capture

Le fichier Word était lu, mais le rendu était un dump de texte en bloc:

- nom non détecté
- paragraphes DOCX écrasés
- Review pas correctement activé dans la barre d'étapes
- CV lisible partiellement mais pas structuré

## Corrections appliquées

### `src/ui/product/hirely-v1-stabilizer.js`

- Extraction DOCX reconstruite par paragraphes `w:p` et fragments `w:t`.
- Décodage XML propre.
- Nettoyage de texte moins destructeur.
- Split automatique des séparateurs `|`, `•` et titres de sections.
- Détection du nom améliorée.
- Parsing résumé / expérience / éducation / skills amélioré.
- Après import, verrouillage UI sur étape 2 `Relire`.
- Boutons Review / Style / Export réactivés si un CV existe.
- Forçage de la visibilité du CV après import pour éviter que l'ancien runtime remette l'étape 1.

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
```

## Commande

```bash
cd ~/Downloads
rm -rf hirely_FINAL_WORKING_IMPORT_REVIEW_EXPORT_2026-06-25
unzip -q hirely_DOCX_REVIEW_FINAL_FIXED_2026-06-26.zip
cd hirely_FINAL_WORKING_IMPORT_REVIEW_EXPORT_2026-06-25
lsof -ti:4321 | xargs kill -9 2>/dev/null || true
npm run dev
```
