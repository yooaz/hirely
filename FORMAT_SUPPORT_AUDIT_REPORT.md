# FORMAT_SUPPORT_AUDIT_REPORT

**Status:** PASS
**Generated:** 2026-06-11T00:18:43.209Z

## Pass criteria

Each format must either:

1. **Import correctly** — extract text, parse sections, render CV, export PDF
2. **Paste fallback** — clear non-blocking paste UI (no crash, no infinite loading)

## Summary

| Metric | Value |
|--------|-------|
| Formats tested | 9 |
| Imported successfully | 5 |
| Paste fallback (acceptable) | 4 |
| Failed | 0 |

## Per-format results

| Format | Import | Raw chars | Quality | Name | Email | Phone | Exp | Edu | Skills | Clients | CV render | PDF export | Outcome |
|--------|--------|-----------|---------|------|-------|-------|-----|-----|--------|---------|-----------|------------|---------|
| PDF selectable | ✓ | 1769 | 87 | ✓ | ✓ | ✓ | 12 | 0 | 14 | 5 | ✓ | ✓ | import |
| PDF scanned | ✓ | 0 | 0 | — | — | — | 0 | 0 | 0 | 0 | — | — | paste_fallback |
| PDF protected | ✓ | 0 | 0 | — | — | — | 0 | 0 | 0 | 0 | — | — | paste_fallback |
| DOCX | ✓ | 2490 | 88 | ✓ | ✓ | ✓ | 12 | 2 | 15 | 10 | ✓ | ✓ | import |
| DOC | ✓ | 2490 | 88 | ✓ | ✓ | ✓ | 12 | 2 | 15 | 10 | ✓ | ✓ | import |
| RTF | ✓ | 2490 | 88 | ✓ | ✓ | ✓ | 12 | 2 | 15 | 10 | ✓ | ✓ | import |
| TXT | ✓ | 2490 | 88 | ✓ | ✓ | ✓ | 12 | 2 | 15 | 10 | ✓ | ✓ | import |
| Image PNG | ✓ | 0 | 0 | — | — | — | 0 | 0 | 0 | 0 | — | — | paste_fallback |
| Image JPG | ✓ | 0 | 0 | — | — | — | 0 | 0 | 0 | 0 | — | — | paste_fallback |

## Format coverage

| Format | Expected path |
|--------|---------------|
| PDF selectable | Native pdf.js text layer → parser → render |
| PDF scanned | Empty/scan PDF → paste fallback (OCR optional in browser) |
| PDF protected | Corrupt/encrypted PDF → paste fallback |
| DOCX | mammoth + structure recovery → parser |
| DOC | mammoth legacy path (OOXML-as-DOC) → parser |
| RTF | Native RTF strip → parser |
| TXT | Direct read → parser |
| Image PNG/JPG | Browser OCR or paste fallback |

## Code paths

- `src/core/extraction/document-extract.js` — per-format extraction router
- `src/core/extraction/extract-file.js` — enrichment + import status
- `src/core/pipeline/hirely-import.js` — file → parse → resumeData
- `index.html` — `#importPasteFallback` non-blocking paste UI

## QA

```bash
npm run qa:format-support-audit
npm run format-support-audit-report
```

---

### Console output

```
tax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82299) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
HIRELY PDF.js open failed Error
    at BaseExceptionClosure (/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:463:29)
    at Object.<anonymous> (/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:466:2)
    at __w_pdfjs_require__ (/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:22782:42)
    at /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:23062:13
    at /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:23073:3
    at /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:23076:12
    at webpackUniversalModuleDefinition (/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:25:36)
    at Object.<anonymous> (/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:32:3)
    at Module._compile (node:internal/modules/cjs/loader:1829:14)
    at Module._extensions..js (node:internal/modules/cjs/loader:1969:10)
    at Module.load (node:internal/modules/cjs/loader:1552:32)
    at Module._load (node:internal/modules/cjs/loader:1354:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:255:19)
    at Module.require (node:internal/modules/cjs/loader:1575:12)
    at require (node:internal/modules/helpers:191:16)
    at bootstrapNodeExtractors (file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/tests/qa-format-support-audit.mjs:48:19) {
  message: 'Invalid PDF structure.',
  name: 'InvalidPDFException'
}
HIRELY PDF.js open failed Error
    at BaseExceptionClosure (/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:463:29)
    at Object.<anonymous> (/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:466:2)
    at __w_pdfjs_require__ (/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:22782:42)
    at /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:23062:13
    at /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:23073:3
    at /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:23076:12
    at webpackUniversalModuleDefinition (/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:25:36)
    at Object.<anonymous> (/Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/node_modules/pdfjs-dist/legacy/build/pdf.js:32:3)
    at Module._compile (node:internal/modules/cjs/loader:1829:14)
    at Module._extensions..js (node:internal/modules/cjs/loader:1969:10)
    at Module.load (node:internal/modules/cjs/loader:1552:32)
    at Module._load (node:internal/modules/cjs/loader:1354:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:255:19)
    at Module.require (node:internal/modules/cjs/loader:1575:12)
    at require (node:internal/modules/helpers:191:16)
    at bootstrapNodeExtractors (file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/tests/qa-format-support-audit.mjs:48:19) {
  message: 'Invalid PDF structure.',
  name: 'InvalidPDFException'
}
```
