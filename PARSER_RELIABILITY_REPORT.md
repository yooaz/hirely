# PARSER RELIABILITY REPORT

Generated: 2026-06-06T20:39:47.388Z
Scope: HIRELY H2 — extraction → structured CV (generic patterns only)
Fixtures: **12** (TXT, DOCX text, native PDF text, OCR text)

## Verdict

**PASS** — all section precision targets ≥ 90% after sanitize gate.

## Pipeline audited

| Stage | Module(s) | Role |
|-------|-----------|------|
| Raw text | `extract-file`, `pdf-router`, `docx-extract`, `ocr-pipeline` | PDF / DOCX / TXT / OCR ingestion |
| Normalization | `clean`, `line-cleaner`, `ocr-postprocess` | whitespace, OCR repair, contact strip |
| Section detection | `section-fuzzy`, `section-mapper`, `unsorted-section-recovery` | header fuzzy match + block split |
| Entity extraction | `experience-parser`, `education-recovery`, `entity-catalog` | role/company/school/skills/tools |
| Validation | `confidence-gate`, `universal-safety-gate` | confidence + safety |
| Structured CV | `sanitize-resume-display`, `resume-output-quality` | display gate + section polish |

## Aggregate precision (post-sanitize)

| Section | Precision | Recall | FP | FN |
|---------|----------:|-------:|---:|---:|
| Experience | **100%** | 57.1% | 0 | 15 |
| Education | **93.3%** | 82.4% | 1 | 3 |
| Skill | **96.6%** | 78.1% | 2 | 16 |
| Language | **100%** | 100% | 0 | 0 |
| Tool | **100%** | 89.5% | 0 | 4 |
| Client | **95.2%** | 66.7% | 1 | 10 |

## Generic fixes applied (this pass)

1. **Section header bleed** — `section-fuzzy.js` rejects content rows (dates, em-dash job lines) so `Software Engineer — …` is not classified as a `tools` header.
2. **Experience role/company** — `experience-parser.js` prioritizes role markers over title-case employer heuristic; parses `Role — Company — Location — Dates`.
3. **Education without dictionary school** — `education-recovery.js` / `classification-fixes.js` recover `School — Degree — Years` when degree+years present; dedupe keeps raw line fallback.
4. **Unsorted recovery** — `unsorted-section-recovery.js` + post-retention hook in `resume-data.js` re-home skills/tools/languages/education from `unsorted`.
5. **Display gates** — `sanitize-resume-display.js` broadened skill/tool/language patterns; education gate accepts degree+year; blocks freelance lines mis-tagged as education.
6. **Client/tool confusion** — skip client harvest from tool lines (`Google Analytics`, `Meta Ads`); strip employer tokens from clients.
7. **School dictionary** — generic universities added to `schools.json` (MIT, NYU, LSE, Leeds, Sciences Po).

## Top 20 failure cases

| # | Type | Category | Fixture | Item |
|--:|:----:|----------|---------|------|
| 1 | FP | Client false positive | `yoaz-cv` | `AKQA` |
| 2 | FP | Education false positive | `yoaz-pdf-live` | `Créapole — Ic) yoaz27 : creation school management ign fin hie. je — — –` |
| 3 | FP | Skills confusion | `yoaz-pdf-live` | `web design` |
| 4 | FP | Skills confusion | `yoaz-pdf-live` | `Drawing` |
| 5 | FN | Education miss | `creative-cv` | `Créapole — Visual Communication / Product Design` |
| 6 | FN | Client miss | `creative-cv` | `Adobe` |
| 7 | FN | Client miss | `creative-cv` | `McCann` |
| 8 | FN | Client miss | `creative-cv` | `Arte` |
| 9 | FN | Experience miss | `developer-cv` | `Software Engineer — Dropbox — 2015 — 2019` |
| 10 | FN | Experience miss | `docx` | `Product Manager — Beta Corp — 2015 — 2019` |
| 11 | FN | Experience miss | `recruiter-cv` | `Recruiter — Randstad — 2015 — 2019` |
| 12 | FN | Skills confusion | `scanned-pdf` | `Product strategy` |
| 13 | FN | Skills confusion | `scanned-pdf` | `Agile` |
| 14 | FN | Skills confusion | `scanned-pdf` | `SQL` |
| 15 | FN | Skills confusion | `scanned-pdf` | `User research` |
| 16 | FN | Experience miss | `text-pdf` | `Product Manager — Beta Corp — 2015 — 2019` |
| 17 | FN | Experience miss | `two-column-cv` | `Product Manager — Beta Corp — 2015 — 2019` |
| 18 | FN | Education miss | `two-column-cv` | `HEC Paris — MBA — 2018` |
| 19 | FN | Experience miss | `yoaz-cv` | `Freelance — Senior Art Director — 2018 — 2020` |
| 20 | FN | Experience miss | `yoaz-cv` | `DDB Paris — Visual Designer — 2021 — 2022` |

### Failure themes

- **OCR live PDF (`yoaz-pdf-live`)** — largest FN cluster: experience rows, creative skills, tools, clients buried in OCR noise.
- **Experience recall** — second jobs sometimes parsed but collapsed by fuzzy section matcher when roles share tokens + overlapping years.
- **Creative education** — program lines without explicit degree tokens (Créapole visual communication) still missed.
- **Client recall** — brand dictionary matches clients mentioned only in prose, not extracted as list items.
- **OCR skills block (`scanned-pdf`)** — skills section lost when headers are corrupted; items stay in `unsorted`.

## Residual gaps (not CV-specific)

- Improve OCR section header recovery before sanitize (scanned PDFs).
- Tighten creative client extraction without harvesting agencies from experience employers.
- Section accuracy matcher: avoid collapsing distinct jobs with same role title + adjacent years.
- MBA single-year lines (`HEC Paris — MBA — 2018`) need one-year program date parser.

## Verification

```bash
npm run stress:sections
npm run test:yoaz-pdf-regression
npm run parser:reliability
```
