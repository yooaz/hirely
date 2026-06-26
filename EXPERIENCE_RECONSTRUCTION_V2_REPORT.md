# HIRELY P1 — Experience Reconstruction Engine V2

**Result:** PASS
**Generated:** 2026-06-10T01:01:53.310Z

## Problem

Experience recall was weak on real CVs (especially fragmented OCR): many career lines were dropped or merged incorrectly.

## Solution — `EXPERIENCE_RECONSTRUCTION_ENGINE_V2`

| Input | Output |
|-------|--------|
| Raw text (OCR / paste / PDF) | Maximum experience recovery |

### Recovers

- Date ranges (including space-separated OCR years `2011 2014`)
- Company names (stacked OCR rows + compact single-line rows)
- Freelance careers
- Internships
- Client lists (attached to freelance / stored on structured resume)

### Never discard lines

Lines that cannot be structured automatically are sent to the **review queue** (`field: experiences`, `status: pending`) — not silently dropped.

## Yoaz fragmented OCR benchmark

| Metric | Value |
|--------|-------|
| Experiences recovered | 9 |
| Unknown lines queued | 2 |
| Recall vs 9-job ground truth | 100% |
| Recall goal | ≥ 92% |

## Implementation

| Piece | Location |
|-------|----------|
| V2 engine | `src/core/parsing/experience-reconstruction-engine-v2.js` |
| Compact OCR parser | `parseCompactOcrExperienceLine()` |
| Stacked OCR parser | `parseStackedOcrBlock()` |
| Review routing | `buildReviewItemForLine()` |
| Pipeline hook | `runExperienceReconstructionV2()` in `section-engine-v2.js` |

## QA checks

| Check | Status |
|-------|--------|
| compact_mccann_company | PASS |
| compact_mccann_dates | PASS |
| compact_freelance_company | PASS |
| compact_freelance_start | PASS |
| review_queue_item | PASS |
| engine_id | PASS |
| yoaz_ocr_recovery_count | PASS |
| yoaz_unknown_lines_queued | PASS |
| yoaz_company_freelance | PASS |
| yoaz_company_mccann | PASS |
| yoaz_company_publicis | PASS |
| yoaz_company_havas | PASS |
| yoaz_company_betc | PASS |
| yoaz_company_ddb | PASS |
| yoaz_company_akqa | PASS |
| yoaz_company_yoaz | PASS |
| client_list_recovered | PASS |
| section_engine_v2_wired | PASS |
| section_engine_produces_experiences | PASS |
| recall_goal | PASS |

## Gates

| Command | Status |
|---------|--------|
| `npm run test:experience-reconstruction-v2` | PASS |
| `npm run qa:experience-reconstruction-engine` | PASS |

```bash
npm run test:experience-reconstruction-v2
```