# Yoaz PDF parsing benchmark

Permanent regression fixture for **cv. Yohann azancot.pdf** — a two-page creative CV (sidebar + main column on page 1, portfolio grid on page 2).

| File | Role |
|------|------|
| `document.pdf` | Binary source (2 pages, image/scanned layout). Canonical filename: `cv. Yohann azancot.pdf`. |
| `fixture-page1.txt` | Page-1 OCR reference text (contact, profile, experience, education). |
| `fixture-page2.txt` | Page-2 portfolio captions (must not pollute structured sections). |
| `fixture.txt` | Full document text used for deterministic Node parsing tests. |
| `page1-lines.json` | Positioned line coordinates for layout detection QA (`npm run qa:page-layout-yoaz`). |

Golden expectations: `tests/golden/yoaz-pdf-benchmark.expected.json`  
**Target regression (mandatory):** `tests/golden/yoaz-pdf-target.expected.json`  
**Target snapshot:** `tests/golden/yoaz-pdf-normalized.target.snapshot.json`

| Command | Purpose |
|---------|---------|
| `npm run qa:yoaz-pdf-regression` | Hard regression — target + hard failures + purity (expect FAIL until fixed) |
| `npm run golden:yoaz-pdf` | Production flat-text path (`fixture.txt`) |
| `npm run qa:page-layout-yoaz` | Page layout detection |
| `npm run qa:cv-parse-benchmark` | Block-parser metrics suite |

**Layout contract (page 1):** sidebar (x &lt; 280) = contact, profile, languages; main column (x ≥ 300) = experience, education, skills, interests. Page 2 = portfolio only.
