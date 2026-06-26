# Hirely PDF Direct Loader Fix — 2026-06-26

## Blocker

Le PDF pouvait encore échouer parce que le stabilizer dépendait de `HirelyLazy.ensurePdf()`, donc de l'ancien runtime/loader.

## Fix

`src/ui/product/hirely-v1-stabilizer.js` charge maintenant PDF.js directement:

```js
await import('/vendor/pdf.min.mjs')
```

et force:

```js
pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs'
```

Donc le PDF texte ne dépend plus de:
- `/node_modules/...`
- ancien `HirelyLazy`
- ancien loader CSP

## Comportement

- PDF texte: lecture directe via `/vendor/pdf.min.mjs`
- PDF texte trop court: fallback paste avec log clair
- PDF scanné/protégé: fallback paste normal
- DOCX/TXT/Paste: inchangé

## QA

PASS:

```bash
node --check src/ui/product/hirely-v1-stabilizer.js
npm run qa:vendor
npm run check:core
```
