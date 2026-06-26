# Hirely Single Engine Final — 2026-06-26

## What changed

The old multi-runtime Hirely import stack was bypassed for the product UI.

This build uses one stable browser app:

- `index.html`
- `src/single-engine/app.js`
- `src/single-engine/app.css`

## Why

The previous app had multiple import/runtime layers competing:

- legacy import handlers
- OCR routing
- lazy vendor loader
- PDF worker loader
- fallback patch layer
- template/runtime patch layer

That caused repeated PDF failures and unstable UI state.

## Stable flow

Supported:

- TXT import
- DOCX import
- PDF text import through local PDF.js
- Paste fallback
- Review
- Template selection
- PDF export through local html2pdf
- Browser print fallback if html2pdf fails

PDF behavior:

- Text PDF: automatic extraction.
- Scanned/protected PDF: paste fallback with clear message.

## Local vendor assets

Uses:

- `/vendor/pdf.min.mjs`
- `/vendor/pdf.worker.min.mjs`
- `/vendor/jszip.min.js`
- `/vendor/html2pdf.bundle.min.js`

## QA run

PASS:

```bash
node --check src/single-engine/app.js
node --check scripts/dev-server.mjs
```

PASS server smoke on clean port:

```txt
/ => 200
/src/single-engine/app.js => 200
/src/single-engine/app.css => 200
/vendor/pdf.min.mjs => 200
```

## Command

```bash
cd ~/Downloads
rm -rf hirely_FINAL_WORKING_IMPORT_REVIEW_EXPORT_2026-06-25
unzip -q hirely_SINGLE_ENGINE_FINAL_WORKING_2026-06-26.zip
cd hirely_FINAL_WORKING_IMPORT_REVIEW_EXPORT_2026-06-25
lsof -ti:4321 | xargs kill -9 2>/dev/null || true
npm run dev
```

Open:

```txt
http://127.0.0.1:4321/
```
