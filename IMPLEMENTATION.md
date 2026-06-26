# Hirely — implementation notes (OCR, UI, cleanup)

## 1. OCR

### Preprocessing (`src/core/extraction/ocr-preprocess.js`)
- Deskew (±2°, 0.5° steps via horizontal projection score)
- Upscale ×2
- Grayscale median denoise (3×3)
- Otsu binarization + contrast

### Tesseract (`src/core/extraction/ocr.js`)
- CDN: Tesseract.js v5 (LSTM engine when `OEM.LSTM_ONLY` is available)
- Languages: `fra+eng`
- Page segmentation: auto (`PSM.AUTO` / mode 3)

### Cloud OCR (optional)
- Set in browser: `window.HIRELY_CLOUD_OCR_URL` (POST multipart `file`)
- Optional: `window.HIRELY_CLOUD_OCR_KEY` for `Authorization: Bearer …`
- Response JSON: `{ "text": "..." }` or plain text
- Used for images and as PDF fallback before local OCR

### Post-processing (`src/core/parsing/ocr-postprocess.js`)
- Character fixes (0/O, RN/M, ligatures)
- Section header normalization (EXPÉRIENCE, FORMATION, …)
- Light French/EN CV word hints
- Wired in `extract-file.js` (OCR paths) and `cleanExtraction()` when text looks OCR-noisy

## 2. Core loading / `emptyCVData`

- `index.html` loads `./src/core/index.js` (also absolute URL fallback)
- Inline fallback sets `__hirelyFallback: true` and `emptyCVData: blank` (no recursion)
- `emptyCVData()` in UI skips delegation when fallback is active

## 3. Templates (premium trio)

| ID | Nom | Style |
|----|-----|--------|
| `premium-moderne` | Corporate moderne | Bleu, barres compétences |
| `premium-classique` | Minimaliste | Beige/gris, épuré |
| `premium-creatif` | Créatif | Magazine, graphique |
| `premium-luxe` | Luxe | Sidebar, accent or |

14 production templates total — see `src/ui/templates/production-template-ids.mjs`.

Styles: `src/ui/templates/cv-templates-premium.css`  
Registry: `src/ui/templates/cv-templates.js` (13 templates total; `ats` = free)

## 4. Repository cleanup

- Removed stale root `cv-templates-premium.css` (use `src/ui/templates/` only)
- Root `cv-templates.js` remains a deprecation shim
- `archive/` kept for history (do not import)

## 5. Vercel

- `vercel.json` rewrites exclude `/src/` so `src/core/index.js` is served as a static ES module
- Run `npm run dev` locally on port 3000

## 6. Tests

```bash
npm run test:extract
npm run qa:extraction
npm run qa:core-flow
npm run qa:smoke
node src/tests/ocr-postprocess-test.mjs
npm run qa:browser   # requires dev server
```

## 7. UI / export

- Document-first shell: `src/ui/hirely-document.css` (loaded after inline CSS in `index.html`)
- PDF export: `html2pdf` in `index.html` (`downloadPDF`) — A4 794×1123px, no forced min-height blank pages
