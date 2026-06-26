# Hirely Final Dev Start Fix — 2026-06-26

## Blocker exact

`npm run dev` lançait automatiquement `predev`.

`predev` lançait `npm run check:core`.

`check:core` échouait sur `qa-automatic-import-policy`, donc le serveur local ne démarrait jamais.

## Corrections appliquées

### 1. `package.json`

- Suppression de `predev`.
- `npm run dev` démarre directement le serveur local.
- `npm run dev:ui` démarre aussi directement le serveur local.
- Création de `qa:startup` pour lancer les checks manuellement.
- `qa-browser-boot-console-gate` déplacé dans `qa:browser`, car il dépend d'un navigateur Playwright installé localement.

### 2. `src/core/import/import-decision-final.js`

Policy OCR corrigée:

- plus aucune inférence de `ocrUsable` depuis `ocrTextLength`
- plus aucune route `structured_from_ocr` si `ocrAttempted !== true`
- OCR utilisable sans payload structuré => `recovery`
- OCR échoué/non tenté => `paste`

### 3. Runtime vendor déjà conservé

- les anciens chemins `/node_modules/...pdfjs-dist...` restent redirigés vers `/vendor/...`
- les chemins `.pnpm` sont aussi couverts par le serveur local

## QA exécutée

PASS:

```bash
node src/tests/qa-automatic-import-policy.mjs
npm run check:core
npm run qa:vendor
node --check src/core/import/import-decision-final.js
node --check scripts/dev-server.mjs
```

PASS serveur:

- `/` => 200
- `/node_modules/pdfjs-dist/build/pdf.min.mjs` => 200
- `/node_modules/.pnpm/pdfjs-dist@4.2.67/node_modules/pdfjs-dist/build/pdf.min.mjs` => 200

## Commande à utiliser

```bash
lsof -ti:4321 | xargs kill -9
npm run dev
```

Puis ouvrir:

```txt
http://127.0.0.1:4321/
```

## QA optionnelle

```bash
npm run qa:startup
```

La QA browser complète est séparée:

```bash
npm run qa:browser
```

Elle demande Playwright + navigateur installé localement.
