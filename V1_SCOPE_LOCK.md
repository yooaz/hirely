# V1 Scope Lock

**Generated:** 2026-06-16T07:01:22.999Z
**Status:** **PASS** (19/19 checks)
**Version:** `V1_SCOPE_LOCK_V1`

## Frozen scope

### Supported (V1)

| Format | Notes |
| --- | --- |
| **Text PDF** | Native text layer via PDF.js — no OCR |
| **DOCX** | Word Open XML |
| **TXT** | Plain text file |
| **Pasted text** | Paste panel — first-class path |

### Not supported (V1)

| Feature | User-facing behavior |
| --- | --- |
| **OCR** | Disabled — `HIRELY_OCR_DISABLED_V1=true` |
| **Scanned PDF auto-read** | Paste fallback with honest copy |
| **Image CV auto-read** | Rejected at extraction — paste fallback |
| **AI rewriting** | `HIRELY_AI_RECONSTRUCTION=false` |
| **ATS intelligence blockers** | No template/export lock from review/quality gates |

## Runtime flags (`index.html`)

```javascript
HIRELY_V1_SCOPE_LOCK = true
HIRELY_V1_IMPORT = true
HIRELY_SIMPLE_IMPORT_MODE = true
HIRELY_OCR_DISABLED_V1 = true
HIRELY_OCR_AUTO = false
HIRELY_V1_NO_ATS_BLOCKERS = true
HIRELY_UNBLOCK_EVERYTHING = true
```

## UI changes

- Format guide shows **4 supported** + **3 unsupported** lists (no OCR/photo in supported).
- File picker `accept` limited to PDF, DOC, DOCX, TXT.
- Paste fallback title: unsupported format → paste (not “image PDF OCR”).
- Hidden: OCR confidence, analysis stages, retry OCR, review-required export banners.
- ATS template badges remain (layout compatibility); **blockers** bypassed in validation modules.

## Module map

| File | Role |
| --- | --- |
| `src/core/import/v1-scope-lock.js` | Scope constants + `isV1ScopeLocked()` |
| `src/core/import/v1-import-constants.js` | Supported/unsupported lists + paste copy |
| `src/ui/product/v1-scope-lock.css` | Hide unsupported-feature UI |
| `src/core/validation/review-before-template-lock.js` | Bypass when V1 ATS blockers off |
| `src/core/validation/product-experience-gate.js` | Bypass low-extraction export blocks |
| `index.html` | Flags, i18n, format guide, file accept |

## Static checks

| Check | Status | Detail |
| --- | --- | --- |
| file:v1-scope-lock-js | PASS | — |
| file:v1-scope-lock-css | PASS | — |
| index:links-v1-css | PASS | — |
| flag:HIRELY_V1_SCOPE_LOCK | PASS | — |
| flag:OCR_DISABLED_V1 | PASS | — |
| flag:OCR_AUTO_off | PASS | — |
| flag:NO_ATS_BLOCKERS | PASS | — |
| const:no-ocr-in-supported | PASS | — |
| const:unsupported-scan | PASS | — |
| ui:format-guide-supported-only | PASS | — |
| ui:format-guide-unsupported-scan | PASS | — |
| ui:file-input-v1-accept | PASS | — |
| ui:paste-honest-copy | PASS | — |
| css:hide-ocr-ui | PASS | — |
| css:hide-review-required-banner | PASS | — |
| gate:review-before-template-bypass | PASS | — |
| gate:product-experience-bypass | PASS | — |
| simple-import:V1_OCR_DISABLED | PASS | — |
| api:isV1ScopeLocked | PASS | — |

## Verification

```bash
npm run v1-scope-lock-report
npm run v1-release-test   # txt, docx, text pdf, paste — must PASS
```

## Out of V1 (do not ship marketing for)

- “Upload any CV including scans”
- “Automatic OCR”
- “Photo / screenshot import”
- “AI rewrite / AI reconstruction”
- “Fix ATS score before export” blocking flows

## Next version (V2+) candidates

- OCR for scanned PDFs
- Image CV pipeline
- ATS quality gates (optional strict mode)
- AI-assisted rewrite (opt-in)
