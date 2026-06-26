# Experience Recovery Fix Report (P0)

**Generated:** 2026-06-13T23:02:32.997Z
**Acceptance:** experience accuracy **≥ 90%** (no fake company)
**Suite:** 50 real-world CVs (HIRELY_REAL_WORLD_STRESS_P0)

## Result

| Metric | Before fix | After fix | Goal | Status |
| --- | --- | --- | --- | --- |
| **Experience accuracy** | 76.9% | **84.4%** | ≥ 90% | FAIL |
| Student role (all formats) | — | **100%** | ≥ 90% | **PASS** |
| Freelancer TXT/DOCX | — | **100%** | ≥ 90% | **PASS** |
| OCR/image formats (scan/PNG/JPG) | — | 78.9% | ≥ 90% | FAIL |
| Overall extraction | 86.4% | 93% | — | — |
| Skills accuracy | 65.8% → 97.8% | — | — | — |

QA gate (95% all dimensions): FAIL (other dimensions)

## Root cause (pre-fix)

1. **No em-dash parser** — `Role — Company — Location — Dates` lines fell through to internship/freelance heuristics or collapsed roles.
2. **Summary false positives** — `parseInternshipLine` matched prose ("seeking a software engineering internship") and invented experiences.
3. **Reconstruction replaced good rows** — `reconstructExperienceEntries` kept segmentation output only and dropped strict-parsed Monzo/freelance rows.
4. **Pipeline text loss** — normalized `cleanedText` dropped experience lines (e.g. Teaching Assistant); recovery never saw original paste text.
5. **Fake placeholders** — universal reconstructor emitted `Role to confirm`; year-only and education fragments became experience.
6. **Role normalization** — `Full Stack Developer` truncated to `Developer`; compound intern titles collapsed to `Internship`.

## Fix summary

| Layer | File | Change |
| --- | --- | --- |
| Dash parser | `classification-fixes.js` | `parseDashSeparatedExperienceLine`; internship/freelance delegate; block summary prose |
| Experience repair | `experience-recovery.js` | `repairExperienceEntries`, `pruneRecoveredExperiences`, sourceText line harvest |
| Parser strict gate | `experience-parser.js` | Dash-first groups; reject year-only / placeholder roles; preserve compound intern titles |
| Reconstruction preserve | `experience-reconstruction-engine.js` | `preserveCompleteInputExperiences` after segmentation |
| Experience intelligence | `experience-intelligence.js` | Dash-aware role/company detect; skip OCR filler when complete rows exist |
| Universal reconstructor | `universal-extraction/experience-reconstructor.js` | No `Role to confirm`; dash parse; academic employment; review queue for role+date |
| Polish pass | `resume-output-quality.js` | `repairExperienceEntries` in `polishResumeOutput` |
| Import source text | `hirely-import.js`, `resume-data.js` | `meta.sourceText` for recovery when pipeline strips lines |
| Auto-accept guard | `suggestion-auto-accept.js` | Internship push requires confidence ≥ 70 + dates; multi-source lines |
| Mapper/repair | `simple-cv-mapper.js`, `import-repair.js` | Dash parser first in legacy harvest paths |

## Routing rules (implemented)

- Experience types: job, internship, freelance, project, volunteer, student project (via dash + strict parsers).
- `Role — Company — Dates` (em-dash) → experience when confidence ≥ 70.
- Role + dates, no company → `reviewQueue` / `experienceReviewItems` (not discarded).
- Reject: year-only role/company, `Role to confirm`, role === company duplicates, summary prose internships.
- No fake company: independent normalized; invented client-only rows stripped.

## Per-CV experience ≥ 90%

| ID | Role | Format | Experience accuracy |
| --- | --- | --- | --- |
| rw-02-designer-pdftext | designer | PDF-text | 100% |
| rw-04-designer-docx | designer | DOCX | 100% |
| rw-06-engineer-txt | engineer | TXT | 100% |
| rw-07-engineer-pdftext | engineer | PDF-text | 100% |
| rw-08-engineer-pdfscan | engineer | PDF-scan | 100% |
| rw-09-engineer-docx | engineer | DOCX | 100% |
| rw-10-engineer-jpg | engineer | JPG | 100% |
| rw-11-marketing-txt | marketing | TXT | 100% |
| rw-12-marketing-pdftext | marketing | PDF-text | 100% |
| rw-13-marketing-pdfscan | marketing | PDF-scan | 100% |
| rw-14-marketing-docx | marketing | DOCX | 100% |
| rw-15-marketing-png | marketing | PNG | 100% |
| rw-16-sales-txt | sales | TXT | 100% |
| rw-18-sales-pdfscan | sales | PDF-scan | 100% |
| rw-19-sales-docx | sales | DOCX | 100% |
| rw-20-sales-jpg | sales | JPG | 100% |
| rw-21-student-txt | student | TXT | 100% |
| rw-22-student-pdftext | student | PDF-text | 100% |
| rw-23-student-pdfscan | student | PDF-scan | 100% |
| rw-24-student-docx | student | DOCX | 100% |
| rw-25-student-png | student | PNG | 100% |
| rw-26-executive-txt | executive | TXT | 100% |
| rw-27-executive-pdftext | executive | PDF-text | 100% |
| rw-28-executive-pdfscan | executive | PDF-scan | 100% |
| rw-29-executive-docx | executive | DOCX | 100% |
| rw-30-executive-jpg | executive | JPG | 100% |
| rw-31-consultant-txt | consultant | TXT | 100% |
| rw-32-consultant-pdftext | consultant | PDF-text | 100% |
| rw-33-consultant-pdfscan | consultant | PDF-scan | 100% |
| rw-35-consultant-png | consultant | PNG | 100% |
| rw-36-creative-director-txt | creative-director | TXT | 100% |
| rw-38-creative-director-pdfscan | creative-director | PDF-scan | 100% |
| rw-39-creative-director-docx | creative-director | DOCX | 100% |
| rw-41-freelancer-txt | freelancer | TXT | 100% |
| rw-44-freelancer-docx | freelancer | DOCX | 100% |
| rw-46-artist-txt | artist | TXT | 100% |
| rw-47-artist-pdftext | artist | PDF-text | 100% |
| rw-48-artist-pdfscan | artist | PDF-scan | 100% |
| rw-49-artist-docx | artist | DOCX | 100% |
| rw-50-artist-png | artist | PNG | 100% |

## Remaining experience failures (< 90%)

| ID | Role | Format | Exp % | Missed (sample) | False positive (sample) |
| --- | --- | --- | --- | --- | --- |
| rw-01-designer-txt | designer | TXT | 22.2% | McCann Paris — Lead Illustrator — 2011 — 2014; Publicis Conseil — Art Director — 2014 — 2016; Havas Paris — Senior Illustrator — 2016 — 2018 | Creative Director — Independent / Freelance — 2023–Present; Illustrator / Designer — Art — 2020–2021 |
| rw-03-designer-pdfscan | designer | PDF-scan | 44.4% | McCann Paris — Lead Illustrator — 2011 — 2014; Havas Paris — Senior Illustrator — 2016 — 2018; BETC — Illustrator / Designer — 2020 — 2021 | Independent Studio Practice Across Editorial, Culture And Sport. — Independent / Freelance — 2023–Present; Illustrator — Delivered key Visual for FMCGand automotive clients. — 2016–2018 |
| rw-05-designer-png | designer | PNG | 0% | — | Freelance Designer — Independent / Freelance — 2011–2011 |
| rw-17-sales-pdftext | sales | PDF-text | 50% | Product Manager — Beta Corp — 2015 — 2019 | — |
| rw-34-consultant-docx | consultant | DOCX | 50% | Senior Consultant — Strategy firm — 2018 – Present | Consultant — Capgemini Invent — 2018–Present |
| rw-37-creative-director-pdftext | creative-director | PDF-text | 22.2% | McCann Paris — Lead Illustrator — 2011 — 2014; Publicis Conseil — Art Director — 2014 — 2016; Havas Paris — Senior Illustrator — 2016 — 2018 | Creative Director — Independent / Freelance — 2023–Present; Illustrator / Designer — Art — 2020–2021 |
| rw-40-creative-director-png | creative-director | PNG | 33.3% | McCann Paris — Lead Illustrator — 2011 — 2014; Havas Paris — Senior Illustrator — 2016 — 2018; BETC — Illustrator / Designer — 2020 — 2021 | Independent Studio Practice Across Editorial, Culture And Sport. — Independent / Freelance — 2023–Present; Illustrator / Designer — Art — 2020–2021 |
| rw-42-freelancer-pdftext | freelancer | PDF-text | 0% | Freelance Designer 2011 — Present | Freelance Designer — Independent / Freelance — 2011–2011 |
| rw-43-freelancer-pdfscan | freelancer | PDF-scan | 0% | — | Freelance Web Developer — Independent / Freelance — 2019–Present; Full Stack Developer — Startup Agency — 2016–2019 |
| rw-45-freelancer-jpg | freelancer | JPG | 0% | — | Freelance Designer — Independent / Freelance — 2011–2011 |

## Verification

```bash
npm run qa:real-world-stress
npm run experience-recovery-report
node -e "import { runHirelyImportFromText } from './src/core/pipeline/hirely-import.js'; ..."
```

## Files touched

- `src/core/parsing/classification-fixes.js`
- `src/core/parsing/experience-recovery.js`
- `src/core/parsing/experience-parser.js`
- `src/core/parsing/experience-reconstruction-engine.js`
- `src/core/parsing/experience-intelligence.js`
- `src/core/parsing/universal-extraction/experience-reconstructor.js`
- `src/core/parsing/resume-output-quality.js`
- `src/core/parsing/simple-cv-mapper.js`
- `src/core/parsing/import-repair.js`
- `src/core/parsing/suggestion-auto-accept.js`
- `src/core/pipeline/hirely-import.js`
- `src/core/resume-data.js`
- `scripts/experience-recovery-fix-report.mjs` (new)
