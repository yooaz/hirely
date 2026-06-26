# CSP Eval Fix Report

**Status:** PASS
**Date:** 2026-06-11

## Goal

Remove `eval()`, `new Function()`, and string-based timers from Hirely runtime paths. Enforce CSP **without** `unsafe-eval`.

## First-party static scan

- No `eval(`, `new Function(`, or string `setTimeout`/`setInterval` in app source.

## Remediation

| Area | Before | After |
|------|--------|-------|
| Vendor scripts | CDN UMD bundles (pdf.js used eval paths) | Same-origin `node_modules` via `src/vendor/csp-safe-loader.js` |
| PDF.js | CDN 3.11 + default eval | `pdfjs-dist@4.2.67` ESM + `isEvalSupported: false` |
| DOCX | mammoth + jszip CDN (`new Function`) | Self-hosted JSZip + native OOXML recovery (mammoth removed from browser) |
| PDF export | html2pdf CDN | Self-hosted `html2pdf.js` bundle (no eval in bundle) |
| OCR | tesseract CDN | Self-hosted `tesseract.js` + `wasm-unsafe-eval` only (not `unsafe-eval`) |
| CSP | none | Meta + Vercel header, no `unsafe-eval` |

## Browser verification

| Check | Result |
|-------|--------|
| pdf.js loaded | yes |
| isEvalSupported=false | yes |
| pdf-lib loaded | yes |
| JSZip loaded | yes |
| html2pdf loaded | yes |
| mammoth absent | yes |
| CSP meta (no unsafe-eval) | yes |
| CSP violation events | 0 |
| eval/CSP console errors | 0 |

## Run

```bash
npm run csp-eval-fix-report
```
