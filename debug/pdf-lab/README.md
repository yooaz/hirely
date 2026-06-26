# PDF Accuracy Lab

Scientific extraction debugger — see exactly where information disappears.

## Open

```bash
npm run lab:pdf
# http://127.0.0.1:3000/debug/pdf-lab/
```

Or with dev server already running: `/debug/pdf-lab/`

## Pipeline trace

1. **Original PDF** — embedded preview
2. **Raw PDF text** — native/OCR extraction + line geometry
3. **Layout blocks** — column-aware reading order
4. **Classified blocks** — type, confidence, dictionary match, validation
5. **Structured JSON** — `structuredResume` from P0 blocks
6. **Final CV** — read-only ATS preview (no export)

## Metrics bar

| Metric | Meaning |
|--------|---------|
| Pages | PDF page count |
| Text blocks | Reading-order layout blocks |
| Columns | Left/right split when multi-column |
| Sections | Detected block types |
| Confidence | Mean block confidence |
| Text loss % | Raw chars not represented in structured output |
| Classif. errors | Review queue + validation corrections + leaks |
| Dropped lines | Raw lines missing from render output |

## Side-by-side

Compares each raw line to structured output: `matched`, `changed`, `dropped`, `missing`, `added`.

## Export

**Export report JSON** — full metrics + stages (without heavy pipeline objects).

## Fixtures

- **Yoaz two-column** — geometry fixture with x/y (readable two-column CV)
