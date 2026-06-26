# Hirely Emergency Runtime Fix — 2026-06-26

## Ce que la capture montre

Le site lancé sur `127.0.0.1:4321` demande encore:

`/node_modules/.../pdfjs-dist/build/pdf.min.mjs`

et reçoit `404`.

Donc l'ancien import stack démarre avant le stabilizer et casse l'import PDF.

## Correction radicale appliquée

1. `scripts/dev-server.mjs`
   - redirige tous les anciens chemins `/node_modules/...pdfjs-dist...` vers `/vendor/pdf.min.mjs`
   - redirige les workers PDF vers `/vendor/pdf.worker.min.mjs`
   - redirige JSZip/html2pdf/pdf-lib/jsPDF vers `/vendor/...`
   - ajoute MIME `.gz` pour les assets OCR

2. `index.html`
   - charge `src/ui/product/hirely-v1-stabilizer.js` avant le gros script principal

3. `src/ui/product/hirely-v1-stabilizer.js`
   - intercepte `#fileInput` au niveau `document` en capture phase
   - stoppe l'ancien handler import avant qu'il lance l'ancien PDF loader
   - gère TXT/DOCX/PDF texte/Paste et fallback PDF scanné

4. `package.json`
   - `npm run dev` et `npm run dev:ui` utilisent maintenant le même serveur Node corrigé

## QA exécutée

PASS:

```bash
npm run qa:vendor
npm test
node --check src/ui/product/hirely-v1-stabilizer.js
node --check scripts/dev-server.mjs
```

PASS alias serveur:

- `/vendor/pdf.min.mjs` → 200
- `/node_modules/pdfjs-dist/build/pdf.min.mjs` → 200
- `/node_modules/.pnpm/pdfjs-dist@4.2.67/node_modules/pdfjs-dist/build/pdf.min.mjs` → 200
- `/node_modules/pdfjs-dist/build/pdf.worker.min.mjs` → 200
- `/node_modules/jszip/dist/jszip.min.js` → 200

## Commande

```bash
npm run dev
```

ou

```bash
npm run dev:ui
```

Puis:

```txt
http://127.0.0.1:4321/
```

## Important

Après unzip, ferme l'ancien serveur puis relance.

Si la console garde une ancienne erreur, fais un hard refresh:

```txt
Cmd + Shift + R
```
