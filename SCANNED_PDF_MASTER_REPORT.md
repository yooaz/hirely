# Scanned PDF Master (P2)

**Status:** PASS  
**Generated:** 2026-06-11T08:50:16.254Z  
**Experience recall goal:** 85%  
**QA checks:** 17/17

## Problem

OCR extracts text from scanned PDFs, but **structure disappears** — jobs, schools, and skills lose their section context when the OCR stream order is wrong or lines are fragmented.

## Solution — OCR_STRUCTURE_RECOVERY

**Module:** `src/core/parsing/ocr-structure-recovery/`

| Signal | Purpose |
|--------|---------|
| **Year clustering** | Anchor experience blocks by date ranges; sort by latest year (never trust OCR order) |
| **Spacing** | Blank-line and y-gap breaks between logical records |
| **Line grouping** | Merge company + role + year-only stacks into single experience units |
| **Semantic grouping** | Bucket groups into profile / experience / education / skills / languages / clients |

**Rule:** Never trust OCR order — rebuild canonical sections before classification.

### Pipeline

```
OCR text → postProcessOcrText → OCR_STRUCTURE_RECOVERY → SECTION_ENGINE_V2 → structured resume
```

**Hook:** `section-engine-v2.js` — runs when `extractionMethod` is OCR or text looks like OCR.

### Files

| File | Role |
|------|------|
| `year-cluster.js` | Extract years, year-only lines, sort experience by cluster |
| `line-grouper.js` | Split merged headers, group company/role/year stacks |
| `semantic-grouper.js` | Section buckets (order-agnostic) |
| `section-rebuilder.js` | Emit canonical section text for parser |
| `index.js` | `runOcrStructureRecovery` orchestrator |

## Acceptance

| Fixture | Target |
|---------|--------|
| Yoaz OCR fragmented | 9/9 experience labels (100% recall) |
| Scanned PDF (Marie Dupont) | ≥1 experience row |
| Release scanned OCR sim | Freelance illustrator recovered |
| **Overall** | **Experience recall ≥ 85%** |

## Results

| Corpus | Recall | Experience rows |
|--------|--------|-----------------|
| Yoaz OCR | 100% | 34 |
| Scanned fixture | 100% | 5 |
| Release scanned | 100% | 7 |

## QA

```bash
npm run qa:scanned-pdf-master
npm run qa:site-extraction-fixes
npm run scanned-pdf-master-report
```

## Check results

- [x] **year_anchor_range** — 
- [x] **year_only_line** — 
- [x] **year_only_present** — 
- [x] **line_group_experience_stack** — 
- [x] **recovery_engine** — 
- [x] **never_trust_ocr_order** — 
- [x] **recovery_rebuilds_sections** — 
- [x] **yoaz_ocr_recovery_applied** — 8
- [x] **yoaz_ocr_section_engine_wired** — 
- [x] **yoaz_ocr_experience_recall** — 100% (9/9)
- [x] **scanned_fixture_recovery_applied** — 1
- [x] **scanned_fixture_section_engine_wired** — 
- [x] **scanned_fixture_experience_recall** — 100% (1/1)
- [x] **release_scanned_recovery_applied** — 1
- [x] **release_scanned_section_engine_wired** — 
- [x] **release_scanned_experience_recall** — 100% (1/1)
- [x] **overall_recall_goal** — 100%
