# Parser validation mode

**OCR development is frozen.** Prove pasted clean text works before touching PDF/OCR again.

## Flow

```
Paste CV text (fixture.txt)
    ↓
Parse (runExtractionPipeline, method=paste)
    ↓
Generate CV preview (formatCvAsStructuredText + cvDataIsRenderable)
    ↓
Choose template (registry smoke check — no template edits)
    ↓
Export PDF (optional browser test)
```

No OCR. No PDF upload extraction in this mode.

## Parser Lab (interactive)

Hidden UI at **`/parser-lab/`** — paste-only, live parser truth test:

- Left: raw text
- Center: every parser decision + `structuredResume` JSON
- Right: rendered CV (existing ATS template, unchanged)
- **OCR Forensic** in app: `?debug=forensic` — fullscreen pipeline (RAW EXTRACTION → CLEANED → CLASSIFIED LINES → JSON → RENDERED), word diff, rejected/modified lines. Parser lab: [parser-lab/index.html](../parser-lab/index.html). CLI: `node tests/ocr-forensic.mjs`

```bash
python3 -m http.server 3456
# open http://127.0.0.1:3456/parser-lab/
```

## Commands

```bash
# Required — parser + preview text (Node)
npm run validate:parser

# Optional — live DOM preview + html2pdf (needs dev server on :3456)
python3 -m http.server 3456
npm run validate:parser:browser
```

## Fixtures (clean text)

| Profile       | Path                              |
|---------------|-----------------------------------|
| Designer CV   | `tests/fixtures/creative-cv/`     |
| Developer CV  | `tests/fixtures/developer-cv/`    |
| Consultant CV | `tests/fixtures/consultant-cv/`   |
| Student CV    | `tests/fixtures/student-cv/`      |

## Acceptance (each profile)

- Name detected (no `Name to confirm`, no ` · ` candidate list)
- Title detected
- Email detected
- Phone detected (when present in fixture)
- Experience detected
- Education detected (no languages/tools mixed in)
- Skills / tools / languages separated
- Clients separated (designer fixture)
- No OCR garbage in structured output
- CV preview text not empty
- `canGenerate` true

Browser pass additionally checks:

- Live `#cvDoc` preview not empty
- Contact fields via `window.HirelyParse.lastResult.cvData` (set after each `applyCvPipeline`)
- Extraction method is not `pdf-ocr`
- PDF blob export via html2pdf

## Resume OCR / PDF extraction when

```bash
npm run validate:parser
# → OK all 4 clean-text profiles passed clean-text validation
```
