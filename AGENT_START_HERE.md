# AGENT START HERE — Hirely functional build

Run from this exact folder:

```bash
npm run dev:ui
```

Open:

```txt
http://127.0.0.1:4321/
```

Do not serve an older nested folder.

## Fixed root cause

The browser must not load PDF.js from `/node_modules/...`.

Correct runtime vendor paths are now:

- `/vendor/pdf.min.mjs`
- `/vendor/pdf.worker.min.mjs`
- `/vendor/jszip.min.js`
- `/vendor/html2pdf.bundle.min.js`

Check:

```bash
npm run qa:vendor
```

## Do not do

- Do not redesign.
- Do not re-enable complex OCR as a hard dependency.
- Do not add a second import engine.
- Do not restore old panels.

## Expected behavior

- TXT, DOCX, PDF text and paste produce a visible CV.
- Scanned/image PDF shows paste fallback instead of fake structured OCR.
- Review, Style and Export remain accessible if raw text or a resume object exists.
