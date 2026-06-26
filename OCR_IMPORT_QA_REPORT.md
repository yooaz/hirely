# OCR Import QA Matrix

**Status:** PASS
**Generated:** 2026-06-16T09:17:40.222Z

## Expected behaviour

| Input | Import path | Downstream |
|-------|-------------|------------|
| Text PDF, DOCX, TXT, paste | Native / text extract | Direct Review → Style → Export |
| Scanned / flattened PDF | OCR (≤20s) | Review if text readable |
| Unreadable image PDF | OCR attempt | Calm paste panel → paste recovery |

## Progress copy (OCR)

- Lecture du PDF…
- Reconnaissance du texte…
- Création du CV…

## Paste fallback copy

- **Title:** Ce PDF est une image
- **Message:** Nous n’avons pas pu lire assez de texte automatiquement. Collez le texte du CV ci-dessous pour continuer.
- **Button:** Créer mon CV avec ce texte

## Matrix

| Case | File | Import | Review | Preview | Style | Export | Row | Path |
|------|------|--------|--------|---------|-------|--------|-----|------|
| Text PDF | `good.pdf` | PASS | PASS | PASS | PASS | PASS | PASS | direct |
| Illustrator flattened PDF | `illustrator-flat.pdf` | PASS | PASS | PASS | PASS | PASS | PASS | ocr |
| Scanned PDF | `scan.pdf` | PASS | PASS | PASS | PASS | PASS | PASS | ocr |
| Image-only PDF (unreadable) | `image-only.pdf` | PASS | PASS | PASS | PASS | PASS | PASS | paste_panel→paste |
| DOCX | `docx.docx` | PASS | PASS | PASS | PASS | PASS | PASS | direct |
| TXT | `txt.txt` | PASS | PASS | PASS | PASS | PASS | PASS | direct |
| Paste text | `paste.txt` | PASS | PASS | PASS | PASS | PASS | PASS | paste_input |

## Checks

| Check | Result | Detail |
|-------|--------|--------|
| vendor_assets | PASS | ok |
| ocr_enabled | PASS | true |
| direct_review_paths | PASS | 4/4 |
| ocr_review_paths | PASS | 2/2 |
| unreadable_paste_path | PASS | paste_panel→paste |
| calm_paste_panel | PASS | Ce PDF est une image |

## Detail

| Case | ms | cvLen | docStep | Paste | Note |
|------|-----|-------|---------|-------|------|
| Text PDF | 1365 | 400 | edit | no | direct → Review → Style → Export |
| Illustrator flattened PDF | 2007 | 425 | edit | no | ocr → Review → Style → Export |
| Scanned PDF | 2075 | 425 | edit | no | ocr → Review → Style → Export |
| Image-only PDF (unreadable) | 467 | 431 | edit | no | paste_panel→paste → Review → Style → Export |
| DOCX | 179 | 609 | edit | no | direct → Review → Style → Export |
| TXT | 159 | 609 | edit | no | direct → Review → Style → Export |
| Paste text | 1089 | 431 | edit | no | paste_input → Review → Style → Export |

## Re-run

```bash
npm run ocr-import-qa-report
```

Raw JSON: `tests/output/ocr-import-qa/report.json`
