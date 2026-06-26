# Hirely PDF No-Worker Fix — 2026-06-26

## Problem

PDF import was still unreliable in the browser. The likely blocker is the PDF.js worker/runtime path on local servers.

## Fix

`src/ui/product/hirely-v1-stabilizer.js` now:

- loads PDF.js directly from `/vendor/pdf.min.mjs`
- tries fallback import paths
- forces `disableWorker: true`
- disables worker fetch and eval
- reconstructs text by visual lines
- if the PDF text is too short, shows a clear paste fallback instead of silently failing

## QA

PASS:

```bash
npm run qa:pdf
npm run qa:vendor
npm run check:core
node --check src/ui/product/hirely-v1-stabilizer.js
```

PASS server paths:

```txt
/ => 200
/vendor/pdf.min.mjs => 200
/src/ui/product/hirely-v1-stabilizer.js => 200
```

## Behavior

- PDF texte: direct PDF.js no-worker extraction
- PDF scanné/protégé: paste fallback
- DOCX/TXT/Paste: unchanged
