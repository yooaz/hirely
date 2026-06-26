# Hirely PDF WorkerSrc Fix — 2026-06-26

## Erreur exacte corrigée

Console:

`No "GlobalWorkerOptions.workerSrc" specified.`

Le précédent patch tentait de désactiver le worker. PDF.js refusait quand même.

## Correction

`src/ui/product/hirely-v1-stabilizer.js` configure maintenant explicitement:

```js
pdfjs.GlobalWorkerOptions.workerSrc = new URL('/vendor/pdf.worker.min.mjs', window.location.origin).href
```

et utilise PDF.js normalement.

## QA

PASS:

```bash
node --check src/ui/product/hirely-v1-stabilizer.js
npm run qa:pdf
npm run qa:vendor
npm run check:core
```

PASS serveur:

```txt
/ => 200
/vendor/pdf.min.mjs => 200
/vendor/pdf.worker.min.mjs => 200
```

## Résultat attendu

- PDF texte: extraction PDF.js avec worker local.
- PDF scanné/protégé: fallback paste.
