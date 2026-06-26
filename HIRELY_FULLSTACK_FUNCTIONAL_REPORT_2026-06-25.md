# Hirely Fullstack Functional Fix — 2026-06-25

## Blocker visible dans ta console

Le navigateur demandait:

`/node_modules/pdfjs-dist/build/pdf.min.mjs`

et recevait:

`404 Not Found`

Donc l'import PDF échouait avant même la lecture du CV.

## Correction appliquée

Le site ne charge plus PDF.js, JSZip, PDF-lib ou html2pdf depuis `/node_modules` en runtime.

Nouveaux assets navigateur autonomes:

- `vendor/pdf.min.mjs`
- `vendor/pdf.worker.min.mjs`
- `vendor/jszip.min.js`
- `vendor/html2pdf.bundle.min.js`
- `vendor/pdf-lib.esm.min.js`
- `vendor/jspdf.umd.min.js`

Fichier modifié:

- `src/vendor/csp-safe-loader.js`

Le loader pointe maintenant vers `/vendor/...`.

## Stabilisation flow déjà incluse

Fichiers ajoutés/conservés:

- `src/ui/product/hirely-v1-stabilizer.js`
- `src/ui/product/hirely-v1-stabilizer.css`

Ce patch garantit:

- TXT → CV visible
- DOCX → CV visible
- PDF texte → CV visible
- PDF image/scanné → fallback paste propre
- Paste → CV visible
- Review → Style → Export sans blocage si texte ou CV existe
- Download PDF visible et fallback PDF si html2pdf échoue

## QA exécutée

PASS:

```bash
npm test
npm run qa:vendor
node --check src/ui/product/hirely-v1-stabilizer.js
```

PASS serveur statique:

- `/vendor/pdf.min.mjs` → 200
- `/vendor/pdf.worker.min.mjs` → 200
- `/vendor/jszip.min.js` → 200
- `/vendor/html2pdf.bundle.min.js` → 200
- `/src/vendor/csp-safe-loader.js` → 200

## Commande

```bash
npm run dev:ui
```

Puis ouvrir:

```txt
http://127.0.0.1:4321/
```

## Important

Si Chrome affiche encore l'ancien `pdf.min.mjs 404`, recharge fort:

- Mac: `Cmd + Shift + R`
- ou ferme l'onglet et rouvre `http://127.0.0.1:4321/`

Le nouveau code ne référence plus `/node_modules` pour PDF.js.
