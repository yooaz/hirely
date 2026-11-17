# Hirely — OCR local sans facturation (branche expérimentale)

Date : 17 novembre 2026 · `lab/local-ocr-no-billing-20261117`.

## Changements
- `src/core/extraction/ocr-pipeline.js` utilise Tesseract local comme seule voie active ; `HIRELY_FREE_OCR_ONLY = true` bloque Google Vision et le proxy OCR distant dans les fonctions `runOcrOnCanvas`, `runOcrOnCanvasWithLines` et `tryVisionApi`.
- **Optimisation de performance** : aucun `canvas.toBlob()` avant le chemin OCR local. L'ancien chemin convertissait les images haute définition en PNG inutilement avant de lancer Tesseract.
- Aucun nouveau modèle, service cloud, dépendance, abonnement ou GPU introduit.
- `src/tests/qa-local-ocr-no-billing.mjs` vérifie les gardes et le chemin local via des substituts de Tesseract ; cela ne certifie pas la reconnaissance réelle sur des CV.
- Les autres chemins d'import, export PDF, modèles de CV et le contenu de l'utilisateur sont inchangés.

## Ne PAS publier automatiquement
La branche laboratoire conserve le workflow d'origine sur main ; dans **cette branche uniquement**, `.github/workflows/golden-cv.yml` déclenche ses tests sur push vers main, pour éviter les runs automatiques à chaque commit expérimental. La branche principale et ses workflows restent intacts.

Tests locaux prévus :
```sh
node --test src/tests/qa-local-ocr-no-billing.mjs
npm run qa:pdf-image-ocr-decision
npm test
```

Vérifier les tests disponibles dans `package.json` avant toute exécution. Aucune action CI/preview/deploy/Netlify ne doit être déclenchée pour ce pilote.

## Validation manquante
Contrôler dans un navigateur réel : PDF native text, PDF scanné FR/EN, photo JPEG, numérisation multi-colonnes, CV DOCX, 20 fichiers réels consentis et export inchangé ; mesurer temps/mémoire par rapport à main. Vérifier tous les autres appels API éventuels : ce correctif cible **le pipeline OCR canvas** et ne prouve pas que tout Hirely soit dépourvu de services payants.
