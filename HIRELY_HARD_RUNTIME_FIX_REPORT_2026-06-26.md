# Hirely Hard Runtime Fix — 2026-06-26

## Problem seen in browser

Chrome still requested an old PDF.js path under:

`/node_modules/.pnpm/.../pdfjs-dist/build/pdf.min.mjs`

and got `404`.

## Hard fix applied

This build now has three protections:

1. `src/vendor/csp-safe-loader.js` uses `/vendor/...` paths.
2. `scripts/dev-server.mjs` aliases old `/node_modules/...` PDF/JSZip/html2pdf paths to `/vendor/...`.
3. The exact old PNPM-style paths now physically exist in `node_modules/.pnpm/...`, so even a simple static server cannot 404 the PDF.js file.

## Added physical aliases

- `node_modules/.pnpm/pdfjs-dist@4.2.67/node_modules/pdfjs-dist/build/pdf.min.mjs`
- `node_modules/.pnpm/pdfjs-dist@4.2.67/node_modules/pdfjs-dist/build/pdf.worker.min.mjs`
- `node_modules/pdfjs-dist/build/pdf.min.mjs`
- `node_modules/pdfjs-dist/build/pdf.worker.min.mjs`
- `node_modules/.vite/deps/pdfjs-dist_build_pdf_min_mjs.js`
- `node_modules/.vite/deps/pdfjs-dist_build_pdf_min_mjs.mjs`
- `node_modules/.pnpm/jszip@3.10.1/node_modules/jszip/dist/jszip.min.js`
- `node_modules/.pnpm/html2pdf.js@0.10.2/node_modules/html2pdf.js/dist/html2pdf.bundle.min.js`

## Flow protection

`src/ui/product/hirely-v1-stabilizer.js` now loads before the main inline app script and intercepts `#fileInput` in capture phase to prevent the old import handler from silently failing.

## Verified

Using the patched Node dev server:

- `/node_modules/.pnpm/pdfjs-dist@4.2.67/node_modules/pdfjs-dist/build/pdf.min.mjs` -> 200
- `/node_modules/pdfjs-dist/build/pdf.min.mjs` -> 200
- `/vendor/pdf.min.mjs` -> 200

## Start clean

Kill the old server first:

```bash
lsof -ti:4321 | xargs kill -9
```

Then run:

```bash
npm run dev
```

Open:

```txt
http://127.0.0.1:4321/
```

Then hard refresh:

```txt
Cmd + Shift + R
```
