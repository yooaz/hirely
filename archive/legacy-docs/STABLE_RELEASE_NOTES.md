# Hirely — Stable Release Notes

**Status:** Stable (QA locked)  
**Date:** 2026-05-21  
**Canonical app:** `index.html` + `cv-templates.js` + `cv-templates-premium.css`

This build is frozen for launch. Do not add features or redesign from this baseline without a new QA pass.

---

## What works

### Core flow (every time, text ≥ 20 characters)

1. **Import** — sample, paste, TXT, or PDF (when readable)
2. **Recruiter score** — ring + ATS, Readability, Impact, Completeness, Clarity (35–92)
3. **CV preview** — centered A4, selected template
4. **Template picker** — 20 templates, icon + name + category + ATS badge
5. **Export** — Download PDF + Export TXT (after workspace is ready)

Pipeline:

```
rawText → cleanText → parseCV() → cvData → scoreCV() → renderCV()
```

`forceCvDataFromText()` guarantees `cvData` is never null when enough text exists.

### Verified automatically

| Check | Command |
|--------|---------|
| Smoke + templates | `npm run qa:smoke` |
| Sample, paste, TXT, score clamp | `npm run qa:core-flow` |
| Extraction helpers | `npm run qa:extraction` |
| Browser E2E | `npm run qa:browser` (server on :3456) |

Browser checklist (`npm run qa:browser` on :3456, `?pro=true`): sample, paste, TXT upload, template switch + active state, PDF button visible, PDF unreadable fallback, no blank UI, language switch, no JS errors.

### User-facing copy only

- Before: **Import your CV**
- During: **Reading CV…** → **Analyzing profile…** → **Generating recruiter-ready CV…**
- After: **CV imported**
- PDF fail: **We could not read this PDF. Paste the CV text or upload TXT/DOCX.**

Technical UI (parse feed, field audit, confidence %, extraction flow) is hidden.

### Workspace after import

Single column: score → templates → CV preview → export. Hero and pricing hidden. Compact import tools at bottom.

### i18n

FR, EN, NL, DE, ES, IT via `data-i` + locale packs.

---

## Intentional fallbacks

| Situation | Behavior |
|-----------|----------|
| Imperfect parse | `buildFallbackCvDataFromText()` fills summary, experience lines, skills from raw text |
| Partial sections only | CV still renders; empty sections hidden in templates |
| PDF unreadable | Paste / TXT message; raw text editor opens; no blank screen |
| Scanned PDF / image | Paste fallback (no OCR in stable build) |
| Low parser confidence | **Never blocks** generation or score |
| Premium templates | Require Pro unlock (or `?pro=true` on localhost) |
| Free tier | **Minimal Serif** (`ats`) template + full import/audit flow |

---

## Known limitations

1. **Pro gate** — PDF export and premium templates need **Unlock Pro** (pricing) or `http://127.0.0.1:3456/?pro=true` on localhost.
2. **PDF extraction** — Depends on pdf.js; complex layouts may need manual paste.
3. **DOCX** — Requires mammoth CDN; offline = paste text.
4. **PDF export** — Uses html2pdf.js in browser; very long CVs may need spacing “Compact”.
5. **Score** — Recruiter-style heuristic (35–92), not a human review.
6. **Audit tab** — Detailed dimension reasons can mention internal labels; main import UI stays clean.
7. **Do not use** — `public/lib/hirely-*.js`, `app.js`, AXIS paths (not part of this stable app).

---

## How to run (local)

```bash
cd hirely_FINAL_CURSOR_STABLE_UI
python3 -m http.server 3456
```

Open: **http://127.0.0.1:3456/**

Optional Pro on localhost: **http://127.0.0.1:3456/?pro=true**

Do **not** open `index.html` as `file://` (CDN scripts and paths expect HTTP).

---

## Manual QA checklist

Automated (see commands above):

- [x] Use sample → score, CV, templates, export bar
- [x] Paste text → score + CV
- [x] Upload `.txt` → score + CV
- [x] Upload bad PDF → paste fallback, no crash / blank UI
- [x] Switch template → active highlight + preview class changes

Manual only (one minute in browser):

- [ ] Upload a **readable** PDF → score + CV
- [ ] **Download PDF** → file exports **only** `#cvDoc` area, correct template styling
- [ ] Switch language → UI strings update, no mix

---

## Next improvements (post-stable, not in this lock)

- Production auth/billing for Pro (replace unlock button)
- Server-side PDF generation for pixel-perfect output
- Optional OCR for scanned PDFs
- Hosted deploy (Vercel/Render) with env config
- Remove dead CSS/DOM for legacy extraction UI
- E2E test for real PDF export file size

---

## Critical fixes in this stable line

1. **`templateAtsLabel` parameter shadowed i18n `t()`** — caused `t is not a function` and a broken page. Parameter renamed to `tpl`.
2. **Empty preview with text present** — `forceCvDataFromText()` now falls back to raw text when cleaning strips too much, never returns without renderable data when input ≥ 20 chars, and `ingestCvText()` always sets `cvData` + score + workspace (no confidence gate).
3. **PDF fail** — clears loading, shows paste message, opens editor; no blank screen.

---

*End of stable lock. No further changes unless a checklist item fails.*
