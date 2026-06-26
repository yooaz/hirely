# Local Tesseract OCR (CSP-safe)

Self-hosted Tesseract.js assets — **no CDN at runtime**.

Regenerate after `npm install`:

```bash
npm run setup:vendor-tesseract
```

Runtime paths are configured in `src/vendor/tesseract-runtime.js` and passed on every OCR call via `getLocalTesseractOptions()`.
