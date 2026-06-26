# Hirely Test Lab — six-file matrix

Canonical fixtures for import → review → template → export.

| File | Purpose |
|------|---------|
| `good.pdf` | Selectable text PDF (generated from `txt.txt`) |
| `bad.pdf` | Corrupt PDF → paste fallback |
| `scan.pdf` | Image-only PDF → paste fallback |
| `docx.docx` | Word document |
| `txt.txt` | Plain text CV |
| `paste.txt` | Paste recovery text |

```bash
npm run qa:hirely-test-matrix
npm run hirely-test-matrix-report   # writes TEST_MATRIX.md
```

`good.pdf`, `scan.pdf`, and `docx.docx` are auto-generated on first run if missing.
