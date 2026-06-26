# Hirely RC1 — Start here

**Release:** RC1 (`HIRELY_RC1_READY=true`)  
**Scope:** Import → Review → Template → Export PDF (V1, stability release)

---

## 1. How to run locally

Hirely is a static web app. Vendor libraries (PDF.js, JSZip, etc.) are loaded from `node_modules` at runtime, so you need **install + a local HTTP server** (do not open `index.html` as a `file://` URL).

```bash
# 1. Unzip and enter the folder
unzip HIRELY_RC1_RELEASE.zip
cd hirely-rc1   # or your unzip folder name

# 2. Install dependencies (required for PDF/DOCX in the browser)
npm install

# 3. Serve the project root (must expose /node_modules)
npx --yes serve -l 4173 .

# 4. Open in browser
open http://localhost:4173/index.html
```

**Alternative (Python):**

```bash
python3 -m http.server 4173
# → http://localhost:4173/index.html
```

**Quick core check (no browser):**

```bash
npm run test:core-boot
```

---

## 2. What V1 supports

| Input | Behavior |
|-------|----------|
| **TXT** | Direct import → review → template → PDF export |
| **DOCX** | Word Open XML via native parser |
| **Text PDF** | PDF with a selectable text layer (PDF.js, no OCR) |
| **Pasted text** | Paste panel — first-class path |
| **Scanned / image PDF** | **Paste fallback** — user pastes CV text (no automatic OCR) |

| Product step | RC1 |
|--------------|-----|
| Review | Edit and complete extracted sections |
| Templates | Premium template gallery + live preview |
| Export | Download PDF from preview |

Runtime flags (set in `index.html`): `HIRELY_V1_SCOPE_LOCK`, `HIRELY_OCR_DISABLED_V1`, `HIRELY_RC1_READY`.

See `V1_SCOPE_LOCK.md` for the frozen scope definition.

---

## 3. What V1 does not support

| Not supported | What happens instead |
|---------------|----------------------|
| **Automatic OCR** | Disabled — `HIRELY_OCR_AUTO=false` |
| **Scanned PDF auto-read** | Paste fallback with clear copy |
| **Photo / screenshot CV** | Rejected at extraction → paste |
| **Protected / unreadable PDF** | Paste or try DOCX/TXT |
| **AI rewrite / reconstruction** | Off in V1 import path |
| **ATS score blocking export** | Informational only — does not block template or PDF |
| **LinkedIn merge** | Hidden in production UI (debug only) |

Do **not** market V1 as “upload any scan” or “automatic OCR.”

---

## 4. How to test import / export

### Manual (browser)

1. Start the server (section 1).
2. **Import:** drop `tests/fixtures/hirely-test-lab/txt.txt`, `docx.docx`, or `good.pdf`.
3. **Paste:** drop `scan.pdf` → paste panel → paste text from `paste.txt` → **Continuer**.
4. **Review:** complete name, contact, experience; confirm preview updates.
5. **Template:** choose a template; preview should refresh.
6. **Export:** open Export step → **Télécharger le PDF**; file should download.

### Automated smoke (Playwright)

```bash
npm install   # includes playwright
npx playwright install chromium

npm run test:core-boot      # engine loads
npm run v1-smoke-test       # TXT, DOCX, text PDF, paste, scanned→paste
npm run v1-release-test     # RC1 browser gate (writes report when run from dev tree)
npm run user-flow-cleanup-audit   # visible UI checks on main flow
```

Fixtures live in `tests/fixtures/hirely-test-lab/` (`good.pdf`, `docx.docx`, `txt.txt`, `paste.txt`, `scan.pdf`).

### Expected results

- **TXT / DOCX / text PDF / paste:** reach Review with Style and Export unlocked.
- **Scanned PDF:** paste panel within a few seconds; after paste, same as above.
- **Export:** PDF downloads; preview matches export step.

Ship evidence summary: `RC1_REPORT.md`.

---

## Contents

Full file manifest: `RELEASE_CONTENTS.md`.
