# Universal CV Extraction Engine

**Status:** PASS  
**Generated:** 2026-06-11T08:33:49.624Z  
**Experience recall goal:** 90%  
**QA checks:** 21/21

## Problem

Text extraction works, but structure recovery was weak — experiences, dates, companies, skills, tools, languages, and projects were lost before classification.

## Solution — 5 phases

### Phase 1 — CV_BLOCK_ENGINE (before classification)

Detects structural blocks using **position, spacing, capitalization, bullet density, date density** — not keywords only.

| Block type |
|------------|
| IDENTITY · SUMMARY · EXPERIENCE · EDUCATION · SKILLS · TOOLS · LANGUAGES · CLIENTS · PROJECTS · CERTIFICATIONS |

**Module:** `src/core/parsing/universal-extraction/cv-block-engine.js`  
**Hook:** `section-detect-v2.js` — runs after `BLOCK_BUILDER_V1`, before semantic classification.

### Phase 2 — Date detector

Formats: `2018-2020`, `2018 → Present`, `Jan 2020`, `06/2019`, standalone years, OCR repair (`2O18`).

**Module:** `universal-extraction/date-detector.js`

### Phase 3 — Company detector

Context-based proper-noun detection — **no hardcoded brand lists**. Handles Nike, Adobe, Google, Meta, Freelance, agency suffixes.

**Module:** `universal-extraction/company-detector.js`

### Phase 4 — Role detector

Recovers titles from noisy OCR (Graphic Designer, Art Director, Frontend Developer, etc.).

**Module:** `universal-extraction/role-detector.js`

### Phase 5 — Reconstruction

When **role + company + date** (any 2 of 3) → create experience. **Never discard** — low confidence → review queue.

**Module:** `universal-extraction/experience-reconstructor.js`  
**Hook:** `section-engine-v2.js` — after experience reconstruction V2.

## Pipeline isolation

| Layer | Touched? |
|-------|----------|
| Import / OCR | No |
| `finalResumeData` contract | No |
| `buildResumeData` | No |
| Section detect + engine | Yes (render path only) |

## Metrics

| Fixture | Expected | Recovered | Recall |
|---------|----------|-----------|--------|
| Labeled creative CV | 4 | 4 hits | 100% |
| Yoaz OCR fragmented | 9 | 18 | 100% |

## Acceptance checklist

- [x] date_range_hyphen
- [x] date_arrow_present
- [x] date_month_range
- [x] date_slash_month
- [x] date_ocr_repair
- [x] company_nike
- [x] company_freelance
- [x] company_google
- [x] role_graphic_designer
- [x] role_frontend
- [x] role_art_director
- [x] block_engine_id
- [x] block_count — blocks=16
- [x] block_types_detected
- [x] reconstruction_count — count=6
- [x] labeled_recall — 100%
- [x] section_engine_block_wired
- [x] section_engine_recon_wired
- [x] section_engine_experiences
- [x] yoaz_ocr_recovery — count=18
- [x] yoaz_recall — 100%

## Commands

```bash
npm run qa:universal-extraction-engine
npm run universal-extraction-engine-report
```
