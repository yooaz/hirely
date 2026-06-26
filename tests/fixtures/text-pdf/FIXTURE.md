# text-pdf

**Purpose:** PDF with a normal text layer (not a scan).

## Add this file

- `document.pdf` — exported from Word/Google Docs, selectable text, 1–2 pages, includes Experience + Education + Skills.

## Expected extraction

- Method: `pdf-text`
- Must **not** trigger OCR.

## CI

`fixture.txt` is the ground-truth raw text used when `document.pdf` is absent.
