# Extraction test fixtures

Drop real files into each folder to test binary extraction in the browser. **CI uses `fixture.txt`** in each folder so `npm run test:extract` runs without PDF/DOCX binaries.

## Folders

| Folder | Drop-in file(s) | Expected method |
|--------|-----------------|-----------------|
| `text-pdf/` | `document.pdf` (selectable text) | `pdf-text` |
| `scanned-pdf/` | `document.pdf` (image-only scan) | `pdf-ocr` |
| `docx/` | `document.docx` | `docx` |
| `image-cv/` | `document.png` or `.jpg` | `image-ocr` |
| `two-column-cv/` | `document.pdf` (sidebar layout) | `pdf-text` |
| `creative-cv/` | any of PDF/DOCX/TXT | varies |
| `marketing-cv/` | `document.txt` | `paste` |
| `recruiter-cv/` | `document.txt` | `paste` |

## Adding a real file

1. Read `FIXTURE.md` in the folder for constraints.
2. Add the binary as `document.pdf`, `document.docx`, or `document.png`.
3. Optionally update `fixture.txt` from a one-time paste of extracted raw text (ground truth).
4. Run `npm run test:extract`.

## Quality gate

See `tests/run-extract.mjs`. **FAIL** blocks release; fix extraction/parsing before UI work.
