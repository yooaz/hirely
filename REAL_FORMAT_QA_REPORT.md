# REAL_FORMAT_QA_REPORT

**Status:** PASS
**Engine:** `REAL_FORMAT_QA_V1`
**Generated:** 2026-06-11T00:58:53.284Z

## Scope

Real corpus files across selectable PDFs, scanned PDFs, DOCX, legacy DOC, TXT, and images.

## Allowed outcomes

| Outcome | Meaning |
|---------|---------|
| `IMPORT_READY` | Full import succeeded |
| `IMPORT_PARTIAL` | Partial text recovered, review continues |
| `IMPORT_NEEDS_PASTE` | Paste fallback shown — acceptable |
| `IMPORT_UNSUPPORTED` | Format not supported — terminal, no crash |

## Forbidden outcomes

| Outcome | Rule |
|---------|------|
| `IMPORT_CRASH` | Never — uncaught exception |
| `IMPORT_STUCK` | Never — loading/import exceeds timeout |

## Format coverage

| Category | Tested |
|----------|--------|
| PDF selectable | 3 (min 3) |
| PDF scanned | 3 (min 3) |
| DOCX | 3 (min 3) |
| DOC legacy | 1 (min 1) |
| TXT | 2 (min 2) |
| Image | 2 (min 2) |

## Outcome distribution (node)

- **IMPORT_READY**: 9
- **IMPORT_NEEDS_PASTE**: 5

## Per-file results

| File | Category | Outcome | Raw chars | Duration | Pass |
|------|----------|---------|-----------|----------|------|
| PDF selectable — Yoaz | pdf_selectable | IMPORT_READY | 1769 | 18700ms | ✓ |
| PDF selectable — Designer | pdf_selectable | IMPORT_READY | 760 | 8866ms | ✓ |
| PDF selectable — Consultant | pdf_selectable | IMPORT_READY | 775 | 5476ms | ✓ |
| PDF scanned — blank page | pdf_scanned | IMPORT_NEEDS_PASTE | 0 | 9ms | ✓ |
| PDF scanned — corrupt | pdf_scanned | IMPORT_NEEDS_PASTE | 0 | 4ms | ✓ |
| PDF scanned — protected | pdf_scanned | IMPORT_NEEDS_PASTE | 0 | 1ms | ✓ |
| DOCX — Yoaz | docx | IMPORT_READY | 2490 | 15105ms | ✓ |
| DOCX — Designer | docx | IMPORT_READY | 992 | 10287ms | ✓ |
| DOCX — Consultant | docx | IMPORT_READY | 845 | 8473ms | ✓ |
| DOC legacy — Yoaz | doc_legacy | IMPORT_READY | 2490 | 10285ms | ✓ |
| TXT — Yoaz | txt | IMPORT_READY | 2490 | 15187ms | ✓ |
| TXT — Developer | txt | IMPORT_READY | 891 | 1526ms | ✓ |
| Image — PNG | image | IMPORT_NEEDS_PASTE | 0 | 1ms | ✓ |
| Image — JPEG | image | IMPORT_NEEDS_PASTE | 0 | 0ms | ✓ |

## Browser stuck checks

| File | Outcome | Loading cleared | Pass |
|------|---------|-----------------|------|
| PDF scanned — blank page (browser) | IMPORT_NEEDS_PASTE | ✓ | ✓ |
| PDF scanned — corrupt (browser) | IMPORT_NEEDS_PASTE | ✓ | ✓ |
| PDF scanned — protected (browser) | IMPORT_NEEDS_PASTE | ✓ | ✓ |
| Image — PNG (browser) | IMPORT_NEEDS_PASTE | ✓ | ✓ |
| Image — JPEG (browser) | IMPORT_NEEDS_PASTE | ✓ | ✓ |

**Forbidden totals:** IMPORT_CRASH=0, IMPORT_STUCK=0

## Verify

```bash
npm run qa:real-format-qa
npm run real-format-qa-report
```

---

### Console

```

Wrote /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/tests/output/real-format-qa/report.json

All REAL FORMAT QA checks passed

(node:63524) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/import/canonical-import.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
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
    at bootstrapNodeExtractors (file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/tests/qa-real-format-qa.mjs:59:19) {
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
    at bootstrapNodeExtractors (file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/tests/qa-real-format-qa.mjs:59:19) {
  message: 'Invalid PDF structure.',
  name: 'InvalidPDFException'
}
(node:63524) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
```
